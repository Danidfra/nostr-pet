/**
 * The hatch theatre's timing and the baby's first moments, as data (the
 * component is `components/HatchTheater.tsx`). Pure, so the choreography is
 * pinned by tests and tuned in one place.
 */
import type { BlobbiExpression } from '@blobbi-kit/renderer';
import type { CeremonyTimings } from '@/features/lifecycle';

/** The theatre's pace: longer than the classic home's, every beat its own moment. */
export const THEATER_TIMINGS: CeremonyTimings = { leadMs: 1_900, stepMs: 950, finalMs: 1_300, burstMs: 900, revealMs: 5_400 };
export const REDUCED_THEATER_TIMINGS: CeremonyTimings = { leadMs: 700, stepMs: 450, finalMs: 600, burstMs: 0, revealMs: 2_600 };
/** How long the room takes to darken before the egg is presented. */
export const VEIL_MS = 700;

/** After the light clears, what the baby does, by time into the reveal (ms). */
export interface RevealMoment {
  face: BlobbiExpression;
  eyes: { x: number; y: number } | undefined;
  hop: boolean;
  caption: 'none' | 'hatched' | 'home';
}

const SHY: BlobbiExpression = { eyes: 'open', mouth: 'smile', brows: 'raised', blush: 'strong' };
const WIDE: BlobbiExpression = { eyes: 'wide', mouth: 'open', brows: 'raised', blush: 'none' };

/** The baby's first moments: blinking into the light, a look round, the player noticed, shy, then glad. */
export function revealMoment(t: number, reduced: boolean): RevealMoment {
  if (reduced) {
    if (t < 900) return { face: WIDE, eyes: undefined, hop: false, caption: 'hatched' };
    if (t < 1_800) return { face: SHY, eyes: { x: 0, y: 0.1 }, hop: false, caption: 'hatched' };
    return { face: 'happy', eyes: undefined, hop: false, caption: 'home' };
  }
  if (t < 600) return { face: WIDE, eyes: undefined, hop: false, caption: 'none' };
  if (t < 1_200) return { face: { blend: { surprised: 0.55, happy: 0.45 } }, eyes: { x: -0.85, y: 0.05 }, hop: false, caption: 'hatched' };
  if (t < 1_800) return { face: { blend: { surprised: 0.55, happy: 0.45 } }, eyes: { x: 0.85, y: -0.05 }, hop: false, caption: 'hatched' };
  if (t < 2_300) return { face: 'surprised', eyes: { x: 0, y: 0.15 }, hop: false, caption: 'hatched' };
  if (t < 3_400) return { face: SHY, eyes: { x: 0, y: 0.1 }, hop: false, caption: 'hatched' };
  if (t < 4_300) return { face: 'happy', eyes: undefined, hop: true, caption: 'home' };
  return { face: 'happy', eyes: undefined, hop: false, caption: 'home' };
}

/*
 * The first hatch is the player's (M12.3): the theatre opens by itself once the egg is home, and the shell gives way
 * under the player's taps, one crack a tap, the last tap opening it. Nothing is timed against the player: a tap is
 * never refused for being slow; one that follows the last within a blink is not counted, so every crack is seen.
 */

/** Taps that open the shell: three cracks (the renderer's light, medium, heavy shell), then the one that opens it. */
export const TAPS_TO_HATCH = 4;
/** The least time between two counted taps, so every crack is seen even under a drumroll of taps. */
export const TAP_SETTLE_MS = 180;
/** "Hatch it for me": the pace of the taps it makes for the player (reduced motion: quicker, nothing to watch move). */
export const AUTO_TAP_MS = 650;
export const REDUCED_AUTO_TAP_MS = 300;

/** The shell after `taps` taps: the renderer's own drawings. */
export function crackForTaps(taps: number): 'none' | 'light' | 'medium' | 'heavy' {
  if (taps <= 0) return 'none';
  if (taps === 1) return 'light';
  if (taps === 2) return 'medium';
  return 'heavy';
}

/** Whether a tap at `at` counts: the shell still closed, and the last counted tap a moment ago. */
export function tapCounts(taps: number, lastAt: number | null, at: number): boolean {
  if (taps >= TAPS_TO_HATCH) return false;
  return lastAt === null || at - lastAt >= TAP_SETTLE_MS;
}

/** What the theatre says while the shell is in the player's hands. */
export function tapCaption(taps: number): string {
  if (taps <= 0) return 'Tap your egg to help it hatch!';
  if (taps === 1) return 'A crack! Keep going…';
  if (taps === 2) return 'It is working! Tap again…';
  if (taps === 3) return 'Almost there… one more!';
  return 'Here it comes…';
}
