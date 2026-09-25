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
