/**
 * A procedural 3D Blobbi, built from the kit's own geometry.
 *
 * The kit draws a V3 Blobbi from a morphology (`deriveMorphology`) through
 * `buildBlobbiGeometry`: a front silhouette (`spanAt(y)`: how wide the body
 * is at each height), a side silhouette (`frontAt(y)`/`backAt(y)`: how deep),
 * a face, limbs, appendages and markings, every one placed in root units.
 * This module lofts the body from those two silhouettes (each height's
 * cross-section is the ellipse the front and side views agree on), puts the
 * eyes, brows, mouth and cheeks on that surface where the front view puts
 * them, hangs the feet, arms, tuft and appendages where the views attach
 * them (the side view gives their depth), wraps the markings around the body
 * (`skin.ts`), and colours everything from the morphology's palette. No
 * number here is random or time-dependent: the same morphology is the same
 * model, vertex for vertex.
 *
 * Model units: one unit is the art box's height (`units.ts`). The root group
 * stands on the origin, facing +z.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildBlobbiGeometry, type Appendage, type BlobbiGeometry, type BlobbiMorphology, type BlobbiPalette, type FrontGeometry, type Gait, type SideGeometry } from '@blobbi-kit/renderer/procedural';
import { boundsOf, samplePath, type Pt } from './svg-path';
import { toModelX, toModelY, toModelZ, U, type Frame } from './units';
import { paintMarkings } from './skin';

type Front = Extract<BlobbiGeometry, { view: 'front' | 'back' }>;
type Side = Extract<BlobbiGeometry, { view: 'side' }>;
type Prim = Appendage['prims'][number];
type Ellipse = NonNullable<Prim['ellipse']>;
type Face = NonNullable<FrontGeometry['face']>;
type Eye = Face['eyes'][number];
type Foot = FrontGeometry['limbs']['feet'][number];
type Arm = FrontGeometry['limbs']['arms'][number];
type Tuft = NonNullable<FrontGeometry['limbs']['tuft']>;

/** Rings up the body and segments around it. */
const RINGS = 40;
const SEGMENTS = 48;
/** The ink line around the body and its parts, in root units (the kit strokes ~7). */
const LINE = 6 * U;
const DEG = Math.PI / 180;

/** One horizontal cross-section of the body: an ellipse at height `y`. */
export interface Ring {
  y: number;
  cx: number;
  a: number;
  zc: number;
  b: number;
}

/** Where the body's surface is, for putting things on it. */
export interface Surface {
  frame: Frame;
  ringAt(f: number): Ring;
  fractionOf(yRoot: number): number;
  at(xRoot: number, yRoot: number, lift?: number): { position: THREE.Vector3; normal: THREE.Vector3; theta: number };
}

export interface EyeRig {
  /** The eye on the surface, turned to face out of it. */
  group: THREE.Group;
  /** The iris, pupil and highlights: moved for the gaze. */
  inner: THREE.Group;
  open: THREE.Group;
  /** The closed lid's line (the sleeping drawing's), shown when the eye is shut. */
  closed: THREE.Object3D | null;
  /** How far the gaze may move the inner eye (root units). */
  travel: number;
}

/** The parts a motion moves, each at rest where the kit's rig pivots it. */
export interface Rig {
  body: THREE.Group;
  legs: { left: THREE.Group | null; right: THREE.Group | null };
  arms: { left: THREE.Group | null; right: THREE.Group | null };
  tuft: THREE.Group | null;
  appendages: { part: string; sway: Appendage['sway']; group: THREE.Group }[];
  eyes: EyeRig[];
}

export interface BlobbiModel {
  root: THREE.Group;
  rig: Rig;
  seed: string;
  stage: BlobbiGeometry['stage'];
  /** The life stage's size and gait, for `motionPose`. */
  scale: number;
  gait: Gait;
  /** The model's extent at rest, in model units. */
  bounds: { width: number; height: number; depth: number };
  dispose(): void;
}

const SPHERE = new THREE.SphereGeometry(1, 28, 18);

