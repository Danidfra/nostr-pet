/**
 * Care in the 3D room, as pure decisions: which items a room offers, and
 * what a drop or a Use means. No React, no Nostr; `useRoomCare` acts on
 * these through the home's own write paths.
 *
 * THE BOUNDARY. What an item is, whether this Blobbi may use it, how much
 * of it the player owns and what using it writes all belong to the
 * inventory feature and are not restated here:
 *
 *  - a STARTER (`StarterEntry`) is the official catalog, free and
 *    unlimited, never owned: using one is the care write alone
 *    (`useStarterUse`: kind 31124, then the 1124 receipt);
 *  - an OWNED item (`HomeInventoryItem`) is a balance in another game's
 *    inventory: using one spends exactly one (`useUseItem`: kind 1416, then
 *    31124 with `blobbi_op`, then the 1124 receipt), with its ledger,
 *    resume and ambiguity rules;
 *  - which items belong in which room is the registry's (`roomShowsItem`,
 *    the M8 hotbar's filter over `room.activities`).
 *
 * Ditto's room shows its whole shop catalog as free, reusable abilities
 * with no quantity; that is NOT this app's economy and is not copied: an
 * owned item here shows its real balance and is spent on use.
 */
import { isHandFed, ownedEntry, starterEntry, type CareEntry } from '@/features/care-ui/care-entries';
import { roomById, roomShowsItem, type RoomActivity, type RoomId } from '@/features/home/rooms/rooms';
import type { HomeInventory, HomeItem, ItemAction } from '@/features/inventory';
import { ROOM_GRID } from './room-geometry';

/** One item a room offers (the carousel's model, shared with the classic home). */
export type RoomCareEntry = CareEntry;

/** Which activities a strip shows: a room's own, or what a piece of furniture opens (the toy box anywhere). */
export type CareShelf = { kind: 'room'; roomId: RoomId } | { kind: 'furniture'; label: string; activities: readonly RoomActivity[] };

export function shelfActivities(shelf: CareShelf): readonly RoomActivity[] {
  return shelf.kind === 'room' ? roomById(shelf.roomId).activities : shelf.activities;
}

/** A stable key for a shelf, so a selection is remembered per room and per piece of furniture. */
export function shelfKey(shelf: CareShelf): string {
  return shelf.kind === 'room' ? `room:${shelf.roomId}` : `furniture:${shelf.activities.join('+')}`;
}

/** The registry's own rule (`roomShowsItem`), over a shelf's activities. */
function shows(activities: readonly RoomActivity[], item: Pick<HomeItem, 'care'>): boolean {
  return roomShowsItem({ ...roomById('home'), activities }, item);
}

/**
 * What a shelf offers: the starter kit's items that answer its activities,
 * then the player's owned items that do, each with whether it can be used
 * now. An owned item the relays could not verify, or with none left, is
 * shown but cannot be used; one that is not a care item never shows.
 */
export function shelfEntries(shelf: CareShelf, inventory: Pick<HomeInventory, 'starters' | 'items'>): RoomCareEntry[] {
  const activities = shelfActivities(shelf);
  const starters = inventory.starters
    .filter((s) => shows(activities, s.item))
    .map((entry) => starterEntry(entry));
  const owned = inventory.items
    .filter((i) => shows(activities, i.item) && i.quantity > 0)
    .map((entry) => ownedEntry(entry))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...starters, ...owned];
}

/** Food and drink are eaten (bite by bite, once their use has landed); everything else is used in place. */
export { isHandFed as isEaten, isHandFed };

/** Where a drop lands, from what the room reports under the point. */
export type DropPlace = { kind: 'blobbi' } | { kind: 'floor'; x: number; z: number } | { kind: 'nowhere' };

/**
 * What letting an item go somewhere means: anything let go on the Blobbi is
 * set down at its feet (food on a dish in front of it, a toy beside it);
 * anything on the floor is set down there, for it to walk to. Off the floor
 * (a wall, the chrome): nothing, the item goes back. Every item is a thing in
 * the room the Blobbi comes to; nothing is handed over in mid-air.
 */
export type DropPlan = { kind: 'set-down'; x: number; z: number } | { kind: 'cancel' };

export function planDrop(_action: ItemAction, place: DropPlace, blobbiAt: { x: number; z: number } | null): DropPlan {
  if (place.kind === 'nowhere') return { kind: 'cancel' };
  if (place.kind === 'blobbi') return { kind: 'set-down', ...setDownNear(blobbiAt ?? MIDDLE) };
  return { kind: 'set-down', x: clampFloor(place.x), z: clampFloor(place.z) };
}

/** The explicit Use (no drag): set down just in front of the Blobbi, toward the viewer (in front of the middle when nobody knows where it stands). */
export function planUse(_action: ItemAction, blobbiAt: { x: number; z: number } | null): DropPlan {
  return { kind: 'set-down', ...setDownNear(blobbiAt ?? MIDDLE) };
}

/** The middle of the floor, where an item goes when the Blobbi's place is unknown (the simple room). */
const MIDDLE = { x: ROOM_GRID / 2 - 0.5, z: ROOM_GRID / 2 - 0.5 } as const;

/** How far in front of the Blobbi (tiles, toward the open corner) a used item is set down. */
export const SET_DOWN_OFFSET = 1.1;
/** How close to a wall an item may lie (tiles). */
const FLOOR_MARGIN = 0.6;

function clampFloor(v: number): number {
  return Math.min(ROOM_GRID - FLOOR_MARGIN, Math.max(FLOOR_MARGIN, v));
}

/** A spot just in front of the Blobbi, toward the camera's corner, inside the room. */
export function setDownNear(at: { x: number; z: number }): { x: number; z: number } {
  const d = SET_DOWN_OFFSET / Math.SQRT2;
  const x = at.x + d;
  const z = at.z + d;
  // Against the open edge, set it down on the side instead
  if (x > ROOM_GRID - FLOOR_MARGIN || z > ROOM_GRID - FLOOR_MARGIN) return { x: clampFloor(at.x - d), z: clampFloor(at.z + d) };
  return { x: clampFloor(x), z: clampFloor(z) };
}
