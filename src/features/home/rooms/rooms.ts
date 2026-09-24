/**
 * The room registry: every room of the home, as data.
 *
 * The set and the order are Ditto's Blobbi rooms (care, kitchen, home, rest,
 * closet; navigation wraps around), so the home is recognisably the same
 * place a player knows from there. What a room is made of lives here and
 * nowhere else: its surfaces (Ditto's schema), the decor painted on its
 * wall, the furniture it starts with (editable, `layout-schema.ts`), where
 * the Blobbi comes in, which activities belong here (what the hotbar shows),
 * and one line of copy. Components read the definition; none of them
 * branches on a room id.
 *
 * Rooms are UI state. Changing rooms publishes nothing, reads nothing, and
 * never touches the Blobbi's identity or its kind 31124 state. A sleeping
 * Blobbi is always in the bedroom, in its bed.
 */
import type { HomeItem } from '@/features/inventory';
import type { FloorPoint } from '../scene/geometry';
import { floorFromRoom } from '../space/room-space';
import { furnitureById } from './furniture-registry';
import type { Placement } from './layout-schema';
import type { RoomSurfaces } from './surfaces';

export type RoomId = 'care' | 'kitchen' | 'home' | 'rest' | 'closet';

/** What a player does in a room; the hotbar shows the items that do it. */
export type RoomActivity = 'feed' | 'play' | 'clean' | 'medicine' | 'boost' | 'rest' | 'dress';

/** Decor painted on the wall by the backdrop (not furniture: fixed, not editable). */
export type RoomDecor = 'window' | 'window-small' | 'lamp-glow' | 'tiles-band' | 'wardrobe';

/** A fixture: a scene object with a role that is not furniture (the door out). */
export type RoomFixture = 'door';

export interface RoomDefinition {
  id: RoomId;
  label: string;
  description: string;
  surfaces: RoomSurfaces;
  decor: readonly RoomDecor[];
  fixtures: readonly RoomFixture[];
  /** The furniture a fresh room has; a saved layout replaces it whole. */
  defaultFurniture: readonly Placement[];
  /** Where the Blobbi stands on coming in (floor units). */
  entry: FloorPoint;
  activities: readonly RoomActivity[];
  /** What the hotbar says when nothing qualifies. */
  emptyHint: string;
}

const CARE_ITEMS = (item: Pick<HomeItem, 'care'>) => item.care?.action;

const DEFS: Record<RoomId, RoomDefinition> = {
  care: {
    id: 'care',
    label: 'Care room',
    description: 'Hygiene, care and medicine',
    surfaces: { wall: { style: 'solid', palette: ['#f0f9ff', '#e0f2fe'] }, floor: { style: 'tile', palette: ['#f0f9ff', '#bae6fd'], angle: 45 } },
    decor: ['tiles-band', 'window-small'],
    fixtures: [],
    defaultFurniture: [{ id: 'official:plant-small', x: 0.1, y: 0.72, layer: 'front', scale: 0.8 }],
    entry: { x: 0.5, y: 0.6 },
    activities: ['clean', 'medicine'],
    emptyHint: 'Soap and medicine go here.',
  },
  kitchen: {
    id: 'kitchen',
    label: 'Kitchen',
    description: 'Feed your Blobbi',
    surfaces: { wall: { style: 'solid', palette: ['#fafaf9', '#f5f5f4'] }, floor: { style: 'tile', palette: ['#f5f5f4', '#d6d3d1'] } },
    decor: ['window-small'],
    fixtures: [],
    defaultFurniture: [
      { id: 'official:plant-small', x: 0.85, y: 0.72, layer: 'front', scale: 0.9 },
      { id: 'official:clock-wall', x: 0.5, y: 0.18, layer: 'back' },
      { id: 'official:shelf-floating', x: 0.22, y: 0.3, layer: 'back' },
    ],
    entry: { x: 0.5, y: 0.6 },
    activities: ['feed', 'boost'],
    emptyHint: 'Food and drinks go here.',
  },
  home: {
    id: 'home',
    label: 'Living room',
    description: 'Where the day happens',
    surfaces: { wall: { style: 'gradient', palette: ['#fef9ef', '#fef3c7'] }, floor: { style: 'wood', palette: ['#b45309', '#78350f'], variant: 'wide' } },
    decor: ['window'],
    fixtures: ['door'],
    defaultFurniture: [
      { id: 'official:rug-round', x: 0.5, y: 0.88, layer: 'floor' },
      { id: 'official:plant-tall', x: 0.88, y: 0.72, layer: 'front' },
      { id: 'official:lamp-floor', x: 0.3, y: 0.74, layer: 'front' },
      { id: 'official:shelf-wall', x: 0.3, y: 0.3, layer: 'back' },
    ],
    entry: { x: 0.5, y: 0.6 },
    activities: ['play'],
    emptyHint: 'Toys go here.',
  },
  rest: {
    id: 'rest',
    label: 'Bedroom',
    description: 'Rest and recharge',
    surfaces: { wall: { style: 'gradient', palette: ['#faf5ff', '#ede9fe'] }, floor: { style: 'carpet', palette: ['#a78bfa', '#8b5cf6'], variant: 'soft' } },
    decor: ['window-small', 'lamp-glow'],
    fixtures: [],
    defaultFurniture: [
      { id: 'official:bed-single', x: 0.68, y: 0.84, layer: 'floor' },
      { id: 'official:lamp-floor', x: 0.9, y: 0.72, layer: 'front', scale: 0.9 },
      { id: 'official:table-side', x: 0.88, y: 0.8, layer: 'floor', scale: 0.8 },
    ],
    entry: { x: 0.35, y: 0.6 },
    activities: ['rest'],
    emptyHint: 'Nothing to use in here. Tap the bed to rest.',
  },
  closet: {
    id: 'closet',
    label: 'Closet',
    description: 'Wardrobe and accessories',
    surfaces: { wall: { style: 'solid', palette: ['#faf5f0', '#f0e8df'] }, floor: { style: 'wood', palette: ['#78350f', '#451a03'], variant: 'narrow' } },
    decor: ['wardrobe'],
    fixtures: [],
    defaultFurniture: [
      { id: 'official:plant-small', x: 0.88, y: 0.72, layer: 'front', scale: 0.9 },
      { id: 'official:rug-runner', x: 0.5, y: 0.9, layer: 'floor' },
    ],
    entry: { x: 0.5, y: 0.6 },
    activities: ['dress'],
    emptyHint: 'What your Blobbi wears is equipped on the Island.',
  },
};

