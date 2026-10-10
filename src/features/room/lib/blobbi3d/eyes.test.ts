/**
 * The eyes are where the drawing puts them, on the body, level and
 * symmetrical: each eye's centre is the kit's front-view centre projected
 * onto the surface; the pupils rest where the kit rests them (a little
 * inward and down, the same on both sides); the adult has the layered eye
 * and the baby the simple coloured one; nothing floats off the skin or
 * sinks into it; and the gaze slides the inner eye the kit's travel.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildBlobbiGeometry, deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { domeHeight, EYE_BULGE } from './eyes';
import { poseRig } from './rig';
import { toModelX, toModelY, U } from './units';

const SEEDS = ['lab-1', 'lab-2', 'lab-3', 'abc123', 'seed-5', 'seed-6'];

beforeAll(() => {
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

function front(seed: string, stage: 'baby' | 'adult') {
  const geo = buildBlobbiGeometry(deriveMorphology(generateGenome(seed), stage), { view: 'front' });
  if (geo.view === 'side' || !geo.face) throw new Error('front face expected');
  return { ...geo, face: geo.face };
}

/** A world matrix back into the figure's own units (the geometry's, before the stage's box scaling). */
function toFigure(m: BlobbiModel, o: THREE.Object3D): THREE.Matrix4 {
  m.root.updateMatrixWorld(true);
  return new THREE.Matrix4().copy(m.figure.matrixWorld).invert().multiply(o.matrixWorld);
}

/** The centroid of a mesh's vertices in the figure's coordinates. */
function centroid(m: BlobbiModel, mesh: THREE.Object3D): THREE.Vector3 {
  const into = toFigure(m, mesh);
  const p = (mesh as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) c.add(v.fromBufferAttribute(p, i).applyMatrix4(into));
  return c.divideScalar(p.count);
}

