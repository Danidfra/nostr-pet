import { DEFAULT_IDLE_TIMING, type IdleTiming, type Random } from './idle';
import { DEFAULT_WALK_SPEED } from './locomotion';

/**
 * Knobs for the behaviour layer. The app uses the defaults; tests inject a
 * scripted `random`, short idle timing, or a reduced-motion override so
 * every behaviour is deterministic. Nothing here is persisted or published.
 */
export interface SceneSettings {
  /** Overrides the `prefers-reduced-motion` media query when set. */
  reducedMotion?: boolean;
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
