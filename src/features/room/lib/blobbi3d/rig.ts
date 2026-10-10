/**
 * MOTION on the 3D model: the kit's `motionPose`, in three dimensions.
 *
 * The kit defines every motion (idle breathing, the walk, the baby's hop,
 * the egg's rock) as a pure function from a phase to a small transform per
 * rig part, once for the front view and once for the side view. Here the
 * front view's pose moves a part across and up and rolls it, and the side
 * view's pose moves it forward and pitches it, about the same pivot the kit
 * turns it about, so the 3D Blobbi breathes, steps and swings exactly as the
 * 2D drawing does, from either side at once. Turning and blinking are the
 * only motions of its own: the drawing has a facing, the model has a heading.
 */
import type * as THREE from 'three';
import { motionPose, type BlobbiMotion, type RigPart } from '@blobbi-kit/renderer/procedural';
import { U } from './units';
import type { BlobbiModel } from './model';

const DEG = Math.PI / 180;

export interface RigState {
  motion: BlobbiMotion;
  /** 0..1 through one cycle of the motion. */
  phase: number;
  /** Where the eyes look, -1..1 each way, as the kit's gaze. */
  gaze?: { x: number; y: number };
  eyesClosed?: boolean;
}

interface Rest {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

function rest(o: THREE.Object3D): Rest {
  return o.userData.rest as Rest;
}

/** Pose one part from its front- and side-view poses. */
function pose(group: THREE.Group | null, model: BlobbiModel, state: RigState, frontPart: RigPart, sidePart: RigPart) {
  if (!group) return;
  const r = rest(group);
  const f = motionPose(state.motion, 'front', frontPart, state.phase, model.scale, model.gait);
  const s = motionPose(state.motion, 'side', sidePart, state.phase, model.scale, model.gait);
  // Across and up from the front view, forward from the side view (the side faces screen-right: +x there is +z here)
  group.position.set(r.position.x + f.tx * U, r.position.y - Math.min(f.ty, s.ty) * U, r.position.z + s.tx * U);
  // A clockwise turn on the front drawing is a roll about -z here; on the side drawing, a pitch about +x
  group.rotation.set(r.rotation.x + s.rot * DEG, r.rotation.y, r.rotation.z - f.rot * DEG);
  group.scale.set(r.scale.x * f.sx, r.scale.y * f.sy, r.scale.z * f.sx);
}

/** Put the whole model in the pose of one instant. */
export function poseRig(model: BlobbiModel, state: RigState): void {
  const { rig } = model;
  pose(rig.body, model, state, 'body', 'body');
  pose(rig.legs.left, model, state, 'left-leg', 'near-leg');
  pose(rig.legs.right, model, state, 'right-leg', 'far-leg');
  pose(rig.arms.left, model, state, 'left-arm', 'near-arm');
  pose(rig.arms.right, model, state, 'right-arm', 'far-arm');
  pose(rig.tuft, model, state, 'tuft', 'tuft');
  for (const a of rig.appendages) {
    if (a.sway) pose(a.group, model, state, a.sway, a.sway);
  }
  const gaze = state.gaze ?? { x: 0, y: 0 };
  for (const eye of rig.eyes) {
    // The inner eye slides over the white along the surface, as far as the kit lets the pupils travel
    eye.inner.position.copy(eye.across).multiplyScalar(gaze.x * eye.travel * U).addScaledVector(eye.up, -gaze.y * eye.travel * U);
    const closed = !!state.eyesClosed;
    // Shut: the white and all on it squeezed to a line at the lid, the lid's line drawn over it
    eye.open.scale.y = closed ? 0.06 : 1;
    eye.open.visible = !closed || eye.closed === null;
    if (eye.closed) eye.closed.visible = closed;
  }
}

/** The yaw that faces a view: the front faces the viewer, the side faces screen-right as the kit's side view does. */
export function yawForView(view: 'front' | 'side' | 'back'): number {
  return view === 'front' ? 0 : view === 'side' ? Math.PI / 2 : Math.PI;
}

/** Ease a heading toward another the short way round. Settles exactly when close. */
export function turnToward(current: number, target: number, dt: number, rate = 9): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (Math.abs(delta) < 0.002) return target;
  return current + delta * (1 - Math.exp(-rate * dt));
}

/** How long a blink shuts the eyes, seconds. */
export const BLINK_SECONDS = 0.13;

/**
 * Whether the eyes are shut at `seconds` into the model's life: a steady
 * cadence set by the seed (a few seconds apart, each Blobbi its own), so
 * two viewers of the same Blobbi see the same blinks and no dice are rolled.
 */
export function blinking(seconds: number, seed: string): boolean {
  const h = parseInt(seed.slice(0, 8) || '0', 16) / 0xffffffff;
  const period = 3.4 + 1.8 * (Number.isFinite(h) ? h : 0);
  const offset = period * 0.6 * (Number.isFinite(h) ? h : 0);
  const t = (seconds + offset) % period;
  return t >= 0 && t < BLINK_SECONDS;
}