describe('the eyes', () => {
  it("sit where the drawing puts them, both stages: each centre is the kit's eye centre, on the body's surface", () => {
    for (const stage of ['adult', 'baby'] as const) {
      for (const seed of SEEDS) {
        const m = model(seed, stage);
        const geo = front(seed, stage);
        const frame = m.surface.frame;
        expect(m.rig.eyes).toHaveLength(2);
        geo.face.eyes.forEach((eye, i) => {
          const rig = m.rig.eyes[i];
          expect(rig.group.position.x).toBeCloseTo(toModelX(eye.white.cx, frame), 4);
          expect(rig.group.position.y).toBeCloseTo(toModelY(eye.white.cy, frame), 4);
          const on = m.surface.at(eye.white.cx, eye.white.cy);
          expect(rig.group.position.distanceTo(on.position)).toBeLessThan(1e-6);
          // Forward of the body's axis: on the face, not inside the head
          expect(rig.group.position.z).toBeGreaterThan(0.08);
        });
        // Level with each other, as the drawing's are (the kit may tilt them; the model tilts the same)
        const [l, r] = geo.face.eyes;
        expect(m.rig.eyes[0].group.position.y - m.rig.eyes[1].group.position.y).toBeCloseTo((r.white.cy - l.white.cy) * U, 5);
        // The same depth on both sides
        expect(m.rig.eyes[0].group.position.z).toBeCloseTo(m.rig.eyes[1].group.position.z, 2);
      }
    }
  });

  it('rest their pupils where the kit rests them: the same small turn inward and down on both sides, under no gaze', () => {
    for (const stage of ['adult', 'baby'] as const) {
      for (const seed of SEEDS) {
        const m = model(seed, stage);
        poseRig(m, { motion: 'still', phase: 0 });
        const geo = front(seed, stage);
        const offsets = geo.face.eyes.map((eye, i) => {
          const pupil = m.rig.eyes[i].inner.getObjectByName('pupil')!;
          const c = centroid(m, pupil);
          const centre = new THREE.Vector3().setFromMatrixPosition(toFigure(m, m.rig.eyes[i].group));
          // Measured in root units across and up, as the drawing states them
          return { dx: (c.x - centre.x) / U, dy: -(c.y - centre.y) / U, kitDx: eye.pupil.cx - eye.white.cx, kitDy: eye.pupil.cy - eye.white.cy };
        });
        for (const o of offsets) {
          expect(o.dx).toBeCloseTo(o.kitDx, 0);
          expect(o.dy).toBeCloseTo(o.kitDy, 0);
        }
        // Mirrored: the left pupil turns right by as much as the right turns left
        expect(offsets[0].dx).toBeCloseTo(-offsets[1].dx, 0);
        expect(offsets[0].dy).toBeCloseTo(offsets[1].dy, 0);
        if (stage === 'adult') expect(offsets[0].dx).toBeGreaterThan(0); // toward the viewer's centre
      }
    }
  });

  it('are the layered eye on an adult and the simple coloured eye on a baby, in the proportions the kit draws', () => {
    const adult = model('lab-1', 'adult');
    const baby = model('lab-1', 'baby');
    const adultGeo = front('lab-1', 'adult');
    const babyGeo = front('lab-1', 'baby');
    for (const eye of adult.rig.eyes) {
      const parts = eye.layers.map((l) => l.part);
      expect(parts).toEqual(['white', 'iris', 'pupil', 'highlight', 'glint']);
      expect(eye.layers.find((l) => l.part === 'pupil')!.colour).toBe(adultGeo.palette.pupil);
      expect(eye.layers.find((l) => l.part === 'iris')!.colour).toBe(adultGeo.palette.irisMid);
    }
    for (const eye of baby.rig.eyes) {
      const parts = eye.layers.map((l) => l.part);
      expect(parts).toEqual(['white', 'pupil', 'pupil-light', 'highlight']);
      // The baby's big disc is the iris colour, never the adult's black pupil
      expect(eye.layers.find((l) => l.part === 'pupil')!.colour).toBe(babyGeo.palette.babyEyeDark);
      expect(eye.layers.find((l) => l.part === 'pupil-light')!.colour).toBe(babyGeo.palette.babyEyeLight);
    }
    // Proportions: the white's width and height, and the disc's size, are the kit's
    // In the geometry's own units (the figure's), as drawn
    const boxOf = (o: THREE.Object3D) => {
      const geometry = (o as THREE.Mesh).geometry;
      geometry.computeBoundingBox();
      return geometry.boundingBox!.getSize(new THREE.Vector3());
    };
    const whiteBox = (m: BlobbiModel, i: number) => boxOf(m.rig.eyes[i].open.getObjectByName('white')!);
    expect(whiteBox(adult, 0).x / U).toBeCloseTo(adultGeo.face.eyes[0].white.rx * 2, -1);
    expect(whiteBox(adult, 0).y / U).toBeCloseTo(adultGeo.face.eyes[0].white.ry * 2, -1);
    expect(whiteBox(baby, 0).x / U).toBeCloseTo(babyGeo.face.eyes[0].white.rx * 2, -1);
    const babyDisc = boxOf(baby.rig.eyes[0].inner.getObjectByName('pupil')!);
    expect(babyDisc.x / U).toBeCloseTo(babyGeo.face.eyes[0].pupil.rx * 2, -1);
    expect(babyDisc.x / whiteBox(baby, 0).x).toBeGreaterThan(0.6); // the baby's disc fills most of its eye, as drawn
  });

  it('are attached to the skin: the white rises off the surface by its dome and no part of an eye is under the skin', () => {
    for (const stage of ['adult', 'baby'] as const) {
      for (const seed of SEEDS) {
        const m = model(seed, stage);
        const geo = front(seed, stage);
        m.root.updateMatrixWorld(true);
        geo.face.eyes.forEach((eye, i) => {
          const rig = m.rig.eyes[i];
          let lowest = Infinity;
          let highest = -Infinity;
          rig.open.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const p = o.geometry.getAttribute('position') as THREE.BufferAttribute;
            const into = toFigure(m, o);
            const v = new THREE.Vector3();
            for (let k = 0; k < p.count; k++) {
              v.fromBufferAttribute(p, k).applyMatrix4(into);
              // Back to the drawing's plane: where on the skin is this point, and how high over it
              const xr = m.surface.frame.axisX + v.x / U;
              const yr = m.surface.frame.groundY - v.y / U;
              const on = m.surface.at(xr, yr);
              // Raised toward the viewer, so measured that way: over the skin under it
              const height = (v.z - on.position.z) / U;
              lowest = Math.min(lowest, height);
              highest = Math.max(highest, height);
            }
          });
          expect(lowest).toBeGreaterThan(-0.5); // never under the skin
          expect(highest).toBeLessThan(eye.white.rx * EYE_BULGE + 6); // no further out than the dome and its layers
          expect(highest).toBeGreaterThan(eye.white.rx * EYE_BULGE * 0.8);
          expect(domeHeight(eye.white, eye.white.cx, eye.white.cy)).toBeCloseTo(eye.white.rx * EYE_BULGE, 6);
          expect(domeHeight(eye.white, eye.white.cx + eye.white.rx, eye.white.cy)).toBeCloseTo(0, 5);
        });
      }
    }
  });

  it('look where the gaze says, sliding over the white by the kit\'s travel, and back to rest', () => {
    const m = model('lab-1', 'adult');
    poseRig(m, { motion: 'still', phase: 0, gaze: { x: 1, y: 0 } });
    for (const eye of m.rig.eyes) {
      expect(eye.inner.position.length()).toBeCloseTo(eye.travel * U, 6);
      expect(eye.inner.position.x).toBeGreaterThan(0);
      expect(Math.abs(eye.inner.position.y)).toBeLessThan(1e-9);
    }
    poseRig(m, { motion: 'still', phase: 0, gaze: { x: 0, y: 1 } });
    for (const eye of m.rig.eyes) expect(eye.inner.position.y).toBeCloseTo(-eye.travel * U, 6);
    poseRig(m, { motion: 'still', phase: 0 });
    for (const eye of m.rig.eyes) expect(eye.inner.position.length()).toBe(0);
  });
});
