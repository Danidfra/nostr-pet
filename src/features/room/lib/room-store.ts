/**
 * Where a decorated room is kept: this device's storage, per player and per
 * Blobbi, in a versioned format. Milestone 5. Nothing here touches Nostr:
 * Ditto keeps rooms in the kind 11125 profile (`room_furniture_v2`,
 * `room_layouts`), which this app reads opaquely and never writes; syncing
 * rooms there is a later decision.
 *
 *   key      `blobbi:room3d:<pubkey or anon>:<blobbi d>`: one document per
 *            Blobbi, so two Blobbis (or two accounts on one device) never
 *            share or overwrite each other's rooms
 *   document { v: 1, rooms: { <roomId>: { furniture?: Placement[], layout?: Surfaces } } }
 *            only what was SAVED: a room never saved shows its defaults; a
 *            room saved empty stays empty (an empty list is a choice)
 *
 * Reading is defensive and never throws: unparsable JSON, an unknown
 * version, an unknown room, a piece the catalog no longer has (or that no
 * longer belongs in that room), a position off the room, a turn that is
 * not a quarter, a size outside 0.5–2 are each dropped, piece by piece, and the
 * room falls back to its defaults where nothing valid is left. A document
 * written by a NEWER version of the app is read as nothing and never
 * overwritten, so going back to an older build loses nothing.
 *
 * Writing happens on Save only (the decorator's draft lives in memory), as
 * one whole document; a refusal (no storage, quota) is reported, and the
 * session keeps the save in memory for the visit.
 *
 * MIGRATIONS. `MIGRATIONS[n]` turns a version-n document into version n+1;
 * a read walks them up to `ROOM_STORE_VERSION` before validating. A future
 * schema bumps the version and adds the step; nothing else changes.
 */
import { isRoomId, type RoomId } from '@/features/home/rooms/rooms';
import { parseSurface } from '@/features/home/rooms/surfaces';
import { canPlaceInRoom, resolveFurniture } from './furniture-3d';
import { MAX_FURNITURE_PER_ROOM, type FurniturePlacement, type FurnitureRotation } from './room-furniture';
import { ROOM_GRID, WALL_HEIGHT } from './room-geometry';
import type { RoomLayout } from './room-layout';
import { SCALE_STEPS } from './placement-edit';

/** A placement's size, as `FurniturePlacement.scale` documents it and the editor's steps span. */
const MIN_SCALE = SCALE_STEPS[0];
const MAX_SCALE = SCALE_STEPS[SCALE_STEPS.length - 1];
import type { RoomSession } from './room-session';

export const ROOM_STORE_PREFIX = 'blobbi:room3d:';
export const ROOM_STORE_VERSION = 1;

/** One document per player and Blobbi. A signed-out visitor has no Blobbi here, but the key still never collides. */
export function roomStoreKey(pubkey: string | undefined, blobbiD: string): string {
  return `${ROOM_STORE_PREFIX}${pubkey ?? 'anon'}:${blobbiD}`;
}

interface StoredRoom {
  furniture?: FurniturePlacement[];
  layout?: RoomLayout;
}
interface StoredRoomsV1 {
  v: 1;
  rooms: Partial<Record<RoomId, StoredRoom>>;
}

/** Version n → n+1, for each n below the current version. None yet. */
export const MIGRATIONS: Readonly<Record<number, (doc: Record<string, unknown>) => Record<string, unknown>>> = {};

export type LoadStatus = 'empty' | 'loaded' | 'repaired' | 'corrupt' | 'newer' | 'unavailable';

export interface LoadResult {
  session: RoomSession;
  status: LoadStatus;
  /** Pieces or surfaces that were dropped as invalid or obsolete. */
  dropped: number;
}

const EMPTY: RoomSession = { furniture: {}, layouts: {} };

/** Validate one placement for a room, or null to drop it. */
export function parsePlacement(raw: unknown, roomId: RoomId): FurniturePlacement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string') return null;
  const def = resolveFurniture(r.id);
  // Gone from the catalog, or no longer allowed in this room
  if (!def || !canPlaceInRoom(def, roomId)) return null;
  const onWall = def.mount === 'wall';
  if (onWall ? r.at !== 'left' && r.at !== 'right' : r.at !== 'floor') return null;
  if (typeof r.x !== 'number' || typeof r.y !== 'number' || !Number.isFinite(r.x) || !Number.isFinite(r.y)) return null;
  if (r.x < 0 || r.x > ROOM_GRID || r.y < 0 || r.y > (onWall ? WALL_HEIGHT : ROOM_GRID)) return null;
  const placement: FurniturePlacement = { id: r.id, at: r.at as FurniturePlacement['at'], x: r.x, y: r.y };
  if (r.rot !== undefined) {
    if (onWall || typeof r.rot !== 'number' || ![0, 1, 2, 3].includes(r.rot)) return null;
    if (r.rot !== 0) placement.rot = r.rot as FurnitureRotation;
  }
  if (r.scale !== undefined) {
    // The placement's own range (Ditto's defaults use sizes between the editor's steps, 1.4, 1.75…)
    if (typeof r.scale !== 'number' || !Number.isFinite(r.scale) || r.scale < MIN_SCALE || r.scale > MAX_SCALE) return null;
    if (r.scale !== 1) placement.scale = r.scale;
  }
  return placement;
}

