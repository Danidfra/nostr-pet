/**
 * How big a Blobbi stands in the room, measured, not assumed: the 3D model
 * is the kit's drawing in depth (its height and width are the front view's,
 * `model.test.ts`), and the room scales the drawing's box and the model by
 * the same `blobbiBoxTiles`, so the model's measured height IS the height
 * both renderers show. Against it, the official furniture's own heights.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { buildBlobbiModel } from './blobbi3d/model';
import { genomeOf, labBlobbi, morphologyOf } from './blobbi3d/identity';
import { MODEL_UNITS_PER_TILE, blobbiBoxTiles } from './room-geometry';
import { getOfficialModel } from './scene/official-models';

const PET_IDS = ['0000000001', '0000000005', '0000000006', '0000000010', '0000000018', '0000000020'];

/** A Blobbi's height in the room, in tiles: its model's height (one unit = its box) times the box. */
function standingTiles(petId: string, stage: 'baby' | 'adult'): number {
  const genome = genomeOf(toBlobbiVisual(labBlobbi('a'.repeat(64), petId, 'x', stage)))!;
  const model = buildBlobbiModel(morphologyOf(genome, stage), genome.seed);
  model.root.updateMatrixWorld(true);
  const height = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).y;
  model.dispose();
  return height * blobbiBoxTiles(stage);
}

/** A piece of furniture's height in tiles, from its model's vertices. */
function furnitureTiles(id: string): number {
  const vertices = getOfficialModel(id)!.payload.vertices;
  const ys = vertices.map((v) => v[1]);
  return (Math.max(...ys) - Math.min(...ys)) / MODEL_UNITS_PER_TILE;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('the Blobbi\'s size in the room', () => {
  const adult = mean(PET_IDS.map((id) => standingTiles(id, 'adult')));
  const baby = mean(PET_IDS.map((id) => standingTiles(id, 'baby')));

  it('an adult stands about as tall as the sink, under the fridge and the wardrobe, over the counter', () => {
    expect(adult).toBeGreaterThan(furnitureTiles('official:counter'));
    expect(adult).toBeGreaterThan(furnitureTiles('official:sink') * 0.92);
    expect(adult).toBeLessThan(furnitureTiles('official:sink') * 1.12);
    expect(adult).toBeLessThan(furnitureTiles('official:fridge') * 0.7);
    expect(adult).toBeLessThan(furnitureTiles('official:wardrobe') * 0.7);
  });

  it('is 10–15% smaller than Ditto\'s box drew it, and a baby stays clearly smaller than an adult', () => {
    const before = adult * (3.8 / blobbiBoxTiles('adult'));
    expect(adult / before).toBeGreaterThan(0.85);
    expect(adult / before).toBeLessThan(0.9);
    expect(baby / adult).toBeLessThan(0.75);
    expect(baby / adult).toBeGreaterThan(0.55);
  });
});
