import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import type { Facing } from './geometry';
import { DEFAULT_IDLE_TIMING, type IdleTiming, type Random } from './idle';
import { DEFAULT_WALK_SPEED } from './locomotion';

/**
 * Knobs for the behaviour layer. The app uses the defaults; tests inject a
 * scripted `random`, short idle timing, or a reduced-motion override so
 * every behaviour is deterministic, and the dev fixture pins a face or a
 * facing to look at. Nothing here is persisted or published.
 */
export interface SceneSettings {
  /** Overrides the `prefers-reduced-motion` media query when set. */
  reducedMotion?: boolean;
  /** Pins the baseline face; null or absent lets the condition decide. Reactions still play over it. */
  baselineExpression?: BlobbiEmotion | null;
  /** Pins the facing; null or absent lets locomotion decide. */
  facing?: Facing | null;
  random: Random;
  idle: IdleTiming;
  /** Idle behaviour on or off (off in tests that are not about it). */
  idleEnabled: boolean;
  walkSpeed: number;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  random: Math.random,
  idle: DEFAULT_IDLE_TIMING,
  idleEnabled: true,
  walkSpeed: DEFAULT_WALK_SPEED,
};
