/**
 * The reach the room keeps clear of its walls is the body's own: every body
 * shape the kit can make (each trait kind, each appendage pair, the gene
 * bounds, a spread of addresses), posed at every heading and leaning back
 * from the room's camera as the room poses it, reaches no further than
 * `blobbiReachTiles` says, toward the back walls and toward the front.
 * A new trait that widens the body fails here, not in somebody's room.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { buildBlobbiModel } from './blobbi3d/model';
import { createBlobbiActor } from './blobbi3d/actor';
import { genomeOf, labBlobbi, morphologyOf } from './blobbi3d/identity';
import { extremeFixtures, pairFixtures, traitFixtures } from './blobbi3d/coverage';
import { BLOBBI_REACH_FRACTIONS, CAMERA_AZIMUTH, blobbiBoxTiles, blobbiReachTiles, clampToReach } from './room-geometry';

const HEADINGS = 8;

function reachOf(stage: 'adult' | 'baby') {
  const genomes = [
    ...Array.from({ length: 12 }, (_, i) => genomeOf(toBlobbiVisual(labBlobbi('c'.repeat(64), String(i + 1).padStart(10, '0'), 'x', stage)))!),
    ...[...traitFixtures(), ...pairFixtures(), ...extremeFixtures()].map((f) => f.genome),
  ];
  let back = 0;
  let front = 0;
  const box = new THREE.Box3();
  for (const genome of genomes) {
    const model = buildBlobbiModel(morphologyOf(genome, stage), genome.seed);
    const actor = createBlobbiActor(model, { reducedMotion: () => true });
    for (let h = 0; h < HEADINGS; h++) {
      for (const viewAzimuth of [CAMERA_AZIMUTH, undefined]) {
        actor.update({ dt: 0, motion: 'still', heading: (h / HEADINGS) * Math.PI * 2, sleeping: false, viewAzimuth });
        model.root.updateMatrixWorld(true);
        box.setFromObject(model.root, true);
        back = Math.max(back, -box.min.x, -box.min.z);
        front = Math.max(front, box.max.x, box.max.z);
      }
    }
    model.dispose();
  }
  return { back, front, shapes: genomes.length };
}

describe('the reach the room keeps clear of its walls', () => {
  it.each(['adult', 'baby'] as const)('holds every %s body shape, at every heading and leaning as the room leans it', (stage) => {
    const measured = reachOf(stage);
    expect(measured.shapes).toBeGreaterThan(40);
    expect(measured.back).toBeLessThanOrEqual(BLOBBI_REACH_FRACTIONS[stage].back);
    expect(measured.front).toBeLessThanOrEqual(BLOBBI_REACH_FRACTIONS[stage].front);
    // And not wastefully: within a few hundredths of the widest body, so it never stops needlessly far from a wall
    expect(BLOBBI_REACH_FRACTIONS[stage].back - measured.back).toBeLessThan(0.03);
    expect(blobbiReachTiles(stage).back).toBeCloseTo(BLOBBI_REACH_FRACTIONS[stage].back * blobbiBoxTiles(stage), 10);
  }, 120_000);

  it('keeps a standing point its reach from every edge, and the middle when a room is too small for the body', () => {
    const reach = { back: 1.2, front: 0.8 };
    expect(clampToReach(0.5, reach)).toBe(1.2);
    expect(clampToReach(7.5, reach)).toBe(7.2);
    expect(clampToReach(4, reach)).toBe(4);
    expect(clampToReach(1, { back: 3, front: 3 }, 5)).toBe(2.5);
  });
});