/** Validate a room's surfaces, or undefined (both must be valid: a half room is the defaults). */
export function parseLayout(raw: unknown): RoomLayout | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const wall = parseSurface(r.wall, 'wall');
  const floor = parseSurface(r.floor, 'floor');
  return wall && floor ? { wall, floor } : undefined;
}

/** A stored document (any version) as a session, with what had to be dropped. Never throws. */
export function parseStoredRooms(input: unknown): LoadResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { session: EMPTY, status: 'corrupt', dropped: 0 };
  let doc = input as Record<string, unknown>;
  const v = doc.v;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { session: EMPTY, status: 'corrupt', dropped: 0 };
  if (v > ROOM_STORE_VERSION) return { session: EMPTY, status: 'newer', dropped: 0 };
  for (let n = v; n < ROOM_STORE_VERSION; n++) {
    const step = MIGRATIONS[n];
    if (!step) return { session: EMPTY, status: 'corrupt', dropped: 0 };
    doc = step(doc);
  }
  const rooms = doc.rooms;
  if (!rooms || typeof rooms !== 'object' || Array.isArray(rooms)) return { session: EMPTY, status: 'corrupt', dropped: 0 };
  const session: RoomSession = { furniture: {}, layouts: {} };
  let dropped = 0;
  for (const [roomId, raw] of Object.entries(rooms as Record<string, unknown>)) {
    if (!isRoomId(roomId) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      dropped += 1;
      continue;
    }
    const room = raw as Record<string, unknown>;
    if (room.furniture !== undefined) {
      if (Array.isArray(room.furniture)) {
        const valid = room.furniture.map((p) => parsePlacement(p, roomId)).filter((p): p is FurniturePlacement => p !== null);
        dropped += room.furniture.length - valid.length;
        if (valid.length > MAX_FURNITURE_PER_ROOM) dropped += valid.length - MAX_FURNITURE_PER_ROOM;
        // A room whose every piece was dropped shows its defaults, unless it was saved empty on purpose
        if (valid.length > 0 || room.furniture.length === 0) session.furniture[roomId] = valid.slice(0, MAX_FURNITURE_PER_ROOM);
      } else dropped += 1;
    }
    if (room.layout !== undefined) {
      const layout = parseLayout(room.layout);
      if (layout) session.layouts[roomId] = layout;
      else dropped += 1;
    }
  }
  return { session, status: dropped > 0 ? 'repaired' : 'loaded', dropped };
}

/** The session as the current document: only saved rooms, only what was saved. */
export function serializeRooms(session: RoomSession): string {
  const rooms: StoredRoomsV1['rooms'] = {};
  const ids = new Set<RoomId>([...Object.keys(session.furniture), ...Object.keys(session.layouts)].filter(isRoomId));
  for (const id of ids) {
    const room: StoredRoom = {};
    const furniture = session.furniture[id];
    const layout = session.layouts[id];
    if (furniture) room.furniture = furniture.map(({ id: pid, at, x, y, rot, scale }) => ({ id: pid, at, x, y, ...(rot ? { rot } : {}), ...(scale !== undefined && scale !== 1 ? { scale } : {}) }));
    if (layout) room.layout = layout;
    rooms[id] = room;
  }
  const doc: StoredRoomsV1 = { v: ROOM_STORE_VERSION, rooms };
  return JSON.stringify(doc);
}

type Readable = Pick<Storage, 'getItem'>;
type Writable = Pick<Storage, 'getItem' | 'setItem'>;

export function loadRooms(storage: Readable | null, key: string): LoadResult {
  if (!storage) return { session: EMPTY, status: 'unavailable', dropped: 0 };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { session: EMPTY, status: 'unavailable', dropped: 0 };
  }
  if (raw === null) return { session: EMPTY, status: 'empty', dropped: 0 };
  try {
    return parseStoredRooms(JSON.parse(raw));
  } catch {
    return { session: EMPTY, status: 'corrupt', dropped: 0 };
  }
}

export type SaveStatus = 'saved' | 'unavailable' | 'full' | 'newer';

/** Write the whole document; never over one a newer version of the app wrote. */
export function saveRooms(storage: Writable | null, key: string, session: RoomSession): SaveStatus {
  if (!storage) return 'unavailable';
  try {
    const existing = storage.getItem(key);
    if (existing !== null && loadRooms({ getItem: () => existing }, key).status === 'newer') return 'newer';
    storage.setItem(key, serializeRooms(session));
    return 'saved';
  } catch (error) {
    const name = (error as { name?: string })?.name ?? '';
    return /quota/i.test(name) ? 'full' : 'unavailable';
  }
}
