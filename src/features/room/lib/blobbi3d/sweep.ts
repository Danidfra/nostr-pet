/**
 * Swept tubes along curves: the horns, antennae and the curl tail.
 *
 * The kit states these parts as outlines with a known structure, each
 * drawn around a quadratic Bézier centreline: a `stalk` (an antenna, the
 * curl tail) is `M a Q c1 ta L tb Q c2 b Z`, with the centreline's base at
 * the middle of a and b, its tip at the middle of ta and tb and its control
 * point at the middle of c1 and c2; a horn is `M root C c1 c2 end A … end'
 * C c2' c1' root' (A … ) Z`, whose base, tip and point at t = 0.62 recover
 * the same kind of curve; a `softCone` (a pointed ear) is `M a Q c ta A …
 * tb Q c' b Z`. `parseStalk`, `parseHorn` and `parseCone` read them back
 * (and refuse anything else, loudly, so a change in the kit's drawing is
 * caught rather than drawn wrong), and `sweep` builds a round, tapered
 * tube along the curve with a rotation-minimising frame, closed by a dome
 * at the tip and a flat cap at the base.
 */
import * as THREE from 'three';

export interface Pt2 {
  x: number;
  y: number;
}

/** A quadratic Bézier centreline with the half-widths the outline states along it. */
export interface Spine2 {
  base: Pt2;
  control: Pt2;
  tip: Pt2;
  /** Half-widths at parameters along the curve, from the outline. */
  widths: { t: number; half: number }[];
}

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

interface Token {
  command: string;
  numbers: number[];
}

/** The path's commands with their numbers, in order. */
export function tokens(d: string): Token[] {
  const out: Token[] = [];
  const re = /([A-Za-z])([^A-Za-z]*)/g;
  for (const m of d.matchAll(re)) out.push({ command: m[1], numbers: (m[2].match(NUM) ?? []).map(Number) });
  return out;
}

const mid = (a: Pt2, b: Pt2): Pt2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt2, b: Pt2) => Math.hypot(a.x - b.x, a.y - b.y);
const p = (n: number[], i: number): Pt2 => ({ x: n[i], y: n[i + 1] });

function expect(ok: boolean, what: string, d: string): asserts ok {
  if (!ok) throw new Error(`Unexpected ${what} in the kit's path: ${d.slice(0, 80)}`);
}

/** A `stalk`: M a Q c1 ta L tb Q c2 b Z. */
export function parseStalk(d: string): Spine2 {
  const t = tokens(d);
  expect(t.length === 5 && t[0].command === 'M' && t[1].command === 'Q' && t[2].command === 'L' && t[3].command === 'Q' && t[4].command === 'Z', 'stalk structure', d);
  const a = p(t[0].numbers, 0);
  const c1 = p(t[1].numbers, 0);
  const ta = p(t[1].numbers, 2);
  const tb = p(t[2].numbers, 0);
  const c2 = p(t[3].numbers, 0);
  const b = p(t[3].numbers, 2);
  return { base: mid(a, b), control: mid(c1, c2), tip: mid(ta, tb), widths: [{ t: 0, half: dist(a, b) / 2 }, { t: 0.5, half: dist(c1, c2) / 2 }, { t: 1, half: dist(ta, tb) / 2 }] };
}

/** A `softCone`: M a Q c ta A rx ry … tb Q c' b Z. */
export function parseCone(d: string): Spine2 {
  const t = tokens(d);
  expect(t.length === 5 && t[0].command === 'M' && t[1].command === 'Q' && t[2].command === 'A' && t[3].command === 'Q' && t[4].command === 'Z', 'cone structure', d);
  const a = p(t[0].numbers, 0);
  const c = p(t[1].numbers, 0);
  const ta = p(t[1].numbers, 2);
  const tb = p(t[2].numbers, 5);
  const c2 = p(t[3].numbers, 0);
  const b = p(t[3].numbers, 2);
  return { base: mid(a, b), control: mid(c, c2), tip: mid(ta, tb), widths: [{ t: 0, half: dist(a, b) / 2 }, { t: 0.5, half: dist(c, c2) / 2 }, { t: 1, half: dist(ta, tb) / 2 }] };
}

