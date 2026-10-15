/**
 * The ritual drawn in the 3D room (M15 care): the foam and the beads sit on
 * the body's sampled surface (within tolerance of it), everything on the
 * body is instanced (bounded draw calls), each cue plays once, the wet
 * sheen is put back exactly, the Classic drawing's overlay pass gets the
 * tub's near walls and never the water or the body's effects, and reduced
 * motion draws no beads and no wobble while keeping the foam.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BATH_ELEV, BATH_TUB, BathLayer, SHAKE_S, type BathActorPlace } from './bath-scene';
import { CAMERA_AZIMUTH } from '../room-geometry';
import { makeFrame } from '@/test/bath-frames';
import { RITUALS } from '@/features/bath/rituals';

const TILES = 3;
const ACTOR = { x: 4, z: 4, elev: 0 };
/** An ellipsoid in the Blobbi's place, as wide and tall as its body. */
const RADII = { x: TILES * 0.3, y: TILES * 0.42, z: TILES * 0.26 };

function ellipsoid(material = new THREE.MeshStandardMaterial({ color: '#f0a', roughness: 0.78 })) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material);
  mesh.scale.set(RADII.x, RADII.y, RADII.z);
  mesh.position.set(0, RADII.y, 0);
  const root = new THREE.Group();
  root.add(mesh);
  root.position.set(ACTOR.x, ACTOR.elev, ACTOR.z);
  root.rotation.y = CAMERA_AZIMUTH;
  root.updateWorldMatrix(true, true);
  return { root, mesh, material };
}

/** How far a point is from the ellipsoid's surface, in its own radii (0 on it). */
function offSurface(p: THREE.Vector3, mesh: THREE.Mesh): number {
  const local = mesh.worldToLocal(p.clone());
  return Math.abs(local.length() - 1);
}

const place = (model: THREE.Object3D | null, over: Partial<BathActorPlace> = {}): BathActorPlace => ({ ...ACTOR, tiles: TILES, model, proxy: null, ...over });

/** The instances drawn (a zero scale is hidden), by position. */
function instancePositions(mesh: THREE.InstancedMesh): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    const te = m.elements;
    if (Math.hypot(te[0], te[1], te[2]) > 1e-6) out.push(new THREE.Vector3(te[12], te[13], te[14]));
  }
  return out;
}

describe('BathLayer: the surface', () => {
  it('samples every body cell off the model’s mesh: the foam sits on its surface, within tolerance', () => {
    const { root, mesh } = ellipsoid();
    const layer = new BathLayer(null, () => false);
    const frame = makeFrame({ foamed: true });
    layer.update(frame, place(root));
    const surface = layer.surfaceNow()!;
    expect(surface).not.toBeNull();
    const bodyCells = frame.cells.filter((c) => c.body).length;
    expect(surface.found).toBeGreaterThan(bodyCells * 0.6);
    const foam = instancePositions(layer.foam);
    expect(foam.length).toBe(bodyCells);
    // Lifted a little off the surface along its normal (the bead's radius): on it, within tolerance
    let onIt = 0;
    for (const p of foam) if (offSurface(p, mesh) < 0.35) onIt += 1;
    expect(onIt).toBeGreaterThan(foam.length * 0.6);
    layer.dispose();
  });

  it('with no model, the procedural shape stands in; with neither, the plain dome; a jump never samples', () => {
    const { root } = ellipsoid();
    const layer = new BathLayer(null, () => false);
    layer.update(makeFrame({ foamed: true }), place(null, { proxy: root }));
    expect(layer.surfaceNow()!.found).toBeGreaterThan(0);
    const bare = new BathLayer(null, () => false);
    bare.update(makeFrame({ foamed: true }), place(null));
    expect(bare.surfaceNow()!.found).toBe(0);
    expect(instancePositions(bare.foam).length).toBeGreaterThan(0);
    const mid = new BathLayer(null, () => false);
    mid.update(makeFrame({ ritual: RITUALS.soak, stageIndex: 0 }), place(root));
    expect(mid.surfaceNow()).toBeNull();
    layer.dispose();
    bare.dispose();
    mid.dispose();
  });
});

