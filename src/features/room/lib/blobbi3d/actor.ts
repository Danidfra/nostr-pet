/**
 * The 3D Blobbi as an actor in the room: what the scene drives each frame.
 *
 * The scene says how the actor moves (standing, walking), which way it is
 * heading, whether it sleeps and what, if anything, it looks at; the actor
 * keeps the motion's phase, turns smoothly toward the heading, blinks on
 * its seed's cadence, eases its gaze, and poses the model (`rig.ts`). It
 * is presentation only: the scene's Blobbi position, path and facing are
 * untouched, so the 2D drawing and the 3D model are interchangeable views
 * of the same walk.
 *
 * The gaze: the kit's eyes look by an offset of -1..1 across and up, as
 * far as its `travel` lets the pupils move (`useGazePolicy` on the home
 * gives that offset from the pointer). Here the offset is found from a
 * point in the world the Blobbi looks at: the direction to it from the
 * eyes, in the Blobbi's own frame, scaled so a target well off the axis
 * is a full look, clamped to the unit disc, and FADED to nothing as the
 * face turns away from it (a Blobbi cannot look at what is behind its
 * head, so it stops looking rather than squinting sideways). Every
 * change is eased over a few frames, so nothing jumps: not a new target,
 * not the target leaving, not a turn of the body under a fixed target.
 */
import * as THREE from 'three';
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
  /** Where the eyes look as the kit's offset (-1..1 each way), when the caller decides it (a travel glance). */
  gaze?: { x: number; y: number };
  /** A point in the world to look at (the pointer, another Blobbi); the resting gaze when absent. */
  lookAt?: THREE.Vector3 | null;
}

/** Something the scene stands in a Blobbi's place and drives each frame. */
export interface ActorModel {
  object: THREE.Object3D;
  /** The model's height in model units; the scene scales it to the Blobbi's box in tiles. */
  box: number;
  /** How much faster than the drawing's pace this actor walks, its feet keeping step (`WALK_TEMPO_3D`). */
  pace: number;
  /** Pose for this frame. True while it keeps moving on its own (so the scene keeps drawing frames). */
  update(frame: ActorFrame): boolean;
  /** The gaze as posed this frame, -1..1 each way (for tests and the lab). */
  gaze(): { x: number; y: number };
  dispose(): void;
}

export interface ActorOptions {
  /** Seconds per walk cycle (the room's tempo); the kit's by default. Played `WALK_TEMPO_3D` times faster. */
  walkCycle?: number;
  /** Seconds per idle breath; the kit's by default. */
  idleCycle?: number;
  reducedMotion?: () => boolean;
}

/**
 * The 3D walk is a little brisker than the drawing's (the review asked for
 * 5–10% more): the cycle plays this much faster and the scene moves the
 * actor this much faster with it, so a planted foot keeps its spot.
 */
export const WALK_TEMPO_3D = 1.08;

/** A target this far off the eyes' axis (as a sine) is a full look. */
const FULL_LOOK = Math.sin((35 * Math.PI) / 180);
/** The gaze eases toward its target at this rate (per second). */
const GAZE_RATE = 10;

export function createBlobbiActor(model: BlobbiModel, options: ActorOptions = {}): ActorModel {
  const walkCycle = (options.walkCycle ?? MOTION_DURATION.walking) / WALK_TEMPO_3D;
  const idleCycle = options.idleCycle ?? MOTION_DURATION.idle;
  let phase = 0;
  let age = 0;
  let heading = 0;
  let placed = false;
  let lastEyes = false;
  const gaze = { x: 0, y: 0 };
  const wanted = { x: 0, y: 0 };
  const eyeCentre = new THREE.Vector3();
  const toEyes = new THREE.Vector3();
  const inverse = new THREE.Quaternion();

  /** The offset the eyes want, from what the frame says. */
  const aim = (frame: ActorFrame) => {
    if (frame.gaze) {
      wanted.x = frame.gaze.x;
      wanted.y = frame.gaze.y;
    } else if (frame.lookAt) {
      // The eyes' place in the world, and the direction to the target in the Blobbi's own frame
      model.root.updateWorldMatrix(true, false);
      eyeCentre.set(0, 0, 0);
      for (const eye of model.rig.eyes) eyeCentre.add(eye.group.getWorldPosition(new THREE.Vector3()));
      eyeCentre.divideScalar(Math.max(1, model.rig.eyes.length));
      toEyes.subVectors(frame.lookAt, eyeCentre);
      if (toEyes.lengthSq() < 1e-12) {
        wanted.x = wanted.y = 0;
      } else {
        toEyes.normalize().applyQuaternion(model.root.getWorldQuaternion(inverse).invert());
        // Facing the target: a full look; beside or behind the head: no look at all
        const facing = THREE.MathUtils.smoothstep(toEyes.z, 0.1, 0.55);
        wanted.x = (toEyes.x / FULL_LOOK) * facing;
        wanted.y = (-toEyes.y / FULL_LOOK) * facing;
      }
    } else {
      wanted.x = wanted.y = 0;
    }
    const len = Math.hypot(wanted.x, wanted.y);
    if (len > 1) {
      wanted.x /= len;
      wanted.y /= len;
    }
  };

  return {
    object: model.root,
    box: 1,
    pace: WALK_TEMPO_3D,
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
      // A still pose (a comparison still, an egg) never catches a blink; a living one blinks on its seed's cadence
      const eyesClosed = frame.sleeping || (!reduced && motion !== 'still' && blinking(age, model.seed));
      aim(frame);
      const ease = reduced ? 1 : 1 - Math.exp(-GAZE_RATE * frame.dt);
      gaze.x += (wanted.x - gaze.x) * ease;
      gaze.y += (wanted.y - gaze.y) * ease;
      const settled = Math.abs(wanted.x - gaze.x) < 0.002 && Math.abs(wanted.y - gaze.y) < 0.002;
      if (settled) {
        gaze.x = wanted.x;
        gaze.y = wanted.y;
      }
      poseRig(model, { motion, phase, gaze, eyesClosed });
      const turning = Math.abs(Math.atan2(Math.sin(frame.heading - heading), Math.cos(frame.heading - heading))) > 0.002;
      const blinkChanged = eyesClosed !== lastEyes;
      lastEyes = eyesClosed;
      return motion !== 'still' || turning || blinkChanged || !settled || (!reduced && !frame.sleeping);
    },
    gaze: () => ({ x: gaze.x, y: gaze.y }),
    dispose: () => model.dispose(),
  };
}
