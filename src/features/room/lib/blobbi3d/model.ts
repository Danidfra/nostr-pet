/**
 * A procedural 3D Blobbi, built from the kit's own geometry.
 *
 * The kit draws a V3 Blobbi from a morphology (`deriveMorphology`) through
 * `buildBlobbiGeometry`: a front silhouette (`spanAt(y)`: how wide the body
 * is at each height), a side silhouette (`frontAt(y)`/`backAt(y)`: how deep),
 * a face, limbs, appendages and markings, every one placed in root units.
 * This module lofts the body from those two silhouettes (`surface.ts`),
 * lays the eyes, brows, mouth and cheeks on that surface where the front
 * view puts them (`eyes.ts` for the eyes), lofts each arm from its own
 * front and side outlines, hangs the feet, tuft and appendages where the
 * views attach them (the side view gives their depth), wraps the markings
 * around the body (`skin.ts`), and colours everything from the morphology's
 * palette. No number here is random or time-dependent: the same morphology
 * is the same model, vertex for vertex.
 *
 * Model units: one unit is the art box's height (`units.ts`). The root group
 * stands on the origin, facing +z.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildBlobbiGeometry, type Appendage, type BlobbiGeometry, type BlobbiMorphology, type BlobbiPalette, type FrontGeometry, type Gait } from '@blobbi-kit/renderer/procedural';
import { boundsOf, samplePath, type Pt } from './svg-path';
import { ROOT_PER_BOX, rootPerBox, toModelX, toModelY, toModelZ, U, type Frame } from './units';
import { paintMarkings } from './skin';
import { buildEye, type EyeRig } from './eyes';
import { clamp, loftRings, makeSurface, spanOf, stickerGeometry, type Ring, type Surface } from './surface';
import { buildAppendage3d, type AppendageKind, type Built3dAppendage } from './appendages';
import { assertSupported } from './compat';

export type { Ring, Surface } from './surface';
export type { EyeRig } from './eyes';

type Front = Extract<BlobbiGeometry, { view: 'front' | 'back' }>;
type Side = Extract<BlobbiGeometry, { view: 'side' }>;
type Prim = Appendage['prims'][number];
type Ellipse = NonNullable<Prim['ellipse']>;
type Face = NonNullable<FrontGeometry['face']>;
type Foot = FrontGeometry['limbs']['feet'][number];
type Arm = FrontGeometry['limbs']['arms'][number];
type Tuft = NonNullable<FrontGeometry['limbs']['tuft']>;

/** Rings up the body. */
const RINGS = 40;
/** Rings along an arm. */
const ARM_RINGS = 16;
/** The ink line around the body and its parts, in root units (the kit strokes ~7). */
const LINE = 6 * U;
const DEG = Math.PI / 180;

/** The parts a motion moves, each at rest where the kit's rig pivots it. */
export interface Rig {
  body: THREE.Group;
  legs: { left: THREE.Group | null; right: THREE.Group | null };
  arms: { left: THREE.Group | null; right: THREE.Group | null };
  tuft: THREE.Group | null;
  appendages: { part: string; sway: Appendage['sway']; group: THREE.Group; built?: Built3dAppendage }[];
  eyes: EyeRig[];
}

