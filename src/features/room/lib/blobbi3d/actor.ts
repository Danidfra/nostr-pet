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
import { createTeleport3D, type Teleport3D } from '@/features/teleport/three/teleport3d';
import type { JourneyFrame, JourneyKind } from '@/features/teleport/timeline';

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
  /**
   * The yaw (about +y, 0 toward +z) of the direction from the Blobbi to an
   * elevated camera that sees it (the room's). Given, the actor leans back
   * from that camera by its `lean`; absent, it stands upright.
   */
  viewAzimuth?: number;
  /** A journey to draw (teleporting): the model comes apart or together, its eyes shut while it concentrates. */
  journey?: { frame: JourneyFrame; kind: JourneyKind; t: number } | null;
}

/** Something the scene stands in a Blobbi's place and drives each frame. */
export interface ActorModel {
  object: THREE.Object3D;
  /** The model's height in model units; the scene scales it to the Blobbi's box in tiles. */
  box: number;
  /** How much faster than the drawing's pace this actor walks, its feet keeping step (`WALK_TEMPO_3D`). */
  pace: number;
  /** How far (radians) it leans back from an elevated camera that sees it (`ROOM_LEAN`); 0 stands upright. */
  lean: number;
  /** Pose for this frame. True while it keeps moving on its own (so the scene keeps drawing frames). */
  update(frame: ActorFrame): boolean;
  /** Play one of the home's body gestures (a glad bounce, a recoil, a stir, a wiggle) over the next frames. */
  gesture(kind: ActorGesture): void;
  /** The gaze as posed this frame, -1..1 each way (for tests and the lab). */
  gaze(): { x: number; y: number };
  dispose(): void;
}

/** The home's poke gestures (`home/personality.ts`), in the model's own body. */
export type ActorGesture = 'wiggle' | 'bounce' | 'recoil' | 'stir';

/**
 * Each gesture as a few keys of the figure's offsets, mirroring the home's
 * CSS keyframes (`home/scene/gestures.ts`) so the 2D and 3D Blobbi move
 * alike: `lift` in box heights, `sx`/`sy` the squash (about the ground, so
 * the feet stay down), `roll` a tilt in the view's plane, `shift` sideways
 * in box widths; times as fractions of the duration.
 */
interface GestureKey { at: number; lift?: number; sx?: number; sy?: number; roll?: number; shift?: number }
const GESTURE_KEYS: Record<ActorGesture, { durationMs: number; keys: GestureKey[] }> = {
  wiggle: { durationMs: 650, keys: [{ at: 0 }, { at: 0.2, roll: -7 }, { at: 0.45, roll: 6 }, { at: 0.7, roll: -4 }, { at: 0.88, roll: 2 }, { at: 1 }] },
  bounce: { durationMs: 520, keys: [{ at: 0 }, { at: 0.15, sx: 1.06, sy: 0.92 }, { at: 0.5, lift: 0.09, sx: 0.96, sy: 1.06 }, { at: 0.82, sx: 1.03, sy: 0.97 }, { at: 1 }] },
  recoil: { durationMs: 420, keys: [{ at: 0 }, { at: 0.25, shift: -0.04, roll: -3 }, { at: 0.55, shift: 0.03, roll: 2 }, { at: 1 }] },
  stir: { durationMs: 600, keys: [{ at: 0 }, { at: 0.5, roll: -1.5, sx: 1.01, sy: 0.99 }, { at: 1 }] },
};

/** The figure's offsets at `t` (0..1) through a gesture's keys, eased between keys. */
export function gestureAt(kind: ActorGesture, t: number): Required<Omit<GestureKey, 'at'>> {
  const keys = GESTURE_KEYS[kind].keys;
  const v = (k: GestureKey, f: keyof Omit<GestureKey, 'at'>) => k[f] ?? (f === 'sx' || f === 'sy' ? 1 : 0);
  const clamped = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].at < clamped) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const local = b.at > a.at ? (clamped - a.at) / (b.at - a.at) : 1;
  const e = local * local * (3 - 2 * local);
  const mix = (f: keyof Omit<GestureKey, 'at'>) => v(a, f) + (v(b, f) - v(a, f)) * e;
  return { lift: mix('lift'), sx: mix('sx'), sy: mix('sy'), roll: mix('roll'), shift: mix('shift') };
}

export const GESTURE_DURATION_MS: Record<ActorGesture, number> = Object.fromEntries(Object.entries(GESTURE_KEYS).map(([k, g]) => [k, g.durationMs])) as Record<ActorGesture, number>;

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

