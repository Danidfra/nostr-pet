/**
 * Behaviour mode: the one word that says who is in charge of the Blobbi
 * right now, and the policy table that says what each mode allows.
 *
 * Precedence is a fixed order, resolved in `resolveBehaviorMode`:
 *
 *   sleeping > user-walk > free
 *
 * Every gate in the behaviour layer reads the policy for the resolved mode
 * instead of testing `isSleeping` / `isUserWalking` on its own, so a future
 * exclusive mode (a lifecycle ceremony, say) is one more word here, one
 * more row in the table, and nothing else. Locomotion keeps one rule of
 * its own, "an idle walk never replaces a user walk in progress"
 * (`beginWalk`), because that is about replacing a walk, not about what a
 * mode allows; the table's `walks` field decides which sources may start
 * one at all.
 */
import type { WalkSource } from './locomotion';

export type BehaviorMode = 'sleeping' | 'user-walk' | 'free';

export const BEHAVIOR_MODES: readonly BehaviorMode[] = ['sleeping', 'user-walk', 'free'];

export interface BehaviorPolicy {
  /** Who may start a walk in this mode. */
  walks: readonly WalkSource[];
  /** The idle clock runs. */
  idle: boolean;
  /** The eyes follow targets (pointer, taps, glances). */
  gaze: boolean;
  /** Care results and pokes may show a temporary face. */
  reactions: boolean;
  /** Floor taps and bed taps are accepted. */
  floorTaps: boolean;
  /** Body motion is forced to this, or null to let locomotion decide. */
  forcedMotion: 'still' | null;
}

export const BEHAVIOR_POLICY: Record<BehaviorMode, BehaviorPolicy> = {
  sleeping: { walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still' },
  'user-walk': { walks: ['user'], idle: false, gaze: true, reactions: true, floorTaps: true, forcedMotion: null },
  free: { walks: ['user', 'idle'], idle: true, gaze: true, reactions: true, floorTaps: true, forcedMotion: null },
};

export interface BehaviorModeInput {
  isSleeping: boolean;
  isUserWalking: boolean;
}

/** The mode for the current facts, in precedence order. */
export function resolveBehaviorMode({ isSleeping, isUserWalking }: BehaviorModeInput): BehaviorMode {
  if (isSleeping) return 'sleeping';
  if (isUserWalking) return 'user-walk';
  return 'free';
}

export function policyFor(mode: BehaviorMode): BehaviorPolicy {
  return BEHAVIOR_POLICY[mode];
}
