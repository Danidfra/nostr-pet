/**
 * Where furniture stands in a 3D room: a placement on the tile grid, and
 * the placements every room starts with.
 *
 * The placement is Ditto's `room_furniture_v2` shape (on the floor, or on
 * the left or right wall, a quarter-turn rotation, a scale), kept as it is
 * so a room saved there could be read here one day; this milestone only
 * draws the defaults and saves nothing. The parser and the profile update
 * belong to the persistence milestone.
 */

import type { RoomId } from '@/features/home/rooms/rooms';

/** Where a placement is mounted: the floor, or the left (x = 0) or right (z = 0) wall. */
export type FurnitureSurface = 'floor' | 'left' | 'right';

/** Quarter turns clockwise, seen from above. */
export type FurnitureRotation = 0 | 1 | 2 | 3;

/** Dynamic per-instance content (a picture frame's image; not used yet). */
export interface FurnitureContent {
  imageUrl?: string;
}

/** A single placed furniture item (see `room-geometry.ts` for the units). */
export interface FurniturePlacement {
  /** Namespaced furniture ID, e.g. "official:plant-small" */
  id: string;
  at: FurnitureSurface;
  /**
   * Center of the item on its surface, in tiles. Floor: world x, 0–ROOM_GRID.
   * Wall: distance along the wall from the corner, 0–ROOM_GRID.
   */
  x: number;
  /** Floor: world z, 0–ROOM_GRID. Wall: height of the item's center, 0–WALL_HEIGHT. */
  y: number;
  /** Quarter turns (floor items only). Default 0. */
  rot?: FurnitureRotation;
  /** Scale factor 0.5–2.0, default 1 */
  scale?: number;
  content?: FurnitureContent;
}

/**
 * Ditto's default rooms: big pieces stand against the walls, facing into the
 * room; each room's rug or mat lies in the middle, where the Blobbi stands
 * when it arrives. Pieces against the left wall turn (rot 3) to face in.
 */
export const DEFAULT_ROOM_FURNITURE: Record<RoomId, readonly FurniturePlacement[]> = {
  home: [
    { id: 'official:rug-round', at: 'floor', x: 4.5, y: 4.5 },
    { id: 'official:toybox', at: 'floor', x: 3, y: 0.5 },
    { id: 'official:lamp-floor', at: 'floor', x: 0.5, y: 0.5 },
    { id: 'official:plant-tall', at: 'floor', x: 7.5, y: 0.5 },
    { id: 'official:table-side', at: 'floor', x: 0.5, y: 4.5, rot: 3 },
    { id: 'official:lamp-table', at: 'floor', x: 0.5, y: 4.5, rot: 3 },
    { id: 'official:plant-fern', at: 'floor', x: 0.5, y: 6.5 },
    { id: 'official:shelf-wall', at: 'left', x: 5.5, y: 3, scale: 1.4 },
    { id: 'official:picture-frame', at: 'right', x: 5.5, y: 3 },
  ],
  kitchen: [
    { id: 'official:fridge', at: 'floor', x: 1, y: 1 },
    { id: 'official:counter', at: 'floor', x: 3, y: 1 },
    { id: 'official:plant-small', at: 'floor', x: 3, y: 0.5 },
    { id: 'official:counter', at: 'floor', x: 5, y: 1 },
    { id: 'official:oven', at: 'floor', x: 7, y: 1 },
    { id: 'official:clock-wall', at: 'right', x: 5, y: 3.6 },
    { id: 'official:shelf-floating', at: 'left', x: 5.5, y: 3.2, scale: 1.2 },
    { id: 'official:plant-hanging', at: 'left', x: 7.5, y: 3.9 },
  ],
  care: [
    { id: 'official:bathtub', at: 'floor', x: 4.5, y: 1 },
    { id: 'official:sink', at: 'floor', x: 1, y: 4, rot: 3 },
    { id: 'official:plant-fern', at: 'floor', x: 1, y: 1, scale: 1.75 },
    { id: 'official:rug-paw', at: 'floor', x: 5, y: 3.5 },
    { id: 'official:mirror', at: 'left', x: 4, y: 3.8 },
    { id: 'official:towel-rack', at: 'left', x: 6.5, y: 2.4 },
    { id: 'official:picture-frame-oval', at: 'right', x: 5, y: 3.6 },
  ],
  rest: [
    { id: 'official:bed-single', at: 'floor', x: 1.5, y: 3 },
    { id: 'official:table-side', at: 'floor', x: 0.5, y: 4.5, rot: 3 },
    { id: 'official:clock-alarm', at: 'floor', x: 0.5, y: 4.5, rot: 3 },
    { id: 'official:lamp-floor', at: 'floor', x: 0.5, y: 0.5 },
    { id: 'official:shelf-books', at: 'floor', x: 7, y: 0.5, scale: 1.3 },
    { id: 'official:rug-rectangle', at: 'floor', x: 5, y: 4, rot: 1, scale: 1.6 },
    { id: 'official:lamp-string', at: 'right', x: 2, y: 4.2 },
    { id: 'official:lamp-string', at: 'right', x: 6, y: 4.2 },
    { id: 'official:lamp-string', at: 'left', x: 2, y: 4.2 },
    { id: 'official:lamp-string', at: 'left', x: 6, y: 4.2 },
    { id: 'official:picture-frame-square', at: 'left', x: 3, y: 3.2 },
  ],
  closet: [
    { id: 'official:wardrobe', at: 'floor', x: 3, y: 0.5 },
    { id: 'official:plant-tall', at: 'floor', x: 0.5, y: 0.5 },
    { id: 'official:rug-runner', at: 'floor', x: 3.5, y: 2.5 },
    { id: 'official:picture-frame-gold', at: 'left', x: 4, y: 3 },
  ],
};

/** The placements a room shows: its defaults (a saved room comes with a later milestone). */
export function roomFurnitureFor(roomId: RoomId): readonly FurniturePlacement[] {
  return DEFAULT_ROOM_FURNITURE[roomId];
}