/**
 * A horn: M root C c1 c2 end A r r … end' C c2' c1' root' [A …] Z. The
 * kit's c1 lies 0.2 of the way along the start direction and c2 beside the
 * curve's point at t = 0.62, from which the quadratic's control point
 * follows exactly.
 */
export function parseHorn(d: string): Spine2 {
  const t = tokens(d);
  expect(t.length >= 5 && t[0].command === 'M' && t[1].command === 'C' && t[2].command === 'A' && t[3].command === 'C', 'horn structure', d);
  const root = p(t[0].numbers, 0);
  const c1 = p(t[1].numbers, 0);
  const c2 = p(t[1].numbers, 2);
  const end = p(t[1].numbers, 4);
  const end2 = p(t[2].numbers, 5);
  const c2b = p(t[3].numbers, 0);
  const c1b = p(t[3].numbers, 2);
  const root2 = p(t[3].numbers, 4);
  const base = mid(root, root2);
  const tip = mid(end, end2);
  const at62 = mid(c2, c2b);
  // P(0.62) = 0.1444 B + 0.4712 C + 0.3844 T
  const control = { x: (at62.x - 0.1444 * base.x - 0.3844 * tip.x) / 0.4712, y: (at62.y - 0.1444 * base.y - 0.3844 * tip.y) / 0.4712 };
  const half = dist(c1, c1b) / 2;
  return {
    base,
    control,
    tip,
    widths: [
      { t: 0, half: dist(root, root2) / 2 },
      { t: 0.2, half },
      { t: 0.62, half: dist(c2, c2b) / 2 },
      { t: 1, half: dist(end, end2) / 2 },
    ],
  };
}

export function quadraticAt(s: Spine2, t: number): Pt2 {
  const u = 1 - t;
  return { x: u * u * s.base.x + 2 * u * t * s.control.x + t * t * s.tip.x, y: u * u * s.base.y + 2 * u * t * s.control.y + t * t * s.tip.y };
}

/** The outline's half-width at `t`, interpolated between the widths it states. */
export function halfWidthAt(s: Spine2, t: number): number {
  const w = s.widths;
  if (t <= w[0].t) return w[0].half;
  for (let i = 1; i < w.length; i++) {
    if (t <= w[i].t) {
      const f = (t - w[i - 1].t) / (w[i].t - w[i - 1].t);
      return w[i - 1].half + f * (w[i].half - w[i - 1].half);
    }
  }
  return w[w.length - 1].half;
}

