/**
 * Scene geometry: where things stand in the home, in normalized units.
 *
 * The floor is the band of the scene a Blobbi can stand on. A floor point is
 * `{ x, y }` with both axes in 0..1: `x` runs left to right across the floor,
 * `y` runs from the back of the floor (0, near the horizon) to the front (1,
 * nearest the viewer). Nothing here knows about pixels except the one
 * function that turns a floor point into CSS placement and the one that turns
 * a pointer position inside the scene back into a floor point. Everything is
 * pure so it can be pinned by tests and reused by locomotion, gaze and idle.
 */

import { FLOOR_FRONT, FLOOR_LINE } from '../space/room-space';

export interface FloorPoint {
  x: number;
  y: number;
}

/** The part of the floor a Blobbi may stand on (keeps it clear of the edges). */
export interface FloorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * `maxY` stops short of the front edge so the caption under the feet never
 * runs out of the scene box (the scene clips its overflow).
 */
export const FLOOR_BOUNDS: FloorBounds = { minX: 0.1, maxX: 0.9, minY: 0.05, maxY: 0.82 };

/**
 * Where the floor band sits in the room canvas, as fractions of its height:
 * `y = 0` is the horizon line, `y = 1` the front edge. The actor's feet go on
 * that line. The numbers are the canonical space's (`space/room-space.ts`);
 * CSS (`--floor-line`) and placement agree through them.
 */
export const FLOOR_BAND = { top: FLOOR_LINE, bottom: FLOOR_FRONT } as const;

/**
 * The floor is DRAWN much shorter than it is wide: the band's height in
 * canvas-width units is (0.97 − 0.72) · 5/4. A step in `y` covers this much
 * less SCREEN than the same step in `x`. This is what the viewer sees, so it
 * decides which way a moving Blobbi is drawn facing (`facingFromDirection`).
 * It is not how far anything has walked.
 */
export const DEPTH_WEIGHT = 0.31;

/**
 * How deep the floor IS, in floor widths: the room is as deep as it is wide,
 * seen foreshortened. Distances are measured in the room, not on the screen,
 * so a Blobbi takes as long to walk the floor's depth as its width, and one
 * walk cycle covers the same ground whichever way it goes. (Distances used
 * to be measured on the screen, which made walking toward or away from the
 * viewer more than three times as fast as walking across: the body slid
 * down the floor under legs that were stepping at the same pace.)
 */
export const FLOOR_DEPTH = 1;

/** How much closer things grow as they come to the front. Subtle on purpose. */
export const DEPTH_SCALE = { back: 0.88, front: 1 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const clampAxis = (v: number, min: number, max: number) => (Number.isNaN(v) ? min : Math.min(max, Math.max(min, v)));

export function clampToFloor(point: FloorPoint, bounds: FloorBounds = FLOOR_BOUNDS): FloorPoint {
  return { x: clampAxis(point.x, bounds.minX, bounds.maxX), y: clampAxis(point.y, bounds.minY, bounds.maxY) };
}

/** Distance between two floor points in the room, in floor widths. */
export function floorDistance(a: FloorPoint, b: FloorPoint): number {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) * FLOOR_DEPTH;
  return Math.hypot(dx, dy);
}

/**
 * Unit direction from `a` to `b` in the room, as the per-axis step in floor
 * units for one unit of travel. `{ x: 0, y: 0 }` when the two points
 * coincide.
 */
export function floorDirection(a: FloorPoint, b: FloorPoint): FloorPoint {
  const dist = floorDistance(a, b);
  if (dist === 0) return { x: 0, y: 0 };
  return { x: (b.x - a.x) / dist, y: (b.y - a.y) / dist };
}

export type Facing = 'front' | 'back' | 'left' | 'right';

/**
 * Which way a Blobbi is drawn while MOVING along `direction`: in profile
 * when it goes left or right, from behind when it goes up the floor (away),
 * from the front when it comes down it (toward the viewer). Judged by what
 * the move looks like on screen. Side views are favoured because they read
 * as "going somewhere"; only a mostly-depthwise move shows the front or the
 * back. A zero direction keeps the current facing.
 *
 * A Blobbi that is NOT moving faces the viewer; that is the locomotion
 * model's rule (`locomotion.ts`), not this function's.
 */
export function facingFromDirection(direction: FloorPoint, current: Facing = 'front'): Facing {
  const dx = direction.x;
  const dy = direction.y * DEPTH_WEIGHT;
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) >= Math.abs(dy) * 0.75) return dx < 0 ? 'left' : 'right';
  return dy > 0 ? 'front' : 'back';
}

/** Depth scale for a point: things at the back are drawn a little smaller. */
export function depthScale(y: number): number {
  const t = clamp01(y);
  return DEPTH_SCALE.back + (DEPTH_SCALE.front - DEPTH_SCALE.back) * t;
}

export interface FloorPlacement {
  /** CSS `left`, percentage of the scene width, at the actor's centre. */
  left: string;
  /** CSS `top`, percentage of the scene height, at the actor's feet. */
  top: string;
  scale: number;
  /** Paint order: things nearer the front are drawn on top. */
  zIndex: number;
}

/** CSS placement for a floor point; the element is anchored at its feet. */
export function placeOnFloor(point: FloorPoint): FloorPlacement {
  const p = clampToFloor(point, { minX: 0, maxX: 1, minY: 0, maxY: 1 });
  const top = FLOOR_BAND.top + p.y * (FLOOR_BAND.bottom - FLOOR_BAND.top);
  return {
    left: `${(p.x * 100).toFixed(3)}%`,
    top: `${(top * 100).toFixed(3)}%`,
    scale: depthScale(p.y),
    zIndex: 10 + Math.round(p.y * 100),
  };
}

/**
 * The floor point under a position inside the scene box, both given as
 * fractions of the scene's width and height. Points above the horizon or
 * past the front edge clamp to the nearest floor point.
 */
export function floorPointFromScene(fraction: { x: number; y: number }, bounds: FloorBounds = FLOOR_BOUNDS): FloorPoint {
  const y = (fraction.y - FLOOR_BAND.top) / (FLOOR_BAND.bottom - FLOOR_BAND.top);
  return clampToFloor({ x: fraction.x, y }, bounds);
}

/** True when two points are close enough to count as the same spot. */
export function isAtPoint(a: FloorPoint, b: FloorPoint, epsilon = 0.005): boolean {
  return floorDistance(a, b) <= epsilon;
}
