/**
 * The body's surface and the lofts built on it.
 *
 * The kit states a Blobbi in two silhouettes: the front one says how wide
 * the body is at each height (`spanAt`), the side one how deep
 * (`frontAt`/`backAt`). Between them the body is round: each height's
 * cross-section is a superellipse through the four points the two views
 * fix (its exponent a little over 2, so the diagonals are full rather than
 * pinched, while the front and side silhouettes stay exactly the kit's).
 * `Surface.at` finds where that surface is under a front-view point, with
 * its normal, so features drawn in the front view can be laid on it.
 *
 * `loftRings` turns a stack of such cross-sections into a smooth mesh (the
 * body, and each arm from its own two outlines); `stickerGeometry` lays a
 * front-view ellipse over any placer (an eye on the body, a pupil on the
 * eye's bulge).
 */
import * as THREE from 'three';
import type { FrontGeometry, SideGeometry } from '@blobbi-kit/renderer/procedural';
import { toModelX, toModelY, toModelZ, U, type Frame } from './units';

/** The cross-section's exponent: 2 is an ellipse; more is fuller at the diagonals. */
export const SUPER = 2.4;

/** One horizontal cross-section: a superellipse of half-width `a` and half-depth `b` about (cx, zc) at height `y`. */
export interface Ring {
  y: number;
  cx: number;
  a: number;
  zc: number;
  b: number;
}

export interface SurfacePoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  /** The normal's yaw about +y (0 faces +z). */
  theta: number;
}