/** The kit's curl, in degrees: how far the tip direction turns from the base direction. */
export function bendOf(s: Spine2): number {
  const a = Math.atan2(s.control.y - s.base.y, s.control.x - s.base.x);
  const b = Math.atan2(s.tip.y - s.control.y, s.tip.x - s.control.x);
  let d = ((b - a) * 180) / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export interface SweepOptions {
  /** Rings along the curve. */
  steps?: number;
  /** Segments around. */
  segments?: number;
  /** Close the tip with a dome (the kit's rounded tips) rather than a point. */
  dome?: boolean;
  /**
   * How the cross-section is turned along the curve: 'twist-free' carries it
   * with as little twist as possible (round parts); 'flat' keeps its width
   * across the picture plane (x/y) and its depth along z (an ear's leaf).
   */
  frame?: 'twist-free' | 'flat';
}

/**
 * A tube around `centre(t)` with radii `(a(t), b(t))` across and along a
 * rotation-minimising frame, for t in 0..1, closed at both ends.
 */
export function sweep(centre: (t: number) => THREE.Vector3, radii: (t: number) => { a: number; b: number }, options: SweepOptions = {}): THREE.BufferGeometry {
  const steps = options.steps ?? 24;
  const segments = options.segments ?? 16;
  const dome = options.dome ?? true;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) points.push(centre(i / steps));
  // Tangents, then a frame carried along with as little twist as possible
  const tangents = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(steps, i + 1)];
    const t = new THREE.Vector3().subVectors(b, a);
    return t.lengthSq() > 1e-18 ? t.normalize() : new THREE.Vector3(0, 1, 0);
  });
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];
  let n = new THREE.Vector3(1, 0, 0);
  if (Math.abs(n.dot(tangents[0])) > 0.9) n = new THREE.Vector3(0, 0, 1);
  n.sub(tangents[0].clone().multiplyScalar(n.dot(tangents[0]))).normalize();
  for (let i = 0; i <= steps; i++) {
    if (options.frame === 'flat') {
      // Width in the picture plane, perpendicular to the curve; depth toward the viewer
      const z = new THREE.Vector3(0, 0, 1);
      const across = new THREE.Vector3().crossVectors(tangents[i], z);
      if (across.lengthSq() < 1e-12) across.set(1, 0, 0);
      across.normalize();
      normals.push(across);
      binormals.push(new THREE.Vector3().crossVectors(tangents[i], across).normalize());
      continue;
    }
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
      if (axis.lengthSq() > 1e-12) {
        const angle = Math.acos(Math.max(-1, Math.min(1, tangents[i - 1].dot(tangents[i]))));
        n = n.clone().applyAxisAngle(axis.normalize(), angle);
      }
    }
    normals.push(n.clone());
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], n).normalize());
  }
  const positions: number[] = [];
  const index: number[] = [];
  const ring = (i: number, r: { a: number; b: number }, at: THREE.Vector3) => {
    const start = positions.length / 3;
    for (let j = 0; j <= segments; j++) {
      const phi = (2 * Math.PI * j) / segments;
      const v = at.clone().addScaledVector(normals[i], r.a * Math.cos(phi)).addScaledVector(binormals[i], r.b * Math.sin(phi));
      positions.push(v.x, v.y, v.z);
    }
    return start;
  };
  const starts: number[] = [];
  for (let i = 0; i <= steps; i++) starts.push(ring(i, radii(i / steps), points[i]));
  // The dome: rings shrinking past the tip, a quarter turn round
  const tipRadius = radii(1);
  const domeRings = dome ? 6 : 0;
  for (let k = 1; k <= domeRings; k++) {
    const u = (k / domeRings) * (Math.PI / 2);
    const at = points[steps].clone().addScaledVector(tangents[steps], Math.min(tipRadius.a, tipRadius.b) * Math.sin(u));
    const shrink = Math.cos(u);
    starts.push(ring(steps, { a: tipRadius.a * shrink + 1e-6, b: tipRadius.b * shrink + 1e-6 }, at));
  }
  for (let r = 0; r < starts.length - 1; r++) {
    for (let j = 0; j < segments; j++) {
      const a = starts[r] + j;
      const b = starts[r + 1] + j;
      // Counter-clockwise seen from outside: along the curve, then round it (t × b = -n would face inward)
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // The base: a flat cap, drawn inward-facing so it is hidden inside the body
  const baseCentre = positions.length / 3;
  positions.push(points[0].x, points[0].y, points[0].z);
  for (let j = 0; j < segments; j++) index.push(starts[0] + j + 1, starts[0] + j, baseCentre);
  // The tip's last ring closes to a point
  const tipCentre = positions.length / 3;
  const last = starts[starts.length - 1];
  const tipPoint = dome ? points[steps].clone().addScaledVector(tangents[steps], Math.min(tipRadius.a, tipRadius.b)) : points[steps];
  positions.push(tipPoint.x, tipPoint.y, tipPoint.z);
  for (let j = 0; j < segments; j++) index.push(last + j, last + j + 1, tipCentre);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