/**
 * How far a Blobbi leans back, away from the room's elevated camera, by
 * stage. The kit draws a baby as a seed whose crown rises only about 23°
 * above level at its tip; a solid true to both its silhouettes, seen from
 * the room's 35° above, hides that tip behind its own crown and reads as a
 * ball. Leaning back, its face turned up toward the viewer, lets the room's
 * camera see it nearly as the kit draws it: the tip, the narrower crown,
 * the fuller base, the face level. The geometry stays the kit's from every
 * side; only the pose changes, and only toward an elevated camera. An adult
 * stands on its feet and reads true as it is, so it stands upright.
 */
export const ROOM_LEAN: Readonly<Record<BlobbiModel['stage'], number>> = { baby: (18 * Math.PI) / 180, adult: 0 };

const Y_AXIS = new THREE.Vector3(0, 1, 0);

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
  const lean = ROOM_LEAN[model.stage] ?? 0;
  // The figure's resting pose, which a gesture moves about and always returns to
  const figure = model.figure;
  const restScale = figure.scale.clone();
  const restPosition = figure.position.clone();
  const restRotation = figure.rotation.clone();
  let playing: { kind: ActorGesture; startedAt: number } | null = null;
  // A journey's effect on this model, made the first time one is drawn
  let teleport: Teleport3D | null = null;
  let travelling = false;
  /** Pose the figure for the gesture in progress; true while one is. */
  const poseGesture = (): boolean => {
    if (!playing) return false;
    const t = (age - playing.startedAt) / (GESTURE_KEYS[playing.kind].durationMs / 1000);
    const g = gestureAt(playing.kind, t);
    figure.scale.set(restScale.x * g.sx, restScale.y * g.sy, restScale.z * g.sx);
    figure.position.set(restPosition.x + g.shift, restPosition.y + g.lift, restPosition.z);
    figure.rotation.set(restRotation.x, restRotation.y, restRotation.z + (g.roll * Math.PI) / 180);
    if (t >= 1) {
      playing = null;
      figure.scale.copy(restScale);
      figure.position.copy(restPosition);
      figure.rotation.copy(restRotation);
    }
    return true;
  };
  const yaw = new THREE.Quaternion();
  const tilt = new THREE.Quaternion();
  const leanAxis = new THREE.Vector3();
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
    lean,
    update(frame) {
      const reduced = options.reducedMotion?.() ?? false;
      age += frame.dt;
      if (!placed) {
        heading = frame.heading;
        placed = true;
      } else {
        heading = reduced ? frame.heading : turnToward(heading, frame.heading, frame.dt);
      }
      // Turned to its heading; leaned back from the camera that sees it, about the ground under it
      if (lean && frame.viewAzimuth !== undefined) {
        yaw.setFromAxisAngle(Y_AXIS, heading);
        leanAxis.set(Math.cos(frame.viewAzimuth), 0, -Math.sin(frame.viewAzimuth));
        tilt.setFromAxisAngle(leanAxis, -lean);
        model.root.quaternion.multiplyQuaternions(tilt, yaw);
      } else {
        model.root.rotation.set(0, heading, 0);
      }
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
      const journey = frame.journey ?? null;
      poseRig(model, { motion, phase, gaze, eyesClosed: eyesClosed || !!journey?.frame.eyesClosed });
      // A journey owns the body (its squash); a gesture plays only once it is whole again (the arrival's hop)
      const gesturing = journey && journey.frame.cut < 1 ? false : poseGesture();
      if (journey) {
        teleport ??= createTeleport3D({ root: model.root, figure: model.figure }, new THREE.Color(model.tint));
        if (!gesturing) teleport.apply(journey.frame, journey.kind, journey.t);
        travelling = true;
      } else if (travelling) {
        teleport?.rest();
        travelling = false;
      }
      const turning = Math.abs(Math.atan2(Math.sin(frame.heading - heading), Math.cos(frame.heading - heading))) > 0.002;
      const blinkChanged = eyesClosed !== lastEyes;
      lastEyes = eyesClosed;
      return travelling || gesturing || motion !== 'still' || turning || blinkChanged || !settled || (!reduced && !frame.sleeping);
    },
    gesture(kind) {
      // Reduced motion: no body gestures, as on the home
      if (options.reducedMotion?.()) return;
      playing = { kind, startedAt: age };
    },
    gaze: () => ({ x: gaze.x, y: gaze.y }),
    dispose: () => {
      teleport?.dispose();
      model.dispose();
    },
  };
}
