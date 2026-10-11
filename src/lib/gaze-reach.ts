/**
 * How far a Blobbi may look. The kit moves a V3 eye's inner part (iris,
 * pupil, highlights) by up to its `travel` for a full look; for some babies
 * that slides the big pupil past the edge of the white, and an eye that
 * slides off its own white reads as a second eye. `gazeReach` is the share
 * of the travel that keeps the outer disc inside the white whichever way it
 * looks; both drawings (the kit's SVG through `eyeOffset`, the room's 3D
 * model through its rig) look no further than that. Pure; no three.js, so
 * the classic home can use it too.
 */
import { buildBlobbiGeometry } from '@blobbi-kit/renderer/procedural';
import type { BlobbiVisual } from '@blobbi-kit/renderer';
import { genomeOf, morphologyOf, stage3dOf } from '@/features/room/lib/blobbi3d/identity';

export interface GazeEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** The largest share (0..1) of `travel` that keeps `outer` within `margin` of the white's rim, every way. */
export function gazeReach(white: GazeEllipse, outer: GazeEllipse, travel: number, margin = 0.97): number {
  if (!(travel > 0)) return 1;
  const worst = (k: number) => {
    let r = 0;
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * Math.PI * 2;
      const cx = outer.cx + Math.cos(th) * travel * k;
      const cy = outer.cy + Math.sin(th) * travel * k;
      for (let b = 0; b < 24; b++) {
        const ph = (b / 24) * Math.PI * 2;
        r = Math.max(r, Math.hypot((cx + outer.rx * Math.cos(ph) - white.cx) / white.rx, (cy + outer.ry * Math.sin(ph) - white.cy) / white.ry));
      }
    }
    return r;
  };
  if (worst(1) <= margin) return 1;
  if (worst(0) > margin) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (worst(mid) <= margin) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The disc that must stay inside the white as the eye looks: the iris (layered look), or the big pupil (simple look). */
export function outerDisc(eye: { iris?: GazeEllipse; pupil: GazeEllipse }, look: 'layered' | 'simple'): GazeEllipse {
  if (look === 'layered' && eye.iris && eye.iris.rx >= eye.pupil.rx) return eye.iris;
  return eye.pupil;
}

const cache = new Map<string, number>();

/** A Blobbi's gaze reach, from the kit's own front geometry (1 for V1/V2 art and eggs, whose eyes the kit keeps within bounds). */
export function gazeReachOfVisual(visual: BlobbiVisual): number {
  const stage = stage3dOf(visual.stage);
  const genome = stage ? genomeOf(visual) : null;
  if (!stage || !genome) return 1;
  const key = `${stage}|${JSON.stringify(genome)}`;
  const known = cache.get(key);
  if (known !== undefined) return known;
  let reach = 1;
  try {
    const front = buildBlobbiGeometry(morphologyOf(genome, stage), { view: 'front' }) as unknown as {
      face?: { eyes: { white: GazeEllipse; iris?: GazeEllipse; pupil: GazeEllipse; travel: number }[] };
      look: { eye: 'layered' | 'simple' };
    };
    for (const eye of front.face?.eyes ?? []) reach = Math.min(reach, gazeReach(eye.white, outerDisc(eye, front.look.eye), eye.travel));
  } catch {
    reach = 1;
  }
  cache.set(key, reach);
  return reach;
}

/** An eye offset no further than the reach: clamped to the unit disc (as the kit does), then scaled. */
export function limitGaze<T extends { x: number; y: number } | undefined>(offset: T, reach: number): T {
  if (!offset) return offset;
  const len = Math.hypot(offset.x, offset.y);
  const k = (len > 1 ? 1 / len : 1) * Math.min(1, reach);
  if (k === 1) return offset;
  return { x: offset.x * k, y: offset.y * k } as T;
}
