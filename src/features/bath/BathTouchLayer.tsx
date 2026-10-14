/**
 * The bath on the Blobbi's body: the surface the player rubs, and what the
 * rubbing leaves on the drawing. Laid over the Blobbi's art box (the 2D
 * home's actor, the room's overlay on its feet), it takes every pointer
 * (touch, mouse, pen: one pointer at a time, captured so a finger that
 * slides off a little keeps rubbing) and hands it to the session in box
 * coordinates; and, when `draw` is on, it draws the foam where the soap
 * went, the wet where the water is, the shower's rain while it is held and
 * the tool in the player's hand (resting, with a gentle invitation, while
 * nothing is pressed). The 3D room's model draws those itself and turns
 * `draw` off; the surface stays.
 *
 * The keyboard: with the layer focused, the arrow keys carry the tool a
 * cell at a time (pressing it down as they go), Space lifts it.
 */
import { useCallback, useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cellCenter, type BathPoint, type BathTool } from './bath-machine';
import type { BathInput, BathView } from './useBathSession';
import { BathToolArt } from './BathTools';
import './bath.css';

interface BathTouchLayerProps {
  view: BathView;
  input: BathInput;
  /** Draw the foam, the water and the tool here (off when the 3D model draws them). */
  draw?: boolean;
  reducedMotion: boolean;
  /** The Blobbi's name, for the layer's accessible name. */
  name: string;
  className?: string;
  style?: CSSProperties;
}

/** Where a tool waits when nothing is pressed, in the box. */
const RESTING: Readonly<Record<BathTool, BathPoint>> = { soap: { x: 0.84, y: 0.4 }, shower: { x: 0.5, y: 1.04 }, towel: { x: 0.16, y: 0.42 } };

/** The keyboard's step across the box, and where its tool starts. */
const KEY_STEP = 1 / 8;
const KEY_START: BathPoint = { x: 0.5, y: 0.5 };

const toSvg = (p: BathPoint) => ({ x: p.x * 100, y: (1 - p.y) * 100 });

export function BathTouchLayer({ view, input, draw = true, reducedMotion, name, className, style }: BathTouchLayerProps) {
  const pressed = useRef<number | null>(null);
  const keyPointer = useRef<BathPoint | null>(null);

  const localPoint = (e: { clientX: number; clientY: number; currentTarget: EventTarget & HTMLElement }): BathPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return { x: (e.clientX - rect.left) / rect.width, y: 1 - (e.clientY - rect.top) / rect.height };
  };

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
  const stage = view.stage;
  const rubbing = stage === 'soap' || stage === 'rinse' || stage === 'dry';
  const at = view.pointer ?? (tool ? RESTING[tool] : null);
  const toolAt = at ? toSvg(at) : null;
  const raining = stage === 'rinse' && view.pointer !== null;
  const bottom = (1 - view.outline.bottom) * 100;

  return (
    <div
      className={`bath-layer ${className ?? ''}`}
      style={style}
      data-testid="bath-layer"
      data-stage={stage ?? view.status}
      data-tool={tool ?? 'none'}
      data-pressed={view.pointer ? 'true' : 'false'}
      data-draw={draw ? 'true' : 'false'}
      data-reduced={reducedMotion ? 'true' : undefined}
      data-room-drag=""
      role="application"
      aria-label={tool ? `Wash ${name}: drag the ${tool} over ${name}. Arrow keys carry it too.` : `${name} in the bath`}
      aria-roledescription="bath"
      tabIndex={rubbing ? 0 : -1}
      onPointerDown={rubbing ? onPointerDown : undefined}
      onPointerMove={rubbing ? onPointerMove : undefined}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={rubbing ? onKeyDown : undefined}
    >
      {draw && (
        <svg className="bath-layer__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
          {/* Wet: a sheen where the water has been (the rinse and the dry) */}
          {(stage === 'rinse' || stage === 'dry') && (
            <g className="bath-wet" data-testid="bath-wet">
              {view.wet.map((w, i) => {
                if (!view.mask[i] || w < 0.03) return null;
                const c = toSvg(cellCenter(view.grid, i));
                return <circle key={i} cx={c.x} cy={c.y} r={6.8} fill="#38bdf8" opacity={0.26 * w} />;
              })}
            </g>
          )}
          {/* Foam where the soap went, a bubble on each lathered cell, bigger as it fills */}
          <g className="bath-foam" data-testid="bath-foam" data-count={view.foam.filter((f, i) => view.mask[i] && f > 0.03).length}>
            {view.foam.map((f, i) => {
              if (!view.mask[i] || f < 0.03) return null;
              const c = toSvg(cellCenter(view.grid, i));
              const r = 3.6 + 5.6 * Math.min(1, f);
              const wobble = ((i * 7) % 5) - 2;
              return (
                <g key={i} className="bath-foam__cell" style={{ '--i': i % 6 } as CSSProperties}>
                  <circle cx={c.x + wobble * 0.4} cy={c.y - wobble * 0.3} r={r} fill="#fff" opacity={0.78 + 0.18 * Math.min(1, f)} />
                  <circle cx={c.x + wobble * 0.4 - r * 0.35} cy={c.y - wobble * 0.3 - r * 0.35} r={r * 0.22} fill="#e0f2fe" opacity="0.9" />
                </g>
              );
            })}
          </g>
          {/* The shower's rain while it is held: drops from the head down to the water, and the splash where they land */}
          {stage === 'rinse' && toolAt && (
            <g className="bath-rain" data-testid="bath-rain" data-raining={raining ? 'true' : 'false'} style={{ '--fall': `${Math.max(8, bottom - toolAt.y)}` } as CSSProperties}>
              {raining && [-9, -5.5, -2, 1.5, 5, 8.5].map((dx, i) => (
                <ellipse key={dx} className="bath-drop" style={{ '--delay': `${i * 90}ms` } as CSSProperties} cx={toolAt.x + dx} cy={toolAt.y + 4} rx={1.1} ry={2.4} fill="#7dd3fc" opacity="0.85" />
              ))}
              {raining && [-10, -4, 3, 9].map((dx, i) => (
                <circle key={dx} className="bath-splash" style={{ '--delay': `${i * 140}ms` } as CSSProperties} cx={toolAt.x + dx} cy={bottom} r={1.6} fill="#bae6fd" opacity="0.9" />
              ))}
            </g>
          )}
        </svg>
      )}
      {draw && tool && toolAt && (
        <div className="bath-layer__tool" data-testid="bath-tool-in-hand" data-tool={tool} data-resting={view.pointer ? 'false' : 'true'} style={{ left: `${toolAt.x}%`, top: `${toolAt.y}%` }} aria-hidden>
          <BathToolArt tool={tool} className="bath-layer__tool-art" />
        </div>
      )}
    </div>
  );
}
