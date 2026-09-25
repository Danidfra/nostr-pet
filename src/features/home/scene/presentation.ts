/**
 * The one presentation state the renderer is handed, and the precedence that
 * builds it. Every input is application state; the renderer owns nothing
 * behavioural.
 *
 * Who is in charge is decided first, as a mode (`behavior-mode.ts`):
 *
 *   sleeping > user-walk > free
 *
 * and this function only applies that mode's policy:
 *
 *   sleeping           : still, eyes shut, no gaze, neutral face
 *   any walk           : eyes on the road, not on the pointer; no body gesture
 *   temporary reaction > baseline expression (when reactions are allowed)
 *   a poke gesture     : only where the mode allows one, and never over a walk
 */
import type { BlobbiEmotion, BlobbiMotion } from '@blobbi-kit/renderer';
import { policyFor, type BehaviorMode } from './behavior-mode';
import type { Facing, FloorPoint } from './geometry';
import type { EyeOffset } from './gaze';
import type { ActiveGesture } from './useReactionPolicy';

export interface BlobbiPresentation {
  position: FloorPoint;
  facing: Facing;
  motion: BlobbiMotion;
  eyeOffset: EyeOffset | undefined;
  expression: BlobbiEmotion;
  isSleeping: boolean;
  /** A body gesture the actor plays on its own element; null when none or when the mode forbids one. */
  gesture: ActiveGesture | null;
}

export interface PresentationInputs {
  mode: BehaviorMode;
  position: FloorPoint;
  facing: Facing;
  /** From locomotion: idle or walking. */
  motion: 'idle' | 'walking';
  /** From the gaze policy; undefined when nothing draws the eyes. */
  gaze: EyeOffset | undefined;
  /** Where the eyes go while walking; undefined keeps them static. */
  travelGaze: EyeOffset | undefined;
  /** The temporary reaction, if one is running. */
  reaction: BlobbiEmotion | null;
  baseline: BlobbiEmotion;
  /** The gesture in flight, if one is. */
  gesture?: ActiveGesture | null;
}

export function composePresentation(input: PresentationInputs): BlobbiPresentation {
  const policy = policyFor(input.mode);
  const isSleeping = input.mode === 'sleeping';
  const walking = input.motion === 'walking';
  const motion: BlobbiMotion = policy.forcedMotion ?? (walking ? 'walking' : 'idle');

  let eyeOffset: EyeOffset | undefined;
  if (!policy.gaze) eyeOffset = undefined;
  else eyeOffset = walking ? input.travelGaze : input.gaze;

  const expression: BlobbiEmotion = isSleeping ? 'neutral' : policy.reactions ? (input.reaction ?? input.baseline) : input.baseline;

  // Precedence for the body: the renderer's walk owns it while walking (a
  // home gesture on top would fight it), so a walk shows the face only; a
  // sleeper and an egg may gesture but have no face to change.
  const gestureAllowed = policy.pokes === 'full' || policy.pokes === 'gesture';
  const gesture = gestureAllowed && !walking ? (input.gesture ?? null) : null;

  return { position: input.position, facing: input.facing, motion, eyeOffset, expression, isSleeping, gesture };
}
