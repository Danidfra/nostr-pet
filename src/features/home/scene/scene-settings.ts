import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import type { EyeOffset } from './gaze';
import type { Facing } from './geometry';
import { DEFAULT_IDLE_TIMING, type IdleTiming, type Random } from './idle';
import { DEFAULT_WALK_SPEED } from './locomotion';
import type { BlobbiSceneController } from './useBlobbiPresentation';

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
  /** Pins the gaze; null or absent lets the gaze policy decide. */
  gaze?: EyeOffset | null;
  /** Pins the body motion in place (`idle` or `walking`); null or absent lets locomotion decide. */
  motion?: 'idle' | 'walking' | null;
  /**
   * Told about the scene controller of every Blobbi presentation that mounts
   * under these settings (null when it unmounts). A seam for a dev harness
   * that drives the same walks, turns and pokes the game does; the app sets
   * nothing here.
   */
  onController?: (controller: BlobbiSceneController | null) => void;
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
