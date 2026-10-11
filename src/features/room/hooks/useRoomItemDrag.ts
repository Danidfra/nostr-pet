/**
 * Dragging an item from the dock into the room: Ditto's `useRoomDrag`, for
 * items only, with the ways a drag must end that Ditto's never needed.
 *
 * A press on an item starts a session; window listeners own it from there
 * (so the strip can re-render or scroll underneath). Past a few pixels it
 * LIFTS: a ghost follows the pointer, positioned by direct DOM writes, so
 * React renders only on lift and on end, never per move. Letting go calls
 * `onDrop` with the screen point; a press that never lifted is a tap
 * (`onTap`), which only selects: nothing here ever uses an item.
 *
 * Touch: the strip scrolls sideways under a finger (`touch-action: pan-x`
 * on its tiles), and the browser cancels the pointer when it takes over the
 * pan; only a mostly upward or downward move lifts an item, so scrolling
 * the strip never drags. A mouse lifts in any direction.
 *
 * Ends without a drop: pointercancel, the window losing focus, Escape, and
 * `cancel()` (the caller's: a room switch, the item gone or no longer
 * usable, the inventory unavailable, decorating).
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Movement (px) before a press becomes a drag. */
export const DRAG_SLOP = 8;

export interface RoomItemDragSession {
  /** What is being dragged (the entry's key). */
  key: string;
  /** Lifted past the slop: the ghost is showing. */
  lifted: boolean;
}

export interface UseRoomItemDragOptions {
  onDrop: (key: string, clientX: number, clientY: number) => void;
  onTap?: (key: string) => void;
  /** The pointer moved while lifted; null when the drag ends however it ends. */
  onHover?: (key: string, point: { x: number; y: number } | null) => void;
}

export function useRoomItemDrag(options: UseRoomItemDragOptions) {
  const [session, setSession] = useState<RoomItemDragSession | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const cleanupRef = useRef<(() => void) | null>(null);
  /** The press in progress, read by `finish` to tell a lifted drag from a press. */
  const activeRef = useRef<RoomItemDragSession | null>(null);

  /** Tear down the listeners and the ghost; returns the press that was in progress. */
  const finish = useCallback((): RoomItemDragSession | null => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    const ended = activeRef.current;
    activeRef.current = null;
    if (ghostRef.current) ghostRef.current.style.display = 'none';
    setSession(null);
    return ended;
  }, []);

  /** End a drag without a drop (nothing is used). */
  const cancel = useCallback(() => {
    const ended = finish();
    if (ended?.lifted) optionsRef.current.onHover?.(ended.key, null);
  }, [finish]);

  const start = useCallback(
    (e: ReactPointerEvent, key: string) => {
      if (!e.isPrimary || e.button > 0) return;
      cancel();
      const pid = e.pointerId;
      const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      const startX = e.clientX;
      const startY = e.clientY;
      let lifted = false;
      activeRef.current = { key, lifted: false };
      setSession({ key, lifted: false });

      const place = (x: number, y: number) => {
        const ghost = ghostRef.current;
        if (!ghost) return;
        ghost.style.display = '';
        ghost.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -60%)`;
      };
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        if (!lifted) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (Math.hypot(dx, dy) < DRAG_SLOP) return;
          // A finger moving sideways is scrolling the strip, not carrying the item
          if (touch && Math.abs(dy) < Math.abs(dx)) {
            cancel();
            return;
          }
          lifted = true;
          activeRef.current = { key, lifted: true };
          setSession({ key, lifted: true });
        }
        ev.preventDefault();
        place(ev.clientX, ev.clientY);
        optionsRef.current.onHover?.(key, { x: ev.clientX, y: ev.clientY });
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        const wasLifted = lifted;
        finish();
        if (wasLifted) {
          // A drag let go over its own tile is not also a click on it
          const swallow = (c: MouseEvent) => {
            c.stopPropagation();
            c.preventDefault();
          };
          window.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
          optionsRef.current.onHover?.(key, null);
          optionsRef.current.onDrop(key, ev.clientX, ev.clientY);
        } else {
          optionsRef.current.onTap?.(key);
        }
      };
      const abort = (ev: Event) => {
        if (ev instanceof PointerEvent && ev.pointerId !== pid) return;
        cancel();
      };
      const key_ = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') cancel();
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', abort);
      window.addEventListener('blur', abort);
      window.addEventListener('keydown', key_);
      cleanupRef.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', abort);
        window.removeEventListener('blur', abort);
        window.removeEventListener('keydown', key_);
      };
    },
    [cancel, finish],
  );

  // Unmounting mid-drag leaves no listener behind
  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  return { session, ghostRef, start, cancel };
}

export type RoomItemDrag = ReturnType<typeof useRoomItemDrag>;
