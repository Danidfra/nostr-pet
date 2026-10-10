/**
 * The 3D Blobbi is the kit's Blobbi: built from its geometry alone, the same
 * every time, as tall, wide and deep as its front and side views, with the
 * parts its morphology has, from the genome the kit draws its 2D self from.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderBlobbiSvg as renderVisualSvg } from '@blobbi-kit/renderer';
import { BABY_BOX, buildBlobbiGeometry, deriveMorphology, generateGenome, renderBlobbiSvg } from '@blobbi-kit/renderer/procedural';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { genomeOf, labBlobbi, morphologyOf, stage3dOf } from './identity';
import { ROOT_PER_BOX, toModelY, U } from './units';
import { yawForView } from './rig';

const PUBKEY = 'a'.repeat(64);
const SEEDS = ['lab-1', 'lab-2', 'lab-3', 'abc123'];

beforeAll(() => {
  // No 2D canvas in jsdom: the markings are skipped, the geometry is not
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

let built: BlobbiModel[] = [];
afterEach(() => {
  for (const m of built) m.dispose();
  built = [];
});

function model(seed: string, stage: 'baby' | 'adult' = 'adult'): BlobbiModel {
  const m = buildBlobbiModel(deriveMorphology(generateGenome(seed), stage), seed);
  built.push(m);
  return m;
}

/** Every mesh's vertices, in scene order. */
function vertices(m: BlobbiModel): Float32Array[] {
  const out: Float32Array[] = [];
  m.root.updateMatrixWorld(true);
  m.root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(new Float32Array((o.geometry.getAttribute('position') as THREE.BufferAttribute).array));
  });
  return out;
}

function skinBox(m: BlobbiModel): THREE.Box3 {
  const skin = m.root.getObjectByName('skin') as THREE.Mesh;
  skin.geometry.computeBoundingBox();
  return skin.geometry.boundingBox!;
}

function parts(m: BlobbiModel, part: string): number {
  return m.rig.appendages.filter((a) => a.part === part).length;
}

