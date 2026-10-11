/**
 * The home's body gestures, in the 3D model: the same moves as the 2D
 * drawing's keyframes (a glad bounce lifts and squashes, a recoil leans
 * back, a stir barely settles, a wiggle rocks), always about the ground so
 * the feet stay down, and always back to exactly the resting pose.
 * Reduced motion: none, as on the home.
 */
import { describe, expect, it } from 'vitest';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { buildBlobbiModel } from './model';
import { createBlobbiActor, gestureAt, GESTURE_DURATION_MS } from './actor';
import { genomeOf, labBlobbi, morphologyOf } from './identity';
import { GESTURES } from '@/features/home/scene/gestures';

function model() {
  const genome = genomeOf(toBlobbiVisual(labBlobbi('d'.repeat(64), '0000000004', 'x', 'adult')))!;
  return buildBlobbiModel(morphologyOf(genome, 'adult'), genome.seed);
}

describe('the 3D Blobbi\'s gestures', () => {
  it('play the home\'s four gestures for as long as the drawing plays them, from rest back to rest', () => {
    for (const kind of ['wiggle', 'bounce', 'recoil', 'stir'] as const) {
      expect(GESTURE_DURATION_MS[kind]).toBe(GESTURES[kind].durationMs);
      for (const t of [0, 1]) expect(gestureAt(kind, t)).toEqual({ lift: 0, sx: 1, sy: 1, roll: 0, shift: 0 });
    }
    const top = gestureAt('bounce', 0.5);
    expect(top.lift).toBeCloseTo(0.09, 6);
    expect(gestureAt('bounce', 0.15).sy).toBeLessThan(1);
    expect(gestureAt('recoil', 0.25).shift).toBeLessThan(0);
    expect(Math.abs(gestureAt('wiggle', 0.2).roll)).toBeGreaterThan(5);
  });

  it('move the figure about the ground and put it back exactly; the root (where the scene stands it) is never touched', () => {
    const m = model();
    const actor = createBlobbiActor(m, { reducedMotion: () => false });
    const rest = { scale: m.figure.scale.clone(), position: m.figure.position.clone(), rotation: m.figure.rotation.clone() };
    actor.update({ dt: 0.016, motion: 'idle', heading: 0, sleeping: false });
    const root = m.root.position.clone();
    actor.gesture('bounce');
    actor.update({ dt: 0.26, motion: 'idle', heading: 0, sleeping: false });
    expect(m.figure.position.y).toBeGreaterThan(rest.position.y);
    expect(actor.update({ dt: 0.01, motion: 'idle', heading: 0, sleeping: false })).toBe(true);
    for (let i = 0; i < 40; i++) actor.update({ dt: 0.05, motion: 'idle', heading: 0, sleeping: false });
    expect(m.figure.scale.toArray()).toEqual(rest.scale.toArray());
    expect(m.figure.position.toArray()).toEqual(rest.position.toArray());
    expect(m.figure.rotation.toArray()).toEqual(rest.rotation.toArray());
    expect(m.root.position.toArray()).toEqual(root.toArray());
    m.dispose();
  });

  it('under reduced motion there is no gesture', () => {
    const m = model();
    const actor = createBlobbiActor(m, { reducedMotion: () => true });
    const before = m.figure.position.clone();
    actor.gesture('bounce');
    actor.update({ dt: 0.26, motion: 'idle', heading: 0, sleeping: false });
    expect(m.figure.position.toArray()).toEqual(before.toArray());
    m.dispose();
  });
});
