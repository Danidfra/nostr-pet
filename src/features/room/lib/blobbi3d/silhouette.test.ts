/**
 * The baby's seed: its silhouette is the kit's, and the room sees it.
 *
 * The kit draws a V3 baby as a seed: a crown that comes to a tip, a narrower
 * upper body, the widest part below the middle, a fuller base. The model's
 * body is lofted from those two silhouettes, so from the front and the side
 * its width and depth ARE the kit's, height for height. From the room's
 * camera, 35° above, a solid with that blunt tip hides it behind its own
 * crown and reads as a ball; leaning back from the camera (`ROOM_LEAN`)
 * brings the tip back to the top of what the room sees.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildBlobbiGeometry } from '@blobbi-kit/renderer/procedural';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { CAMERA_ELEVATION } from '../room-geometry';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { createBlobbiActor, ROOM_LEAN } from './actor';
import { genomeOf, labBlobbi, morphologyOf } from './identity';

const PET_IDS = ['0000000001', '0000000005', '0000000006', '0000000010', '0000000018', '0000000020'];

function babyOf(petId: string) {
  const genome = genomeOf(toBlobbiVisual(labBlobbi('b'.repeat(64), petId, 'x', 'baby')))!;
  const morphology = morphologyOf(genome, 'baby');
  return { model: buildBlobbiModel(morphology, genome.seed), front: buildBlobbiGeometry(morphology, { view: 'front' }) };
}

/** The body's skin vertices in world space. */
function skin(model: BlobbiModel): THREE.Vector3[] {
  model.root.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o.name !== 'skin') return;
    const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld));
  });
  return points;
}

/** Width of the skin across a band of heights, as a fraction of its widest. */
function widthProfile(points: THREE.Vector3[]): (f: number) => number {
  const ys = points.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const xs = points.map((p) => p.x);
  const widest = Math.max(...xs) - Math.min(...xs);
  return (f) => {
    const y = lo + f * (hi - lo);
    const band = points.filter((p) => Math.abs(p.y - y) < (hi - lo) / 60);
    return (Math.max(...band.map((p) => p.x)) - Math.min(...band.map((p) => p.x))) / widest;
  };
}

/** The kit's front-view width at a height fraction, as a fraction of its widest. */
function kitProfile(front: ReturnType<typeof buildBlobbiGeometry>): (f: number) => number {
  if (front.view !== 'front') throw new Error('front view expected');
  const body = front.body;
  const at = (f: number) => {
    const s = body.spanAt(body.bottom - f * (body.bottom - body.top));
    return s ? s.max - s.min : 0;
  };
  let widest = 0;
  for (let f = 0; f <= 1; f += 0.005) widest = Math.max(widest, at(f));
  return (f) => at(f) / widest;
}

/** Up on the room camera's screen, for a camera on +z looking down at its elevation. */
const SCREEN_UP = new THREE.Vector3(0, Math.cos(CAMERA_ELEVATION), -Math.sin(CAMERA_ELEVATION));

/** How far below the top of what the camera sees the crown's tip is, as a fraction of the body's height. */
function tipDrop(model: BlobbiModel): number {
  const points = skin(model);
  const apex = points.reduce((a, b) => {
    // The tip: the highest point of the skin in the model's own frame
    const la = model.root.worldToLocal(a.clone()).y;
    const lb = model.root.worldToLocal(b.clone()).y;
    return lb > la ? b : a;
  });
  const top = Math.max(...points.map((p) => p.dot(SCREEN_UP)));
  const ys = points.map((p) => p.y);
  return (top - apex.dot(SCREEN_UP)) / (Math.max(...ys) - Math.min(...ys));
}

/** The width of what the room's camera sees, `below` (a fraction of its height) under its top, as a fraction of its widest. */
function crownWidth(model: BlobbiModel, below: number): number {
  const points = skin(model).map((p) => ({ x: p.x, y: p.dot(SCREEN_UP) }));
  const top = Math.max(...points.map((p) => p.y));
  const height = top - Math.min(...points.map((p) => p.y));
  const widest = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  const band = points.filter((p) => Math.abs(p.y - (top - below * height)) < height / 80);
  return (Math.max(...band.map((p) => p.x)) - Math.min(...band.map((p) => p.x))) / widest;
}

describe('the baby\'s seed silhouette', () => {
  const babies = PET_IDS.map(babyOf);

  it('is the kit\'s outline, height for height, for every identity: a narrower crown, the widest part low, a fuller base', () => {
    for (const { model, front } of babies) {
      const ours = widthProfile(skin(model));
      const kit = kitProfile(front);
      for (const f of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) expect(Math.abs(ours(f) - kit(f))).toBeLessThan(0.03);
      // The seed: the crown narrower than the base at the same distance from either end, the widest part below the middle
      expect(ours(0.8)).toBeLessThan(ours(0.2) - 0.08);
      expect(ours(0.9)).toBeLessThan(ours(0.1) - 0.06);
      expect(ours(0.4)).toBeGreaterThan(ours(0.6));
    }
  });

  it('from the room\'s camera the tip is the top of the Blobbi when it leans back, and hidden behind its crown when it stands upright', () => {
    for (const { model, front } of babies) {
      const actor = createBlobbiActor(model, { reducedMotion: () => true });
      actor.update({ dt: 0, motion: 'still', heading: 0, sleeping: false });
      const uprightDrop = tipDrop(model);
      const uprightCrown = crownWidth(model, 0.1);
      actor.update({ dt: 0, motion: 'still', heading: 0, sleeping: false, viewAzimuth: 0 });
      // Upright, the crown's rim is the top and the tip is behind it; leaning, the tip is the top again
      expect(uprightDrop).toBeGreaterThan(0.003);
      expect(tipDrop(model)).toBeLessThan(0.0005);
      // And just under the top the room sees a narrower crown, nearer the kit's own drawing
      const leaning = crownWidth(model, 0.1);
      expect(leaning).toBeLessThan(uprightCrown - 0.04);
      expect(Math.abs(leaning - kitProfile(front)(0.9))).toBeLessThan(Math.abs(uprightCrown - kitProfile(front)(0.9)));
    }
  });

  it('leans only toward an elevated camera, about the ground under it, and an adult stands upright', () => {
    expect(ROOM_LEAN.adult).toBe(0);
    expect(ROOM_LEAN.baby).toBeGreaterThan(0);
    const { model } = babies[0];
    const actor = createBlobbiActor(model, { reducedMotion: () => true });
    // Seen from the room's corner, walking any way: the lean is away from the camera, whatever the heading
    for (const heading of [0, 1, 2.5, -2]) {
      actor.update({ dt: 0, motion: 'still', heading, sleeping: false, viewAzimuth: Math.PI / 4 });
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(model.root.quaternion);
      const towardCamera = new THREE.Vector3(Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4));
      expect(up.dot(towardCamera)).toBeCloseTo(-Math.sin(ROOM_LEAN.baby), 6);
      expect(model.root.position.length()).toBe(0);
    }
  });
});
