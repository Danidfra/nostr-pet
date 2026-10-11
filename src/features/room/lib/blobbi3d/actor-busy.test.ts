/**
 * What the scene draws at full rate and what at the gentler idle rate: a
 * 3D Blobbi only breathing and blinking is idle life (`busy` false, though
 * it still wants frames); walking, turning, a gesture, a new face, a pose,
 * or its eyes still settling on a new look are busy.
 */
import { describe, expect, it } from 'vitest';
import { deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { buildBlobbiModel } from './model';
import { createBlobbiActor } from './actor';

describe('idle life and busy frames', () => {
  it('breathing alone is idle; a walk, a turn, a gesture, a face, a pose or a settling look is busy', () => {
    const model = buildBlobbiModel(deriveMorphology(generateGenome('busy-1'), 'adult'), 'busy-1');
    const actor = createBlobbiActor(model, { reducedMotion: () => false });
    const base = { dt: 1 / 60, motion: 'idle' as const, heading: 0, sleeping: false };
    // Settle first
    for (let i = 0; i < 120; i++) actor.update(base);
    expect(actor.update(base)).toBe(true);
    expect(actor.busy?.()).toBe(false);
    expect(actor.update({ ...base, motion: 'walking' })).toBe(true);
    expect(actor.busy?.()).toBe(true);
    for (let i = 0; i < 120; i++) actor.update(base);
    actor.update({ ...base, heading: 2 });
    expect(actor.busy?.()).toBe(true);
    for (let i = 0; i < 240; i++) actor.update({ ...base, heading: 2 });
    expect(actor.busy?.()).toBe(false);
    actor.update({ ...base, heading: 2, gaze: { x: 1, y: 0 } });
    expect(actor.busy?.()).toBe(true);
    for (let i = 0; i < 240; i++) actor.update({ ...base, heading: 2, gaze: { x: 1, y: 0 } });
    expect(actor.busy?.()).toBe(false);
    actor.update({ ...base, heading: 2, gaze: { x: 1, y: 0 }, pose: { sy: 0.9 } });
    expect(actor.busy?.()).toBe(true);
    actor.update({ ...base, heading: 2, gaze: { x: 1, y: 0 }, face: { expression: { happy: 1 } } });
    expect(actor.busy?.()).toBe(true);
    actor.gesture('bounce');
    actor.update({ ...base, heading: 2, gaze: { x: 1, y: 0 }, face: { expression: { happy: 1 } } });
    expect(actor.busy?.()).toBe(true);
    actor.dispose();
  }, 30_000);
});
