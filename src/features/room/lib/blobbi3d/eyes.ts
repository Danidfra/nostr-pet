/**
 * EYES, the way the kit draws them.
 *
 * In the drawing an eye is a stack of ellipses in the picture plane: the
 * white, then (the layered look, the adult's) an iris, a pupil, a primary
 * highlight and a glint, or (the simple look, the baby's) one big disc
 * filled with the iris gradient and a highlight; no outline. Their centres
 * and radii are the morphology's, and so is the resting gaze: both pupils
 * sit a little inward and down of their whites, toward the viewer.
 *
 * Here the white is that same ellipse laid on the body's surface and
 * bulging out of it a little (a sticker with a dome: its rim is on the
 * skin everywhere, so it can neither float nor sink whichever way the
 * body curves), and the iris, pupil and highlights are stickers on the
 * white's dome, at the picture-plane offsets the kit gives them. The dome
 * and the layers rise toward the viewer of the front view (+z), not along
 * the skin's normal, so seen from the front every point of the eye is
 * exactly where the drawing has it: that is what keeps the two eyes level
 * and the resting gaze symmetrical, for every seed and stage, and it stays
 * so as the body turns because nothing about the eye is turned on its own.
 */
import * as THREE from 'three';
import type { BlobbiPalette, FrontGeometry } from '@blobbi-kit/renderer/procedural';
import { stickerGeometry, type EllipseLike, type Surface } from './surface';
import { U } from './units';
import { gazeReach, outerDisc } from '@/lib/gaze-reach';

type Face = NonNullable<FrontGeometry['face']>;
export type EyeGeometry = Face['eyes'][number];
export type EyeLook = 'layered' | 'simple';

/** The white's dome height as a fraction of its half-width: enough to catch the light, not enough to stand off the face seen from the side. */
export const EYE_BULGE = 0.2;
/** Root units each layer sits above the one under it. */
const LAYER = 0.9;

export interface EyeRig {
  /** At the eye's centre on the surface; the blink scales it flat. */
  group: THREE.Group;
  /** The iris, pupil and highlights: slid along the surface for the gaze. */
  inner: THREE.Group;
  open: THREE.Group;
  /** The closed lid's line (the sleeping drawing's), shown when the eye is shut. */
  closed: THREE.Object3D | null;
  /** How far the gaze may move the inner eye (root units). */
  travel: number;
  /** The surface's tangents at the eye: across (toward +x) and up. */
  across: THREE.Vector3;
  up: THREE.Vector3;
  /** The eye's parts and their colours, for tests. */
  layers: { part: string; colour: string }[];
  /** The white, and the inner eye's centre (the pupil's), in root units: to keep the inner eye on the dome as it moves. */
  white: EllipseLike;
  pupil: { x: number; y: number };
  /** How much of the kit's `travel` the gaze may use before the inner eye's outer disc would leave the white (0..1). */
  reach: number;
  /**
   * The inner eye's stickers as built: each vertex's place at rest (relative to the eye) and the point of the
   * drawing it stands for (root units), so a look can seat every vertex back on the dome where it now is.
   */
  seats: EyeSeat[];
  /** The look the seats were last fitted to (`poseRig` skips refitting an unchanged look). */
  seated?: string;
  /** A point of the drawing on the skin, raised toward the viewer by `height` root units, relative to the eye's centre. */
  place: (xRoot: number, yRoot: number, height: number) => THREE.Vector3;
  /** The look the inner eye now shows, in model units relative to rest (for tests and the lab). */
  look: THREE.Vector3;
}

/** One sticker of the inner eye, as `poseRig` re-seats it on the dome for a look. */
export interface EyeSeat {
  mesh: THREE.Mesh;
  /** The drawing's point under each vertex, root units (x, y per vertex). */
  roots: Float32Array;
  /** How far above the white's dome it lies (root units). */
  height: number;
  /** The skin under each vertex at rest, relative to the eye's centre (x, y, z per vertex). */
  skin: Float32Array;
  /** How the skin there moves per root unit across and down the drawing (x, y, z per vertex, each): a look is a few units, so linear is exact enough. */
  skinDx: Float32Array;
  skinDy: Float32Array;
}