export interface Surface {
  frame: Frame;
  ringAt(f: number): Ring;
  fractionOf(yRoot: number): number;
  /** The angle around the ring (0 at the front) of a point at `s` = (x − cx) / a on the front hemisphere. */
  phiOf(s: number): number;
  /** Where the surface is under a front-view root point, lifted along the normal. */
  at(xRoot: number, yRoot: number, lift?: number): SurfacePoint;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const pow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

/** A unit superellipse point at angle `phi` (0 toward +z, the front): (sx along x, cz along z). */
export function unitProfile(phi: number): { sx: number; cz: number } {
  return { sx: pow(Math.sin(phi), 2 / SUPER), cz: pow(Math.cos(phi), 2 / SUPER) };
}

export function phiOf(s: number): number {
  return Math.asin(clamp(pow(s, SUPER / 2), -1, 1));
}

/** The outward normal of a ring at (sx, cz) on its unit profile. */
function ringNormal(ring: Ring, sx: number, cz: number): THREE.Vector3 {
  const e = SUPER - 1;
  return new THREE.Vector3((pow(sx, e)) / ring.a, 0, (pow(cz, e)) / ring.b).normalize();
}

/** The surface the kit's two silhouettes agree on. */
export function makeSurface(front: FrontGeometry, side: SideGeometry, frame: Frame): Surface {
  const fb = front.body;
  const sb = side.body;
  const span = fb.bottom - fb.top;
  const sideSpan = sb.bottom - sb.top;
  const ringAt = (f: number): Ring => {
    const t = clamp(f, 0.004, 0.996);
    const yF = fb.bottom - t * span;
    const yS = sb.bottom - t * sideSpan;
    const s = fb.spanAt(yF);
    const min = s ? s.min : fb.apex.x - 0.5;
    const max = s ? s.max : fb.apex.x + 0.5;
    const fr = sb.frontAt(yS);
    const bk = sb.backAt(yS);
    return {
      y: toModelY(yF, frame),
      cx: toModelX((min + max) / 2, frame),
      a: Math.max(0.5, (max - min) / 2) * U,
      zc: toModelZ((fr + bk) / 2, frame),
      b: Math.max(0.5, (fr - bk) / 2) * U,
    };
  };
  const fractionOf = (yRoot: number) => clamp((fb.bottom - yRoot) / span, 0, 1);
  const at = (xRoot: number, yRoot: number, lift = 0): SurfacePoint => {
    const ring = ringAt(fractionOf(yRoot));
    const xm = toModelX(xRoot, frame);
    const s = clamp((xm - ring.cx) / ring.a, -0.985, 0.985);
    const phi = phiOf(s);
    const { sx, cz } = unitProfile(phi);
    const normal = ringNormal(ring, sx, cz);
    const position = new THREE.Vector3(ring.cx + ring.a * sx, toModelY(yRoot, frame), ring.zc + ring.b * cz).addScaledVector(normal, lift);
    return { position, normal, theta: Math.atan2(normal.x, normal.z) };
  };
  return { frame, ringAt, fractionOf, phiOf, at };
}

export interface LoftOptions {
  segments?: number;
  /** A point closing the top, and one closing the bottom. */
  capTop?: THREE.Vector3;
  capBottom?: THREE.Vector3;
  /** A colour per vertex, from its position and which ring it is on (0 bottom … 1 top). */
  colour?: (x: number, y: number, z: number, f: number, phi: number) => [number, number, number];
}

/**
 * A smooth mesh through a stack of rings, bottom to top: superellipse
 * cross-sections, `segments` around, UVs with u around (0 and 1 at the
 * back, 0.5 at the front) and v up, smooth normals, closed by its caps.
 */
export function loftRings(rings: readonly Ring[], options: LoftOptions = {}): THREE.BufferGeometry {
  const segments = options.segments ?? 48;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const n = rings.length;
  const push = (x: number, y: number, z: number, u: number, v: number, phi: number) => {
    positions.push(x, y, z);
    uvs.push(u, v);
    if (options.colour) colors.push(...options.colour(x, y, z, v, phi));
  };
  rings.forEach((ring, r) => {
    const v = n > 1 ? r / (n - 1) : 0;
    for (let i = 0; i <= segments; i++) {
      const phi = -Math.PI + (2 * Math.PI * i) / segments;
      const { sx, cz } = unitProfile(phi);
      push(ring.cx + ring.a * sx, ring.y, ring.zc + ring.b * cz, i / segments, v, phi);
    }
  });
  const stride = segments + 1;
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const a = r * stride + i;
      const b = a + stride;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  if (options.capTop) {
    const apex = positions.length / 3;
    push(options.capTop.x, options.capTop.y, options.capTop.z, 0.5, 1, 0);
    for (let i = 0; i < segments; i++) {
      const t = (n - 1) * stride + i;
      index.push(t, t + 1, apex);
    }
  }
  if (options.capBottom) {
    const base = positions.length / 3;
    push(options.capBottom.x, options.capBottom.y, options.capBottom.z, 0.5, 0, 0);
    for (let i = 0; i < segments; i++) index.push(i + 1, i, base);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (options.colour) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

export interface EllipseLike {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation?: number;
}

/**
 * A front-view ellipse laid over a placer: the disc is sampled in rings,
 * each sample (a root point and how far out it is, 0 at the centre, 1 at
 * the rim) placed wherever the placer says. Smooth normals.
 */
export function stickerGeometry(e: EllipseLike, place: (xRoot: number, yRoot: number, r: number) => THREE.Vector3, rings = 5, segments = 24): THREE.BufferGeometry {
  const rot = ((e.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const positions: number[] = [];
  const index: number[] = [];
  const centre = place(e.cx, e.cy, 0);
  positions.push(centre.x, centre.y, centre.z);
  for (let i = 1; i <= rings; i++) {
    const r = i / rings;
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2;
      const dx = e.rx * r * Math.cos(t);
      const dy = e.ry * r * Math.sin(t);
      const p = place(e.cx + dx * cos - dy * sin, e.cy + dx * sin + dy * cos, r);
      positions.push(p.x, p.y, p.z);
    }
  }
  const at = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * segments + (j % segments));
  for (let j = 0; j < segments; j++) index.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = at(i, j);
      const b = at(i, j + 1);
      const c = at(i + 1, j);
      const d = at(i + 1, j + 1);
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The x range of a closed outline at height `y` (root units), or null above or below it. */
export function spanOf(points: readonly { x: number; y: number }[], y: number): { min: number; max: number } | null {
  const xs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    if ((p.y <= y && q.y > y) || (q.y <= y && p.y > y)) xs.push(p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x));
  }
  if (xs.length < 2) return null;
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
