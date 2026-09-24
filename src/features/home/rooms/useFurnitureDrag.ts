/**
 * Dragging a piece of furniture: one engine, pointer events only.
 *
 *  - the piece captures the pointer on down, so a fast finger never loses it;
 *  - moves update a ref and paint the element directly, at most once per
 *    frame; React renders nothing until the pointer is up;
 *  - the drop converts the pointer through the canvas box to a room point
 *    with the grab offset kept, and the caller clamps it in room units;
 *  - Escape (or a cancelled pointer) puts the piece back where it was.
 *
 * Ditto has two drag engines, one re-rendering the page per move; this is
 * the single one the audit asked for.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { roomFromViewport, type RoomPoint } from '../space/room-space';

export interface DragSession {
  index: number;
  pointerId: number;
  /** Where the anchor was when the drag began (room units). */
  origin: RoomPoint;
  /** Pointer − anchor at the start, so the piece does not jump under the finger. */
  grab: RoomPoint;
  element: HTMLElement;
}

export interface UseFurnitureDragOptions {
  canvasRef: RefObject<HTMLDivElement | null>;
  /** The anchor a piece has now (room units), so the grab offset can be computed. */
  anchorOf: (index: number) => RoomPoint | undefined;
  /** The legal anchor for a raw one (clamping), so the ghost never leaves the room while moving. */
  clamp: (index: number, point: RoomPoint) => RoomPoint;
  /** The drop: commit this anchor. */
  onDrop: (index: number, point: RoomPoint) => void;
  enabled: boolean;
}

/** Minimum movement before a press counts as a drag, so a tap still selects. */
export const DRAG_SLOP_PX = 4;

export function useFurnitureDrag({ canvasRef, anchorOf, clamp, onDrop, enabled }: UseFurnitureDragOptions) {
  const sessionRef = useRef<DragSession | null>(null);
  const latestRef = useRef<RoomPoint | null>(null);
  const movedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const startPxRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const opts = useRef({ anchorOf, clamp, onDrop });
  opts.current = { anchorOf, clamp, onDrop };

  const paint = useCallback((session: DragSession, point: RoomPoint) => {
    session.element.style.left = `${(point.x * 100).toFixed(3)}%`;
    session.element.style.top = `${(point.y * 100).toFixed(3)}%`;
  }, []);

  const end = useCallback(
    (commit: boolean) => {
      const session = sessionRef.current;
      if (!session) return;
      sessionRef.current = null;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      try {
        session.element.releasePointerCapture?.(session.pointerId);
      } catch {
        /* already released */
      }
      const dropped = latestRef.current;
      latestRef.current = null;
      setDragging(null);
      if (commit && dropped && movedRef.current) opts.current.onDrop(session.index, dropped);
      else paint(session, session.origin);
      movedRef.current = false;
    },
    [paint],
  );

  const onPointerDown = useCallback(
    (index: number, event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      const canvas = canvasRef.current;
      const anchor = opts.current.anchorOf(index);
      const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('.furniture-anchor');
      if (!canvas || !anchor || !element) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const pointer = roomFromViewport({ x: event.clientX, y: event.clientY }, rect);
      sessionRef.current = { index, pointerId: event.pointerId, origin: anchor, grab: { x: pointer.x - anchor.x, y: pointer.y - anchor.y }, element };
      startPxRef.current = { x: event.clientX, y: event.clientY };
      movedRef.current = false;
      try {
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      } catch {
        /* capture is a nicety */
      }
      setDragging(index);
    },
    [enabled, canvasRef],
  );

  // Move, up and cancel are window listeners for the length of one session:
  // the pointer may leave the piece, the canvas, or the window.
  useEffect(() => {
    if (dragging === null) return;
    const onMove = (event: PointerEvent) => {
      const session = sessionRef.current;
      const canvas = canvasRef.current;
      if (!session || event.pointerId !== session.pointerId || !canvas) return;
      const start = startPxRef.current;
      if (start && !movedRef.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_SLOP_PX) return;
      movedRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const pointer = roomFromViewport({ x: event.clientX, y: event.clientY }, rect);
      latestRef.current = opts.current.clamp(session.index, { x: pointer.x - session.grab.x, y: pointer.y - session.grab.y });
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          const s = sessionRef.current;
          if (s && latestRef.current) paint(s, latestRef.current);
        });
      }
    };
    const onUp = (event: PointerEvent) => {
      if (sessionRef.current && event.pointerId === sessionRef.current.pointerId) end(true);
    };
    const onCancel = (event: PointerEvent) => {
      if (sessionRef.current && event.pointerId === sessionRef.current.pointerId) end(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragging, canvasRef, paint, end]);

  useEffect(() => () => end(false), [end]);

  return { onPointerDown, dragging, /** True once the pointer moved past the slop: the following click is not a tap. */ consumedTap: () => movedRef.current };
}
