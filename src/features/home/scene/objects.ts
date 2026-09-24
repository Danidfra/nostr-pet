import type { FloorPoint } from './geometry';

/**
 * Where things are in the home, and what they are.
 *
 * An object DEFINITION says what a thing is and where it sits, as a
 * normalized floor point (so it holds at every viewport). How it is drawn
 * (`SceneObjectView`) and what tapping it does (the overview) are separate,
 * so a future placed or equipped inventory object is one more definition
 * and one more drawing, not a new component tree.
 */

export type SceneObjectId = 'bed' | 'door' | 'offer';

/** Furniture stays; an item is offered for a moment and goes away. */
export type SceneObjectKind = 'furniture' | 'item';

export interface SceneObjectDef {
  id: SceneObjectId;
  kind: SceneObjectKind;
  /** Accessible name. */
  label: string;
  /** Where the object's feet are. */
  position: FloorPoint;
  /** Where a Blobbi stands to use it (defaults to the object's own spot). */
  approach?: FloorPoint;
  /** Width as a fraction of the scene width (clamped by CSS). */
  width: number;
}

/** Where a Blobbi stands when it arrives home (awake). */
export const HOME_SPOT: FloorPoint = { x: 0.5, y: 0.6 };

/** The bed's spot: back right, out of the way of the dock. */
export const BED_POSITION: FloorPoint = { x: 0.78, y: 0.42 };

/** Where the Blobbi lies when it sleeps: on the bed, a little forward so it reads as "in" it. */
export const BED_SLEEP_SPOT: FloorPoint = { x: 0.78, y: 0.5 };

/** The door to the Island: on the back wall, left. */
export const DOOR_POSITION: FloorPoint = { x: 0.16, y: 0.06 };

/** Where the Blobbi stands to go out. */
export const DOOR_APPROACH: FloorPoint = { x: 0.2, y: 0.22 };

/** Where an offered item is set down: front left of the rug, in plain view. */
export const OFFER_SPOT: FloorPoint = { x: 0.36, y: 0.7 };

/** Where the Blobbi stands to use an offered item: just to its right, facing it. */
export const OFFER_APPROACH: FloorPoint = { x: 0.47, y: 0.66 };

export const SCENE_OBJECTS: readonly SceneObjectDef[] = [
  { id: 'door', kind: 'furniture', label: 'Door to Blobbi Island', position: DOOR_POSITION, approach: DOOR_APPROACH, width: 0.16 },
  { id: 'bed', kind: 'furniture', label: 'Bed', position: BED_POSITION, approach: BED_SLEEP_SPOT, width: 0.26 },
];

/**
 * The definition for an item set down in the room. Items are not in the
 * static table: one exists only while it is offered, and its label is the
 * item's own name. Same shape as furniture, so the view and the depth
 * ordering need not know the difference.
 */
export function offeredItemObject(name: string): SceneObjectDef {
  return { id: 'offer', kind: 'item', label: name, position: OFFER_SPOT, approach: OFFER_APPROACH, width: 0.11 };
}

export function sceneObject(id: SceneObjectId): SceneObjectDef {
  const def = SCENE_OBJECTS.find((o) => o.id === id);
  if (!def) throw new Error(`Unknown scene object ${id}`);
  return def;
}
