/**
 * Idle behaviour, the pure part: what a Blobbi that has been left alone
 * might do next. Restrained by design: one small thing at a time, with long
 * pauses, and never while the player is doing something. Randomness is
 * injected so tests plan the exact sequence.
 */
import { clampToFloor, type Facing, type FloorPoint } from './geometry';
import type { EyeOffset } from './gaze';

export type IdleAction =
  | { type: 'glance'; offset: EyeOffset; durationMs: number }
  | { type: 'turn'; facing: Facing }
  | { type: 'walk'; destination: FloorPoint }
  | { type: 'rest' };

export interface IdleTiming {
  /** No idle action until this long without user input. */
  inactivityMs: number;
  /** Base gap between idle actions once idle; jittered by up to half. */
  intervalMs: number;
}

export const DEFAULT_IDLE_TIMING: IdleTiming = { inactivityMs: 12_000, intervalMs: 9_000 };

/** How far an idle stroll may go, in floor units. */
export const IDLE_STROLL_RANGE = 0.22;

/** A source of numbers in [0, 1). `Math.random` in the app; scripted in tests. */
export type Random = () => number;

const FACINGS: readonly Facing[] = ['front', 'left', 'right'];

/**
 * Pick the next idle action. Weights: glances most often, a turn sometimes,
 * a short stroll now and then, and a plain rest (do nothing) so the Blobbi
 * is not busy every beat.
 */
export function planIdleAction(random: Random, position: FloorPoint, facing: Facing): IdleAction {
  const roll = random();
  if (roll < 0.45) {
    const x = (random() * 2 - 1) * 0.7;
    const y = (random() * 2 - 1) * 0.35;
    return { type: 'glance', offset: { x: round(x), y: round(y) }, durationMs: 1_400 + Math.round(random() * 1_200) };
  }
  if (roll < 0.62) {
    const candidates = FACINGS.filter((f) => f !== facing);
    return { type: 'turn', facing: candidates[Math.floor(random() * candidates.length)] ?? 'front' };
  }
  if (roll < 0.85) {
    const dx = (random() * 2 - 1) * IDLE_STROLL_RANGE;
    const dy = (random() * 2 - 1) * IDLE_STROLL_RANGE * 0.6;
    return { type: 'walk', destination: clampToFloor({ x: position.x + dx, y: position.y + dy }) };
  }
  return { type: 'rest' };
}

/** The delay before the next idle beat: the interval with up to 50% jitter. */
export function nextIdleDelay(random: Random, timing: IdleTiming): number {
  return Math.round(timing.intervalMs * (0.75 + random() * 0.5));
}

function round(v: number): number {
  return Number(v.toFixed(2));
}