export interface BlobbiModel {
  /** One unit tall: the Blobbi's art box. The room scales it by the box's size in tiles. */
  root: THREE.Group;
  /** The geometry, in the adult document's units, scaled into the stage's own box. */
  figure: THREE.Group;
  rig: Rig;
  seed: string;
  stage: BlobbiGeometry['stage'];
  /** The life stage's size and gait, for `motionPose`. */
  scale: number;
  gait: Gait;
  /** Where the body's surface is, for tests and for laying more on it. */
  surface: Surface;
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

function asFront(geo: BlobbiGeometry): Front {
  if (geo.view === 'side') throw new Error('front geometry expected');
  return geo;
}

function asSide(geo: BlobbiGeometry): Side {
  if (geo.view !== 'side') throw new Error('side geometry expected');
  return geo;
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
  constructor(readonly palette: BlobbiPalette, readonly baby = false) {}

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

  private flats = new Map<string, THREE.MeshBasicMaterial>();
  /** A flat, unshaded fill: what the drawing's flat colours are. */
  flat(color: string, opacity = 1): THREE.MeshBasicMaterial {
    const key = `${color}:${opacity}`;
    let m = this.flats.get(key);
    if (!m) {
      m = this.track(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
      this.flats.set(key, m);
    }
    return m;
  }

  private inkMaterial?: THREE.MeshBasicMaterial;
  get ink(): THREE.MeshBasicMaterial {
    this.inkMaterial ??= this.track(new THREE.MeshBasicMaterial({ color: this.palette.line, side: THREE.BackSide }));
    return this.inkMaterial;
  }

  paint(role: string | undefined): string {
    if (role === 'shade' && this.baby) return this.palette.babyDark;
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

  /** A front-view ellipse laid on a surface with a small dome. */
  sticker(e: Ellipse, surface: Surface, material: THREE.Material, dome = 0, lift = 0.6): THREE.Mesh {
    const geometry = this.track(stickerGeometry(e, (xr, yr, r) => surface.at(xr, yr, (lift + dome * Math.sqrt(Math.max(0, 1 - r * r))) * U).position));
    return new THREE.Mesh(geometry, material);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}

function surfacePoints(surface: Surface, d: string, lift: number): THREE.Vector3[] {
  return samplePath(d, 8).flatMap((poly) => poly.points.map((p) => surface.at(p.x, p.y, lift).position));
}

/** The body: rings lofted between the two silhouettes, coloured by the kit's radial gradient. */
function loftBody(surface: Surface, front: Front, palette: BlobbiPalette): THREE.BufferGeometry {
  const { frame } = surface;
  // The baby's body (the v1 look) is painted in its own three colours, as the kit's gradient is
  const baby = front.look.body === 'v1';
  const light = new THREE.Color(baby ? palette.babyLight : palette.bodyLight);
  const mid = new THREE.Color(baby ? palette.babyMid : palette.bodyMid);
  const dark = new THREE.Color(baby ? palette.babyDark : palette.bodyDark);
  const g = front.gradient;
  const tint = new THREE.Color();
  const rings: Ring[] = [];
  for (let r = 0; r <= RINGS; r++) rings.push(surface.ringAt(r / RINGS));
  const top = rings[RINGS];
  const base = rings[0];
  return loftRings(rings, {
    capTop: new THREE.Vector3(toModelX(front.body.apex.x, frame), toModelY(front.body.top, frame), top.zc),
    capBottom: new THREE.Vector3(base.cx, toModelY(front.body.bottom, frame), base.zc),
    colour: (x, y, _z, _f, phi) => {
      // The gradient as the kit paints it on the view that sees this point: the front view's at the belly,
      // the back view's (the same, mirrored) at the back, turning smoothly from one to the other round the sides
      const xr = frame.axisX + (x * Math.cos(phi)) / U;
      const yr = frame.groundY - y / U;
      const t = Math.hypot((xr - g.cx) / g.rx, (yr - g.cy) / g.ry);
      void _z;
      if (t < g.mid) tint.copy(light).lerp(mid, t / g.mid);
      else tint.copy(mid).lerp(dark, clamp((t - g.mid) / (1 - g.mid), 0, 1));
      return [tint.r, tint.g, tint.b];
    },
  });
}

/** Raise the skin under the eyes, on the front half only, and recompute the normals. */
function raiseMounds(geometry: THREE.BufferGeometry, surface: Surface) {
  const p = geometry.getAttribute('position') as THREE.BufferAttribute;
  const { frame } = surface;
  let moved = false;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const ring = surface.ringAt(surface.fractionOf(frame.groundY - y / U));
    if (z <= ring.zc) continue;
    const raise = surface.mound(frame.axisX + x / U, frame.groundY - y / U);
    if (raise > 0) {
      p.setZ(i, z + raise);
      moved = true;
    }
  }
  if (moved) {
    p.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}

function buildFace(face: Face, look: 'layered' | 'simple', sleeping: Face | null, surface: Surface, parts: Parts, body: THREE.Group, front: Front): EyeRig[] {
  const { palette } = parts;
  const feature = parts.material(palette.feature);
  const closedLine = (d: string, width: number) => parts.tube(surfacePoints(surface, d, 3 * U), (width / 2) * U, feature);
  const eyes = face.eyes.map((eye, i) => {
    const lid = sleeping?.eyes[i]?.lid;
    const rig = buildEye(eye, look, palette, surface, parts, lid?.closed ? { d: lid.line, width: lid.lineWidth } : null, closedLine);
    body.add(rig.group);
    if (rig.closed) body.add(rig.closed);
    return rig;
  });
  for (const brow of face.brows) {
    body.add(parts.tube(surfacePoints(surface, brow.d, 3 * U), (brow.strokeWidth / 2) * U, parts.material(palette.feature, brow.opacity)));
  }
  const mouth = face.mouth;
  body.add(parts.tube(surfacePoints(surface, mouth.d, 2.5 * U), (mouth.strokeWidth / 2) * U, feature));
  if (mouth.open) {
    const poly = samplePath(mouth.d, 8)[0];
    if (poly && poly.points.length > 2) {
      // The open mouth: the path's inside, laid on the surface
      const contour = poly.points.map((p) => new THREE.Vector2(p.x, p.y));
      const faces = THREE.ShapeUtils.triangulateShape(contour, []);
      const positions: number[] = [];
      for (const p of poly.points) {
        const v = surface.at(p.x, p.y, 1.5 * U).position;
        positions.push(v.x, v.y, v.z);
      }
      const geometry = parts.track(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(faces.flat());
      geometry.computeVertexNormals();
      const inside = new THREE.Mesh(geometry, parts.track(new THREE.MeshStandardMaterial({ color: palette.feature, roughness: 0.8, side: THREE.DoubleSide })));
      body.add(inside);
    }
  }
  for (const raw of face.cheeks) {
    // The kit lets a cheek hang past the body's outline (the baby's do); on a 3D body it would fold round the side,
    // so it is drawn within the face: its outer side pulled in to the edge, the rest where the kit puts it
    const cheek = { ...raw, base: fitInside(raw.base, front), highlight: fitInside(raw.highlight, front) };
    // Blush is flat colour in the drawing, even where it wraps round the silhouette: lit from within so a grazing angle keeps it pink
    const blush = parts.track(new THREE.MeshStandardMaterial({ color: palette.cheek, emissive: palette.cheek, emissiveIntensity: 0.45, roughness: 1, transparent: true, opacity: cheek.baseOpacity, depthWrite: false }));
    body.add(parts.sticker(cheek.base, surface, blush, cheek.base.ry * 0.12, 0.8));
    if (cheek.highlightOpacity > 0) body.add(parts.sticker(cheek.highlight, surface, parts.material(palette.white, cheek.highlightOpacity), 0, 1.4));
  }
  return eyes;
}

/**
 * An ellipse moved inside the body's front outline at its height (with a
 * little margin): its size kept (up to a third of the half-width), its
 * centre shifted in until its outer side is within the face.
 */
function fitInside(e: Ellipse, front: Front): Ellipse {
  const span = front.body.spanAt(e.cy);
  if (!span) return e;
  const half = (span.max - span.min) / 2;
  const margin = 0.08 * half;
  const rx = Math.min(e.rx, half / 3);
  const ry = e.ry * (rx / e.rx);
  const cx = Math.max(span.min + margin + rx, Math.min(span.max - margin - rx, e.cx));
  return { ...e, cx, rx, ry };
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

/**
 * An arm: the front view's paddle says how wide it is at each height and
 * where, the side view's how deep and where; lofted between them it is a
 * rounded limb hanging from the shoulder, which is the group's origin.
 */
function buildArm(arm: Arm, sideArm: Side['limbs']['nearArm'], frame: Frame, parts: Parts): THREE.Group {
  const g = new THREE.Group();
  g.name = `${arm.side}-arm`;
  const front = samplePath(arm.d, 10)[0]?.points ?? [];
  const side = sideArm ? (samplePath(sideArm.d, 10)[0]?.points ?? []) : [];
  const box = boundsOf(front);
  const sbox = side.length ? boundsOf(side) : null;
  const shoulderZ = sideArm ? toModelZ(sideArm.shoulder.x, frame) : 0;
  g.position.set(toModelX(arm.shoulder.x, frame), toModelY(arm.shoulder.y, frame), shoulderZ);
  if (front.length < 3) return g;
  const rings: Ring[] = [];
  for (let k = ARM_RINGS; k >= 0; k--) {
    const f = clamp(k / ARM_RINGS, 0.015, 0.985);
    const yF = box.y1 + f * (box.y2 - box.y1);
    const span = spanOf(front, yF) ?? { min: (box.x1 + box.x2) / 2 - 0.5, max: (box.x1 + box.x2) / 2 + 0.5 };
    let zc = 0;
    let b = ((span.max - span.min) / 2) * 0.7 * U;
    if (sbox) {
      const yS = sbox.y1 + f * (sbox.y2 - sbox.y1);
      const s = spanOf(side, yS);
      if (s) {
        zc = toModelZ((s.min + s.max) / 2, frame) - shoulderZ;
        b = Math.max(0.5, (s.max - s.min) / 2) * U;
      }
    }
    rings.push({ y: toModelY(yF, frame) - toModelY(arm.shoulder.y, frame), cx: toModelX((span.min + span.max) / 2, frame) - toModelX(arm.shoulder.x, frame), a: Math.max(0.5, (span.max - span.min) / 2) * U, zc, b });
  }
  const light = new THREE.Color(parts.palette.limbLight);
  const dark = new THREE.Color(parts.palette.limbDark);
  const tint = new THREE.Color();
  const w = Math.max(1, box.x2 - box.x1);
  const h = Math.max(1, box.y2 - box.y1);
  const top = rings[rings.length - 1];
  const bottom = rings[0];
  const geometry = parts.track(loftRings(rings, {
    segments: 24,
    capTop: new THREE.Vector3(top.cx, top.y + 0.5 * U, top.zc),
    capBottom: new THREE.Vector3(bottom.cx, bottom.y - 0.5 * U, bottom.zc),
    colour: (x, y) => {
      // The kit's limb gradient runs corner to corner over the arm's box
      const fx = clamp((x / U + arm.shoulder.x - box.x1) / w, 0, 1);
      const fy = clamp((arm.shoulder.y - y / U - box.y1) / h, 0, 1);
      tint.copy(light).lerp(dark, (fx + fy) / 2);
      return [tint.r, tint.g, tint.b];
    },
  }));
  const mesh = new THREE.Mesh(geometry, parts.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, transparent: arm.opacity < 1, opacity: arm.opacity })));
  mesh.name = 'arm';
  mesh.castShadow = true;
  g.add(mesh, parts.track(hull(geometry, parts.ink)));
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
  // A trait or part the builders do not know fails loudly in development, never quietly drawn wrong
  assertSupported(morphology);
  const front = asFront(buildBlobbiGeometry(morphology, { view: 'front' }));
  const back = asFront(buildBlobbiGeometry(morphology, { view: 'back' }));
  const side = asSide(buildBlobbiGeometry(morphology, { view: 'side' }));
  const asleep = asFront(buildBlobbiGeometry(morphology, { view: 'front', sleeping: true }));
  const palette = front.palette;
  const frame: Frame = { axisX: front.body.axisX, groundY: front.ground.y, sideAxisX: side.body.axisX };
  // The eyes shape the face they sit on (a mound under each); only the front's depth changes
  const surface = makeSurface(front, side, frame, front.face?.eyes.map((e) => e.white) ?? []);
  const parts = new Parts(palette, front.look.body === 'v1');

  const root = new THREE.Group();
  root.name = 'blobbi';
  // Built in the adult document's units; a baby stands in its own smaller box, so it is scaled up into it
  const figure = new THREE.Group();
  figure.name = 'figure';
  figure.scale.setScalar(ROOT_PER_BOX / rootPerBox(front.stage === 'baby' ? 'baby' : 'adult'));
  root.add(figure);
  const body = new THREE.Group();
  body.name = 'body';
  figure.add(body);

  // The body
  const bodyGeometry = parts.track(loftBody(surface, front, palette));
  raiseMounds(bodyGeometry, surface);
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
  if (front.shine) body.add(parts.sticker(front.shine, surface, parts.material(palette.white, 0.55), 0, 1.2));

  // The face, on the surface
  const eyes = front.face ? buildFace(front.face, front.look.eye, asleep.face, surface, parts, body, front) : [];

  // Feet on the ground, arms at the shoulders, the tuft on the crown
  const footDepth = (side.limbs.nearFoot?.foot.rx ?? front.limbs.feet[0]?.foot.rx ?? 60) * 0.9 * U;
  const legs: Rig['legs'] = { left: null, right: null };
  for (const foot of front.limbs.feet) {
    const leg = buildFoot(foot, footDepth, frame, parts);
    figure.add(leg);
    if (foot.side === 'left') legs.left = leg;
    else if (foot.side === 'right') legs.right = leg;
  }
  const arms: Rig['arms'] = { left: null, right: null };
  for (const arm of front.limbs.arms) {
    const a = buildArm(arm, side.limbs.nearArm, frame, parts);
    body.add(a);
    if (arm.side === 'left') arms.left = a;
    else if (arm.side === 'right') arms.right = a;
  }
  let tuft: THREE.Group | null = null;
  if (front.limbs.tuft) {
    tuft = buildTuft(front.limbs.tuft, surface.ringAt(0.97).zc, frame, parts);
    body.add(tuft);
  }

  // Antennae, horns and tails: swept along the centreline the kit draws them around, from the views that show it
  const appendages: Rig['appendages'] = [];
  const key = (a: Appendage) => `${a.part}:${a.side}`;
  const swept = new Set<string>();
  const sideBy = new Map<string, Appendage>();
  for (const a of side.appendages) if (!sideBy.has(key(a)) || sideBy.get(key(a))!.far) sideBy.set(key(a), a);
  const backBy = new Map<string, Appendage>();
  for (const a of back.appendages) if (!backBy.has(key(a))) backBy.set(key(a), a);
  const frontBy = new Map<string, Appendage>();
  for (const a of front.appendages) if (!frontBy.has(key(a))) frontBy.set(key(a), a);
  const keys = new Set([...frontBy.keys(), ...backBy.keys(), ...sideBy.keys()]);
  for (const k of keys) {
    const kind = k.split(':')[0] as AppendageKind;
    if (kind !== 'antenna' && kind !== 'horn' && kind !== 'tail' && kind !== 'ear') continue;
    const any = frontBy.get(k) ?? backBy.get(k) ?? sideBy.get(k)!;
    const built = buildAppendage3d(kind, { front: frontBy.get(k) ?? null, back: backBy.get(k) ?? null, side: sideBy.get(k) ?? null, sideGroundY: side.ground.y }, frame, parts);
    if (!built) continue;
    swept.add(k);
    body.add(built.group);
    appendages.push({ part: kind, sway: any.sway, group: built.group, built });
  }

  // Anything else: flat shapes drawn where the front view draws them, as deep as the side view puts them
  const sideByPart = new Map<string, Appendage>();
  for (const a of side.appendages) if (!sideByPart.has(a.part)) sideByPart.set(a.part, a);
  const seen = new Set<string>();
  for (const a of front.appendages) {
    seen.add(a.part);
    if (swept.has(key(a))) continue;
    const atSide = sideByPart.get(a.part);
    const z = atSide ? toModelZ(atSide.base.x, frame) : a.layer === 'behind' ? -0.04 : surface.ringAt(surface.fractionOf(a.base.y)).zc;
    const group = new THREE.Group();
    group.name = a.part;
    group.position.set(toModelX(a.pivot.x, frame), toModelY(a.pivot.y, frame), z);
    group.add(buildPrims(a.prims, a.pivot, parts, 'front'));
    body.add(group);
    appendages.push({ part: a.part, sway: a.sway, group });
  }
  // Parts only the side view shows: drawn in the side plane, on the axis
  for (const a of side.appendages) {
    if (seen.has(a.part) || a.far || swept.has(key(a))) continue;
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
    figure,
    rig: { body, legs, arms, tuft, appendages, eyes },
    seed,
    stage: front.stage,
    scale: front.scale,
    gait: front.look.gait,
    surface,
    bounds: { width: size.x, height: size.y, depth: size.z },
    dispose: () => parts.dispose(),
  };
}
