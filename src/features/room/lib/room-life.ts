/**
 * A Blobbi left to itself in its room, the pure part: what it might do
 * next. The home's idle policy (`home/scene/idle.ts`) in the room's tiles:
 * restrained by design, one small thing at a time with long pauses, never
 * while the player is doing something. Curious, not restless.
 *
 *   glance    its eyes wander somewhere for a moment (most often)
 *   stroll    a short walk, one to three tiles, to somewhere free nearby
 *   stretch   a small settling of the body (the home's `stir` gesture)
 *   rest      nothing at all, this beat
 *
 * Randomness is injected, so tests plan the exact sequence; nothing reads
 * the clock, so the timing is the caller's.
 */
import type { EyeOffset } from '@/features/home/scene/gaze';
import { ROOM_GRID } from './room-geometry';

export type LifeBeat =
  | { type: 'glance'; offset: EyeOffset; durationMs: number }
  | { type: 'stroll'; x: number; z: number }
  | { type: 'stretch' }
  | { type: 'rest' };

export interface LifeTiming {
  /** No beat until the player has left the room alone this long. */
  quietMs: number;
  /** Base gap between beats; jittered by up to half either way. */
  intervalMs: number;
}

export const ROOM_LIFE_TIMING: LifeTiming = { quietMs: 6_000, intervalMs: 8_000 };

/** A source of numbers in [0, 1). */
export type Random = () => number;

/** How far a stroll goes, in tiles. */
export const STROLL_RANGE = { min: 1.2, max: 3 } as const;

export interface LifeContext {
  /** Where it stands, in tiles. */
  at: { x: number; z: number };
  /** Whether it may walk now (3D room up, awake, not an egg, motion welcome). */
  canWalk: boolean;
}

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * The next beat. Weights: glances half the time, a stroll a quarter (when
 * walking is possible, else a glance), a stretch now and then, and a plain
 * rest so it is not busy every beat.
 */
export function planLifeBeat(random: Random, { at, canWalk }: LifeContext): LifeBeat {
  const roll = random();
  if (roll < 0.5 || (!canWalk && roll < 0.75)) {
    const x = (random() * 2 - 1) * 0.75;
    const y = (random() * 2 - 1) * 0.4;
    return { type: 'glance', offset: { x: round(x), y: round(y) }, durationMs: 1_300 + Math.round(random() * 1_300) };
  }
  if (roll < 0.75) {
    const angle = random() * Math.PI * 2;
    const distance = STROLL_RANGE.min + random() * (STROLL_RANGE.max - STROLL_RANGE.min);
    const clamp = (v: number) => Math.min(ROOM_GRID - 1, Math.max(1, v));
    return { type: 'stroll', x: round(clamp(at.x + Math.cos(angle) * distance)), z: round(clamp(at.z + Math.sin(angle) * distance)) };
  }
  if (roll < 0.85) return { type: 'stretch' };
  return { type: 'rest' };
}

/** The wait before the next beat: the interval, jittered by up to half either way. */
export function nextBeatDelay(random: Random, timing: LifeTiming = ROOM_LIFE_TIMING): number {
  return Math.round(timing.intervalMs * (0.5 + random()));
}
