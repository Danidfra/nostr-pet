/**
 * Where a walking Blobbi's eyes go in the room: a glance the way it is
 * going, from the side it is drawn from. The home's `travelGlance` takes a
 * screen direction; in the room the direction on screen IS the facing
 * (room-facing.ts), so it is derived from that. The back has no face.
 */
import type { BlobbiFacing } from '@blobbi-kit/renderer';
import { travelGlance, type EyeOffset } from '@/features/home/scene/gaze';

const SCREEN_DIRECTION: Record<BlobbiFacing, { x: number; y: number } | null> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  front: { x: 0, y: 1 },
  back: null,
};

export function travelGaze(facing: BlobbiFacing): EyeOffset | undefined {
  const direction = SCREEN_DIRECTION[facing];
  return direction ? travelGlance(direction) : undefined;
}

/** Everything that wants the eyes, at once; `pickGaze` decides. */
export interface GazeWants {
  /** A choreographed look (a transition's "look down", "look at the player", the food it is about to eat): above all. */
  scripted?: EyeOffset | null;
  /** The pointer hovering, or a tap it is still attending to (the home's gaze policy). */
  pointer?: EyeOffset;
  /** Something just touched in the room (a piece knocked, an item set down). */
  attention?: EyeOffset | null;
  /** Its own idle glance. */
  glance?: EyeOffset | null;
  /** Walking: a glance the way it goes, unless a script says otherwise. */
  walking?: { facing: BlobbiFacing } | null;
}

/**
 * The one place the eyes are decided, in order: a choreographed look, then
 * (walking) the way it goes, then the pointer, then what it is attending
 * to, then its own glance; nothing wanted is the eyes at rest (undefined).
 * Both drawings take this one answer, so 2D and 3D never disagree.
 */
export function pickGaze(wants: GazeWants): EyeOffset | undefined {
  if (wants.scripted) return wants.scripted;
  if (wants.walking) return travelGaze(wants.walking.facing);
  return wants.pointer ?? wants.attention ?? wants.glance ?? undefined;
}

/**
 * A look from where the Blobbi stands toward a point on the floor (a dish, a
 * ball): across the screen is x - z from the camera's corner, so the eyes go
 * that way; nearer the camera than it is lower on screen, so the eyes go
 * down, else a little up.
 */
export function gazeToward(from: { x: number; z: number }, to: { x: number; z: number }): EyeOffset {
  const across = (to.x - to.z) - (from.x - from.z);
  const nearer = to.x + to.z > from.x + from.z;
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  return { x: Math.max(-0.85, Math.min(0.85, across * 0.3)), y: nearer ? Math.min(0.75, 0.35 + distance * 0.12) : -0.1 };
}