export interface EyeMaterials {
  /** A flat fill, as the drawing's: the eye's parts are not shaded, so the white reads as its whole oval from any angle. */
  flat(colour: string, opacity?: number): THREE.Material;
  track<T extends { dispose(): void }>(x: T): T;
}

/**
 * How high the white's dome is over a front-view point, 0 at and beyond
 * the rim (root units).
 */
export function domeHeight(white: EllipseLike, xRoot: number, yRoot: number): number {
  const dx = (xRoot - white.cx) / white.rx;
  const dy = (yRoot - white.cy) / white.ry;
  return white.rx * EYE_BULGE * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
}

/** Grid nodes across an eye for the skin's slopes (a look moves the inner eye a few root units; the skin's slope changes slowly). */
const SLOPE_GRID = 9;

/**
 * How the skin moves per root unit of the drawing, across and down, under
 * every inner-eye vertex: sampled on a small grid over the eye (two surface
 * lookups a node) and interpolated, rather than three lookups a vertex,
 * which made building a model several times slower.
 */
function fillSlopes(seats: EyeSeat[], white: EllipseLike, raised: (x: number, y: number, h: number) => THREE.Vector3) {
  const x0 = white.cx - white.rx * 1.3;
  const y0 = white.cy - white.ry * 1.3;
  const sx = (white.rx * 2.6) / (SLOPE_GRID - 1);
  const sy = (white.ry * 2.6) / (SLOPE_GRID - 1);
  const dx: THREE.Vector3[] = [];
  const dy: THREE.Vector3[] = [];
  for (let j = 0; j < SLOPE_GRID; j++) {
    for (let i = 0; i < SLOPE_GRID; i++) {
      const x = x0 + i * sx;
      const y = y0 + j * sy;
      const at = raised(x, y, 0);
      dx.push(raised(x + 1, y, 0).sub(at));
      dy.push(raised(x, y + 1, 0).sub(at));
    }
  }
  const sample = (grid: THREE.Vector3[], x: number, y: number, out: Float32Array, at: number) => {
    const fx = Math.min(SLOPE_GRID - 1.0001, Math.max(0, (x - x0) / sx));
    const fy = Math.min(SLOPE_GRID - 1.0001, Math.max(0, (y - y0) / sy));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const a = grid[j * SLOPE_GRID + i];
    const b = grid[j * SLOPE_GRID + i + 1];
    const c = grid[(j + 1) * SLOPE_GRID + i];
    const d = grid[(j + 1) * SLOPE_GRID + i + 1];
    out[at] = (a.x * (1 - u) + b.x * u) * (1 - v) + (c.x * (1 - u) + d.x * u) * v;
    out[at + 1] = (a.y * (1 - u) + b.y * u) * (1 - v) + (c.y * (1 - u) + d.y * u) * v;
    out[at + 2] = (a.z * (1 - u) + b.z * u) * (1 - v) + (c.z * (1 - u) + d.z * u) * v;
  };
  for (const seat of seats) {
    for (let k = 0, n = seat.roots.length / 2; k < n; k++) {
      sample(dx, seat.roots[2 * k], seat.roots[2 * k + 1], seat.skinDx, k * 3);
      sample(dy, seat.roots[2 * k], seat.roots[2 * k + 1], seat.skinDy, k * 3);
    }
  }
}

