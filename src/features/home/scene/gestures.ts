/**
 * The body gestures a poke can play (`personality.ts` decides which). Each
 * is a short keyframe list on the actor's own box, the home's element
 * around the renderer, composited *onto* whatever transform the box has
 * (the sleeping pose), never onto the renderer's root. Durations are
 * short on purpose: a gesture is an acknowledgement, not a performance.
 */
import type { PokeGesture } from '../personality';

export interface GestureSpec {
  keyframes: Keyframe[];
  durationMs: number;
  easing: string;
}

export const GESTURES: Record<PokeGesture, GestureSpec> = {
  wiggle: {
    keyframes: [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(-7deg)', offset: 0.2 },
      { transform: 'rotate(6deg)', offset: 0.45 },
      { transform: 'rotate(-4deg)', offset: 0.7 },
      { transform: 'rotate(2deg)', offset: 0.88 },
      { transform: 'rotate(0deg)' },
    ],
    durationMs: 650,
    easing: 'ease-in-out',
  },
  bounce: {
    keyframes: [
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(2%) scale(1.06, 0.92)', offset: 0.15 },
      { transform: 'translateY(-9%) scale(0.96, 1.06)', offset: 0.5 },
      { transform: 'translateY(0) scale(1.03, 0.97)', offset: 0.82 },
      { transform: 'translateY(0) scale(1, 1)' },
    ],
    durationMs: 520,
    easing: 'ease-out',
  },
  recoil: {
    keyframes: [
      { transform: 'translateX(0) rotate(0deg)' },
      { transform: 'translateX(-4%) rotate(-3deg)', offset: 0.25 },
      { transform: 'translateX(3%) rotate(2deg)', offset: 0.55 },
      { transform: 'translateX(0) rotate(0deg)' },
    ],
    durationMs: 420,
    easing: 'ease-out',
  },
  stir: {
    keyframes: [{ transform: 'rotate(0deg) scale(1, 1)' }, { transform: 'rotate(-1.5deg) scale(1.01, 0.99)', offset: 0.5 }, { transform: 'rotate(0deg) scale(1, 1)' }],
    durationMs: 600,
    easing: 'ease-in-out',
  },
};

/**
 * A hatching shell rocking on the point it rests on. `level` is how far along
 * the hatch is (1: something stirs; 4: the shell is about to give): each
 * level tips further and faster. The pivot is the base of the shell, not the
 * middle of the box, so the keyframes carry the small sideways shift that
 * turning about a point `PIVOT_BELOW` under the centre adds to a plain
 * rotation. Looped by the actor for as long as the beat lasts.
 */
const PIVOT_BELOW = 38; // % of the box, from its centre down to where the shell touches the ground
const ROCK_DEGREES = [0, 2.2, 4, 6, 8.5] as const;
const ROCK_MS = [0, 1_300, 760, 520, 340] as const;

function rockFrame(degrees: number): string {
  const radians = (degrees * Math.PI) / 180;
  const x = PIVOT_BELOW * Math.sin(radians);
  const y = PIVOT_BELOW * (1 - Math.cos(radians));
  return `translate(${x.toFixed(3)}%, ${y.toFixed(3)}%) rotate(${degrees}deg)`;
}

export function hatchRock(level: 1 | 2 | 3 | 4): GestureSpec {
  const tip = ROCK_DEGREES[level];
  return {
    // Each swing eases by itself (out to the tip, back in through the middle), so the loop never pauses.
    keyframes: [
      { transform: rockFrame(0), easing: 'ease-out' },
      { transform: rockFrame(-tip), offset: 0.25, easing: 'ease-in' },
      { transform: rockFrame(0), offset: 0.5, easing: 'ease-out' },
      { transform: rockFrame(tip), offset: 0.75, easing: 'ease-in' },
      { transform: rockFrame(0) },
    ],
    durationMs: ROCK_MS[level],
    easing: 'linear',
  };
}
