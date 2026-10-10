/**
 * The arms are rounded limbs lofted from the kit's two outlines, hung from
 * the shoulder, as wide as the front paddle and as deep as the side one,
 * smooth all round; and every genome builds a whole, finite, well-formed
 * model with the parts its morphology has.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { normalizeBlobbiV3Visual } from '@blobbi-kit/renderer';
import { buildBlobbiGeometry, deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { deriveBlobbiV3Seed } from '@blobbi-kit/core';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { boundsOf, samplePath } from './svg-path';
import { toModelX, toModelY, U } from './units';

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

/** The largest angle between a face's normal and its vertices' normals: small on a smooth surface. */
function roughness(geometry: THREE.BufferGeometry): number {
  const p = geometry.getAttribute('position') as THREE.BufferAttribute;
  const n = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const index = geometry.getIndex()!;
  let worst = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), face = new THREE.Vector3(), vn = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const [ia, ib, ic] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(p, ia);
    b.fromBufferAttribute(p, ib);
    c.fromBufferAttribute(p, ic);
    face.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (face.lengthSq() < 1e-18) continue;
    face.normalize();
    for (const k of [ia, ib, ic]) worst = Math.max(worst, face.angleTo(vn.fromBufferAttribute(n, k)));
  }
  return (worst * 180) / Math.PI;
}

describe('the arms', () => {
  it("are rounded limbs as wide and tall as the kit's front paddle, as deep as its side paddle, hung from the shoulder", () => {
    for (const seed of ['lab-1', 'abc123', 'lab-3']) {
      const m = model(seed, 'adult');
      const morphology = deriveMorphology(generateGenome(seed), 'adult');
      const front = buildBlobbiGeometry(morphology, { view: 'front' });
      const side = buildBlobbiGeometry(morphology, { view: 'side' });
      if (front.view === 'side' || side.view !== 'side') throw new Error();
      const sideBox = boundsOf(samplePath(side.limbs.nearArm!.d, 10)[0].points);
      for (const arm of front.limbs.arms) {
        const group = arm.side === 'left' ? m.rig.arms.left! : m.rig.arms.right!;
        expect(group.position.x).toBeCloseTo(toModelX(arm.shoulder.x, m.surface.frame), 6);
        expect(group.position.y).toBeCloseTo(toModelY(arm.shoulder.y, m.surface.frame), 6);
        const mesh = group.getObjectByName('arm') as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
        expect(size.x / U).toBeCloseTo(arm.box.x2 - arm.box.x1, -1);
        expect(size.y / U).toBeCloseTo(arm.box.y2 - arm.box.y1, -1);
        expect(size.z / U).toBeCloseTo(sideBox.x2 - sideBox.x1, -1);
        // Its top is at the shoulder (the group's origin)
        expect(mesh.geometry.boundingBox!.max.y).toBeLessThan(2 * U);
        expect(mesh.geometry.boundingBox!.max.y).toBeGreaterThan(-2 * U);
        // Smooth: no face turns far from the normals it shares
        expect(roughness(mesh.geometry)).toBeLessThan(40);
        // Round: its cross-section is as deep as it is wide, within the two outlines' ratio
        expect(size.z / size.x).toBeGreaterThan(0.5);
        expect(size.z / size.x).toBeLessThan(1.5);
      }
    }
  });

  it('a baby has none, and the body is smooth too', () => {
    const baby = model('lab-1', 'baby');
    expect(baby.rig.arms.left).toBeNull();
    expect(baby.rig.arms.right).toBeNull();
    const skin = baby.root.getObjectByName('skin') as THREE.Mesh;
    expect(roughness(skin.geometry)).toBeLessThan(32); // the baby's crown comes to a point, as drawn
    const adultSkin = model('lab-1', 'adult').root.getObjectByName('skin') as THREE.Mesh;
    expect(roughness(adultSkin.geometry)).toBeLessThan(25);
  });
});

describe('every genome', () => {
  const pubkey = 'a'.repeat(64);
  const addresses = Array.from({ length: 12 }, (_, i) => String(i * 3 + 1).padStart(10, '0'));

  function genomeAt(petId: string) {
    const seed = deriveBlobbiV3Seed(pubkey, `blobbi-${pubkey.slice(0, 12)}-${petId}`);
    const id = normalizeBlobbiV3Visual({ seed })!;
    const { specialMark, ...traits } = id.traits;
    return generateGenome({ seed: id.seed, colors: { ...id.colors }, ...traits, mark: specialMark });
  }

  it('builds a whole, finite model with the parts its morphology has, as an adult and as a baby, the same twice', () => {
    for (const petId of addresses) {
      const genome = genomeAt(petId);
      for (const stage of ['adult', 'baby'] as const) {
        const morphology = deriveMorphology(genome, stage);
        const m = buildBlobbiModel(morphology, genome.seed);
        built.push(m);
        const again = buildBlobbiModel(morphology, genome.seed);
        built.push(again);
        let vertices = 0;
        m.root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const p = o.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let k = 0; k < p.count * 3; k++) expect(Number.isFinite(p.array[k])).toBe(true);
          vertices += p.count;
        });
        expect(vertices).toBeGreaterThan(1000);
        expect(m.bounds.height).toBeGreaterThan(0.3);
        expect(m.bounds.height).toBeLessThan(1.05);
        expect(m.bounds.width).toBeLessThan(1.1);
        expect(m.rig.eyes).toHaveLength(2);
        const parts = (part: string) => m.rig.appendages.filter((a) => a.part === part).length;
        expect(parts('antenna')).toBe(morphology.antennae.length);
        if (morphology.ears) expect(parts('ear')).toBe(2);
        if (morphology.tail) expect(parts('tail')).toBeGreaterThanOrEqual(1);
        if (morphology.horns) expect(parts('horn')).toBeGreaterThanOrEqual(1);
        if (stage === 'adult') {
          expect(m.rig.legs.left && m.rig.legs.right && m.rig.arms.left && m.rig.arms.right).toBeTruthy();
        } else {
          expect(m.gait).toBe('hop');
        }
        // The same twice
        const skin = (x: BlobbiModel) => Array.from((x.root.getObjectByName('skin') as THREE.Mesh).geometry.getAttribute('position').array as Float32Array);
        expect(skin(again)).toEqual(skin(m));
        expect(again.bounds).toEqual(m.bounds);
      }
    }
  }, 30_000); // forty-eight models
});
