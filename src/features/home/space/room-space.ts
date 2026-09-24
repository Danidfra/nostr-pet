/**
 * The canonical room space: the one coordinate system every room, object,
 * item, toy and the Blobbi share, and the one transform that puts it on a
 * screen.
 *
 * ```
 *   RoomPoint { x, y } ∈ [0,1]²        over a canvas of fixed aspect (4:5)
 *      y < FLOOR_LINE   the wall           y ≥ FLOOR_LINE   the floor
 *   FloorPoint { x, y: depth ∈ [0,1] }  the walking space (geometry.ts):
 *      depth 0 is the wall line, 1 the front edge; room y = FLOOR_LINE + depth · (FLOOR_FRONT − FLOOR_LINE)
 *         ↓ fitCanvas(viewport)        contain: the largest 4:5 box, bottom-centred
 *   CanvasBox { left, top, width, height }   in viewport pixels
 *         ↓ roomToCss / roomFromViewport
 *   CSS percentages of the canvas box (positions) and of its width (sizes)
 * ```
 *
 * The property this buys: a stored room point lands in the same place of
 * the same picture on a 360px phone, a tablet and a wide desktop, because
 * the picture is the canvas and the canvas never stretches. Extra viewport
 * space is bleed (more wall above, more floor to the sides), painted by the
 * backdrop with the horizon fixed to the canvas's floor line.
 *
 * This module is pure and owns every constant; nothing else retypes the
 * math (Ditto's room spreads it over four components, and its canvas is
 * width-driven, so it squashes on desktop).
 */
import type { FloorPoint } from '../scene/geometry';

/** Canvas width over height. Portrait: most of a phone screen, room for the dock. */
export const ROOM_ASPECT = 4 / 5;

/** Where the wall meets the floor, as a fraction of canvas height. */
export const FLOOR_LINE = 0.72;

/** The front edge a Blobbi may stand on; the sliver below keeps feet and captions inside. */
export const FLOOR_FRONT = 0.97;

export interface RoomPoint {
  /** 0 = left edge, 1 = right edge of the canvas. */
  x: number;
  /** 0 = top of the canvas, 1 = bottom. For anything standing, the point is its feet. */
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The canvas box inside a viewport, in the viewport's pixels. */
export interface CanvasBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type RoomRegion = 'wall' | 'floor';

/** Which region a room y falls in. */
export function roomRegion(y: number): RoomRegion {
  return y < FLOOR_LINE ? 'wall' : 'floor';
}

/**
 * The largest canvas of the room's aspect that fits the viewport, resting on
 * its bottom edge and centred. Pixels are rounded so the box is stable
 * under sub-pixel viewports; a degenerate viewport gives a zero box.
 */
export function fitCanvas(viewport: Size, aspect = ROOM_ASPECT): CanvasBox {
  const vw = Math.max(0, viewport.width);
  const vh = Math.max(0, viewport.height);
  if (vw === 0 || vh === 0) return { left: 0, top: 0, width: 0, height: 0 };
  const height = Math.min(vh, vw / aspect);
  const width = height * aspect;
  return {
    width: Math.round(width),
    height: Math.round(height),
    left: Math.round((vw - width) / 2),
    top: Math.round(vh - height),
  };
}

/** A floor point (walking space) as a room point. */
export function roomFromFloor(point: FloorPoint): RoomPoint {
  return { x: point.x, y: FLOOR_LINE + clamp01(point.y) * (FLOOR_FRONT - FLOOR_LINE) };
}

/** A room point as a floor point; a wall point clamps to the wall line, a point past the front to the front. */
export function floorFromRoom(point: RoomPoint): FloorPoint {
  return { x: point.x, y: clamp01((point.y - FLOOR_LINE) / (FLOOR_FRONT - FLOOR_LINE)) };
}

/** CSS placement of a room point inside the canvas box. */
export function roomToCss(point: RoomPoint): { left: string; top: string } {
  return { left: `${(point.x * 100).toFixed(3)}%`, top: `${(point.y * 100).toFixed(3)}%` };
}

/** A room point in viewport pixels (for tests and for placing things by hand). */
export function roomToViewport(point: RoomPoint, box: CanvasBox): { x: number; y: number } {
  return { x: box.left + point.x * box.width, y: box.top + point.y * box.height };
}

/** The room point under a viewport pixel; not clamped (callers decide what to do outside). */
export function roomFromViewport(px: { x: number; y: number }, box: CanvasBox): RoomPoint {
  if (box.width === 0 || box.height === 0) return { x: 0.5, y: FLOOR_LINE };
  return { x: (px.x - box.left) / box.width, y: (px.y - box.top) / box.height };
}

export type PlacementLayer = 'back' | 'floor' | 'front';

export interface PlacementExtent {
  /** Which region the object belongs to: `back` is on the wall; `floor` and `front` stand on the floor. */
  layer: PlacementLayer;
  /** The object's width as a fraction of canvas width. */
  width: number;
  /** The object's height as a fraction of canvas height (width / aspectRatio, in canvas terms). */
  height?: number;
}

/**
 * The nearest legal anchor for an object: inside the canvas with its whole
 * width, on the floor band if it stands, on the wall if it hangs. Applied
 * on every drag step and on every read from storage, so a placement can
 * never be nonsensical on another viewport: the rule is in room units.
 */
export function clampPlacement(point: RoomPoint, extent: PlacementExtent): RoomPoint {
  const half = Math.min(0.5, Math.max(0, extent.width) / 2);
  const x = clampTo(point.x, half, 1 - half);
  if (extent.layer === 'back') {
    const h = Math.max(0, extent.height ?? 0);
    return { x, y: clampTo(point.y, Math.min(h, FLOOR_LINE), FLOOR_LINE) };
  }
  return { x, y: clampTo(point.y, FLOOR_LINE, FLOOR_FRONT) };
}

/** Coordinates are stored with three decimals: enough for a 4K room, small in JSON. */
export function roundRoomPoint(point: RoomPoint): RoomPoint {
  return { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 };
}

function clamp01(v: number): number {
  return Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
}

function clampTo(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}
