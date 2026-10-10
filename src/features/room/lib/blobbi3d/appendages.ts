/**
 * APPENDAGES in three dimensions: antennae, horns and tails, each rebuilt
 * from the kit's own drawings of it.
 *
 * The kit draws each of these around a quadratic centreline it computes in
 * 3D (a tilt, a sweep, a curl, a lift) and projects into every view: the
 * front (or back) view shows where the part goes across and up, the side
 * view where it goes forward and up. `sweep.ts` reads the centreline and
 * the widths back out of each view's outline; here the two are put
 * together into one 3D curve (across from the picture view, forward from
 * the side view, up from whichever view shows the part in profile rather
 * than foreshortened) and swept into a round, tapered tube, closed by the
 * kit's rounded tip. Balls (an antenna's tip, a nub tail, a leaf) are
 * ellipsoids with their depth from the side view; strokes (a leaf's vein)
 * are tubes. Nothing here is a constant of the kit's restated: a part
 * that the kit draws differently is drawn differently here, and a path
 * whose structure the parsers do not know is refused.
 *
 * Which view is the picture: a part the front view draws edge-on (an
 * antenna on the crown, a top or side horn, an ear) is pictured by the
 * front; a part the front view draws pointing at the viewer (a forehead
 * horn, `layer: 'over'`) or not at all (a tail, shown only from behind and
 * from the side) is pictured by the side view, with its across position
 * taken from the back view.
 */
import * as THREE from 'three';
import type { Appendage } from '@blobbi-kit/renderer/procedural';
import { samplePath } from './svg-path';
import { toModelX, toModelZ, U, type Frame } from './units';
import { bendOf, halfWidthAt, parseCone, parseHorn, parseStalk, quadraticAt, sweep, type Spine2 } from './sweep';

type Prim = Appendage['prims'][number];
type Ellipse = NonNullable<Prim['ellipse']>;
export type AppendageKind = 'antenna' | 'horn' | 'tail' | 'ear';

/** How flat an ear is, depth over width: a leaf of a thing, not a cone. */
export const EAR_DEPTH = 0.32;

export interface AppendageViews {
  /** The front view's drawing of the part (null when the front does not show it). */
  front: Appendage | null;
  /** The back view's. */
  back: Appendage | null;
  /** The side view's (the near or the far one, whichever matches the part's side). */
  side: Appendage | null;
  /** The side view's ground line, root y. */
  sideGroundY: number;
}

export interface AppendageMaterials {
  material(colour: string, opacity?: number): THREE.Material;
  paint(role: string | undefined): string;
  track<T extends { dispose(): void }>(x: T): T;
  ink: THREE.Material;
  ellipsoid(rx: number, ry: number, rz: number, material: THREE.Material, ink?: boolean): THREE.Group;
  tube(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Group;
}

export interface Built3dAppendage {
  group: THREE.Group;
  /** What was built, for tests: each spine's 3D control points and the curl it carries, in model units. */
  spines: { part: string; base: THREE.Vector3; control: THREE.Vector3; tip: THREE.Vector3; bend: number; baseHalf: number; tipHalf: number }[];
  /** Parts drawn as a flat extrusion because the side view did not show them. */
  approximations: string[];
}

const LINE = 6 * U;

/** Which prims are spines, and how their outlines are read. */
const SPINES: Record<string, (d: string) => Spine2> = {
  'antenna-stalk': parseStalk,
  'tail-curl': parseStalk,
  'horn-body': parseHorn,
  'ear-outer': parseCone,
  'ear-inner': parseCone,
};

function hull(geometry: THREE.BufferGeometry, material: THREE.Material, thickness = LINE): THREE.Mesh {
  const g = geometry.clone();
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * thickness, p.getY(i) + n.getY(i) * thickness, p.getZ(i) + n.getZ(i) * thickness);
  p.needsUpdate = true;
  return new THREE.Mesh(g, material);
}

/** A picture view's root point into the model: the front as drawn, the back mirrored (screen-right is the Blobbi's left). */
function pictureX(x: number, view: 'front' | 'back', frame: Frame): number {
  return view === 'back' ? -toModelX(x, frame) : toModelX(x, frame);
}

