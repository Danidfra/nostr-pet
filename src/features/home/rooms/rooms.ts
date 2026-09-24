/**
 * The rooms of the home, as data.
 *
 * A room is a backdrop, a set of furniture, where the Blobbi stands when it
 * comes in, and which of the player's consumables the hotbar shows there.
 * It is UI state and nothing else: changing rooms publishes nothing, reads
 * nothing, and never touches the Blobbi's identity or its kind 31124 state.
 * (The Island keeps its own places; Ditto keeps its own rooms. This is the
 * home's furniture, not ecosystem canon.)
 *
 * Rooms are laid out on a line, garden ← living room → bedroom, and moving
 * is a swipe or a chevron; there is no router and no URL. A sleeping Blobbi
 * is always in the bedroom (it is in the bed), so while it sleeps the room
 * is not the player's to choose.
 */
import type { HomeItem } from '@/features/inventory';
import type { FloorPoint } from '../scene/geometry';
import { BED_SLEEP_SPOT, HOME_SPOT, type SceneObjectId } from '../scene/objects';

export type RoomId = 'garden' | 'home' | 'bedroom';

export interface RoomDef {
  id: RoomId;
  label: string;
  /** One line under the name, for the room pill and the journal. */
  tagline: string;
  /** Furniture standing in this room (`SCENE_OBJECTS` ids). */
  objects: readonly SceneObjectId[];
  /** Where the Blobbi stands when it comes in. */
  entry: FloorPoint;
  /** Where a sleeper lies; only the bedroom has one. */
  sleepSpot?: FloorPoint;
  /** Which of the player's usable consumables the hotbar shows here. */
  shows: (item: Pick<HomeItem, 'care'>) => boolean;
  /** What the hotbar says when nothing qualifies. */
  emptyHint: string;
}

const DEFS: Record<RoomId, RoomDef> = {
  garden: {
    id: 'garden',
    label: 'Garden',
    tagline: 'Fresh air, snacks and games',
    objects: [],
    entry: { x: 0.5, y: 0.62 },
    shows: (item) => item.care?.action === 'play' || item.care?.action === 'feed',
    emptyHint: 'Toys and snacks go here.',
  },
  home: {
    id: 'home',
    label: 'Living room',
    tagline: 'Where the day happens',
    objects: ['door'],
    entry: HOME_SPOT,
    shows: () => true,
    emptyHint: 'Nothing to use yet.',
  },
  bedroom: {
    id: 'bedroom',
    label: 'Bedroom',
    tagline: 'Rest and recover',
    objects: ['bed'],
    entry: { x: 0.42, y: 0.62 },
    sleepSpot: BED_SLEEP_SPOT,
    shows: (item) => item.care?.action === 'boost' || item.care?.action === 'medicine',
    emptyHint: 'Medicine and pick-me-ups go here.',
  },
};

/** Left to right. */
export const ROOM_ORDER: readonly RoomId[] = ['garden', 'home', 'bedroom'];

export const DEFAULT_ROOM: RoomId = 'home';

/** The room a sleeper is in, whatever was chosen. */
export const SLEEP_ROOM: RoomId = 'bedroom';

export function isRoomId(value: unknown): value is RoomId {
  return typeof value === 'string' && (ROOM_ORDER as readonly string[]).includes(value);
}

export function roomById(id: RoomId): RoomDef {
  return DEFS[id];
}

/** The room next door, or null at the end of the line (no wrap: the home is a place, not a carousel). */
export function neighbourRoom(id: RoomId, direction: 'left' | 'right'): RoomId | null {
  const index = ROOM_ORDER.indexOf(id);
  const next = ROOM_ORDER[index + (direction === 'right' ? 1 : -1)];
  return next ?? null;
}

/** Where the Blobbi is: the bed while it sleeps, the player's choice otherwise. */
export function resolveRoom(chosen: RoomId, sleeping: boolean): RoomId {
  return sleeping ? SLEEP_ROOM : chosen;
}

/** Where the Blobbi stands on coming into a room. */
export function entrySpot(room: RoomDef, sleeping: boolean): FloorPoint {
  return sleeping ? (room.sleepSpot ?? room.entry) : room.entry;
}

export const ROOM_STORAGE_PREFIX = 'blobbi:home:room:v1:';

export function roomStorageKey(pubkey: string | undefined, blobbiD: string): string {
  return `${ROOM_STORAGE_PREFIX}${pubkey ?? 'anon'}:${blobbiD}`;
}

export function readStoredRoom(key: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): RoomId {
  try {
    const value = storage?.getItem(key);
    return isRoomId(value) ? value : DEFAULT_ROOM;
  } catch {
    return DEFAULT_ROOM;
  }
}

export function writeStoredRoom(key: string, id: RoomId, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(key, id);
  } catch {
    /* the choice still holds for this session */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