describe('buildBlobbiModel', () => {
  it('builds the same model from the same morphology, vertex for vertex, and a different one from another', () => {
    for (const seed of SEEDS) {
      const a = vertices(model(seed));
      const b = vertices(model(seed));
      expect(b).toHaveLength(a.length);
      a.forEach((va, i) => expect(Array.from(b[i])).toEqual(Array.from(va)));
    }
    const widths = SEEDS.map((seed) => skinBox(model(seed)).max.x - skinBox(model(seed)).min.x);
    expect(new Set(widths.map((w) => w.toFixed(4))).size).toBe(SEEDS.length);
  });

  it('never rolls dice or reads the clock: a different random stream builds the identical model', () => {
    // three.js names every object with a random uuid, so Math.random IS called; what matters is that
    // no vertex depends on it. Two builds under two different random streams must agree exactly.
    let n = 0;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => ((n += 7919) % 10007) / 10007);
    const now = vi.spyOn(Date, 'now');
    const perf = vi.spyOn(performance, 'now');
    const first = SEEDS.map((seed) => vertices(model(seed)));
    n = 4242;
    const second = SEEDS.map((seed) => vertices(model(seed)));
    first.forEach((meshes, s) => meshes.forEach((va, i) => expect(Array.from(second[s][i])).toEqual(Array.from(va))));
    expect(random).toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
    perf.mockRestore();
  });

  it("is as tall and wide as the kit's front view and as deep as its side view, standing on the ground", () => {
    for (const seed of SEEDS) {
      const morphology = deriveMorphology(generateGenome(seed), 'adult');
      const front = buildBlobbiGeometry(morphology, { view: 'front' });
      const side = buildBlobbiGeometry(morphology, { view: 'side' });
      const frame = { axisX: front.body.axisX, groundY: front.ground.y, sideAxisX: side.body.axisX };
      const box = skinBox(model(seed));
      expect(box.max.y).toBeCloseTo(toModelY(front.body.top, frame), 3);
      expect(box.min.y).toBeCloseTo(toModelY(front.body.bottom, frame), 3);
      const width = (front.body.right - front.body.left) * U;
      expect(box.max.x - box.min.x).toBeGreaterThan(width * 0.97);
      expect(box.max.x - box.min.x).toBeLessThanOrEqual(width * 1.001);
      const depth = (side.body.right - side.body.left) * U;
      expect(box.max.z - box.min.z).toBeGreaterThan(depth * 0.95);
      expect(box.max.z - box.min.z).toBeLessThanOrEqual(depth * 1.001);
      // The feet stand on the ground line (their ink line, as the drawing's stroke, hangs just under it)
      const m = built[built.length - 1];
      const whole = new THREE.Box3().setFromObject(m.root, true);
      expect(whole.min.y).toBeLessThan(0.001);
      expect(whole.min.y).toBeGreaterThan(-8 * U);
      expect(m.bounds.height).toBeGreaterThan(0.6);
      expect(m.bounds.height).toBeLessThan(1);
    }
  });

  it('has the parts its morphology has: feet, arms, eyes, tuft, ears, antennae, a tail', () => {
    const plain = model('lab-1');
    const m1 = deriveMorphology(generateGenome('lab-1'), 'adult');
    expect(m1.ears?.kind).toBe('round');
    expect(parts(plain, 'ear')).toBe(2);
    expect(parts(plain, 'antenna')).toBe(0);
    expect(plain.rig.legs.left && plain.rig.legs.right).toBeTruthy();
    expect(plain.rig.arms.left && plain.rig.arms.right).toBeTruthy();
    expect(plain.rig.tuft).not.toBeNull();
    expect(plain.rig.eyes).toHaveLength(2);
    for (const eye of plain.rig.eyes) expect(eye.closed).not.toBeNull();
    expect(plain.gait).toBe('legs');

    const m2 = deriveMorphology(generateGenome('abc123'), 'adult');
    expect(m2.antennae).toHaveLength(1);
    expect(m2.tail?.kind).toBe('nub');
    const tailed = model('abc123');
    expect(parts(tailed, 'antenna')).toBe(1);
    expect(parts(tailed, 'tail')).toBe(1);
    const tail = tailed.rig.appendages.find((a) => a.part === 'tail')!.group;
    expect(tail.position.z).toBeLessThan(0); // behind the body
  });

  it("draws a baby without feet or arms, on the hop gait, filling its own box as the drawing fills the kit's baby frame", () => {
    const baby = model('lab-1', 'baby');
    const adult = model('lab-1', 'adult');
    expect(baby.gait).toBe('hop');
    expect(baby.rig.legs.left).toBeNull();
    expect(baby.rig.arms.left).toBeNull();
    expect(baby.scale).toBeLessThan(adult.scale);
    // Its geometry is smaller, in the adult's units; its box is the kit's baby frame, so in box units it stands as tall as the drawing
    expect(baby.figure.scale.x).toBeCloseTo(ROOT_PER_BOX / BABY_BOX.size, 6);
    expect(adult.figure.scale.x).toBe(1);
    const geo = buildBlobbiGeometry(deriveMorphology(generateGenome('lab-1'), 'baby'), { view: 'front' });
    expect(baby.bounds.height).toBeCloseTo(((geo.ground.y - geo.body.top) / BABY_BOX.size), 1);
    expect(baby.bounds.height).toBeGreaterThan(0.6);
  });

  it('faces the viewer, screen-right and away for the front, side and back views', () => {
    expect(yawForView('front')).toBe(0);
    expect(yawForView('side')).toBeCloseTo(Math.PI / 2);
    expect(yawForView('back')).toBeCloseTo(Math.PI);
    const m = model('lab-1');
    // The belly is toward +z: the eyes sit in front of the body's axis
    for (const eye of m.rig.eyes) expect(eye.group.position.z).toBeGreaterThan(0.1);
  });
});

describe('identity', () => {
  it('maps the same address to the same genome and another address to another, and keeps V1 in 2D', () => {
    const a = genomeOf(toBlobbiVisual(labBlobbi(PUBKEY, '0000000001', 'One', 'adult')));
    const again = genomeOf(toBlobbiVisual(labBlobbi(PUBKEY, '0000000001', 'One again', 'adult')));
    const other = genomeOf(toBlobbiVisual(labBlobbi(PUBKEY, '0000000002', 'Two', 'adult')));
    expect(a).not.toBeNull();
    expect(again).toEqual(a);
    expect(other).not.toEqual(a);
    expect(other!.seed).not.toBe(a!.seed);
    expect(genomeOf({ stage: 'adult', visualGeneration: 'v1' })).toBeNull();
    expect(stage3dOf('egg')).toBeNull();
    expect(stage3dOf('adult')).toBe('adult');
  });

  it("is the genome the kit draws the 2D Blobbi from: the same drawing, path for path", () => {
    for (const petId of ['0000000001', '0000000002', '0000000003']) {
      const visual = toBlobbiVisual(labBlobbi(PUBKEY, petId, 'Lab', 'adult'));
      const genome = genomeOf(visual)!;
      const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).sort();
      const kit = renderVisualSvg({ stage: 'adult', visualGeneration: 'v3', v3: visual.v3, facing: 'front' }).svg;
      const ours = renderBlobbiSvg(genome, { stage: 'adult', view: 'front' });
      expect(paths(kit).length).toBeGreaterThan(5);
      expect(paths(ours)).toEqual(paths(kit));
      expect(morphologyOf(genome, 'adult').palette).toEqual(deriveMorphology(genome, 'adult').palette);
    }
  });
});