const PAINT: Record<string, keyof BlobbiPalette> = {
  limb: 'limbLight',
  accent: 'accentLight',
  horn: 'hornLight',
  line: 'line',
  white: 'white',
  cheek: 'cheek',
  marking: 'marking',
  belly: 'belly',
  shade: 'bodyDark',
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function asFront(geo: BlobbiGeometry): Front {
  if (geo.view === 'side') throw new Error('front geometry expected');
  return geo;
}

function asSide(geo: BlobbiGeometry): Side {
  if (geo.view !== 'side') throw new Error('side geometry expected');
  return geo;
}

/** The surface the two silhouettes agree on. */
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
  const at = (xRoot: number, yRoot: number, lift = 0) => {
    const ring = ringAt(fractionOf(yRoot));
    const xm = toModelX(xRoot, frame);
    const sn = clamp((xm - ring.cx) / ring.a, -0.985, 0.985);
    const theta = Math.asin(sn);
    const cs = Math.cos(theta);
    const normal = new THREE.Vector3(sn / ring.a, 0, cs / ring.b).normalize();
    const position = new THREE.Vector3(ring.cx + ring.a * sn, toModelY(yRoot, frame), ring.zc + ring.b * cs).addScaledVector(normal, lift);
    return { position, normal, theta };
  };
  return { frame, ringAt, fractionOf, at };
}

/** The body: rings lofted between the two silhouettes, coloured by the kit's radial gradient. */
function loftBody(surface: Surface, front: FrontGeometry, palette: BlobbiPalette): THREE.BufferGeometry {
  const { frame } = surface;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const light = new THREE.Color(palette.bodyLight);
  const mid = new THREE.Color(palette.bodyMid);
  const dark = new THREE.Color(palette.bodyDark);
  const g = front.gradient;
  const tint = new THREE.Color();
  const colourAt = (x: number, y: number) => {
    const xr = frame.axisX + x / U;
    const yr = frame.groundY - y / U;
    const t = Math.hypot((xr - g.cx) / g.rx, (yr - g.cy) / g.ry);
    if (t < g.mid) tint.copy(light).lerp(mid, t / g.mid);
    else tint.copy(mid).lerp(dark, clamp((t - g.mid) / (1 - g.mid), 0, 1));
    colors.push(tint.r, tint.g, tint.b);
  };
  for (let r = 0; r <= RINGS; r++) {
    const f = r / RINGS;
    const ring = surface.ringAt(f);
    for (let i = 0; i <= SEGMENTS; i++) {
      const phi = -Math.PI + (2 * Math.PI * i) / SEGMENTS;
      const x = ring.cx + ring.a * Math.sin(phi);
      const z = ring.zc + ring.b * Math.cos(phi);
      positions.push(x, ring.y, z);
      uvs.push(i / SEGMENTS, f);
      colourAt(x, ring.y);
    }
  }
  const stride = SEGMENTS + 1;
  for (let r = 0; r < RINGS; r++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = r * stride + i;
      const b = a + stride;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // Close the crown at the apex and the base under the belly
  const top = surface.ringAt(1);
  const base = surface.ringAt(0);
  const apex = positions.length / 3;
  positions.push(toModelX(front.body.apex.x, frame), toModelY(front.body.top, frame), top.zc);
  uvs.push(0.5, 1);
  colourAt(toModelX(front.body.apex.x, frame), toModelY(front.body.top, frame));
  const bottom = apex + 1;
  positions.push(base.cx, toModelY(front.body.bottom, frame), base.zc);
  uvs.push(0.5, 0);
  colourAt(base.cx, toModelY(front.body.bottom, frame));
  for (let i = 0; i < SEGMENTS; i++) {
    const t = RINGS * stride + i;
    index.push(t, t + 1, apex);
    index.push(i + 1, i, bottom);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The ink line: the same shape pushed out along its normals, drawn inside-out behind it. */
function hull(geometry: THREE.BufferGeometry, material: THREE.Material, thickness = LINE): THREE.Mesh {
  const g = geometry.clone();
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * thickness, p.getY(i) + n.getY(i) * thickness, p.getZ(i) + n.getZ(i) * thickness);
  p.needsUpdate = true;
  return new THREE.Mesh(g, material);
}

class Parts {
  private disposables: { dispose(): void }[] = [];
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  constructor(readonly palette: BlobbiPalette) {}

  track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  /** One material per colour and opacity, shared by every part of that colour. */
  material(color: string, opacity = 1): THREE.MeshStandardMaterial {
    const key = `${color}:${opacity}`;
    let m = this.materials.get(key);
    if (!m) {
      m = this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
      this.materials.set(key, m);
    }
    return m;
  }

  private inkMaterial?: THREE.MeshBasicMaterial;
  get ink(): THREE.MeshBasicMaterial {
    this.inkMaterial ??= this.track(new THREE.MeshBasicMaterial({ color: this.palette.line, side: THREE.BackSide }));
    return this.inkMaterial;
  }

  paint(role: string | undefined): string {
    return this.palette[PAINT[role ?? 'limb'] ?? 'limbLight'];
  }

  /** An ellipsoid of radii (rx, ry, rz), optionally inked. */
  ellipsoid(rx: number, ry: number, rz: number, material: THREE.Material, ink = true): THREE.Group {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(SPHERE, material);
    mesh.scale.set(rx, ry, rz);
    mesh.castShadow = true;
    g.add(mesh);
    if (ink) {
      const line = new THREE.Mesh(SPHERE, this.ink);
      line.scale.set(rx + LINE, ry + LINE, rz + LINE);
      g.add(line);
    }
    return g;
  }

  /** A stroke along some points, with round ends. */
  tube(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    if (points.length < 2) return g;
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = this.track(new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), radius, 8, false));
    g.add(new THREE.Mesh(geometry, material));
    for (const p of [points[0], points[points.length - 1]]) {
      const cap = new THREE.Mesh(SPHERE, material);
      cap.position.copy(p);
      cap.scale.setScalar(radius);
      g.add(cap);
    }
    return g;
  }

  /** A closed path extruded a little, the way a flat paper part would be, optionally inked. */
  extruded(points: readonly Pt[], origin: Pt, material: THREE.Material, ink: boolean, depth?: number): THREE.Group {
    const g = new THREE.Group();
    if (points.length < 3) return g;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2((p.x - origin.x) * U, -(p.y - origin.y) * U)));
    const box = boundsOf(points);
    const d = depth ?? Math.max(6 * U, 0.4 * Math.min(box.x2 - box.x1, box.y2 - box.y1) * U);
    const bevel = d * 0.3;
    const raw = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
    raw.translate(0, 0, -d / 2);
    const geometry = this.track(mergeVertices(raw, 1e-4));
    raw.dispose();
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    g.add(mesh);
    if (ink) g.add(this.track(hull(geometry, this.ink)).castShadow ? g : hull(geometry, this.ink));
    return g;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}