export function buildEye(eye: EyeGeometry, look: EyeLook, palette: BlobbiPalette, surface: Surface, parts: EyeMaterials, lid: { d: string; width: number } | null, closedLine: (d: string, width: number) => THREE.Object3D): EyeRig {
  const white = eye.white;
  const centre = surface.at(white.cx, white.cy);
  const group = new THREE.Group();
  group.position.copy(centre.position);
  const open = new THREE.Group();
  group.add(open);
  const inner = new THREE.Group();
  open.add(inner);
  const layers: EyeRig['layers'] = [];
  const seats: EyeSeat[] = [];

  /** A point of the drawing on the skin, raised toward the viewer by `height` root units, relative to the eye's centre. */
  const raised = (xr: number, yr: number, height: number) => surface.at(xr, yr).position.add(new THREE.Vector3(0, 0, height * U)).sub(centre.position);
  /** A sticker over the white's dome, `layer` layers up. */
  const sticker = (e: EllipseLike, layer: number, colour: string, opacity: number, part: string, into: THREE.Group) => {
    const roots: number[] = [];
    const geometry = parts.track(stickerGeometry(e, (xr, yr) => {
      roots.push(xr, yr);
      return raised(xr, yr, domeHeight(white, xr, yr) + layer * LAYER);
    }));
    const mesh = new THREE.Mesh(geometry, parts.flat(colour, opacity));
    mesh.name = part;
    into.add(mesh);
    layers.push({ part, colour });
    if (into === inner) {
      // The skin under each vertex is where it was laid, less its height over the dome; how the skin moves under a
      // look comes from a coarse grid over the eye (`slopes`), filled in once all the stickers are laid
      const n = roots.length / 2;
      const rest = geometry.getAttribute('position');
      const skin = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const lift = (domeHeight(white, roots[2 * i], roots[2 * i + 1]) + layer * LAYER) * U;
        skin.set([rest.getX(i), rest.getY(i), rest.getZ(i) - lift], i * 3);
      }
      seats.push({ mesh, roots: Float32Array.from(roots), height: layer * LAYER, skin, skinDx: new Float32Array(n * 3), skinDy: new Float32Array(n * 3) });
    }
  };

  // The white: its own dome, its rim on the skin
  const whiteGeometry = parts.track(stickerGeometry(white, (xr, yr, r) => raised(xr, yr, domeHeight(white, xr, yr) + 0.4 * (1 - r)), 7, 32));
  const whiteMesh = new THREE.Mesh(whiteGeometry, parts.flat(palette.white));
  whiteMesh.name = 'white';
  open.add(whiteMesh);
  layers.push({ part: 'white', colour: palette.white });

  if (look === 'layered') {
    sticker(eye.iris, 1, palette.irisMid, 1, 'iris', inner);
    sticker(eye.pupil, 2, palette.pupil, 1, 'pupil', inner);
    sticker(eye.highlight, 3, palette.white, 1, 'highlight', inner);
    if (eye.glint.rx > 0) sticker(eye.glint, 4, palette.white, eye.glint.opacity, 'glint', inner);
  } else {
    // The kit's radial iris gradient, lit from the upper left: the dark disc with a lighter one set into it
    const p = eye.pupil;
    sticker(p, 1, palette.babyEyeDark, 1, 'pupil', inner);
    sticker({ cx: p.cx - 0.22 * p.rx, cy: p.cy - 0.22 * p.ry, rx: p.rx * 0.62, ry: p.ry * 0.62 }, 2, palette.babyEyeLight, 0.85, 'pupil-light', inner);
    sticker(eye.highlight, 3, palette.white, 1, 'highlight', inner);
  }

  fillSlopes(seats, white, raised);

  let closed: THREE.Object3D | null = null;
  if (lid) {
    closed = closedLine(lid.d, lid.width);
    closed.visible = false;
  }
  // The surface's tangents at the eye: where the gaze slides the inner eye
  const up = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3().crossVectors(up, centre.normal).normalize();
  const reach = gazeReach(white, outerDisc(eye, look), eye.travel);
  return { group, inner, open, closed, travel: eye.travel, across, up, layers, white: { ...white }, pupil: { x: eye.pupil.cx, y: eye.pupil.cy }, reach, seats, place: raised, look: new THREE.Vector3() };
}