describe('BathLayer: the water', () => {
  it('beads run on the surface in step with the wetness, let go at the body’s bottom, fall and splash on the floor; all instanced', () => {
    const { root, mesh } = ellipsoid();
    const layer = new BathLayer(null, () => false);
    const wet = makeFrame({ wet: true, wetness: 1, status: 'committing', stageIndex: 2 });
    layer.update(wet, place(root));
    const ctx = { surface: layer.surfaceNow(), feet: new THREE.Vector3(ACTOR.x, ACTOR.elev, ACTOR.z), basis: { right: new THREE.Vector3(Math.cos(CAMERA_AZIMUTH), 0, -Math.sin(CAMERA_AZIMUTH)), toward: new THREE.Vector3(Math.sin(CAMERA_AZIMUTH), 0, Math.cos(CAMERA_AZIMUTH)) } };
    let moved = false;
    const off: number[] = [];
    let splashed = false;
    for (let i = 0; i < 240; i++) {
      if (layer.step(1 / 60)) moved = true;
      for (const p of layer.droplets.running(ctx)) off.push(offSurface(p, mesh));
      if (instancePositions(layer.droplets.splashes).length > 0) splashed = true;
    }
    expect(moved).toBe(true);
    expect(off.length).toBeGreaterThan(20);
    // On the surface: nearly all within a bead's lift of it; the few on the body's very edge (where the ray met
    // nothing and the dome stands in) not far off
    expect(off.filter((d) => d < 0.25).length).toBeGreaterThan(off.length * 0.7);
    expect(Math.max(...off)).toBeLessThan(0.6);
    expect(layer.droplets.active).toBeGreaterThan(0);
    expect(splashed).toBe(true);
    // A splash is at the floor, a flying bead never under it
    for (const p of instancePositions(layer.droplets.splashes)) expect(p.y).toBeCloseTo(ACTOR.elev + 0.012, 2);
    for (const p of instancePositions(layer.droplets.mesh)) expect(p.y).toBeGreaterThan(ACTOR.elev - 0.01);
    // One draw call per kind: the foam, the rain, its splash, the beads, their rings
    const instanced = [] as THREE.InstancedMesh[];
    layer.bodyFx.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) instanced.push(o as THREE.InstancedMesh);
    });
    expect(instanced.length).toBe(5);
    // Dry: the beads stop and go
    layer.update(makeFrame({ status: 'done', stageIndex: 2, wetness: 0, revision: 2 }), place(root));
    for (let i = 0; i < 300; i++) layer.step(1 / 60);
    expect(layer.droplets.active).toBe(0);
    layer.dispose();
  });

  it('the wet sheen lowers the model’s roughness with the wetness and puts it back exactly when dry and on dispose', () => {
    const { root, material } = ellipsoid();
    const layer = new BathLayer(null, () => false);
    layer.update(makeFrame({ wetness: 1, wet: true }), place(root));
    expect(material.roughness).toBeCloseTo(0.22);
    layer.update(makeFrame({ wetness: 0.5, wet: true, revision: 2 }), place(root));
    expect(material.roughness).toBeCloseTo(0.5);
    layer.update(makeFrame({ wetness: 0, revision: 3 }), place(root));
    expect(material.roughness).toBe(0.78);
    expect(layer.wet.touched).toBe(0);
    layer.update(makeFrame({ wetness: 1, wet: true, revision: 4 }), place(root));
    expect(material.roughness).toBeCloseTo(0.22);
    layer.dispose();
    expect(material.roughness).toBe(0.78);
  });
});

describe('BathLayer: the cues', () => {
  it('a shake wobbles the model and flings a ring of drops once per cue id; the same cue seen again does nothing; a new ritual starts afresh', () => {
    const { root } = ellipsoid();
    const layer = new BathLayer(null, () => false);
    const before = root.quaternion.clone();
    const shaken = makeFrame({ status: 'done', stageIndex: 2, wetness: 1, cues: [{ id: 1, kind: 'rinse' }, { id: 2, kind: 'shake' }] });
    layer.update(shaken, place(root));
    expect(layer.shaking).toBe(true);
    expect(layer.droplets.active).toBeGreaterThanOrEqual(14);
    layer.step(1 / 60);
    expect(root.quaternion.angleTo(before)).toBeGreaterThan(0.01);
    for (let i = 0; i < 60; i++) layer.step(1 / 60);
    expect(layer.shaking).toBe(false);
    layer.update(makeFrame({ status: 'done', stageIndex: 2, wetness: 1, cues: [{ id: 1, kind: 'rinse' }, { id: 2, kind: 'shake' }], revision: 2 }), place(root));
    expect(layer.shaking).toBe(false);
    layer.update(makeFrame({ status: 'done', stageIndex: 2, wetness: 1, cues: [{ id: 1, kind: 'rinse' }, { id: 2, kind: 'shake' }, { id: 3, kind: 'done' }] }), place(root));
    expect(layer.shaking).toBe(false);
    layer.update(makeFrame({ key: 2, status: 'done', stageIndex: 2, cues: [{ id: 1, kind: 'shake' }] }), place(root));
    expect(layer.shaking).toBe(true);
    layer.dispose();
  });

  it('a splash in or out flings drops up from the tub’s water, once each; they fall to the water, not the floor', () => {
    const { root } = ellipsoid();
    const layer = new BathLayer({ x0: 3, x1: 5, z0: 3, z1: 5 }, () => false);
    const inTub = place(root, { elev: BATH_ELEV });
    layer.update(makeFrame({ ritual: RITUALS.soak, stageIndex: 1, cues: [{ id: 1, kind: 'splash-in' }] }), inTub);
    const flung = layer.droplets.active;
    expect(flung).toBeGreaterThanOrEqual(10);
    const waterY = BATH_TUB.foot + BATH_TUB.water;
    for (let i = 0; i < 20; i++) layer.step(1 / 60);
    for (const p of instancePositions(layer.droplets.mesh)) expect(p.y).toBeGreaterThan(waterY - 0.05);
    for (let i = 0; i < 200; i++) layer.step(1 / 60);
    for (const p of instancePositions(layer.droplets.splashes)) expect(p.y).toBeCloseTo(waterY + 0.012, 2);
    layer.update(makeFrame({ ritual: RITUALS.soak, stageIndex: 1, cues: [{ id: 1, kind: 'splash-in' }], revision: 2 }), inTub);
    expect(layer.droplets.active).toBe(0);
    layer.dispose();
  });
});