function surfacePoints(surface: Surface, d: string, lift: number): THREE.Vector3[] {
  return samplePath(d, 8).flatMap((poly) => poly.points.map((p) => surface.at(p.x, p.y, lift).position));
}

function buildEye(eye: Eye, lid: { d: string; width: number } | null, surface: Surface, parts: Parts, body: THREE.Group): EyeRig {
  const { palette } = parts;
  const centre = { x: eye.white.cx, y: eye.white.cy };
  const rx = eye.white.rx * U;
  const ry = eye.white.ry * U;
  const rz = Math.min(rx, ry) * 0.62;
  const on = surface.at(centre.x, centre.y);
  const group = new THREE.Group();
  group.position.copy(on.position).addScaledVector(on.normal, -rz * 0.45);
  group.rotation.y = on.theta;
  const open = new THREE.Group();
  group.add(open);
  open.add(parts.ellipsoid(rx, ry, rz, parts.material(palette.white), false));
  const inner = new THREE.Group();
  open.add(inner);
  const disc = (e: Ellipse, depth: number, material: THREE.Material) => {
    const d = parts.ellipsoid(e.rx * U, e.ry * U, rz * 0.1, material, false);
    d.position.set((e.cx - centre.x) * U, -(e.cy - centre.y) * U, rz * depth);
    return d;
  };
  inner.add(disc(eye.iris, 0.86, parts.material(palette.irisMid)));
  inner.add(disc(eye.pupil, 0.93, parts.material(palette.pupil)));
  inner.add(disc(eye.highlight, 1.0, parts.material(palette.white)));
  inner.add(disc(eye.glint, 1.02, parts.material(palette.white, eye.glint.opacity)));
  body.add(group);
  let closed: THREE.Object3D | null = null;
  if (lid) {
    closed = parts.tube(surfacePoints(surface, lid.d, 3 * U), (lid.width / 2) * U, parts.material(palette.feature));
    closed.visible = false;
    body.add(closed);
  }
  return { group, inner, open, closed, travel: eye.travel };
}

