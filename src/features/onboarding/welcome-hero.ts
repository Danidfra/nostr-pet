/**
 * The welcome's Blobbi as data (`WelcomeHero.tsx` plays it): what it says,
 * how it reacts to a tap, where its eyes go. Pure, so the little personality
 * is pinned by tests and tuned in one place.
 *
 * A few polished reactions rather than many: the first greeting, then a shy
 * one, a giggle and a burst of joy in turn as it is tapped, and it never
 * says the same line twice in a row. Faces are the renderer's own parts.
 */
import type { BlobbiExpression } from '@blobbi-kit/renderer';
import { t } from '@/i18n';

/** Scene 1: it notices you. */
export function greeting(): string {
  return t('wayIn.welcome.greeting');
}
/** Scene 2: the invitation (the screen's heading). */
export function invitation(): string {
  return t('wayIn.welcome.invitation');
}

/** Its face at rest, glad you came. */
export const AT_REST: BlobbiExpression = { eyes: 'open', mouth: 'smile', brows: 'neutral', blush: 'soft' };
/** The first moment: surprised to see you. */
export const NOTICING: BlobbiExpression = { eyes: 'wide', mouth: 'open', brows: 'raised', blush: 'none' };

export type HeroMove = 'shy-hop' | 'hop' | 'wiggle';

export interface HeroReaction {
  face: BlobbiExpression;
  /** What it says, in the page's language (a getter: read when shown, never at import). */
  readonly line: string;
  move: HeroMove;
  sound: 'poke' | 'happy' | 'chirp';
  /** How long the face and the line stay before it settles again. */
  ms: number;
}

export const REACTIONS: readonly HeroReaction[] = [
  {
    face: { eyes: 'open', mouth: 'smile', brows: 'raised', blush: 'strong' },
    get line() {
      return t('wayIn.welcome.reactions.shy');
    },
    move: 'shy-hop',
    sound: 'poke',
    ms: 1_900,
  },
  {
    face: 'happy',
    get line() {
      return t('wayIn.welcome.reactions.tickles');
    },
    move: 'hop',
    sound: 'happy',
    ms: 1_700,
  },
  {
    face: 'excited',
    get line() {
      return t('wayIn.welcome.reactions.again');
    },
    move: 'wiggle',
    sound: 'chirp',
    ms: 1_800,
  },
];

/** The reaction to the n-th tap (0-based), in turn. */
export function reactionFor(tap: number): HeroReaction {
  return REACTIONS[((tap % REACTIONS.length) + REACTIONS.length) % REACTIONS.length];
}

/** How long after the greeting it settles and the invitation is the scene's line. */
export const GREETING_MS = 2_400;
/** Blinks: one every few seconds, quick. */
export const BLINK_MS = 140;
export function nextBlinkIn(random: () => number = Math.random): number {
  return 2_600 + Math.floor(random() * 3_400);
}

/**
 * Where its eyes go to look at a point on screen: toward it, from the middle of its face, as the renderer's offset
 * (-1..1 each way). Far points saturate; a point right on it looks straight out.
 */
export function gazeToward(face: { x: number; y: number }, point: { x: number; y: number }, reach = 260): { x: number; y: number } {
  const dx = (point.x - face.x) / reach;
  const dy = (point.y - face.y) / reach;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return { x: Math.round(clamp(dx) * 100) / 100, y: Math.round(clamp(dy) * 100) / 100 };
}
