/**
 * Toys the player set down in a room. Ownership is the inventory (a placed
 * toy is drawn only while the verified balance still holds one); placement
 * is presentation, kept on this device per player and Blobbi like the
 * furniture layout. Nothing here reads or writes Nostr.
 */
import { clampToFloor, type FloorPoint } from '../scene/geometry';
import type { RoomId } from './rooms';
import { isRoomId } from './rooms';

export interface PlacedToy {
  /** The item address (`31632:<issuer>:<d>`). */
  address: string;
  /** The inventory it is owned in (`31633:<owner>:<d>`). */
  inventoryAddress: string;
  /** Where it lies, in floor units. */
  x: number;
  y: number;
}

export interface PlacedToys {
  v: 1;
  by_room: Partial<Record<RoomId, PlacedToy[]>>;
}

export const MAX_TOYS_PER_ROOM = 4;
export const TOY_STORAGE_PREFIX = 'blobbi:home:toys:v1:';

export function toyStorageKey(pubkey: string | undefined, blobbiD: string): string {
  return `${TOY_STORAGE_PREFIX}${pubkey ?? 'anon'}:${blobbiD}`;
}

export function toyKey(toy: Pick<PlacedToy, 'address' | 'inventoryAddress'>): string {
  return `${toy.inventoryAddress}|${toy.address}`;
}

function parseToy(raw: unknown): PlacedToy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.address !== 'string' || typeof r.inventoryAddress !== 'string') return undefined;
  if (typeof r.x !== 'number' || typeof r.y !== 'number' || !Number.isFinite(r.x) || !Number.isFinite(r.y)) return undefined;
  const p = clampToFloor({ x: r.x, y: r.y });
  return { address: r.address, inventoryAddress: r.inventoryAddress, x: p.x, y: p.y };
}

export function parsePlacedToys(input: unknown): PlacedToys | undefined {
  let raw: unknown = input;
  if (typeof input === 'string') {
    if (!input.trim()) return undefined;
    try {
      raw = JSON.parse(input);
    } catch {
      return undefined;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !r.by_room || typeof r.by_room !== 'object' || Array.isArray(r.by_room)) return undefined;
  const out: PlacedToys = { v: 1, by_room: {} };
  for (const [key, value] of Object.entries(r.by_room as Record<string, unknown>)) {
    if (!isRoomId(key) || !Array.isArray(value)) continue;
    const toys: PlacedToy[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      if (toys.length >= MAX_TOYS_PER_ROOM) break;
      const toy = parseToy(item);
      if (!toy || seen.has(toyKey(toy))) continue;
      seen.add(toyKey(toy));
      toys.push(toy);
    }
    out.by_room[key] = toys;
  }
  return out;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readPlacedToys(pubkey: string | undefined, blobbiD: string, room: RoomId, storage: StorageLike | null = safeStorage()): PlacedToy[] {
  try {
    return parsePlacedToys(storage?.getItem(toyStorageKey(pubkey, blobbiD)) ?? undefined)?.by_room[room] ?? [];
  } catch {
    return [];
  }
}

export function writePlacedToys(pubkey: string | undefined, blobbiD: string, room: RoomId, toys: readonly PlacedToy[], storage: StorageLike | null = safeStorage()): void {
  let current: PlacedToys | undefined;
  try {
    current = parsePlacedToys(storage?.getItem(toyStorageKey(pubkey, blobbiD)) ?? undefined);
  } catch {
    current = undefined;
  }
  const byRoom = { ...(current?.by_room ?? {}) };
  byRoom[room] = toys.slice(0, MAX_TOYS_PER_ROOM).map((t) => ({ ...t }));
  try {
    storage?.setItem(toyStorageKey(pubkey, blobbiD), JSON.stringify({ v: 1, by_room: byRoom }));
  } catch {
    /* the placement still holds for this session */
  }
}

/** Where a Blobbi stands to play with a toy lying at `at`: just beside it, facing it. */
export function toyApproach(at: FloorPoint): FloorPoint {
  return clampToFloor({ x: at.x + (at.x < 0.5 ? 0.11 : -0.11), y: Math.min(at.y + 0.02, 0.82) });
}
