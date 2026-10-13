/**
 * The Blobbi's life during the save ceremony, as data (M14.2): which face
 * it makes at each moment, which little move, which sparkle, and what it
 * does when nothing happens. Pure, so the personality is pinned by tests
 * and tuned in one place; `CeremonyBlobbi.tsx` plays it.
 *
 * The moments are the ceremony's: the player types (it looks at the field,
 * curious), a name is given (glad), a step is skipped (a small, easy face:
 * it does not mind), a step is passed (a joyful hop and a few hearts), the
 * account is made (a bigger celebration), a word is not friendly (a short
 * surprised, then displeased face, never for long). Between them it
 * breathes (the renderer's idle), blinks, follows the pointer with its eyes
 * and now and then glances about or smiles: one small thing at a time, with
 * long pauses, so it is alive and never busy.
 *
 * Faces are the shared expression vocabulary (`features/expression`); the
 * moves are CSS on the portrait's box, never on the drawing; the sparkles
 * are the renderer's own effects. Reduced motion keeps the faces and drops
 * the moves and the sparkles.
 */
import type { BlobbiExpression, BlobbiVisualEffect } from '@blobbi-kit/renderer';
import { PRIORITY } from '@/features/expression/controller';
import type { ExpressionName } from '@/features/expression/faces';
import type { BlobbiSoundId } from '@/features/sound';

export { BLINK_MS, gazeToward, nextBlinkIn } from '@/features/onboarding/welcome-hero';

/** What can happen to the Blobbi during the ceremony. */
export type CeremonyReaction = 'typing' | 'quiet' | 'named' | 'skipped' | 'advance' | 'complete' | 'displeased';

/** The little moves of its body, played on the portrait's box (`index.css`). */
export type CeremonyMove = 'hop' | 'wiggle' | 'cheer' | 'flinch';

/** Its face at rest during the ceremony: glad to be here, eyes open. */
export const CEREMONY_AT_REST: BlobbiExpression = { eyes: 'open', mouth: 'smile', brows: 'neutral', blush: 'soft' };

export interface CeremonyMoment {
  /** The face to ask the controller for, under `source`; null to clear that source. */
  face: ExpressionName | null;
  /** How long the face stays; null lasts until the source is cleared. */
  faceMs: number | null;
  /** Which controller source this moment speaks for (one request per source). */
  source: 'attention' | 'reaction' | 'celebration';
  priority: number;
  move: CeremonyMove | null;
  /** The renderer's effects around it, and for how long. */
  effects: readonly BlobbiVisualEffect[];
  effectsMs: number;
  sound: BlobbiSoundId | null;
}

const HEARTS: readonly BlobbiVisualEffect[] = [{ id: 'love-burst', intensity: 0.9 }];
// The renderer draws one effect per slot (hearts and sparkles share the air), so the celebration is sparkles in the
// air and a glow around the body: two slots, both drawn
const CELEBRATION: readonly BlobbiVisualEffect[] = [{ id: 'golden-sparkles', intensity: 1.1 }, { id: 'celestial-aura', intensity: 0.5 }];

export const MOMENTS: Readonly<Record<CeremonyReaction, CeremonyMoment>> = {
  // Watching the player type: curious, for as long as the field is theirs; 'quiet' takes it back
  typing: { face: 'curious', faceMs: null, source: 'attention', priority: PRIORITY.life, move: null, effects: [], effectsMs: 0, sound: null },
  quiet: { face: null, faceMs: null, source: 'attention', priority: PRIORITY.life, move: null, effects: [], effectsMs: 0, sound: null },
  // A name given: glad
  named: { face: 'happy', faceMs: 1_600, source: 'reaction', priority: PRIORITY.reaction, move: null, effects: [], effectsMs: 0, sound: 'chirp' },
  // A step skipped: fine by it
  skipped: { face: 'relieved', faceMs: 1_100, source: 'reaction', priority: PRIORITY.reaction, move: null, effects: [], effectsMs: 0, sound: null },
  // A step passed: a joyful hop, a few hearts
  advance: { face: 'excited', faceMs: 1_500, source: 'reaction', priority: PRIORITY.reaction, move: 'hop', effects: HEARTS, effectsMs: 1_600, sound: 'happy' },
  // The account made: the big one, until the scene ends
  complete: { face: 'excited', faceMs: null, source: 'celebration', priority: PRIORITY.journey, move: 'cheer', effects: CELEBRATION, effectsMs: 6_000, sound: null },
  // An unfriendly word: surprised, then a short displeased face, no longer
  displeased: { face: 'upset', faceMs: 1_400, source: 'reaction', priority: PRIORITY.reaction, move: 'flinch', effects: [], effectsMs: 0, sound: 'invalid' },
};

export function momentFor(reaction: CeremonyReaction): CeremonyMoment {
  return MOMENTS[reaction];
}

/** How long a displeased moment first shows surprise before the displeasure. */
export const SURPRISE_MS = 380;

/** Something it does on its own while nothing happens. */
export type IdleMoment = { type: 'glance'; offset: { x: number; y: number }; durationMs: number } | { type: 'face'; name: 'curious' | 'happy'; durationMs: number } | { type: 'rest' };

/** A source of numbers in [0, 1). */
export type Random = () => number;

/**
 * Pick what it does next when left alone: mostly a glance about, now and
 * then a curious or a glad face, often nothing at all. Never a move: the
 * hops are the player's to earn.
 */
export function planIdleMoment(random: Random): IdleMoment {
  const roll = random();
  if (roll < 0.5) {
    const x = Math.round((random() * 2 - 1) * 70) / 100;
    const y = Math.round((random() * 2 - 1) * 30) / 100;
    return { type: 'glance', offset: { x, y }, durationMs: 1_200 + Math.round(random() * 1_000) };
  }
  if (roll < 0.7) return { type: 'face', name: 'curious', durationMs: 1_400 };
  if (roll < 0.82) return { type: 'face', name: 'happy', durationMs: 1_300 };
  return { type: 'rest' };
}

/** The pause before its next idle moment: six to eleven seconds. */
export function nextIdleIn(random: Random): number {
  return 6_000 + Math.round(random() * 5_000);
}

/** How long a move's CSS plays, so a second move is not asked for over the first. */
export const MOVE_MS: Readonly<Record<CeremonyMove, number>> = { hop: 620, wiggle: 700, cheer: 1_400, flinch: 420 };