/**
 * Build one appendage from its views. The group's origin is the part's
 * pivot (where the kit sways it), in body coordinates.
 */
export function buildAppendage3d(kind: AppendageKind, views: AppendageViews, frame: Frame, parts: AppendageMaterials): Built3dAppendage | null {
  const { side } = views;
  const picture = views.front && views.front.layer !== 'over' ? views.front : null;
  const pictureView: 'front' | 'back' = picture ? 'front' : 'back';
  const across = picture ?? views.back; // where the part goes across, when the side is the profile
  const profile = side;
  if (!picture && !profile) return null;
  // Up and forward from the profile when the picture is missing or foreshortened; else up from the picture
  const upFromSide = !picture;
  const yOf = (root: number, fromSide: boolean) => (fromSide ? (views.sideGroundY - root) * U : (frame.groundY - root) * U);
  const main = picture ?? profile!;
  const pivot = new THREE.Vector3(
    across ? pictureX(across.pivot.x, picture ? 'front' : 'back', frame) : 0,
    yOf(main.pivot.y, upFromSide),
    profile ? toModelZ(profile.pivot.x, frame) : 0,
  );
  const group = new THREE.Group();
  group.name = kind;
  group.position.copy(pivot);
  const spines: Built3dAppendage['spines'] = [];
  const approximations: string[] = [];
  const sidePrim = (part: string) => profile?.prims.find((p) => p.part === part) ?? null;
  const acrossPrim = (part: string) => across?.prims.find((p) => p.part === part) ?? null;

  const point = (xRoot: number | null, yRoot: number, zRoot: number | null, fromSide: boolean) =>
    new THREE.Vector3(xRoot === null ? 0 : pictureX(xRoot, pictureView, frame), yOf(yRoot, fromSide), zRoot === null ? pivot.z : toModelZ(zRoot, frame)).sub(pivot);

  for (const prim of main.prims) {
    const colour = parts.paint(prim.fill);
    const material = parts.material(colour, prim.opacity ?? 1);
    const parse = prim.d ? SPINES[prim.part] : undefined;
    if (prim.d && parse) {
      // A spine: across (and up) from the picture, forward (and up, if the picture is foreshortened) from the side
      const pic = picture ? parse(prim.d) : null;
      const sideD = sidePrim(prim.part)?.d;
      const pro = sideD ? parse(sideD) : upFromSide ? parse(prim.d) : null;
      if (!pic && !pro) continue;
      const acrossD = !picture ? acrossPrim(prim.part)?.d : undefined;
      const acrossSpine = acrossD ? parse(acrossD) : null;
      const at = (t: number) => {
        const xy = pic ? quadraticAt(pic, t) : acrossSpine ? quadraticAt(acrossSpine, t) : null;
        const zy = pro ? quadraticAt(pro, t) : null;
        const y = upFromSide && zy ? zy.y : xy ? xy.y : zy!.y;
        return point(xy ? xy.x : null, y, zy ? zy.x : null, upFromSide && !!zy);
      };
      const widthSource = pic ?? pro!;
      // An ear is flat (its depth a fraction of its width); its inner part lies on the outer's front face
      const flat = kind === 'ear' ? (prim.part === 'ear-inner' ? 0.1 : EAR_DEPTH) : 1;
      const outerSpine = prim.part === 'ear-inner' ? main.prims.find((q) => q.part === 'ear-outer')?.d : undefined;
      const outer = outerSpine && SPINES['ear-outer'] ? SPINES['ear-outer'](outerSpine) : null;
      const forward = (t: number) => (outer ? halfWidthAt(outer, Math.max(0, Math.min(1, t))) * U * EAR_DEPTH * 0.9 : 0);
      const radius = (t: number) => {
        const h = halfWidthAt(widthSource, Math.max(0, Math.min(1, t))) * U;
        return { a: h, b: h * flat };
      };
      // Sunk a little further into the body than the kit's base, so the join is never seen
      const centre = (t: number) => at(t).add(new THREE.Vector3(0, 0, forward(t)));
      const geometry = parts.track(sweep((t) => centre(-0.12 + 1.12 * t), (t) => radius(-0.12 + 1.12 * t), { steps: 28, segments: 18, frame: kind === 'ear' ? 'flat' : 'twist-free' }));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = prim.part;
      mesh.castShadow = true;
      group.add(mesh);
      if (prim.part !== 'ear-inner') group.add(parts.track(hull(geometry, parts.ink)));
      const spine = pic ?? acrossSpine ?? pro!;
      spines.push({ part: prim.part, base: at(0), control: at(0.5), tip: at(1), bend: bendOf(pro && upFromSide ? pro : spine), baseHalf: halfWidthAt(widthSource, 0) * U, tipHalf: halfWidthAt(widthSource, 1) * U });
    } else if (prim.ellipse) {
      const e = prim.ellipse;
      const depth = sidePrim(prim.part)?.ellipse ?? null;
      const other = !picture ? acrossPrim(prim.part)?.ellipse ?? null : null;
      if (picture) {
        // In the picture plane, as deep as the side view draws it (an ear as a flat leaf, its inside on its front face)
        let rz = depth ? depth.rx * U : Math.min(e.rx, e.ry) * 0.5 * U;
        let ahead = 0;
        if (kind === 'ear') {
          const outerE = main.prims.find((q) => q.part === 'ear-outer')?.ellipse;
          rz = prim.part === 'ear-inner' ? Math.min(e.rx, e.ry) * 0.08 * U : Math.min(rz, Math.min(e.rx, e.ry) * EAR_DEPTH * 2 * U);
          if (prim.part === 'ear-inner' && outerE) ahead = Math.min(outerE.rx, outerE.ry) * EAR_DEPTH * 2 * U * 0.85;
        }
        const ball = parts.ellipsoid(e.rx * U, e.ry * U, rz, material, !!prim.stroke || prim.part.endsWith('-tip') || prim.part.endsWith('-nub') || prim.part === 'ear-outer');
        ball.position.copy(point(e.cx, e.cy, depth && kind !== 'ear' ? depth.cx : null, false)).add(new THREE.Vector3(0, 0, ahead));
        ball.rotation.z = -((e.rotation ?? 0) * Math.PI) / 180;
        group.add(ball);
      } else {
        // In the side plane: across from the back view's drawing of it
        const rx = other ? other.rx * U : Math.min(e.rx, e.ry) * 0.6 * U;
        const ball = parts.ellipsoid(rx, e.ry * U, e.rx * U, material, prim.part.endsWith('-tip') || prim.part.endsWith('-nub') || prim.part.endsWith('-leaf'));
        ball.position.copy(point(other ? other.cx : null, e.cy, e.cx, true));
        // The side view's rotation turns about the x axis here; its x is our z, so the sense flips
        ball.rotation.x = ((e.rotation ?? 0) * Math.PI) / 180;
        group.add(ball);
      }
    } else if (prim.d && prim.stroke) {
      // A stroke (a leaf's vein): a tube along it, in the plane it is drawn in
      const width = (prim.strokeWidth ?? 3) * U;
      const points = samplePath(prim.d, 8).flatMap((poly) => poly.points.map((p) => (picture ? point(p.x, p.y, null, false) : point(null, p.y, p.x, true))));
      // Lifted off the leaf toward the viewer of the view it is drawn in (the side view's viewer is at -x here)
      const lift = picture ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(-1, 0, 0);
      const stroke = parts.tube(points.map((p) => p.addScaledVector(lift, 2 * U)), width / 2, parts.material(parts.paint(prim.stroke), prim.opacity ?? 1));
      group.add(stroke);
    } else if (prim.d) {
      approximations.push(prim.part);
    }
  }
  return { group, spines, approximations };
}

/** Whether a prim's path is one the parsers know. */
export function knownSpine(part: string): boolean {
  return part in SPINES;
}

export type { Ellipse as AppendageEllipse };
