/**
 * The one space the home shows today, and the pieces of furniture that come
 * out for a care moment.
 *
 * The multi-room registry, the layout store and the editor from M9 are
 * kept in `src/features/home/rooms/` as dormant infrastructure (see the
 * note there); the active product is this single space, built from the
 * same definitions: the living room's surfaces and decor, its door to the
 * Island, and a small set of furniture that never moves. The bed and the
 * tub are not always there: they appear for rest and for a bath and go
 * away after, so the space stays the Blobbi's, not a house.
 */
import { clampToFloor, type FloorPoint } from '../scene/geometry';
import { floorFromRoom } from './room-space';
import { roomById, type RoomDefinition } from '../rooms/rooms';
import type { Placement } from '../rooms/layout-schema';

export type StageObjectKind = 'bed' | 'tub';

const HOME = roomById('home');

export interface HomeSpace {
  /** The room definition the space is drawn from (surfaces, decor, fixtures). */
  room: RoomDefinition;
  /** Furniture that is always there. */
  furniture: readonly Placement[];
  /** Where the Blobbi stands when the home opens (floor units). */
  entry: FloorPoint;
}

export const HOME_SPACE: HomeSpace = {
  room: HOME,
  furniture: [
    { id: 'official:rug-round', x: 0.5, y: 0.88, layer: 'floor' },
    { id: 'official:plant-tall', x: 0.88, y: 0.72, layer: 'front' },
    { id: 'official:lamp-floor', x: 0.3, y: 0.74, layer: 'front' },
    { id: 'official:shelf-wall', x: 0.3, y: 0.3, layer: 'back' },
  ],
  entry: HOME.entry,
};

/** Where the bed and the tub come out, and where a toy is set down. */
export const STAGE_OBJECTS = {
  bed: { id: 'home:bed-pet', x: 0.74, y: 0.88, layer: 'floor' } as Placement,
  tub: { id: 'home:tub', x: 0.68, y: 0.86, layer: 'floor' } as Placement,
  /** A toy lies a little to the left, the Blobbi plays beside it. */
  toySpot: clampToFloor({ x: 0.32, y: 0.72 }),
  toyApproach: clampToFloor({ x: 0.44, y: 0.7 }),
} as const;

/** A stage object's feet in floor units (for tests and gaze). */
export function stageObjectFloorPoint(kind: StageObjectKind): FloorPoint {
  const p = STAGE_OBJECTS[kind];
  return floorFromRoom({ x: p.x, y: p.y });
}
