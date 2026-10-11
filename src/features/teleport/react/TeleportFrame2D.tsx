/**
 * A journey drawn around a 2D drawing: the 2D adapter of the shared timeline
 * and mote field. It wraps any drawing (the kit's canonical SVG, untouched)
 * and composites the effect around it:
 *
 *   dissolve   a CSS mask over the drawing, its edge at the timeline's `cut`
 *              across the body's REAL height (read from the drawing itself,
 *              `readDrawingOutline`): top down when leaving, bottom up when
 *              arriving, with a soft edge
 *   body       a squash about the feet, a soft glow, and a bright line along
 *              the dissolving edge, as wide as the body is there
 *   motes      the shared field (`motesAt`), on a canvas that reaches high
 *              above the box (they rise well over the head), soft round
 *              sprites, white-hot fading to the Blobbi's own colour, added
 *              light on light
 *   face       reported up (`onFace`): the owner hands the renderer the face
 *
 * It animates only during a journey (its own animation frames, none
 * otherwise); `preview` draws one fixed moment instead (a scrubber). A
 * hidden tab's frames pause; the journey's state still completes on its
 * timers (`presence.ts`), and the next frame drawn is the right one.
 */
import { useEffect, useRef, type ReactNode } from 'react';

import { BLOB_SILHOUETTE, motesAt, type Silhouette } from '../particles';
import { readDrawingOutline, type DrawingOutline } from '../silhouette2d';
import { journeyDuration, journeyFrame, type JourneyFace, type JourneyFrame, type JourneyKind } from '../timeline';
import type { Journey } from '../presence';

interface TeleportFrame2DProps {
  journey: Journey | null;
  /** Away: nothing is drawn. */
  absent: boolean;
  /** Draw this moment instead of running (the dev scrubber). */
  preview?: { kind: JourneyKind; t: number; reduced?: boolean } | null;
  /** The face the journey asks for, when it changes. */
  onFace?: (face: JourneyFace) => void;
  /** The arrival's little hop is due. */
  onHop?: () => void;
  /** The motes' colour when the drawing cannot be read. */
  fallbackTint?: string;
  children: ReactNode;
}

/** How far above the box the motes' canvas reaches, in box heights. */
const HEADROOM = 1.6;
/** The default outline before (or without) the drawing's own: feet and top as box fractions. */
const DEFAULT_BOUNDS = { bottom: 0.08, top: 0.9 };

/** A soft round sprite, made once per colour. */
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(color: string): HTMLCanvasElement | null {
  const cached = sprites.get(color);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  sprites.set(color, c);
  return c;
}