/** Ditto's order, wrapping: care ↔ kitchen ↔ home ↔ rest ↔ closet ↔ care. */
export const ROOM_ORDER: readonly RoomId[] = ['care', 'kitchen', 'home', 'rest', 'closet'];

export const DEFAULT_ROOM: RoomId = 'home';

/** The room a sleeper is in, whatever was chosen. */
export const SLEEP_ROOM: RoomId = 'rest';

export function isRoomId(value: unknown): value is RoomId {
  return typeof value === 'string' && (ROOM_ORDER as readonly string[]).includes(value);
}

export function roomById(id: RoomId): RoomDefinition {
  return DEFS[id];
}

export function allRooms(): readonly RoomDefinition[] {
  return ROOM_ORDER.map((id) => DEFS[id]);
}

/** The room next door; the line is a loop. */
export function neighbourRoom(id: RoomId, direction: 'left' | 'right'): RoomId {
  const index = ROOM_ORDER.indexOf(id);
  const n = ROOM_ORDER.length;
  return ROOM_ORDER[(index + (direction === 'right' ? 1 : n - 1)) % n];
}

/** Where the Blobbi is: the bed while it sleeps, the player's choice otherwise. */
export function resolveRoom(chosen: RoomId, sleeping: boolean): RoomId {
  return sleeping ? SLEEP_ROOM : chosen;
}

/** Whether an item belongs to a room's activities (the hotbar filter). */
export function roomShowsItem(room: RoomDefinition, item: Pick<HomeItem, 'care'>): boolean {
  const action = CARE_ITEMS(item);
  return action !== undefined && (room.activities as readonly string[]).includes(action);
}

/**
 * Where a Blobbi lies to sleep in a room: in front of the first piece of
 * furniture one can rest on, or at the entry when there is none. Derived
 * from the layout every time, so a moved bed moves the sleeping spot.
 */
export function sleepSpotFor(placements: readonly Placement[], room: RoomDefinition): FloorPoint {
  const bed = placements.find((p) => furnitureById(p.id)?.use?.kind === 'rest');
  if (!bed) return room.entry;
  return approachSpot(bed);
}

/** Where a Blobbi stands to use a placed piece of furniture (floor units, clamped to the floor). */
export function approachSpot(placement: Placement): FloorPoint {
  const def = furnitureById(placement.id);
  const feet = floorFromRoom({ x: placement.x, y: placement.y });
  const dx = def?.use?.approach.dx ?? 0;
  const dy = def?.use?.approach.dy ?? 0.1;
  return { x: Math.min(0.9, Math.max(0.1, feet.x + dx)), y: Math.min(0.82, Math.max(0.05, feet.y + dy)) };
}

/** Where the Blobbi stands on coming into a room. */
export function entrySpot(room: RoomDefinition, sleeping: boolean, placements: readonly Placement[] = room.defaultFurniture): FloorPoint {
  return sleeping ? sleepSpotFor(placements, room) : room.entry;
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
