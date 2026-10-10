/**
 * The 3D rig moves as the kit's motions say: nothing at rest, a breath while
 * idle, planted-and-swung feet and swinging arms on the walk, a smooth turn
 * the short way round, deterministic blinks, shut eyes asleep.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { blinking, BLINK_SECONDS, poseRig, turnToward } from './rig';
import { createBlobbiActor } from './actor';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

let built: BlobbiModel[] = [];
afterEach(() => {
  for (const m of built) m.dispose();
  built = [];
});

function adult(seed = 'lab-1'): BlobbiModel {
  const m = buildBlobbiModel(deriveMorphology(generateGenome(seed), 'adult'), seed);
  built.push(m);
  return m;
}

describe('poseRig', () => {
  it('rests at the built pose when still, and comes back to it', () => {
    const m = adult();
    const restY = m.rig.legs.left!.position.y;
    poseRig(m, { motion: 'walking', phase: 0.25 });
    poseRig(m, { motion: 'still', phase: 0.7 });
    expect(m.rig.body.scale.y).toBe(1);
    expect(m.rig.body.position.y).toBe(0);
    expect(m.rig.legs.left!.position.y).toBe(restY);
    expect(m.rig.arms.left!.rotation.z).toBeCloseTo(0);
  });

  it('breathes while idle: the body swells mid-breath', () => {
    const m = adult();
    poseRig(m, { motion: 'idle', phase: 0 });
    expect(m.rig.body.scale.y).toBeCloseTo(1, 5);
    poseRig(m, { motion: 'idle', phase: 0.5 });
    expect(m.rig.body.scale.y).toBeGreaterThan(1.01);
    expect(m.rig.body.scale.x).toBeGreaterThan(1.005);
  });

  it('walks: the feet lift and swing half a cycle apart, the body bobs, the arms swing', () => {
    const m = adult();
    const rest = { left: m.rig.legs.left!.position.clone(), right: m.rig.legs.right!.position.clone() };
    poseRig(m, { motion: 'walking', phase: 0 });
    const left = m.rig.legs.left!.position.clone();
    const right = m.rig.legs.right!.position.clone();
    // At the start of a cycle one foot is at the front of its stride, the other at the back
    expect(left.z).not.toBeCloseTo(right.z, 3);
    expect(m.rig.arms.left!.rotation.x).not.toBeCloseTo(0, 3);
    expect(Math.sign(m.rig.arms.left!.rotation.x)).toBe(-Math.sign(m.rig.arms.right!.rotation.x));
    poseRig(m, { motion: 'walking', phase: 0.5 });
    // Half a cycle on, the feet have swapped roles
    expect(Math.sign(m.rig.legs.left!.position.z - rest.left.z)).toBe(-Math.sign(left.z - rest.left.z));
    expect(Math.sign(m.rig.legs.right!.position.z - rest.right.z)).toBe(-Math.sign(right.z - rest.right.z));
    // A quarter in, a foot is lifted and the body rides up over the planted one
    poseRig(m, { motion: 'walking', phase: 0.25 });
    expect(Math.abs(m.rig.legs.left!.position.y - rest.left.y) + Math.abs(m.rig.legs.right!.position.y - rest.right.y)).toBeGreaterThan(0.002);
    expect(m.rig.body.position.y).toBeGreaterThan(0);
  });

  it('shuts the eyes asleep and opens them awake', () => {
    const m = adult();
    poseRig(m, { motion: 'still', phase: 0, eyesClosed: true });
    for (const eye of m.rig.eyes) {
      expect(eye.open.visible).toBe(false);
      expect(eye.closed!.visible).toBe(true);
    }
    poseRig(m, { motion: 'still', phase: 0, eyesClosed: false, gaze: { x: 1, y: 0 } });
    for (const eye of m.rig.eyes) {
      expect(eye.open.visible).toBe(true);
      expect(eye.closed!.visible).toBe(false);
      expect(eye.inner.position.x).toBeGreaterThan(0);
    }
  });
});

describe('turning and blinking', () => {
  it('turns the short way round and settles exactly', () => {
    expect(turnToward(0, 3, 10)).toBeCloseTo(3, 3);
    expect(turnToward(0, 3.5, 10)).toBeCloseTo(3.5 - 2 * Math.PI, 3);
    const step = turnToward(0, 1, 0.1);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(1);
    expect(turnToward(0.9995, 1, 0.01)).toBe(1);
  });

  it('blinks on a steady cadence that depends only on the seed and the time', () => {
    const seed = 'ab'.repeat(32);
    const times = Array.from({ length: 600 }, (_, i) => i / 100);
    const a = times.map((t) => blinking(t, seed));
    const b = times.map((t) => blinking(t, seed));
    expect(a).toEqual(b);
    expect(a.some(Boolean)).toBe(true);
    expect(a.filter(Boolean).length).toBeLessThan(a.length * 0.1);
    expect(BLINK_SECONDS).toBeLessThan(0.3);
    const other = times.map((t) => blinking(t, 'ff'.repeat(32)));
    expect(other).not.toEqual(a);
  });

  it('as an actor, eases toward the heading and keeps animating while anything moves', () => {
    const m = adult();
    const actor = createBlobbiActor(m, { reducedMotion: () => false });
    expect(actor.update({ dt: 1 / 60, motion: 'idle', heading: 1, sleeping: false })).toBe(true);
    expect(actor.object.rotation.y).toBe(1); // placed facing its first heading at once
    actor.update({ dt: 1 / 60, motion: 'idle', heading: 2, sleeping: false });
    expect(actor.object.rotation.y).toBeGreaterThan(1);
    expect(actor.object.rotation.y).toBeLessThan(2);
    for (let i = 0; i < 300; i++) actor.update({ dt: 1 / 60, motion: 'idle', heading: 2, sleeping: false });
    expect(actor.object.rotation.y).toBeCloseTo(2, 3);
    // Asleep: still, eyes shut
    actor.update({ dt: 1 / 60, motion: 'walking', heading: 2, sleeping: true });
    for (const eye of m.rig.eyes) expect(eye.open.visible).toBe(false);
    expect(m.rig.body.position.y).toBe(0);
  });

  it('under reduced motion, snaps to the heading and does not animate', () => {
    const m = adult();
    const actor = createBlobbiActor(m, { reducedMotion: () => true });
    actor.update({ dt: 1 / 60, motion: 'idle', heading: 1, sleeping: false });
    expect(actor.update({ dt: 1 / 60, motion: 'walking', heading: 2, sleeping: false })).toBe(false);
    expect(actor.object.rotation.y).toBe(2);
    expect(m.rig.body.scale.y).toBe(1);
  });
});
