/**
 * A half-shut 3D eye is covered the way the drawing covers it: the lid's
 * skin lies over the white, the iris, the pupil and the highlights above the
 * lid's edge, seen from the front, and none of it reaches past the eye.
 *
 * The bug this guards: the lid was a flat fan of triangles from its outline,
 * a box running past the eye; the white's dome rose through it, so only the
 * edge's line crossed a fully drawn eye, with a skin-coloured box around it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { domeHeight } from './eyes';
import { LID_LIFT, lidClip, lidGrid, lidHeight } from './lid';

vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  // No 2D canvas in jsdom: the markings are skipped, the geometry is not
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

let built: BlobbiModel[] = [];
afterEach(() => {
  for (const m of built) m.dispose();
  built = [];
});

function model(seed: string, stage: 'baby' | 'adult'): BlobbiModel {
  const m = buildBlobbiModel(deriveMorphology(generateGenome(seed), stage), seed);
  built.push(m);
  return m;
}

/** The lid meshes of the face worn now. */
function lids(m: BlobbiModel): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  m.root.traverse((o) => {
    if (o.name === 'face' && o.visible) o.traverse((c) => c instanceof THREE.Mesh && c.name === 'lid' && out.push(c));
  });
  return out;
}

function meshesOf(o: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  o.traverse((c) => c instanceof THREE.Mesh && out.push(c));
  return out;
}

describe('lidGrid', () => {
  const white = { cx: 0, cy: 0, rx: 10, ry: 12 };
  // The kit's upper region: a box above an edge 2 units over the centre, running past the eye
  const upper = [{ x: -15, y: -17 }, { x: 15, y: -17 }, { x: 15, y: -2 }, { x: -15, y: -2 }];

  it('keeps the region inside the eye: every point within the clip ellipse, none below the edge', () => {
    const clip = lidClip(white);
    const grid = lidGrid(upper, clip, 24, 6)!;
    for (let c = 0; c < grid.points.length; c += 7) {
      const column = grid.points.slice(c, c + 7);
      // A column the region misses collapses to one point on the rim and adds no area
      const collapsed = column.every((p) => p.x === column[0].x && p.y === column[0].y);
      for (const p of column) {
        expect(((p.x - clip.cx) / clip.rx) ** 2 + ((p.y - clip.cy) / clip.ry) ** 2).toBeLessThanOrEqual(1 + 1e-9);
        if (!collapsed) expect(p.y).toBeLessThanOrEqual(-2 + 1e-9);
      }
    }
    // It reaches the edge at the middle and the eye's top
    const middle = grid.points.filter((p) => Math.abs(p.x) < 1);
    expect(Math.max(...middle.map((p) => p.y))).toBeCloseTo(-2, 5);
    expect(Math.min(...grid.points.map((p) => p.y))).toBeLessThan(-12);
  });

  it('gives nothing for a region that misses the eye', () => {
    expect(lidGrid([{ x: 30, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 5 }], lidClip(white))).toBeNull();
  });

  it('stands over the dome on the white and comes down to the skin at the rim', () => {
    expect(lidHeight(white, 0, 0)).toBeCloseTo(domeHeight(white, 0, 0) + LID_LIFT, 6);
    expect(lidHeight(white, 0, -12)).toBeCloseTo(LID_LIFT, 6);
    const rim = lidHeight(white, 0, -12.7);
    expect(rim).toBeLessThan(1);
    expect(rim).toBeGreaterThan(0);
  });
});

describe('a half-shut eye on the 3D Blobbi', () => {
  const cases = [
    ['lab-1', 'adult', { sleepy: 1 }],
    ['lab-2', 'adult', { sad: 1 }],
    ['abc123', 'baby', { sleepy: 1 }],
    ['lab-3', 'baby', { sad: 1 }],
    ['lab-2', 'adult', { sleepy: 0.5 }],
  ] as const;

  it.each(cases)('%s %s %o: seen from the front, the lid covers every layer of the eye above its edge', (seed, stage, expression) => {
    const m = model(seed, stage);
    m.setFace({ expression });
    m.root.updateMatrixWorld(true);
    const lidMeshes = lids(m);
    expect(lidMeshes.length).toBe(m.rig.eyes.length);
    const ray = new THREE.Raycaster();
    for (const eye of m.rig.eyes) {
      const eyeMeshes = meshesOf(eye.open);
      const eyeBox = new THREE.Box3().setFromObject(eye.open, true);
      let checked = 0;
      for (const lid of lidMeshes) {
        const position = lid.geometry.getAttribute('position');
        const index = lid.geometry.getIndex()!;
        const corner = (k: number) => new THREE.Vector3().fromBufferAttribute(position, index.getX(k)).applyMatrix4(lid.matrixWorld);
        // Each triangle's centroid (a ray through a vertex may slip between triangles)
        for (let t = 0; t < index.count; t += 3) {
          const v = corner(t).add(corner(t + 1)).add(corner(t + 2)).divideScalar(3);
          // Only the lid over this eye's white (not its rim, where the lid meets the skin)
          if (v.x < eyeBox.min.x * 0.98 + eyeBox.max.x * 0.02 || v.x > eyeBox.max.x * 0.98 + eyeBox.min.x * 0.02) continue;
          if (v.y < eyeBox.min.y || v.y > eyeBox.max.y) continue;
          ray.set(new THREE.Vector3(v.x, v.y, 10), new THREE.Vector3(0, 0, -1));
          const hits = ray.intersectObjects([...lidMeshes, ...eyeMeshes], false);
          if (!hits.length) continue;
          expect(hits[0].object.name, `at ${v.x.toFixed(3)},${v.y.toFixed(3)}`).toBe('lid');
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(20);
    }
  });

  it('lays no lid skin past the eye: the lid stays within the eye white, a hair larger', () => {
    const m = model('lab-1', 'adult');
    m.setFace({ expression: { sleepy: 1 } });
    m.root.updateMatrixWorld(true);
    for (const lid of lids(m)) {
      const box = new THREE.Box3().setFromObject(lid, true);
      const eye = m.rig.eyes.map((e) => new THREE.Box3().setFromObject(e.open, true)).find((b) => b.intersectsBox(box))!;
      const slack = 0.15 * (eye.max.x - eye.min.x);
      expect(box.min.x).toBeGreaterThan(eye.min.x - slack);
      expect(box.max.x).toBeLessThan(eye.max.x + slack);
      expect(box.max.y).toBeLessThan(eye.max.y + slack);
    }
  });
});
