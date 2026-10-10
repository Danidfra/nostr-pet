/**
 * A walk across the room covers exactly the stride of the renderer's own
 * walk animation per cycle, so a planted foot keeps its spot on the floor:
 * the speed is derived from the home's gait table and the room's camera,
 * never chosen on its own.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GAITS, gaitFor, walkCycleFor } from '@/features/home/scene/motion-contract';
import { CAMERA_ELEVATION, blobbiBoxTiles } from './room-geometry';
import { WALK_TEMPO, strideTilesPerCycle, walkCycleSecondsFor, walkSpeedFor } from './room-pace';

describe('the walking pace in the room', () => {
  it('is the gait\'s stride, in the art box\'s tiles, per renderer cycle, for the camera\'s elevation and the diagonal tile axes', () => {
    for (const generation of ['v1', 'v2', 'v3'] as const) {
      for (const stage of ['baby', 'adult'] as const) {
        const gait = GAITS[generation][stage];
        const lateralPerCycle = gait.stride * blobbiBoxTiles(stage);
        expect(strideTilesPerCycle(stage, generation)).toBeCloseTo(lateralPerCycle, 10);
        // Along a tile axis (a screen diagonal) only 1/√2 of the step is lateral, and a lateral
        // world tile shows as 1/cos(el) of the box's unit: the speed that keeps the foot planted.
        const expected = (lateralPerCycle * Math.cos(CAMERA_ELEVATION) * Math.SQRT2) / (walkCycleFor(generation) / WALK_TEMPO);
        expect(walkSpeedFor(stage, generation)).toBeCloseTo(expected, 10);
        expect(walkCycleSecondsFor(generation)).toBeCloseTo(walkCycleFor(generation) / WALK_TEMPO, 10);
      }
    }
  });

  it('the V3 adult walks on its legs at about two tiles a second: a room\'s width in about four seconds', () => {
    const speed = walkSpeedFor('adult', 'v3');
    expect(speed).toBeGreaterThan(1.9);
    expect(speed).toBeLessThan(2.1);
    expect(8 / speed).toBeGreaterThan(3.5);
    expect(8 / speed).toBeLessThan(4.5);
    // The tempo is what makes it so: at the kit's own cycle it would be a shuffle of 0.85 tiles a second
    expect(speed / WALK_TEMPO).toBeCloseTo(0.852, 2);
  });

  it('the lateral screen travel in one cycle AS PLAYED equals the stride, so nothing slides at any tempo', () => {
    // One cycle at the walking speed, along a tile axis, is √2 · lateral; its lateral part on
    // screen (÷ cos el) is the stride in box units. The cycle is the one the CSS plays: the kit's over the tempo.
    const cycle = walkCycleSecondsFor('v3');
    expect(cycle).toBeCloseTo(0.62 / WALK_TEMPO, 10);
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

describe('the tempo and the stylesheet agree', () => {
  it('the room plays the kit\'s walk faster by exactly the tempo the pace uses, for every generation', () => {
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
    // The V3 rig parts and the V1/V2 wrapper walk each get their kit cycle over the tempo variable, and nothing else changes.
    expect(css).toMatch(/\.room-blobbi \[data-blobbi-generation='v3'\]\[data-blobbi-rig-motion='walking'\] \[data-rig\] \{\s*animation-duration: calc\(0\.62s \/ var\(--room-walk-tempo, 1\)\) !important;/);
    // The V1/V2 legs are named by the kit's own rules; the home's contract lets no stylesheet here name a part, so the walking box's descendants are taken together.
    expect(css).toMatch(/\.room-blobbi \[data-blobbi-motion='walking'\],\s*\.room-blobbi \[data-blobbi-motion='walking'\] \* \{\s*animation-duration: calc\(0\.56s \/ var\(--room-walk-tempo, 1\)\) !important;/);
    expect(css).not.toMatch(/data-part/);
    expect(walkCycleFor('v3')).toBe(0.62);
    expect(walkCycleFor('v1')).toBe(0.56);
    expect(WALK_TEMPO).toBeGreaterThan(1);
  });
});
