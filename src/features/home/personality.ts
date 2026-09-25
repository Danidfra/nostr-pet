/**
 * Small personality, kept restrained: how a Blobbi takes a poke, and how
 * much poking is too much. Policy over the kit's thresholds and the
 * renderer's faces; never a publish, never a stat change. The Blobbi does
 * not speak: every reaction is a gesture, a face, or a sound.
 */
import { getStatStatus, type BlobbiCompanion, type BlobbiStats } from '@blobbi-kit/core';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';

/** Pokes within this window before the Blobbi has had enough. */
export const POKE_PATIENCE = { count: 4, windowMs: 5_000 } as const;

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
  if (stage === 'egg') return { mood: 'egg', gesture: 'wiggle', expression: null, durationMs: 700 };
  if (state !== 'active') return { mood: 'asleep', gesture: 'stir', expression: null, durationMs: 600 };
  if (recentPokes >= POKE_PATIENCE.count) return { mood: 'annoyed', gesture: 'recoil', expression: 'upset', durationMs: 2_000 };
  const critical = (stat: keyof BlobbiStats) => stats !== undefined && getStatStatus(stage, stat, stats[stat]) === 'critical';
  if (critical('energy')) return { mood: 'sleepy', gesture: 'stir', expression: 'sleepy', durationMs: 1_400 };
  if (critical('hunger') || critical('health')) return { mood: 'grumpy', gesture: 'recoil', expression: 'upset', durationMs: 1_400 };
  return { mood: 'glad', gesture: 'bounce', expression: 'happy', durationMs: 1_200 };
}

/** A glance toward a spot on the floor from where the Blobbi stands: left, right, and a little down. */
export function glanceToward(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - from.x;
  return { x: Math.max(-0.8, Math.min(0.8, dx * 3)), y: to.y > from.y ? 0.5 : 0.1 };
}

