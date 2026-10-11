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
import { createBlobbiActor, ROOM_LEAN } from './blobbi3d/actor';
import { genomeOf, labBlobbi, morphologyOf } from './blobbi3d/identity';
import { extremeFixtures, pairFixtures, traitFixtures } from './blobbi3d/coverage';
import { BLOBBI_REACH_FRACTIONS, CAMERA_AZIMUTH, blobbiBoxTiles, blobbiReachTiles, clampToReach } from './room-geometry';

const HEADINGS = 4;
const ROOM_LEAN_OF = (stage: 'adult' | 'baby') => ROOM_LEAN[stage];

function reachOf(stage: 'adult' | 'baby') {
  const genomes = [
    ...Array.from({ length: 12 }, (_, i) => genomeOf(toBlobbiVisual(labBlobbi('c'.repeat(64), String(i + 1).padStart(10, '0'), 'x', stage)))!),
    ...[...traitFixtures(), ...pairFixtures(), ...extremeFixtures()].map((f) => f.genome),
  ];
  let back = 0;
  let front = 0;
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const genome of genomes) {
    const model = buildBlobbiModel(morphologyOf(genome, stage), genome.seed);
    const actor = createBlobbiActor(model, { reducedMotion: () => true });
    // Upright, its reach is the same every way it turns: its plan radius, in one pass over its vertices
    actor.update({ dt: 0, motion: 'still', heading: 0, sleeping: false });
    model.root.updateMatrixWorld(true);
    let radius = 0;
    model.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        radius = Math.max(radius, Math.hypot(v.x, v.z));
      }
    });
    back = Math.max(back, radius);
    front = Math.max(front, radius);
    // Leaning back from the room's camera (a baby), measured where it leans: toward the back walls
    if (ROOM_LEAN_OF(stage) > 0) {
      for (let h = 0; h < HEADINGS; h++) {
        actor.update({ dt: 0, motion: 'still', heading: (h / HEADINGS) * Math.PI * 2, sleeping: false, viewAzimuth: CAMERA_AZIMUTH });
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
