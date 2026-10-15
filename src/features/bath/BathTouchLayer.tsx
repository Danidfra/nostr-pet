/**
 * The surface the player rubs during a care ritual. Laid over the Blobbi's
 * art box (the 2D home's actor, the room's overlay on its feet), a little
 * larger than it (`HIT_PAD_PX` all round, so a small Blobbi is still easy to
 * reach and a stroke may start beside it), it takes every pointer (touch,
 * mouse, pen: one pointer at a time, captured so a finger that slides off a
 * little keeps rubbing) and hands it to the session in BOX coordinates (the
 * art box's, not the padded surface's: x across, y up; beyond [0, 1] outside
 * it). It measures the box on screen for the rules measured in px. It
 * draws nothing itself: the drawing is `BathEffects2D`, laid in the box as
 * its child when `draw` is on (off when the 3D model draws the ritual).
 *
 * The keyboard: with the layer focused, the arrow keys carry the tool a
 * cell at a time (pressing it down as they go), Space lifts it.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { BATH_RULES, isHandStage, type BathPoint } from './bath-machine';
import type { BathInput, BathView } from './useBathSession';
import { BathEffects2D } from './BathEffects2D';
import './bath.css';

interface BathTouchLayerProps {
  view: BathView;
  input: BathInput;
  /** Draw the ritual here (off when the 3D model draws it). */
  draw?: boolean;
  reducedMotion: boolean;
  /** The Blobbi's name, for the layer's accessible name. */
  name: string;
  className?: string;
  style?: CSSProperties;
}

/** How far beyond the art box the surface reaches, all round (px). */
export const HIT_PAD_PX = BATH_RULES.hitPadPx;

/** The keyboard's step across the box, and where its tool starts. */
const KEY_STEP = 1 / 8;
const KEY_START: BathPoint = { x: 0.5, y: 0.5 };

export function BathTouchLayer({ view, input, draw = true, reducedMotion, name, className, style }: BathTouchLayerProps) {
  const pressed = useRef<number | null>(null);
  const keyPointer = useRef<BathPoint | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  /** The margin in the box's own px: at least `HIT_PAD_PX` on screen however the box is scaled (the 2D actor is, with depth). */
  const [pad, setPad] = useState<number>(HIT_PAD_PX);

  /** A pointer in the art box's coordinates: from the box on screen when it is laid out, else the surface less its margin. */
  const localPoint = (e: { clientX: number; clientY: number; currentTarget: EventTarget & HTMLElement }): BathPoint => {
    const art = boxRef.current?.getBoundingClientRect();
    if (art && art.width > 0 && art.height > 0) return { x: (e.clientX - art.left) / art.width, y: 1 - (e.clientY - art.top) / art.height };
    const rect = e.currentTarget.getBoundingClientRect();
    const pad = padOf(e.currentTarget);
    const w = rect.width - 2 * pad;
    const h = rect.height - 2 * pad;
    if (w <= 0 || h <= 0) return { x: 0.5, y: 0.5 };
    return { x: (e.clientX - rect.left - pad) / w, y: 1 - (e.clientY - rect.top - pad) / h };
  };

  // The box on screen, for the rules in px; again whenever it changes size
  const measure = input.measure;
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const read = () => {
      const r = box.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      measure({ w: r.width, h: r.height });
      const scale = box.offsetWidth > 0 ? r.width / box.offsetWidth : 1;
      setPad(Math.ceil(HIT_PAD_PX / Math.max(0.2, scale)));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(box);
    return () => observer.disconnect();
  }, [measure, view.key]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button > 0 || pressed.current !== null) return;
    pressed.current = e.pointerId;
    e.preventDefault();
    input.down(localPoint(e));
    // Keep the moves of a finger that slides off a little; a browser that cannot capture this pointer (WebKit refuses
    // one it did not raise itself) still rubs, as long as the pointer stays over the layer
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* no capture: the layer still hears the pointer while it is over it */
    }
  }, [input]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pressed.current !== null && pressed.current !== e.pointerId) return;
    // A hovering mouse carries the tool without rubbing; a finger only moves it while down
    if (pressed.current === null && (e.pointerType === 'touch' || !e.isPrimary)) return;
    input.move(localPoint(e));
  }, [input]);

  const release = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pressed.current !== e.pointerId) return;
    pressed.current = null;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* nothing was captured */
    }
    input.up();
  }, [input]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, BathPoint> = { ArrowLeft: { x: -KEY_STEP, y: 0 }, ArrowRight: { x: KEY_STEP, y: 0 }, ArrowUp: { x: 0, y: KEY_STEP }, ArrowDown: { x: 0, y: -KEY_STEP } };
    if (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter') {
      if (keyPointer.current) {
        keyPointer.current = null;
        input.up();
        e.preventDefault();
      }
      return;
    }
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    if (!keyPointer.current) {
      keyPointer.current = KEY_START;
      input.down(KEY_START);
    }
    const next = { x: Math.max(0, Math.min(1, keyPointer.current.x + d.x)), y: Math.max(0, Math.min(1, keyPointer.current.y + d.y)) };
    keyPointer.current = next;
    input.move(next);
  }, [input]);

  // Whatever held the pointer lets go with the layer
  useEffect(() => () => {
    if (pressed.current !== null || keyPointer.current) input.up();
    pressed.current = null;
    keyPointer.current = null;
  }, [input]);

  const tool = view.tool;
  const rubbing = isHandStage(view.stage);
  return (
    <div
      className={`bath-layer ${className ?? ''}`}
      style={style}
      data-testid="bath-layer-box"
      data-draw={draw ? 'true' : 'false'}
      data-reduced={reducedMotion ? 'true' : undefined}
      ref={boxRef}
    >
      {draw && <BathEffects2D frame={view.frame} />}
      <div
        className="bath-layer__hit"
        style={{ position: 'absolute', inset: `-${pad}px`, touchAction: 'none' }}
        data-pad={pad}
        data-testid="bath-layer"
        data-stage={view.stageId ?? view.status}
        data-ritual={view.ritual.id}
        data-style={view.ritual.style}
        data-tool={tool ?? 'none'}
        data-pressed={view.frame.tool?.pressed ? 'true' : 'false'}
        data-ready={view.ready ? 'true' : 'false'}
        data-draw={draw ? 'true' : 'false'}
        data-room-drag=""
        role="application"
        aria-label={tool ? `Care for ${name}: drag the ${tool} over ${name}. Arrow keys carry it too.` : `${name} in the bath`}
        aria-roledescription="bath"
        tabIndex={rubbing ? 0 : -1}
        onPointerDown={rubbing ? onPointerDown : undefined}
        onPointerMove={rubbing ? onPointerMove : undefined}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={rubbing ? onKeyDown : undefined}
      />
    </div>
  );
}

/** The surface's padding (px), from its own data (a test's DOM has no layout to read it from). */
function padOf(el: HTMLElement): number {
  const v = Number(el.dataset.pad);
  return Number.isFinite(v) ? v : HIT_PAD_PX;
}
