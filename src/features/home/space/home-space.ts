/**
 * The one space the home shows, and the pieces that come out for a care
 * moment.
 *
 * The room definitions live in `src/features/home/rooms/` (see the README
 * there); the home is this single space, built from them: the living room's surfaces, its window (decor) and its
 * door (the way to the Island). Nothing else is permanent: no rug, lamp,
 * plant or shelf, no bed, no toy. The bed and the tub are brought out for
 * rest and for a bath and go away after; food and toys are set down for a
 * use and leave.
 *
 * The home never reads the M9 layout store, the room store or the toy
 * store, so nothing persisted by an earlier build can put furniture here
 * (`home-composition.test.tsx` seeds those keys and checks).
 */
import { clampToFloor, type FloorPoint } from '../scene/geometry';
import { roomById, type RoomDefinition } from '../rooms/rooms';
import type { Placement } from '../rooms/layout-schema';

export type StageObjectKind = 'bed' | 'tub';

const HOME = roomById('home');

export interface HomeSpace {
  /** The room definition the space is drawn from (surfaces, decor, fixtures). */
  room: RoomDefinition;
  /** Furniture that is always there: none, by design. The registry's defaults are not used. */
  furniture: readonly Placement[];
  /** Where the Blobbi stands when the home opens (floor units). */
  entry: FloorPoint;
}

/** What is permanently in the room besides the Blobbi. */
export const PERMANENT_OBJECTS = ['door', 'window'] as const;

export const HOME_SPACE: HomeSpace = {
  room: HOME,
  furniture: [],
  entry: HOME.entry,
};

/**
 * Where the bed and the tub come out (room units), and where a toy is set
 * down (floor units). The bed is scaled for a Blobbi to lie on it: the
 * actor is 44% of the canvas wide, so the bed is about half the canvas.
 */
export const STAGE_OBJECTS = {
  bed: { id: 'home:bed-pet', x: 0.66, y: 0.9, layer: 'floor', scale: 1.7 } as Placement,
  /**
   * The nest: an egg's home position. The same bed, centred in the room and
   * a little smaller, always out while the Blobbi is an egg; the egg sits
   * on it (its feet at the bed's use spot) and never wanders. Presentation
   * only: no event says an egg is in a bed.
   */
  nest: { id: 'home:bed-pet', x: 0.5, y: 0.9, layer: 'floor', scale: 1.5 } as Placement,
  tub: { id: 'home:tub', x: 0.66, y: 0.88, layer: 'floor', scale: 1.25 } as Placement,
  /** A toy lies a little to the left, the Blobbi plays beside it. */
  toySpot: clampToFloor({ x: 0.32, y: 0.72 }),
  toyApproach: clampToFloor({ x: 0.44, y: 0.7 }),
} as const;
