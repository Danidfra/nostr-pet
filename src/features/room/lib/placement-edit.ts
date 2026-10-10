/**
 * Pure edits of a placement while decorating: the next size step, a quarter
 * turn, a nudge by a tile (or half a tile along a wall), clamped to the
 * room. The toolbar and the keyboard call these; tests pin them.
 */
import type { FurniturePlacement, FurnitureRotation } from './room-furniture';
import { ROOM_GRID, WALL_HEIGHT } from './room-geometry';

export const SCALE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** The next scale step from a placement's scale, or the same when at the end. */
export function nextScale(scale: number | undefined, dir: 1 | -1): number {
  const current = SCALE_STEPS.reduce((best, s) => (Math.abs(s - (scale ?? 1)) < Math.abs(best - (scale ?? 1)) ? s : best));
  return SCALE_STEPS[Math.max(0, Math.min(SCALE_STEPS.length - 1, SCALE_STEPS.indexOf(current) + dir))];
}

/** A placement one size step bigger or smaller; scale 1 is stored as absent, as Ditto stores it. */
export function resized(item: FurniturePlacement, dir: 1 | -1): FurniturePlacement {
  const next = nextScale(item.scale, dir);
  const rest: FurniturePlacement = { ...item };
  delete rest.scale;
  return next === 1 ? rest : { ...rest, scale: next };
}

/** A floor placement turned a quarter clockwise; wall pieces do not turn. */
export function rotated(item: FurniturePlacement): FurniturePlacement {
  if (item.at !== 'floor') return item;
  return { ...item, rot: (((item.rot ?? 0) + 1) % 4) as FurnitureRotation };
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

/**
 * A placement nudged by the arrow keys: on the floor a tile along x (dx) or
 * z (dy); on a wall half a tile along it (left and right follow the screen:
 * the left wall runs the other way) or up and down.
 */
export function nudged(item: FurniturePlacement, dx: number, dy: number): FurniturePlacement {
  if (item.at === 'floor') return { ...item, x: clamp(item.x + dx, ROOM_GRID), y: clamp(item.y + dy, ROOM_GRID) };
  return { ...item, x: clamp(item.x + (item.at === 'left' ? -dx : dx) * 0.5, ROOM_GRID), y: clamp(item.y - dy * 0.5, WALL_HEIGHT) };
}
