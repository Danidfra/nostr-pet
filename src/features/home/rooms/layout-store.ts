/**
 * Where room layouts are kept. One interface, one implementation today:
 * this device's storage, per player and Blobbi. The interface exists so the
 * day a shared representation is adopted (Ditto keeps `room_furniture` in
 * the kind 11125 profile's content), an adapter replaces this file and the
 * editor does not change. Nothing here touches Nostr.
 */
import { parseRoomLayouts, type Placement, type RoomLayouts } from './layout-schema';
import type { RoomId } from './rooms';

export interface LayoutStore {
  read(pubkey: string | undefined, blobbiD: string): RoomLayouts | undefined;
  write(pubkey: string | undefined, blobbiD: string, room: RoomId, placements: readonly Placement[] | null): void;
}

export const LAYOUT_STORAGE_PREFIX = 'blobbi:home:layout:v1:';

export function layoutStorageKey(pubkey: string | undefined, blobbiD: string): string {
  return `${LAYOUT_STORAGE_PREFIX}${pubkey ?? 'anon'}:${blobbiD}`;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Layouts on this device. `null` for a room removes its override (back to the room's defaults). */
export function createLocalLayoutStore(storage: StorageLike | null = safeStorage()): LayoutStore {
  return {
    read(pubkey, blobbiD) {
      try {
        return parseRoomLayouts(storage?.getItem(layoutStorageKey(pubkey, blobbiD)) ?? undefined);
      } catch {
        return undefined;
      }
    },
    write(pubkey, blobbiD, room, placements) {
      const current = this.read(pubkey, blobbiD) ?? { v: 1, by_room: {} };
      const byRoom = { ...current.by_room };
      if (placements === null) delete byRoom[room];
      else byRoom[room] = [...placements];
      try {
        storage?.setItem(layoutStorageKey(pubkey, blobbiD), JSON.stringify({ v: 1, by_room: byRoom }));
      } catch {
        /* the layout still holds for this session */
      }
    },
  };
}

export const localLayoutStore: LayoutStore = createLocalLayoutStore();
