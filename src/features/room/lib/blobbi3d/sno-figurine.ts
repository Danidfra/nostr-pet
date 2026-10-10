/**
 * The SNO way, tried: the same Blobbi as a `sno:` object (the room's
 * furniture format, `sno-builder.ts`). A SNO object is a lattice of flat
 * faces with one palette colour each (no gradients, no smooth normals, no
 * rig: it is a figurine), and its vertices snap to 1/120 of a unit. This
 * builds the body as a lathe of the kit's front silhouette, the feet and the
 * eyes as low-poly spheres, in the same model units as the real model, so
 * the two can stand side by side and be judged.
 */
import type * as THREE from 'three';
import { buildBlobbiGeometry, type BlobbiMorphology } from '@blobbi-kit/renderer/procedural';
import { SnoBuilder, type SnoPayload } from '../scene/sno-builder';
import { snoNodeFromPayload } from '../scene/sno-object';
import { buildSnoObject } from '../scene/sno-three';
import { ROOT_PER_BOX, rootPerBox, toModelX, toModelY, U, type Frame } from './units';

export interface SnoFigurine {
  payload: SnoPayload;
  object: THREE.Object3D;
  faces: number;
}

const LEVELS = 12;

export function buildSnoFigurine(morphology: BlobbiMorphology): SnoFigurine {
  const geo = buildBlobbiGeometry(morphology, { view: 'front' });
  if (geo.view === 'side') throw new Error('front geometry expected');
  const { palette, body } = geo;
  const frame: Frame = { axisX: body.axisX, groundY: geo.ground.y, sideAxisX: body.axisX };
  const b = new SnoBuilder();
  // The body: the front silhouette revolved, banded light to dark down the body
  const profile: [number, number][] = [[0, toModelY(body.bottom, frame)]];
  const colors: string[] = [];
  for (let i = 1; i < LEVELS; i++) {
    const y = body.bottom - (i / LEVELS) * (body.bottom - body.top);
    const span = body.spanAt(y);
    const r = span ? ((span.max - span.min) / 2) * U : 0.002;
    profile.push([r, toModelY(y, frame)]);
    colors.push(i < LEVELS / 3 ? palette.bodyDark : i < (2 * LEVELS) / 3 ? palette.bodyMid : palette.bodyLight);
  }
  profile.push([0, toModelY(body.top, frame)]);
  colors.push(palette.bodyLight);
  b.lathe(profile, 10, colors);
  for (const foot of geo.limbs.feet) {
    const e = foot.foot;
    b.sphere([toModelX(e.cx, frame), toModelY(e.cy, frame), 0], [e.rx * U, e.ry * U, e.rx * 0.9 * U], palette.footLight, 8, 4);
  }
  if (geo.face) {
    const apex = body.spanAt((body.top + body.bottom) / 2);
    const depth = apex ? ((apex.max - apex.min) / 2) * U : 0.2;
    for (const eye of geo.face.eyes) {
      const w = eye.white;
      const z = Math.sqrt(Math.max(0, 1 - ((toModelX(w.cx, frame) / depth) ** 2))) * depth;
      b.sphere([toModelX(w.cx, frame), toModelY(w.cy, frame), z], [w.rx * U, w.ry * U, w.rx * 0.5 * U], palette.white, 8, 4);
      b.sphere([toModelX(eye.pupil.cx, frame), toModelY(eye.pupil.cy, frame), z + w.rx * 0.45 * U], [eye.pupil.rx * U, eye.pupil.ry * U, eye.pupil.rx * 0.3 * U], palette.pupil, 6, 3);
    }
  }
  const payload = b.build('Blobbi figurine');
  const object = buildSnoObject(snoNodeFromPayload(payload));
  object.scale.setScalar(ROOT_PER_BOX / rootPerBox(geo.stage === 'baby' ? 'baby' : 'adult'));
  return { payload, object, faces: payload.faces.length };
}
