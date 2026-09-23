/**
 * Gaze policy, the pure part: turn "something is over there" into the
 * renderer's `eyeOffset` (-1..1 per axis, screen-relative). The renderer
 * already corrects the mirrored left profile, so nothing here looks at
 * facing.
 */
export interface EyeOffset {
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

const clampAxis = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0);

/** Clamp to the renderer's range; non-finite axes become 0. */
export function clampEyeOffset(offset: Point): EyeOffset {
  return { x: clampAxis(offset.x), y: clampAxis(offset.y) };
}

/**
 * Where to look to see `target` from `eyes`, both in the same pixel space.
 * `range` is the distance (px) at which the gaze saturates; a target closer
 * than that gets a proportionally smaller offset so the eyes do not flick to
 * the corner for a pointer that is right next to the face. Quantized so
 * small pointer jitter does not cause renders.
 */
export function gazeToward(eyes: Point, target: Point, range: number, step = 0.05): EyeOffset {
  const safeRange = Math.max(1, range);
  const raw = { x: (target.x - eyes.x) / safeRange, y: (target.y - eyes.y) / safeRange };
  const clamped = clampEyeOffset(raw);
  return { x: quantize(clamped.x, step), y: quantize(clamped.y, step) };
}

function quantize(v: number, step: number): number {
  const q = Math.round(v / step) * step;
  return Math.abs(q) < 1e-9 ? 0 : Number(q.toFixed(4));
}

/** A glance in the direction of travel: a little to the side, level. */
export function travelGlance(direction: Point): EyeOffset | undefined {
  if (direction.x === 0 && direction.y === 0) return undefined;
  return clampEyeOffset({ x: Math.sign(direction.x) * 0.45, y: Math.sign(direction.y) * 0.15 });
}

/** The gaze target kinds the policy knows. */
export type GazeTarget =
  | { kind: 'pointer'; point: Point }
  | { kind: 'tap'; point: Point; until: number }
  | { kind: 'glance'; offset: EyeOffset; until: number };

/** How long a tap keeps the Blobbi's attention. */
export const TAP_ATTENTION_MS = 1_600;

/** The saturation range as a fraction of the scene width, with a floor in px. */
export function gazeRangeFor(sceneWidth: number): number {
  return Math.max(120, sceneWidth * 0.3);
}
