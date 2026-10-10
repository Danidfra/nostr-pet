/**
 * The 3D Blobbi as an actor in the room: what the scene drives each frame.
 *
 * The scene says how the actor moves (standing, walking), which way it is
 * heading and whether it sleeps; the actor keeps the motion's phase, turns
 * smoothly toward the heading, blinks on its seed's cadence and poses the
 * model (`rig.ts`). It is presentation only: the scene's Blobbi position,
 * path and facing are untouched, so the 2D drawing and the 3D model are
 * interchangeable views of the same walk.
 */
import type * as THREE from 'three';
import { MOTION_DURATION, type BlobbiMotion } from '@blobbi-kit/renderer/procedural';
import type { BlobbiModel } from './model';
import { blinking, poseRig, turnToward } from './rig';

export interface ActorFrame {
  /** Seconds since the last frame. */
  dt: number;
  motion: BlobbiMotion;
  /** Yaw about +y: 0 faces +z. */
  heading: number;
  sleeping: boolean;
  /** Where the eyes look, if anything is looked at. */
  gaze?: { x: number; y: number };
}

/** Something the scene stands in a Blobbi's place and drives each frame. */
export interface ActorModel {
  object: THREE.Object3D;
  /** The model's height in model units; the scene scales it to the Blobbi's box in tiles. */
  box: number;
  /** Pose for this frame. True while it keeps moving on its own (so the scene keeps drawing frames). */
  update(frame: ActorFrame): boolean;
  dispose(): void;
}

export interface ActorOptions {
  /** Seconds per walk cycle (the room's tempo); the kit's by default. */
  walkCycle?: number;
  /** Seconds per idle breath; the kit's by default. */
  idleCycle?: number;
  reducedMotion?: () => boolean;
}

export function createBlobbiActor(model: BlobbiModel, options: ActorOptions = {}): ActorModel {
  const walkCycle = options.walkCycle ?? MOTION_DURATION.walking;
  const idleCycle = options.idleCycle ?? MOTION_DURATION.idle;
  let phase = 0;
  let age = 0;
  let heading = 0;
  let placed = false;
  let lastEyes = false;
  return {
    object: model.root,
    box: 1,
    update(frame) {
      const reduced = options.reducedMotion?.() ?? false;
      age += frame.dt;
      if (!placed) {
        heading = frame.heading;
        placed = true;
      } else {
        heading = reduced ? frame.heading : turnToward(heading, frame.heading, frame.dt);
      }
      model.root.rotation.y = heading;
      const motion: BlobbiMotion = reduced || frame.sleeping ? 'still' : frame.motion;
      const cycle = motion === 'walking' ? walkCycle : idleCycle;
      phase = motion === 'still' ? 0 : (phase + frame.dt / cycle) % 1;
      const eyesClosed = frame.sleeping || (!reduced && blinking(age, model.seed));
      poseRig(model, { motion, phase, gaze: frame.gaze, eyesClosed });
      const turning = Math.abs(Math.atan2(Math.sin(frame.heading - heading), Math.cos(frame.heading - heading))) > 0.002;
      const blinkChanged = eyesClosed !== lastEyes;
      lastEyes = eyesClosed;
      return motion !== 'still' || turning || blinkChanged || (!reduced && !frame.sleeping);
    },
    dispose: () => model.dispose(),
  };
}
