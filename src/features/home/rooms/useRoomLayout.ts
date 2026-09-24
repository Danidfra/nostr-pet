import { useCallback, useMemo, useState } from 'react';
import { normalizeRoomPlacements, type Placement } from './layout-schema';
import { localLayoutStore, type LayoutStore } from './layout-store';
import { roomById, type RoomDefinition, type RoomId } from './rooms';

export interface RoomLayoutState {
  /** What stands in the room right now: the saved layout, or the room's defaults, every placement legal. */
  placements: readonly Placement[];
  /** Whether a saved layout overrides the defaults. */
  customized: boolean;
  /** Save a layout for this room (the editor's Apply). */
  save: (placements: readonly Placement[]) => void;
  /** Drop the saved layout: back to the room's defaults. */
  reset: () => void;
}

/** The legal placements of any room, read straight from the store (for a room the player is about to enter). */
export function readRoomPlacements(store: LayoutStore, pubkey: string | undefined, blobbiD: string, roomId: RoomId): Placement[] {
  const room = roomById(roomId);
  return normalizeRoomPlacements(store.read(pubkey, blobbiD)?.by_room[roomId] ?? room.defaultFurniture, roomId);
}

/**
 * The furniture of one room for one Blobbi: read from the layout store,
 * every placement re-validated against the catalog and the room, defaults
 * when nothing is saved. The read is synchronous with the room, so the
 * first render of a room already has its furniture. Device-local; nothing
 * here reads or writes Nostr.
 */
export function useRoomLayout({ pubkey, blobbiD, room, store = localLayoutStore }: { pubkey: string | undefined; blobbiD: string; room: RoomDefinition; store?: LayoutStore }): RoomLayoutState {
  const [version, setVersion] = useState(0);
  const saved = useMemo(() => {
    void version;
    return store.read(pubkey, blobbiD)?.by_room[room.id];
  }, [store, pubkey, blobbiD, room.id, version]);
  const placements = useMemo(() => normalizeRoomPlacements(saved ?? room.defaultFurniture, room.id), [saved, room]);

  const save = useCallback(
    (next: readonly Placement[]) => {
      store.write(pubkey, blobbiD, room.id, normalizeRoomPlacements(next, room.id));
      setVersion((v) => v + 1);
    },
    [store, pubkey, blobbiD, room.id],
  );
  const reset = useCallback(() => {
    store.write(pubkey, blobbiD, room.id, null);
    setVersion((v) => v + 1);
  }, [store, pubkey, blobbiD, room.id]);

  return { placements, customized: saved !== undefined, save, reset };
}
