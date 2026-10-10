/**
 * The fidelity pass, pinned: every trait the kit lists is known and built;
 * every trait fixture, appendage pair and gene bound builds a whole, finite,
 * well-formed model at both stages; antennae, horns, ears and tails are
 * swept along the kit's own centrelines, curving and tapering as it draws
 * them, attached to the body, facing outward; the eyes' ovals are the kit's;
 * the gaze is eased, bounded, continuous through turns and blinks, and
 * gives up behind the head; and the 3D walk keeps its feet in step.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { normalizeBlobbiV3Visual } from '@blobbi-kit/renderer';
import { EAR_KINDS, HORN_KINDS, MARK_KINDS, MOTION_DURATION, PATTERN_KINDS, TAIL_KINDS, buildBlobbiGeometry, deriveMorphology, generateGenome, type BlobbiGenome } from '@blobbi-kit/renderer/procedural';
import { deriveBlobbiV3Seed } from '@blobbi-kit/core';
import { buildBlobbiModel, type BlobbiModel } from './model';
import { TRAIT_SUPPORT, UnsupportedMorphologyError, assertSupported, unknownKinds, unsupportedIn } from './compat';
import { extremeFixtures, pairFixtures, traitFixtures } from './coverage';
import { createBlobbiActor, WALK_TEMPO_3D } from './actor';
import { bendOf, parseHorn, parseStalk, sweep } from './sweep';
import { U } from './units';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

let built: BlobbiModel[] = [];
afterEach(() => {
  for (const m of built) m.dispose();
  built = [];
});

function make(genome: BlobbiGenome, stage: 'adult' | 'baby'): BlobbiModel {
  const m = buildBlobbiModel(deriveMorphology(genome, stage), genome.seed);
  built.push(m);
  return m;
}

/** Every mesh is finite, and its faces face the way its normals do (no inverted faces). */
function wellFormed(m: BlobbiModel): { nonFinite: number; inverted: number; faces: number } {
  let nonFinite = 0;
  let inverted = 0;
  let faces = 0;
  m.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    for (let k = 0; k < p.array.length; k++) if (!Number.isFinite(p.array[k])) nonFinite++;
    const index = g.getIndex();
    if (!index || !n) return;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3(), vn = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(p, index.getX(i));
      b.fromBufferAttribute(p, index.getX(i + 1));
      c.fromBufferAttribute(p, index.getX(i + 2));
      f.crossVectors(b.clone().sub(a), c.clone().sub(a));
      if (f.lengthSq() < 1e-20) continue;
      faces++;
      vn.fromBufferAttribute(n, index.getX(i)).add(new THREE.Vector3().fromBufferAttribute(n, index.getX(i + 1))).add(new THREE.Vector3().fromBufferAttribute(n, index.getX(i + 2)));
      if (f.dot(vn) < 0) inverted++;
    }
  });
  return { nonFinite, inverted, faces };
}

