/**
 * Behaviour mode: the one word that says who is in charge of the Blobbi
 * right now, and the policy table that says what each mode allows.
 *
 * Precedence is a fixed order, resolved in `resolveBehaviorMode`:
 *
 *   ceremony > editing > sleeping > nested > user-walk > free
 *
 * `ceremony` is the exclusive lifecycle mode (a hatch or an evolution in
 * progress): nothing else may move, look or react until the semantic write
 * has landed or failed. `nested` is an egg: it rests on its nest, still, has
 * no face to turn or eyes to move, and takes only a poke gesture.
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

export type BehaviorMode = 'ceremony' | 'editing' | 'sleeping' | 'nested' | 'user-walk' | 'free';

export const BEHAVIOR_MODES: readonly BehaviorMode[] = ['ceremony', 'editing', 'sleeping', 'nested', 'user-walk', 'free'];

export interface BehaviorPolicy {
  /** Who may start a walk in this mode. */
  walks: readonly WalkSource[];
  /** The idle clock runs. */
  idle: boolean;
  /** The eyes follow targets (pointer, taps, glances). */
  gaze: boolean;
  /** Care results and pokes may show a temporary face. */
  reactions: boolean;
  /**
   * What a poke may do to the body. `none`: nothing (a ceremony, decorating).
   * `gesture`: a body gesture only, no face (an egg has no face to change,
   * a sleeper keeps its eyes shut). `face`: a face only, no gesture (the
   * renderer is animating the walk; two transforms would fight). `full`.
   */
  pokes: 'none' | 'gesture' | 'face' | 'full';
  /** Floor taps and bed taps are accepted. */
  floorTaps: boolean;
  /** Body motion is forced to this, or null to let locomotion decide. */
  forcedMotion: 'still' | null;
}

export const BEHAVIOR_POLICY: Record<BehaviorMode, BehaviorPolicy> = {
  ceremony: { walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'none' },
  // Decorating: the Blobbi stands and watches; the room is the player's.
  editing: { walks: [], idle: false, gaze: true, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'none' },
  sleeping: { walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'gesture' },
  // An egg rests on its nest: no idle breathing or bob from the renderer, so it
  // sits on the mattress instead of hovering over it (a poke gesture is the
  // home's own, on the box, and still plays).
  nested: { walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'gesture' },
  'user-walk': { walks: ['user'], idle: false, gaze: true, reactions: true, floorTaps: true, forcedMotion: null, pokes: 'face' },
  free: { walks: ['user', 'idle'], idle: true, gaze: true, reactions: true, floorTaps: true, forcedMotion: null, pokes: 'full' },
};

export interface BehaviorModeInput {
  isSleeping: boolean;
  isUserWalking: boolean;
  /** A lifecycle ceremony is building or publishing. */
  isInCeremony?: boolean;
  /** The Blobbi is still an egg. */
  isEgg?: boolean;
  /** The player is decorating the room. */
  isEditing?: boolean;
}

/** The mode for the current facts, in precedence order. */
export function resolveBehaviorMode({ isSleeping, isUserWalking, isInCeremony = false, isEgg = false, isEditing = false }: BehaviorModeInput): BehaviorMode {
  if (isInCeremony) return 'ceremony';
  if (isEditing && !isSleeping) return 'editing';
  if (isSleeping) return 'sleeping';
  if (isEgg) return 'nested';
  if (isUserWalking) return 'user-walk';
  return 'free';
}

export function policyFor(mode: BehaviorMode): BehaviorPolicy {
  return BEHAVIOR_POLICY[mode];
}