describe('BathLayer: the Classic drawing and the overlay pass', () => {
  const onLayer1 = (root: THREE.Object3D) => {
    let any = false;
    root.traverse((o) => {
      if (o.layers.mask & 2) any = true;
    });
    return any;
  };

  it('with the page’s drawing in the tub: the near walls go on the overlay pass, the water never, the body’s effects not drawn here', () => {
    const layer = new BathLayer({ x0: 3, x1: 5, z0: 3, z1: 5 }, () => false);
    layer.update(makeFrame({ ritual: RITUALS.soak, stageIndex: 1, wetness: 1, wet: true }), place(null, { elev: BATH_ELEV }));
    layer.setFrontForDom(true);
    expect(layer.onFront).toBe(true);
    expect(onLayer1(layer.frontParts)).toBe(true);
    expect(onLayer1(layer.waterParts)).toBe(false);
    expect(onLayer1(layer.backParts)).toBe(false);
    expect(onLayer1(layer.bodyFx)).toBe(false);
    expect(layer.bodyFx.visible).toBe(false);
    expect(layer.step(1 / 60)).toBe(true);
    expect(layer.droplets.active).toBe(0);
    layer.setFrontForDom(false);
    expect(layer.onFront).toBe(false);
    expect(onLayer1(layer.frontParts)).toBe(false);
    expect(layer.bodyFx.visible).toBe(true);
    layer.dispose();
  });

  it('every mesh that may go on the overlay pass receives shadows (the pass’s rule); a ritual in place with the drawing draws nothing here', () => {
    const tub = new BathLayer({ x0: 3, x1: 5, z0: 3, z1: 5 }, () => false);
    tub.frontParts.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) expect((o as THREE.Mesh).receiveShadow).toBe(true);
    });
    const inPlace = new BathLayer(null, () => false);
    inPlace.update(makeFrame({ foamed: true }), place(null));
    inPlace.setFrontForDom(true);
    expect(inPlace.root.visible).toBe(false);
    expect(inPlace.onFront).toBe(false);
    inPlace.setFrontForDom(false);
    expect(inPlace.root.visible).toBe(true);
    tub.dispose();
    inPlace.dispose();
  });
});

describe('BathLayer: reduced motion', () => {
  it('draws the foam and the sheen, no beads, no wobble, and nothing moves', () => {
    const { root, material } = ellipsoid();
    const layer = new BathLayer(null, () => true);
    const before = root.quaternion.clone();
    layer.update(makeFrame({ foamed: true, wet: true, wetness: 1, status: 'done', stageIndex: 2, cues: [{ id: 1, kind: 'shake' }], reducedMotion: true }), place(root));
    expect(instancePositions(layer.foam).length).toBeGreaterThan(0);
    expect(material.roughness).toBeCloseTo(0.22);
    expect(layer.shaking).toBe(false);
    for (let i = 0; i < 30; i++) expect(layer.step(1 / 60)).toBe(false);
    expect(layer.droplets.active).toBe(0);
    expect(root.quaternion.angleTo(before)).toBeLessThan(1e-6);
    layer.dispose();
    expect(SHAKE_S).toBeCloseTo(0.7);
  });
});
