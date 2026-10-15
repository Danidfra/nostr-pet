/**
 * The Blobbi's surface, sampled once per bath (M15 care, the 3D effects):
 * for every cell of the bath grid that is the body, where the body's
 * surface is and which way it faces there, read off the 3D model's own
 * meshes (or the procedural body's shape when nothing better stands there)
 * by casting a ray from the camera's side onto each cell. The foam sits on
 * those points, the drops run between them.
 *
 * Everything is kept in the ACTOR's frame: across it (the camera's right),
 * up from its feet, and out toward the camera; the layer turns a sample
 * into the world each frame from where the actor stands now, so the
 * effects follow the Blobbi as it moves without sampling again. A cell
 * the ray misses (a thin part, a gap) gets the plain dome's point instead,
 * so there is always somewhere to draw.
 */
import * as THREE from 'three';
import type { BathCell } from '@/features/bath/bath-frame';

export interface SurfaceBasis {
  right: THREE.Vector3;
  toward: THREE.Vector3;
}

export interface SurfaceShape {
  grid: number;
  cells: readonly BathCell[];
  outline: { bottom: number; top: number };
}

export interface BodySurface {
  grid: number;
  /** Per cell: across, up, out of the surface point (tiles from the feet), then the normal's across, up, out. */
  samples: Float32Array;
  /** Per cell: 1 when the ray found the body there, 0 for the dome's stand-in. */
  hits: Uint8Array;
  /** Per column: the lowest body row, or -1 for none. */
  columnBottom: Int16Array;
  /** Per column: the highest body row, or -1 for none. */
  columnTop: Int16Array;
  /** How many cells the ray found the body on. */
  found: number;
}

const scratch = { origin: new THREE.Vector3(), dir: new THREE.Vector3(), feet: new THREE.Vector3(), rel: new THREE.Vector3(), n: new THREE.Vector3(), nm: new THREE.Matrix3() };

/** The plain dome's point for a cell: the body's box bulging toward the camera over its middle. */
export function domePoint(px: number, py: number, tiles: number, outline: { bottom: number; top: number }, out: Float32Array, at: number) {
  const across = (px - 0.5) * tiles * 0.92;
  // Never under the feet: the lowest row's centre can sit a little below the outline's feet
  const up = Math.max(0.03 * tiles, (py - outline.bottom) * tiles);
  const bulge = Math.sqrt(Math.max(0, 1 - ((px - 0.5) * 2.6) ** 2));
  out[at] = across;
  out[at + 1] = up;
  out[at + 2] = bulge * tiles * 0.26;
  const nx = (px - 0.5) * 2;
  const len = Math.hypot(nx, 0.2, 1);
  out[at + 3] = nx / len;
  out[at + 4] = 0.2 / len;
  out[at + 5] = 1 / len;
}

/**
 * Sample the body under every body cell. `body` is the model's root (or the procedural shape) in the scene, with
 * its world matrices current; `feetY` is where the feet stand (the actor's elevation, without a hop).
 */
export function sampleBodySurface(body: THREE.Object3D | null, place: { x: number; z: number; feetY: number; tiles: number }, shape: SurfaceShape, basis: SurfaceBasis, raycaster = new THREE.Raycaster()): BodySurface {
  const { grid, cells, outline } = shape;
  const n = grid * grid;
  const samples = new Float32Array(n * 6);
  const hits = new Uint8Array(n);
  const columnBottom = new Int16Array(grid).fill(-1);
  const columnTop = new Int16Array(grid).fill(-1);
  const { origin, dir, feet, rel, n: normal, nm } = scratch;
  feet.set(place.x, place.feetY, place.z);
  dir.copy(basis.toward).negate();
  if (body) body.updateWorldMatrix(true, true);
  raycaster.far = place.tiles * 6;
  let found = 0;
  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    if (!cell?.body) continue;
    const col = i % grid;
    const row = Math.floor(i / grid);
    if (columnBottom[col] < 0) columnBottom[col] = row;
    columnTop[col] = row;
    const px = (col + 0.5) / grid;
    const py = (row + 0.5) / grid;
    domePoint(px, py, place.tiles, outline, samples, i * 6);
    if (!body) continue;
    // From well in front of the body, straight back at it: the first mesh the ray meets is the surface there
    origin.copy(feet).addScaledVector(basis.right, (px - 0.5) * place.tiles).addScaledVector(basis.toward, place.tiles * 3);
    origin.y += (py - outline.bottom) * place.tiles;
    raycaster.set(origin, dir);
    const hit = raycaster.intersectObject(body, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
    if (!hit) continue;
    rel.copy(hit.point).sub(feet);
    samples[i * 6] = rel.dot(basis.right);
    samples[i * 6 + 1] = rel.y;
    samples[i * 6 + 2] = rel.dot(basis.toward);
    if (hit.face) {
      nm.getNormalMatrix(hit.object.matrixWorld);
      normal.copy(hit.face.normal).applyMatrix3(nm).normalize();
      // Facing the camera, whichever way the triangle was wound
      if (normal.dot(basis.toward) < 0) normal.negate();
      samples[i * 6 + 3] = normal.dot(basis.right);
      samples[i * 6 + 4] = normal.y;
      samples[i * 6 + 5] = normal.dot(basis.toward);
    }
    hits[i] = 1;
    found += 1;
  }
  return { grid, samples, hits, columnBottom, columnTop, found };
}

/** A sample's point in the world now, lifted along its normal by `lift` (tiles). */
export function surfacePoint(surface: BodySurface, index: number, feet: THREE.Vector3, basis: SurfaceBasis, lift: number, out: THREE.Vector3): THREE.Vector3 {
  const s = surface.samples;
  const i = index * 6;
  out.copy(feet);
  out.addScaledVector(basis.right, s[i] + s[i + 3] * lift);
  out.y += s[i + 1] + s[i + 4] * lift;
  out.addScaledVector(basis.toward, s[i + 2] + s[i + 5] * lift);
  return out;
}