function buildFace(face: Face, sleeping: Face | null, surface: Surface, parts: Parts, body: THREE.Group): EyeRig[] {
  const { palette } = parts;
  const feature = parts.material(palette.feature);
  const eyes = face.eyes.map((eye, i) => {
    const lid = sleeping?.eyes[i]?.lid;
    return buildEye(eye, lid?.closed ? { d: lid.line, width: lid.lineWidth } : null, surface, parts, body);
  });
  for (const brow of face.brows) {
    const stroke = parts.tube(surfacePoints(surface, brow.d, 3 * U), (brow.strokeWidth / 2) * U, parts.material(palette.feature, brow.opacity));
    body.add(stroke);
  }
  const mouth = face.mouth;
  body.add(parts.tube(surfacePoints(surface, mouth.d, 2.5 * U), (mouth.strokeWidth / 2) * U, feature));
  if (mouth.open) {
    const middle = { x: (mouth.left.x + mouth.right.x) / 2, y: (mouth.left.y + mouth.right.y) / 2 };
    const poly = samplePath(mouth.d, 8)[0];
    if (poly && poly.points.length > 2) {
      const shape = new THREE.Shape(poly.points.map((p) => new THREE.Vector2((p.x - middle.x) * U, -(p.y - middle.y) * U)));
      const geometry = parts.track(new THREE.ShapeGeometry(shape, 8));
      const inside = new THREE.Mesh(geometry, feature);
      const on = surface.at(middle.x, middle.y, 1.5 * U);
      inside.position.copy(on.position);
      inside.rotation.y = on.theta;
      body.add(inside);
    }
  }
  for (const cheek of face.cheeks) {
    const e = cheek.base;
    const blush = parts.ellipsoid(e.rx * U, e.ry * U, e.ry * 0.25 * U, parts.material(palette.cheek, cheek.baseOpacity), false);
    const on = surface.at(e.cx, e.cy, 0.5 * U);
    blush.position.copy(on.position);
    blush.rotation.y = on.theta;
    body.add(blush);
  }
  return eyes;
}

function buildFoot(foot: Foot, depth: number, frame: Frame, parts: Parts): THREE.Group {
  const e = foot.foot;
  const g = new THREE.Group();
  g.name = `${foot.side}-leg`;
  g.position.set(toModelX(e.cx, frame), toModelY(e.cy, frame), 0);
  const pad = parts.ellipsoid(e.rx * U, e.ry * U, depth, parts.material(parts.palette.footLight, foot.opacity));
  pad.rotation.z = -(e.rotation ?? 0) * DEG;
  g.add(pad);
  return g;
}

/** How far each arm's paddle is turned from the front plane toward the side, so both views see a paddle. */
const ARM_YAW = (48 * Math.PI) / 180;

function buildArm(arm: Arm, z: number, frame: Frame, parts: Parts): THREE.Group {
  const g = new THREE.Group();
  g.name = `${arm.side}-arm`;
  g.position.set(toModelX(arm.shoulder.x, frame), toModelY(arm.shoulder.y, frame), z);
  const outline = samplePath(arm.d, 8)[0];
  if (outline) {
    const width = (arm.box.x2 - arm.box.x1) * U;
    const paddle = parts.extruded(outline.points, arm.shoulder, parts.material(parts.palette.limbLight, arm.opacity), true, width * 0.4);
    // The front view's paddle, turned halfway toward the side view's: the left arm's face turns to -x
    paddle.rotation.y = arm.side === 'left' ? -ARM_YAW : ARM_YAW;
    g.add(paddle);
  }
  return g;
}

