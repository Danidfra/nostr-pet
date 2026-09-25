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

export type SceneObjectId = 'door' | 'offer' | 'toy';

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
  /** Stands on the wall at the floor line: no depth scaling, drawn behind everything on the floor. */
  wall?: boolean;
  /** A test id when several objects share an id (toys). */
  testId?: string;
}

/** Where a Blobbi stands when it arrives home (awake). */
export const HOME_SPOT: FloorPoint = { x: 0.5, y: 0.6 };

/**
 * The door to the Island: on the back wall, left. `y: 0` is the floor line
 * (the top of the floor band), so its bottom edge rests exactly where the
 * wall meets the floor at every viewport; the canonical space decides.
 */
export const DOOR_POSITION: FloorPoint = { x: 0.17, y: 0 };

/** Where the Blobbi stands to go out: just in front of the door. */
export const DOOR_APPROACH: FloorPoint = { x: 0.22, y: 0.18 };

/** Where an offered item is set down: front left of the rug, in plain view. */
export const OFFER_SPOT: FloorPoint = { x: 0.36, y: 0.7 };

/** Where the Blobbi stands to use an offered item: just to its right, facing it. */
export const OFFER_APPROACH: FloorPoint = { x: 0.47, y: 0.66 };

export const SCENE_OBJECTS: readonly SceneObjectDef[] = [
  { id: 'door', kind: 'furniture', label: 'Door to Blobbi Island', position: DOOR_POSITION, approach: DOOR_APPROACH, width: 0.26, wall: true },
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

/** An item lying at a spot of the player's choosing (a toy set down); the Blobbi stands beside it. */
export function itemObjectAt(id: SceneObjectId, name: string, position: FloorPoint, approach: FloorPoint, testId?: string): SceneObjectDef {
  return { id, kind: 'item', label: name, position, approach, width: 0.11, testId };
}

export function sceneObject(id: SceneObjectId): SceneObjectDef {
  const def = SCENE_OBJECTS.find((o) => o.id === id);
  if (!def) throw new Error(`Unknown scene object ${id}`);
  return def;
}
