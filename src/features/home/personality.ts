/**
 * Small personality, kept restrained: a few first-person lines the Blobbi
 * says when a room answers a need, and how much poking is too much.
 * Policy over the kit's thresholds and the renderer's faces; never a
 * publish, never a stat change.
 */
import { getStatStatus, type BlobbiCompanion, type BlobbiStats } from '@blobbi-kit/core';
import type { RoomId } from './rooms';

/** Pokes within this window before the Blobbi has had enough. */
export const POKE_PATIENCE = { count: 4, windowMs: 5_000 } as const;

export const ANNOYED_LINES = ['Hey! Enough.', 'Stop it…', 'Not now.'];

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