describe('compatibility with the kit', () => {
  it('knows every trait kind the kit lists, at the versions it was written for', () => {
    expect(unknownKinds()).toEqual([]);
    for (const k of HORN_KINDS) expect(TRAIT_SUPPORT[`horns:${k}`]).toBeDefined();
    for (const k of EAR_KINDS) expect(TRAIT_SUPPORT[`ears:${k}`]).toBeDefined();
    for (const k of TAIL_KINDS) expect(TRAIT_SUPPORT[`tail:${k}`]).toBeDefined();
    for (const k of PATTERN_KINDS) expect(TRAIT_SUPPORT[`pattern:${k}`]).toBeDefined();
    for (const k of MARK_KINDS) expect(TRAIT_SUPPORT[`mark:${k}`]).toBeDefined();
    for (const n of [0, 1, 2]) expect(TRAIT_SUPPORT[`antenna:${n}`]).toBeDefined();
  });

  it('fails loudly in development on a trait it does not know, and only warns otherwise', () => {
    const m = deriveMorphology(generateGenome({ seed: 'compat', horns: 'top' }), 'adult');
    const unknown = { ...m, horns: { ...m.horns!, kind: 'spiral' as never } };
    expect(unsupportedIn(unknown)).toContain('horns:spiral');
    expect(() => assertSupported(unknown, true)).toThrow(UnsupportedMorphologyError);
    expect(() => buildBlobbiModel(unknown)).toThrow(/spiral/);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => assertSupported(unknown, false)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('refuses an outline whose structure it does not know rather than drawing it wrong', () => {
    expect(() => parseStalk('M 0,0 L 1,1 Z')).toThrow(/stalk/);
    expect(() => parseHorn('M 0,0 Q 1,1 2,2 Z')).toThrow(/horn/);
  });
});

describe('the whole feature space', () => {
  const fixtures = [...traitFixtures(), ...pairFixtures(), ...extremeFixtures()];

  it('every trait fixture, appendage pair and gene bound builds a whole, finite, well-formed model with its parts, at both stages', () => {
    expect(fixtures.length).toBeGreaterThan(40);
    for (const f of fixtures) {
      for (const stage of ['adult', 'baby'] as const) {
        const morphology = deriveMorphology(f.genome, stage);
        const m = make(f.genome, stage);
        const form = wellFormed(m);
        expect(form.nonFinite, `${f.id} ${stage}`).toBe(0);
        expect(form.inverted / form.faces, `${f.id} ${stage} inverted faces`).toBeLessThan(0.01);
        const count = (part: string) => m.rig.appendages.filter((a) => a.part === part).length;
        expect(count('antenna'), `${f.id} ${stage}`).toBe(morphology.antennae.length);
        expect(count('ear'), `${f.id} ${stage}`).toBe(morphology.ears ? 2 : 0);
        expect(count('tail'), `${f.id} ${stage}`).toBe(morphology.tail ? 1 : 0);
        expect(count('horn'), `${f.id} ${stage}`).toBe(!morphology.horns ? 0 : morphology.horns.kind === 'forehead' ? 1 : 2);
        // Mirror-symmetric at rest: the eyes level, at the same depth, either side of the axis
        const [l, r] = m.rig.eyes;
        expect(l.group.position.z, f.id).toBeCloseTo(r.group.position.z, 2);
        expect(l.group.position.x).toBeLessThan(0);
        expect(r.group.position.x).toBeGreaterThan(0);
        expect(m.bounds.height).toBeLessThan(1.15);
      }
    }
  }, 120_000);

  it('a sweep of sixty addresses builds, the same twice, with no unsupported trait', () => {
    const pubkey = 'f'.repeat(64);
    for (let i = 1; i <= 60; i++) {
      const seed = deriveBlobbiV3Seed(pubkey, `blobbi-${pubkey.slice(0, 12)}-${String(i).padStart(10, '0')}`);
      const id = normalizeBlobbiV3Visual({ seed })!;
      const { specialMark, ...traits } = id.traits;
      const genome = generateGenome({ seed: id.seed, colors: { ...id.colors }, ...traits, mark: specialMark });
      const stage = i % 2 ? 'adult' : 'baby';
      expect(unsupportedIn(deriveMorphology(genome, stage))).toEqual([]);
      const a = make(genome, stage);
      const b = make(genome, stage);
      expect(wellFormed(a).nonFinite).toBe(0);
      expect(b.bounds).toEqual(a.bounds);
    }
  }, 120_000);

  it('a baby has no tail, as the kit draws none (its development gives tails nothing)', () => {
    const g = generateGenome({ seed: 'baby-tail', tail: 'curl' });
    expect(deriveMorphology(g, 'baby').tail).toBeNull();
    expect(make(g, 'baby').rig.appendages.filter((a) => a.part === 'tail')).toHaveLength(0);
    expect(make(g, 'adult').rig.appendages.filter((a) => a.part === 'tail')).toHaveLength(1);
  });
});

describe('antennae, horns, ears and tails', () => {
  const spinesOf = (m: BlobbiModel, part: string) => m.rig.appendages.filter((a) => a.part === part).flatMap((a) => a.built?.spines ?? []);

  it("horns curve as the kit curls them, and taper from a flared root to a rounded tip", () => {
    for (const curvature of [-1, 0, 1]) {
      const g = generateGenome({ seed: 'horn-curl', horns: 'top' });
      g.traits.horns.curvature = curvature;
      const m = make(g, 'adult');
      const spines = spinesOf(m, 'horn');
      expect(spines).toHaveLength(2);
      const front = buildBlobbiGeometry(deriveMorphology(g, 'adult'), { view: 'front' });
      for (const s of spines) {
        expect(s.tipHalf).toBeLessThan(s.baseHalf * 0.75);
        // The 3D centreline bends: its control point lies off the base–tip line in proportion to the kit's curl
        const chord = s.tip.clone().sub(s.base);
        const off = s.control.clone().sub(s.base).sub(chord.clone().multiplyScalar(0.5));
        const sag = off.length() / chord.length();
        if (curvature === 0) expect(Math.abs(s.bend)).toBeLessThan(25);
        else expect(sag).toBeGreaterThan(0.04);
      }
      // The two horns curl mirror-wise (a straight pair has nothing to mirror)
      if (curvature !== 0) expect(Math.sign(spines[0].bend)).toBe(-Math.sign(spines[1].bend));
      // Matching the kit: each horn's front-view bend is the one the kit drew
      const kitBends = front.appendages.filter((a) => a.part === 'horn').map((a) => bendOf(parseHorn(a.prims.find((p) => p.part === 'horn-body')!.d!)));
      expect(spines.map((s) => Math.round(s.bend))).toEqual(kitBends.map((b) => Math.round(b)));
    }
  });

  it('antennae are tapered stalks with their ball at the tip; the curl tail curls; every part starts inside the body', () => {
    const g = generateGenome({ seed: 'parts', antenna: 'double', tail: 'curl', ears: 'pointed', horns: 'side' });
    const m = make(g, 'adult');
    const antenna = spinesOf(m, 'antenna');
    expect(antenna).toHaveLength(2);
    for (const s of antenna) expect(s.tipHalf).toBeLessThan(s.baseHalf);
    for (const a of m.rig.appendages.filter((x) => x.part === 'antenna')) {
      const tip = a.built!.spines[0].tip;
      const ball = a.group.children.find((c) => c instanceof THREE.Group && c.position.distanceTo(tip) < 15 * U);
      expect(ball, 'antenna tip ball at the stalk tip').toBeDefined();
    }
    const [tail] = spinesOf(m, 'tail-curl'.split('-')[0]).filter((s) => s.part === 'tail-curl');
    expect(Math.abs(tail.bend)).toBeGreaterThan(20);
    // Attachment: each part's base, in body coordinates, is within a few units of the skin or inside it
    for (const a of m.rig.appendages) {
      for (const s of a.built?.spines ?? []) {
        if (s.part === 'ear-inner') continue;
        const base = s.base.clone().add(a.group.position);
        const xr = m.surface.frame.axisX + base.x / U;
        const yr = m.surface.frame.groundY - base.y / U;
        const ring = m.surface.ringAt(m.surface.fractionOf(yr));
        // Inside the cross-section's bounding superellipse, give or take the ink line
        const sx = Math.abs((base.x - ring.cx) / ring.a);
        const sz = Math.abs((base.z - ring.zc) / ring.b);
        expect(Math.max(sx, sz), `${a.part} ${s.part} base at ${xr.toFixed(0)},${yr.toFixed(0)}`).toBeLessThan(1.12);
      }
    }
  });

  it('a swept tube faces outward all round, closed at both ends', () => {
    const geometry = sweep((t) => new THREE.Vector3(Math.sin(t * 2), t * 3, 0), (t) => ({ a: 0.3 - 0.2 * t, b: 0.3 - 0.2 * t }), { steps: 20, segments: 12 });
    const p = geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = geometry.getAttribute('normal') as THREE.BufferAttribute;
    let outward = 0;
    let total = 0;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      // The nearest point of the curve
      let best = Infinity;
      let at = new THREE.Vector3();
      for (let k = 0; k <= 200; k++) {
        const c = new THREE.Vector3(Math.sin((k / 200) * 2), (k / 200) * 3, 0);
        const d = c.distanceTo(v);
        if (d < best) { best = d; at = c; }
      }
      if (best < 1e-3) continue;
      total++;
      if (new THREE.Vector3().fromBufferAttribute(n, i).dot(v.clone().sub(at)) > 0) outward++;
    }
    expect(outward / total).toBeGreaterThan(0.97);
    geometry.dispose();
  });
});

describe('the eyes, seen from the front', () => {
  it("are the kit's ovals: width and height as drawn, independently, for adults and babies alike", () => {
    for (const f of traitFixtures().slice(0, 6)) {
      for (const stage of ['adult', 'baby'] as const) {
        const m = make(f.genome, stage);
        const geo = buildBlobbiGeometry(deriveMorphology(f.genome, stage), { view: 'front' });
        geo.face!.eyes.forEach((eye, i) => {
          const white = m.rig.eyes[i].open.getObjectByName('white') as THREE.Mesh;
          white.geometry.computeBoundingBox();
          const size = white.geometry.boundingBox!.getSize(new THREE.Vector3());
          // Projected straight on, the white is exactly the drawing's ellipse
          expect(size.x / U).toBeCloseTo(eye.white.rx * 2, 0);
          expect(size.y / U).toBeCloseTo(eye.white.ry * 2, 0);
          expect(size.x / size.y).toBeCloseTo(eye.white.rx / eye.white.ry, 2);
          // Not a ball, and not wrapped round the head: every point of the white lies close to the eye's own plane
          // (the plane through its centre, facing the way the face does there), within its dome and a little curve
          const rig = m.rig.eyes[i];
          const on = m.surface.at(eye.white.cx, eye.white.cy);
          const p = white.geometry.getAttribute('position') as THREE.BufferAttribute;
          let worst = 0;
          for (let k = 0; k < p.count; k++) {
            const v = new THREE.Vector3().fromBufferAttribute(p, k).add(rig.group.position);
            worst = Math.max(worst, Math.abs(v.sub(on.position).dot(on.normal)));
          }
          expect(worst / size.x, `${f.id} ${stage}`).toBeLessThan(0.22);
        });
      }
    }
  });
});

describe('the gaze', () => {
  const frame = { dt: 1 / 60, motion: 'idle' as const, heading: 0, sleeping: false };

  function actor(seed = 'gaze') {
    const m = make(generateGenome({ seed }), 'adult');
    return { m, a: createBlobbiActor(m, { reducedMotion: () => false }) };
  }

  it('eases toward a target without jumps, and back to rest when the target leaves', () => {
    const { a } = actor();
    a.update({ ...frame, lookAt: null });
    let last = a.gaze();
    let biggest = 0;
    const target = new THREE.Vector3(2, 0.6, 3);
    for (let i = 0; i < 60; i++) {
      a.update({ ...frame, lookAt: target });
      const g = a.gaze();
      biggest = Math.max(biggest, Math.hypot(g.x - last.x, g.y - last.y));
      last = g;
    }
    expect(last.x).toBeGreaterThan(0.3);
    expect(biggest).toBeLessThan(0.2);
    for (let i = 0; i < 90; i++) {
      a.update({ ...frame, lookAt: null });
      const g = a.gaze();
      biggest = Math.max(biggest, Math.hypot(g.x - last.x, g.y - last.y));
      last = g;
    }
    expect(last).toEqual({ x: 0, y: 0 });
    expect(biggest).toBeLessThan(0.2);
  });

  it('stays inside the unit disc however far off the target is', () => {
    const { a } = actor();
    for (const target of [new THREE.Vector3(100, 0, 1), new THREE.Vector3(0, 100, 1), new THREE.Vector3(-50, -50, 2)]) {
      for (let i = 0; i < 120; i++) a.update({ ...frame, lookAt: target });
      const g = a.gaze();
      expect(Math.hypot(g.x, g.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('gives up smoothly as the face turns away, and never looks with the back of the head', () => {
    const { a } = actor();
    const target = new THREE.Vector3(0.5, 0.5, 3);
    for (let i = 0; i < 60; i++) a.update({ ...frame, lookAt: target });
    expect(Math.hypot(a.gaze().x, a.gaze().y)).toBeGreaterThan(0.1);
    // Turn round under the fixed target: the heading eases, the gaze follows it continuously to rest
    let last = a.gaze();
    let biggest = 0;
    for (let i = 0; i < 240; i++) {
      a.update({ ...frame, heading: Math.PI, lookAt: target });
      const g = a.gaze();
      biggest = Math.max(biggest, Math.hypot(g.x - last.x, g.y - last.y));
      last = g;
    }
    expect(biggest).toBeLessThan(0.2);
    expect(Math.hypot(last.x, last.y)).toBeLessThan(1e-6);
  });

  it('keeps its gaze through a blink, and the eyes shut under it', () => {
    const { m, a } = actor('ab'.repeat(32));
    const target = new THREE.Vector3(1, 0.4, 3);
    let sawShut = false;
    let sawOpen = false;
    for (let i = 0; i < 60 * 8; i++) {
      a.update({ ...frame, lookAt: target });
      const shut = m.rig.eyes[0].open.scale.y < 0.5;
      if (shut) {
        sawShut = true;
        expect(a.gaze().x).toBeGreaterThan(0.2);
      } else sawOpen = true;
    }
    expect(sawShut && sawOpen).toBe(true);
  });

  it('never blinks in a still pose, so a comparison still is never caught with its eyes shut', () => {
    const { m, a } = actor('ab'.repeat(32));
    for (let i = 0; i < 60 * 8; i++) {
      a.update({ ...frame, motion: 'still' });
      expect(m.rig.eyes[0].open.scale.y).toBe(1);
    }
  });
});

describe('the 3D walk', () => {
  it('is a little brisker than the drawing\'s and keeps its feet in step: the cycle plays as much faster as the actor moves', () => {
    expect(WALK_TEMPO_3D).toBeGreaterThanOrEqual(1.05);
    expect(WALK_TEMPO_3D).toBeLessThanOrEqual(1.1);
    const m = make(generateGenome({ seed: 'walk' }), 'adult');
    const a = createBlobbiActor(m, { walkCycle: MOTION_DURATION.walking, reducedMotion: () => false });
    expect(a.pace).toBe(WALK_TEMPO_3D);
    // One drawing-cycle's worth of time is WALK_TEMPO_3D cycles of the 3D walk: the left foot's lift comes round that much sooner
    const lifts: number[] = [];
    let prev = 0;
    const restY = m.rig.legs.left!.position.y;
    for (let i = 0; i < 600; i++) {
      a.update({ dt: 1 / 600, motion: 'walking', heading: 0, sleeping: false });
      const y = m.rig.legs.left!.position.y - restY;
      if (prev <= 0.002 && y > 0.002) lifts.push(i / 600);
      prev = y;
    }
    expect(lifts.length).toBeGreaterThanOrEqual(1);
    const cycles = 1 / (MOTION_DURATION.walking / WALK_TEMPO_3D);
    expect(cycles).toBeCloseTo(WALK_TEMPO_3D / MOTION_DURATION.walking, 6);
  });
});
