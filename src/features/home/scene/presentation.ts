/**
 * The one presentation state the renderer is handed, and the precedence that
 * builds it. Every input is application state; the renderer owns nothing
 * behavioural.
 *
 *   sleeping           > temporary reaction > baseline expression
 *   sleeping           > any motion (a sleeper is still)
 *   user-directed walk > idle walk            (decided in locomotion)
 *   walking            > gaze target          (eyes follow the road)
 */
import type { BlobbiEmotion, BlobbiMotion } from '@blobbi-kit/renderer';
import type { Facing, FloorPoint } from './geometry';
import type { EyeOffset } from './gaze';

export interface BlobbiPresentation {
  position: FloorPoint;
  facing: Facing;
  motion: BlobbiMotion;
  eyeOffset: EyeOffset | undefined;
  expression: BlobbiEmotion;
  isSleeping: boolean;
}

export interface PresentationInputs {
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
  isSleeping: boolean;
}

export function composePresentation(input: PresentationInputs): BlobbiPresentation {
  if (input.isSleeping) {
    return {
      position: input.position,
      facing: input.facing,
      motion: 'still',
      eyeOffset: undefined,
      expression: 'neutral',
      isSleeping: true,
    };
  }
  const walking = input.motion === 'walking';
  return {
    position: input.position,
    facing: input.facing,
    motion: walking ? 'walking' : 'idle',
    eyeOffset: walking ? input.travelGaze : input.gaze,
    expression: input.reaction ?? input.baseline,
    isSleeping: false,
  };
}