function buildTuft(tuft: Tuft, z: number, frame: Frame, parts: Parts): THREE.Group {
  const { palette } = parts;
  const g = new THREE.Group();
  g.name = 'tuft';
  g.position.set(toModelX(tuft.root.x, frame), toModelY(tuft.root.y, frame), z);
  const leaf = (e: Ellipse, depth: number) => {
    const rz = Math.min(e.rx, e.ry) * 0.55 * U;
    const l = parts.ellipsoid(e.rx * U, e.ry * U, rz, parts.material(palette.limbLight));
    l.position.set((e.cx - tuft.root.x) * U, -(e.cy - tuft.root.y) * U, depth);
    l.rotation.z = -(e.rotation ?? 0) * DEG;
    return l;
  };
  g.add(leaf(tuft.main, 0), leaf(tuft.secondary, 0.012));
  tuft.details.forEach((detail, i) => {
    const front = (i === 0 ? tuft.main : tuft.secondary);
    const lift = Math.min(front.rx, front.ry) * 0.55 * U + 1.5 * U + (i === 0 ? 0 : 0.012);
    const points = samplePath(detail.d, 6).flatMap((poly) => poly.points.map((p) => new THREE.Vector3((p.x - tuft.root.x) * U, -(p.y - tuft.root.y) * U, lift)));
    g.add(parts.tube(points, (detail.strokeWidth / 2) * U, parts.material(palette.line, tuft.detailOpacity)));
  });
  return g;
}

/** An appendage's primitives about its pivot: in the front plane, or in the side plane turned to face +z. */
function buildPrims(prims: readonly Prim[], pivot: Pt, parts: Parts, plane: 'front' | 'side'): THREE.Group {
  const g = new THREE.Group();
  for (const prim of prims) {
    const material = parts.material(parts.paint(prim.fill), prim.opacity ?? 1);
    const ink = !!prim.stroke;
    let piece: THREE.Group | null = null;
    if (prim.ellipse) {
      const e = prim.ellipse;
      piece = parts.ellipsoid(e.rx * U, e.ry * U, Math.min(e.rx, e.ry) * 0.5 * U, material, ink);
      piece.position.set((e.cx - pivot.x) * U, -(e.cy - pivot.y) * U, 0);
      piece.rotation.z = -(e.rotation ?? 0) * DEG;
    } else if (prim.d) {
      const outline = samplePath(prim.d, 8)[0];
      if (outline) piece = parts.extruded(outline.points, pivot, material, ink);
    }
    if (piece) g.add(piece);
  }
  // A side-view drawing's x is depth: turn its plane so local +x becomes +z
  if (plane === 'side') g.rotation.y = -Math.PI / 2;
  return g;
}

