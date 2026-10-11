/**
 * What the room remembers between visits, on this device only (never on
 * Nostr), per player and per Blobbi:
 *
 *   where it was     `blobbi:room3d:nav:v1:<pubkey or anon>:<blobbi d>`
 *                    { v: 1, room, at: { <roomId>: { x, z } } }: the last
 *                    room the player was in, and where the Blobbi last stood
 *                    in each room (tiles). Written when the room changes and
 *                    when the Blobbi comes to rest somewhere new; never while
 *                    it is mid-walk, mid-transition, away or asleep.
 *   rooms seen       `blobbi:room3d:intro:v<ROOM_INTRO_VERSION>:…`
 *                    { rooms: [...] }: which rooms have been built in front
 *                    of the player once. A room seen before comes back
 *                    quickly instead of folding together again; on a reload
 *                    it is simply there. Bumping ROOM_INTRO_VERSION (a big
 *                    redesign of the rooms) plays every room's introduction
 *                    again once.
 *
 * Reading never throws: unparsable JSON, a newer version, a room that no
 * longer exists, a position that is not a finite point on the floor are
 * each dropped and the defaults stand (the living room, the middle). A
 * position is only ever a wish: the scene stands the Blobbi on the free
 * spot nearest it, clear of the walls and of whatever furniture is there
 * now, so a room redecorated since never traps it.
 */
import { isRoomId, type RoomId } from '@/features/home/rooms/rooms';
import { ROOM_GRID } from './room-geometry';

export const ROOM_NAV_VERSION = 1;
/** Bump to replay every room's first-visit introduction (a major redesign of the rooms). */
export const ROOM_INTRO_VERSION = 1;

export function roomNavKey(pubkey: string | undefined, blobbiD: string): string {
  return `blobbi:room3d:nav:v${ROOM_NAV_VERSION}:${pubkey ?? 'anon'}:${blobbiD}`;
}

/** Whether a storage key is one of the room's memories (where the player was, the rooms seen built). */
export function isRoomMemoryKey(key: string): boolean {
  return key.startsWith('blobbi:room3d:nav:') || key.startsWith('blobbi:room3d:intro:');
}

export function roomIntroKey(pubkey: string | undefined, blobbiD: string): string {
  return `blobbi:room3d:intro:v${ROOM_INTRO_VERSION}:${pubkey ?? 'anon'}:${blobbiD}`;
}

export interface FloorPoint {
  x: number;
  z: number;
}

export interface RoomNavMemory {
  room: RoomId | null;
  at: Partial<Record<RoomId, FloorPoint>>;
}

/** A point on the floor, or null: finite, and within the room (edges included; the scene keeps the body clear of them). */
export function floorPoint(raw: unknown): FloorPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const { x, z } = raw as Record<string, unknown>;
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (x < 0 || x > ROOM_GRID || z < 0 || z > ROOM_GRID) return null;
  return { x, z };
}

export function parseNavMemory(text: string | null): RoomNavMemory {
  const empty: RoomNavMemory = { room: null, at: {} };
  if (!text) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== ROOM_NAV_VERSION) return empty;
  const { room, at } = raw as { room?: unknown; at?: unknown };
  const out: RoomNavMemory = { room: typeof room === 'string' && isRoomId(room) ? room : null, at: {} };
  if (at && typeof at === 'object') {
    for (const [id, point] of Object.entries(at as Record<string, unknown>)) {
      if (!isRoomId(id)) continue;
      const p = floorPoint(point);
      if (p) out.at[id] = p;
    }
  }
  return out;
}

export function serializeNavMemory(memory: RoomNavMemory): string {
  const at: Record<string, FloorPoint> = {};
  for (const [id, p] of Object.entries(memory.at)) if (p) at[id] = { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 };
  return JSON.stringify({ v: ROOM_NAV_VERSION, room: memory.room, at });
}

export function parseSeenRooms(text: string | null): Set<RoomId> {
  if (!text) return new Set();
  try {
    const raw = JSON.parse(text) as { rooms?: unknown };
    return new Set(Array.isArray(raw?.rooms) ? raw.rooms.filter((r): r is RoomId => typeof r === 'string' && isRoomId(r)) : []);
  } catch {
    return new Set();
  }
}

export function serializeSeenRooms(rooms: Iterable<RoomId>): string {
  return JSON.stringify({ rooms: [...new Set(rooms)].sort() });
}

/** Moved far enough to be worth remembering (a hundredth of a tile is noise). */
export function movedEnough(a: FloorPoint | undefined, b: FloorPoint): boolean {
  return !a || Math.hypot(a.x - b.x, a.z - b.z) > 0.05;
}

/** Storage that may be missing or refuse (private mode, quota): every call is guarded, and a refusal just means not remembered. */
export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function safeStorage(): MemoryStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readItem(storage: MemoryStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(storage: MemoryStorage | null, key: string, value: string): boolean {
  try {
    if (!storage) return false;
    if (storage.getItem(key) === value) return true;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
