/**
 * Small personality, kept restrained: a few first-person lines the Blobbi
 * says when a room answers a need, and how much poking is too much.
 * Policy over the kit's thresholds and the renderer's faces; never a
 * publish, never a stat change.
 */
import { getStatStatus, type BlobbiCompanion, type BlobbiStats } from '@blobbi-kit/core';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import type { RoomId } from './rooms';

/** Pokes within this window before the Blobbi has had enough. */
export const POKE_PATIENCE = { count: 4, windowMs: 5_000 } as const;

export const ANNOYED_LINES = ['Hey! Enough.', 'Stop it…', 'Not now.'];

/**
 * A body gesture the home can play on the actor (its own element around
 * the renderer; the renderer's creature animation is never touched):
 *   wiggle  an egg rocking in place
 *   bounce  a glad little hop
 *   recoil  a flinch away from the finger
 *   stir    a sleeper shifting, barely
 */
export type PokeGesture = 'wiggle' | 'bounce' | 'recoil' | 'stir';

export interface PokeReaction {
  /** How it feels about being poked, for callers that speak (lines) or count. */
  mood: 'egg' | 'asleep' | 'glad' | 'grumpy' | 'sleepy' | 'annoyed';
  gesture: PokeGesture;
  /** The face, on artwork that has one; null leaves the baseline. */
  expression: BlobbiEmotion | null;
  /** How long the face and the gesture last. */
  durationMs: number;
  /** Something to say, or nothing. */
  line: string | null;
}

export interface PokeInput {
  stage: BlobbiCompanion['stage'];
  state: BlobbiCompanion['state'];
  stats: BlobbiStats | undefined;
  /** Pokes in the patience window, this one included. */
  recentPokes: number;
}

/**
 * The poke policy: what a tap on the Blobbi does, from its stage, its
 * state, its condition and how often it has been poked lately. Pure, so
 * the table below is the whole personality of a poke today and the place
 * a richer one goes tomorrow (per-personality tables, moods that build
 * up). It decides presentation only: nothing here is written anywhere.
 */
export function pokeReaction({ stage, state, stats, recentPokes }: PokeInput): PokeReaction {
  if (stage === 'egg') return { mood: 'egg', gesture: 'wiggle', expression: null, durationMs: 700, line: null };
  if (state !== 'active') return { mood: 'asleep', gesture: 'stir', expression: null, durationMs: 600, line: null };
  if (recentPokes >= POKE_PATIENCE.count) return { mood: 'annoyed', gesture: 'recoil', expression: 'upset', durationMs: 2_000, line: ANNOYED_LINES[recentPokes % ANNOYED_LINES.length] };
  const critical = (stat: keyof BlobbiStats) => stats !== undefined && getStatStatus(stage, stat, stats[stat]) === 'critical';
  if (critical('energy')) return { mood: 'sleepy', gesture: 'stir', expression: 'sleepy', durationMs: 1_400, line: null };
  if (critical('hunger') || critical('health')) return { mood: 'grumpy', gesture: 'recoil', expression: 'upset', durationMs: 1_400, line: null };
  return { mood: 'glad', gesture: 'bounce', expression: 'happy', durationMs: 1_200, line: null };
}

/** What a Blobbi says on coming into a room, when the room is the answer to something it needs. */
export function roomGreeting(room: RoomId, companion: Pick<BlobbiCompanion, 'stage' | 'state'>, stats: BlobbiStats | undefined): string | null {
  if (!stats || companion.state !== 'active') return null;
  const low = (stat: keyof BlobbiStats) => {
    const status = getStatStatus(companion.stage, stat, stats[stat]);
    return status === 'warning' || status === 'critical';
  };
  switch (room) {
    case 'kitchen':
      return low('hunger') ? 'Is it snack time?' : null;
    case 'care':
      return low('hygiene') ? 'Bath time?' : low('health') ? 'I feel funny.' : null;
    case 'rest':
      return low('energy') ? 'Yawn…' : null;
    case 'home':
      return low('happiness') ? 'Play with me?' : null;
    default:
      return null;
  }
}

/** A glance toward a spot on the floor from where the Blobbi stands: left, right, and a little down. */
export function glanceToward(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - from.x;
  return { x: Math.max(-0.8, Math.min(0.8, dx * 3)), y: to.y > from.y ? 0.5 : 0.1 };
}

/** What a Blobbi says the moment a need becomes critical; once, not on repeat. */
export function needLine(stat: keyof BlobbiStats): string | null {
  switch (stat) {
    case 'hunger':
      return 'So hungry…';
    case 'energy':
      return 'I could sleep for days.';
    case 'hygiene':
      return 'I feel sticky.';
    case 'happiness':
      return 'Play with me?';
    case 'health':
      return 'I feel funny.';
    default:
      return null;
  }
}