/** Build the model of one morphology. */
export function buildBlobbiModel(morphology: BlobbiMorphology, seed = ''): BlobbiModel {
  const front = asFront(buildBlobbiGeometry(morphology, { view: 'front' }));
  const back = asFront(buildBlobbiGeometry(morphology, { view: 'back' }));
  const side = asSide(buildBlobbiGeometry(morphology, { view: 'side' }));
  const asleep = asFront(buildBlobbiGeometry(morphology, { view: 'front', sleeping: true }));
  const palette = front.palette;
  const frame: Frame = { axisX: front.body.axisX, groundY: front.ground.y, sideAxisX: side.body.axisX };
  const surface = makeSurface(front, side, frame);
  const parts = new Parts(palette);

  const root = new THREE.Group();
  root.name = 'blobbi';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // The body
  const bodyGeometry = parts.track(loftBody(surface, front, palette));
  const skin = new THREE.Mesh(bodyGeometry, parts.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 })));
  skin.name = 'skin';
  skin.castShadow = true;
  body.add(skin);
  const markings = paintMarkings(front, back, surface, palette);
  if (markings) {
    parts.track(markings);
    const decal = new THREE.Mesh(bodyGeometry, parts.track(new THREE.MeshStandardMaterial({ map: markings, transparent: true, depthWrite: false, roughness: 0.78, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    decal.name = 'markings';
    body.add(decal);
  }
  body.add(parts.track(hull(bodyGeometry, parts.ink)));
  if (front.shine) {
    const e = front.shine;
    const shine = parts.ellipsoid(e.rx * U, e.ry * U, e.ry * 0.2 * U, parts.material(palette.white, 0.55), false);
    const on = surface.at(e.cx, e.cy, 0.5 * U);
    shine.position.copy(on.position);
    shine.rotation.y = on.theta;
    shine.rotation.z = -(e.rotation ?? 0) * DEG;
    body.add(shine);
  }

  // The face, on the surface
  const eyes = front.face ? buildFace(front.face, asleep.face, surface, parts, body) : [];

  // Feet on the ground, arms at the shoulders, the tuft on the crown
  const footDepth = (side.limbs.nearFoot?.foot.rx ?? front.limbs.feet[0]?.foot.rx ?? 60) * 0.9 * U;
  const legs: Rig['legs'] = { left: null, right: null };
  for (const foot of front.limbs.feet) {
    const leg = buildFoot(foot, footDepth, frame, parts);
    root.add(leg);
    if (foot.side === 'left') legs.left = leg;
    else if (foot.side === 'right') legs.right = leg;
  }
  const arms: Rig['arms'] = { left: null, right: null };
  const armZ = side.limbs.nearArm ? toModelZ(side.limbs.nearArm.shoulder.x, frame) : 0;
  for (const arm of front.limbs.arms) {
    const a = buildArm(arm, armZ, frame, parts);
    body.add(a);
    if (arm.side === 'left') arms.left = a;
    else if (arm.side === 'right') arms.right = a;
  }
  let tuft: THREE.Group | null = null;
  if (front.limbs.tuft) {
    tuft = buildTuft(front.limbs.tuft, surface.ringAt(0.97).zc, frame, parts);
    body.add(tuft);
  }

  // Appendages: drawn where the front view draws them, as deep as the side view puts them
  const sideByPart = new Map<string, Appendage>();
  for (const a of side.appendages) if (!sideByPart.has(a.part)) sideByPart.set(a.part, a);
  const appendages: Rig['appendages'] = [];
  const seen = new Set<string>();
  for (const a of front.appendages) {
    seen.add(a.part);
    const atSide = sideByPart.get(a.part);
    const z = atSide ? toModelZ(atSide.base.x, frame) : a.layer === 'behind' ? -0.04 : surface.ringAt(surface.fractionOf(a.base.y)).zc;
    const group = new THREE.Group();
    group.name = a.part;
    group.position.set(toModelX(a.pivot.x, frame), toModelY(a.pivot.y, frame), z);
    group.add(buildPrims(a.prims, a.pivot, parts, 'front'));
    body.add(group);
    appendages.push({ part: a.part, sway: a.sway, group });
  }
  // Parts only the side view shows (a tail): drawn in the side plane, on the axis
  for (const a of side.appendages) {
    if (seen.has(a.part) || a.far) continue;
    seen.add(a.part);
    const group = new THREE.Group();
    group.name = a.part;
    group.position.set(0, toModelY(a.pivot.y, { ...frame, groundY: side.ground.y }), toModelZ(a.pivot.x, frame));
    group.add(buildPrims(a.prims, a.pivot, parts, 'side'));
    body.add(group);
    appendages.push({ part: a.part, sway: a.sway, group });
  }

  // Remember where everything rests, for the rig to pose from
  root.traverse((o) => {
    o.userData.rest = { position: o.position.clone(), rotation: o.rotation.clone(), scale: o.scale.clone() };
  });

  const box = new THREE.Box3().setFromObject(root, true);
  const size = box.getSize(new THREE.Vector3());
  return {
    root,
    rig: { body, legs, arms, tuft, appendages, eyes },
    seed,
    stage: front.stage,
    scale: front.scale,
    gait: front.look.gait,
    bounds: { width: size.x, height: size.y, depth: size.z },
    dispose: () => parts.dispose(),
  };
}
