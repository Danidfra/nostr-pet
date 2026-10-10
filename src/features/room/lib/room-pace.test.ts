/**
 * A walk across the room covers exactly the stride of the renderer's own
 * walk animation per cycle, so a planted foot keeps its spot on the floor:
 * the speed is derived from the home's gait table and the room's camera,
 * never chosen on its own.
 */
import { describe, expect, it } from 'vitest';

import { GAITS, gaitFor, walkCycleFor } from '@/features/home/scene/motion-contract';
import { CAMERA_ELEVATION, blobbiBoxTiles } from './room-geometry';
import { strideTilesPerCycle, walkSpeedFor } from './room-pace';

describe('the walking pace in the room', () => {
  it('is the gait\'s stride, in the art box\'s tiles, per renderer cycle, for the camera\'s elevation and the diagonal tile axes', () => {
    for (const generation of ['v1', 'v2', 'v3'] as const) {
      for (const stage of ['baby', 'adult'] as const) {
        const gait = GAITS[generation][stage];
        const lateralPerCycle = gait.stride * blobbiBoxTiles(stage);
        expect(strideTilesPerCycle(stage, generation)).toBeCloseTo(lateralPerCycle, 10);
        // Along a tile axis (a screen diagonal) only 1/√2 of the step is lateral, and a lateral
        // world tile shows as 1/cos(el) of the box's unit: the speed that keeps the foot planted.
        const expected = (lateralPerCycle * Math.cos(CAMERA_ELEVATION) * Math.SQRT2) / walkCycleFor(generation);
        expect(walkSpeedFor(stage, generation)).toBeCloseTo(expected, 10);
      }
    }
  });

  it('the V3 adult walks on its legs: about 0.85 tiles a second, a room\'s width in about nine seconds', () => {
    const speed = walkSpeedFor('adult', 'v3');
    expect(speed).toBeGreaterThan(0.8);
    expect(speed).toBeLessThan(0.9);
    expect(8 / speed).toBeGreaterThan(8);
    expect(8 / speed).toBeLessThan(11);
  });

  it('the lateral screen travel in one cycle equals the stride, so nothing slides', () => {
    // One cycle at the walking speed, along a tile axis, is √2 · lateral; its lateral part on
    // screen (÷ cos el) is the stride in box units.
    const cycle = walkCycleFor('v3');
    const alongPath = walkSpeedFor('adult', 'v3') * cycle;
    const lateralOnScreen = (alongPath / Math.SQRT2) / Math.cos(CAMERA_ELEVATION);
    expect(lateralOnScreen).toBeCloseTo(gaitFor('adult', 'v3').stride * blobbiBoxTiles('adult'), 10);
  });

  it('a baby keeps its own gait (the hop), slower in its smaller box, and an unknown generation walks as V1', () => {
    expect(walkSpeedFor('baby', 'v3')).toBeLessThan(walkSpeedFor('adult', 'v3'));
    expect(walkSpeedFor('baby', 'v3')).toBeGreaterThan(0);
    expect(walkSpeedFor('adult', 'nonsense')).toBe(walkSpeedFor('adult', 'v1'));
    // An egg never walks; given a pace anyway, it is the baby's gait in the egg's smaller box
    expect(gaitFor('egg', 'v3')).toBe(gaitFor('baby', 'v3'));
    expect(walkSpeedFor('egg', 'v3')).toBeLessThan(walkSpeedFor('baby', 'v3'));
  });
});
