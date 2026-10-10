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

  /** A point of the drawing on the skin, raised toward the viewer by `height` root units, relative to the eye's centre. */
  const raised = (xr: number, yr: number, height: number) => surface.at(xr, yr).position.add(new THREE.Vector3(0, 0, height * U)).sub(centre.position);
  /** A sticker over the white's dome, `layer` layers up. */
  const sticker = (e: EllipseLike, layer: number, colour: string, opacity: number, part: string, into: THREE.Group) => {
    const geometry = parts.track(stickerGeometry(e, (xr, yr) => raised(xr, yr, domeHeight(white, xr, yr) + layer * LAYER)));
    const mesh = new THREE.Mesh(geometry, parts.flat(colour, opacity));
    mesh.name = part;
    into.add(mesh);
    layers.push({ part, colour });
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

  let closed: THREE.Object3D | null = null;
  if (lid) {
    closed = closedLine(lid.d, lid.width);
    closed.visible = false;
  }
  // The surface's tangents at the eye: where the gaze slides the inner eye
  const up = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3().crossVectors(up, centre.normal).normalize();
  return { group, inner, open, closed, travel: eye.travel, across, up, layers, white: { ...white }, pupil: { x: eye.pupil.cx, y: eye.pupil.cy } };
}