export function TeleportFrame2D({ journey, absent, preview = null, onFace, onHop, fallbackTint = 'rgb(255, 230, 180)', children }: TeleportFrame2DProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRef = useRef<DrawingOutline | null>(null);
  const callbacks = useRef({ onFace, onHop });
  callbacks.current = { onFace, onHop };
  const lastFace = useRef<JourneyFace | undefined>(undefined);
  const hopped = useRef<number | null>(null);

  const active = journey !== null || preview !== null;
  const outlineKey = journey ? `${journey.kind}:${journey.startedAt}` : preview ? `preview:${preview.kind}` : 'none';

  // Read the drawing's outline once per journey (it is the same drawing throughout)
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void readDrawingOutline(bodyRef.current?.querySelector('svg') ?? null).then((outline) => {
      if (!cancelled && outline) outlineRef.current = outline;
    });
    return () => {
      cancelled = true;
    };
  }, [active, outlineKey]);

  useEffect(() => {
    const body = bodyRef.current;
    const canvas = canvasRef.current;
    if (!body || !canvas) return;
    if (!active) {
      // At rest: the drawing as it is, or not at all when away
      clearBody(body);
      body.style.visibility = absent ? 'hidden' : '';
      clearCanvas(canvas);
      if (lastFace.current !== undefined && lastFace.current !== null && !absent) callbacks.current.onFace?.(null);
      lastFace.current = undefined;
      return;
    }
    body.style.visibility = '';
    sizeCanvas(canvas);
    let frameId = 0;
    const draw = () => {
      const kind = preview?.kind ?? journey!.kind;
      const reduced = preview?.reduced ?? journey?.reduced ?? false;
      const t = preview ? preview.t : performance.now() - journey!.startedAt;
      const frame = journeyFrame(kind, t, reduced);
      paint(body, canvas, frame, kind, t, outlineRef.current, fallbackTint);
      if (frame.face !== lastFace.current) {
        lastFace.current = frame.face;
        callbacks.current.onFace?.(frame.face);
      }
      if (frame.phase === 'open' && journey && hopped.current !== journey.startedAt) {
        hopped.current = journey.startedAt;
        callbacks.current.onHop?.();
      }
      if (!preview && t < journeyDuration(kind, reduced) + 50) frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [active, absent, journey, preview, fallbackTint]);

  return (
    <div className="teleport-2d" data-teleport={active ? (preview?.kind ?? journey?.kind) : absent ? 'absent' : 'none'}>
      <div ref={bodyRef} className="teleport-2d__body">
        {children}
      </div>
      <canvas ref={canvasRef} className="teleport-2d__motes" aria-hidden style={{ height: `${(1 + HEADROOM) * 100}%` }} />
    </div>
  );
}

function sizeCanvas(canvas: HTMLCanvasElement) {
  const scale = Math.min(3, (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * 1.5);
  const w = Math.max(1, Math.round(canvas.clientWidth * scale));
  const h = Math.max(1, Math.round(canvas.clientHeight * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

function clearCanvas(canvas: HTMLCanvasElement) {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

function clearBody(body: HTMLDivElement) {
  body.style.maskImage = '';
  body.style.webkitMaskImage = '';
  body.style.transform = '';
  body.style.filter = '';
  body.style.opacity = '';
}

/** One frame of the effect: the body's mask, squash and glow, then the motes and the edge's light. */
function paint(body: HTMLDivElement, canvas: HTMLCanvasElement, frame: JourneyFrame, kind: JourneyKind, t: number, outline: DrawingOutline | null, fallbackTint: string) {
  const bounds = outline ?? DEFAULT_BOUNDS;
  const silhouette: Silhouette = outline?.silhouette ?? BLOB_SILHOUETTE;
  const height = bounds.top - bounds.bottom;
  // The mask: opaque below the cut, clear above it, with a soft edge (box fractions from the bottom)
  if (frame.cut >= 1) {
    body.style.maskImage = '';
    body.style.webkitMaskImage = '';
  } else {
    const at = bounds.bottom + frame.cut * height;
    const soft = frame.edge * height;
    const mask = `linear-gradient(to top, #000 0%, #000 ${((at - soft) * 100).toFixed(2)}%, transparent ${((at + soft * 0.15) * 100).toFixed(2)}%)`;
    body.style.maskImage = mask;
    body.style.webkitMaskImage = mask;
  }
  body.style.transformOrigin = `50% ${((1 - bounds.bottom) * 100).toFixed(1)}%`;
  body.style.transform = frame.sx !== 1 || frame.sy !== 1 ? `scale(${frame.sx.toFixed(4)}, ${frame.sy.toFixed(4)})` : '';
  body.style.filter = frame.glow > 0.01 ? `brightness(${(1 + 0.22 * frame.glow).toFixed(3)}) drop-shadow(0 0 ${(3 + 7 * frame.glow).toFixed(1)}px rgba(255, 244, 214, ${(0.75 * frame.glow).toFixed(3)}))` : '';
  body.style.opacity = frame.opacity < 1 ? frame.opacity.toFixed(3) : '';

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame.motes && frame.edgeGlow <= 0) return;
  const W = canvas.width;
  const H = canvas.height;
  const boxH = H / (1 + HEADROOM);
  // Body coordinates to canvas pixels: x across the box from its middle, y up from the feet
  const px = (x: number) => (0.5 + x) * W;
  const py = (y: number) => H - (bounds.bottom + y * height) * boxH;
  const tint = outline?.tint ?? fallbackTint;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // The edge: a bright line where the body is coming apart (or together), as wide as the body there
  if (frame.edgeGlow > 0 && frame.cut > 0 && frame.cut < 1) {
    const span = silhouette.span(frame.cut) ?? silhouette.span(Math.max(0, frame.cut - 0.03));
    if (span) {
      const y = py(frame.cut);
      const x0 = px(span.left);
      const x1 = px(span.right);
      const thick = Math.max(1.5, boxH * 0.012);
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.15, `rgba(255,250,235,${0.85 * frame.edgeGlow})`);
      g.addColorStop(0.85, `rgba(255,250,235,${0.85 * frame.edgeGlow})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y - thick / 2, x1 - x0, thick);
      // Its halo
      ctx.globalAlpha = 0.35 * frame.edgeGlow;
      ctx.fillRect(x0, y - thick * 2.5, x1 - x0, thick * 5);
      ctx.globalAlpha = 1;
    }
  }
  if (frame.motes) {
    const hot = sprite('rgba(255,252,240,1)');
    const tinted = sprite(tint);
    for (const m of motesAt(kind, t, silhouette)) {
      const r = Math.max(1, m.size * W);
      const x = px(m.x);
      const y = py(m.y);
      if (tinted) {
        // A coloured halo, wide and soft, then the hot core
        ctx.globalAlpha = Math.min(1, m.alpha * (1.1 - m.heat * 0.4));
        ctx.drawImage(tinted, x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      }
      if (hot) {
        ctx.globalAlpha = m.alpha * (0.35 + 0.65 * m.heat);
        ctx.drawImage(hot, x - r, y - r, r * 2, r * 2);
      }
    }
  }
  ctx.restore();
}
