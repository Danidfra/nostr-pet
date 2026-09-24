import { useCallback, useEffect, useState } from 'react';
import { ROOM_ORDER, neighbourRoom, readStoredRoom, resolveRoom, roomById, roomStorageKey, writeStoredRoom, type RoomDef, type RoomId } from './rooms';

export interface RoomState {
  /** The room the Blobbi is in right now. */
  room: RoomDef;
  /** The player's choice, which a sleeping Blobbi overrides. */
  chosen: RoomId;
  /** Whether the player may change rooms (not while the Blobbi sleeps). */
  canMove: boolean;
  order: readonly RoomId[];
  go: (id: RoomId) => void;
  /** The room in that direction, or null at the end of the line. */
  neighbour: (direction: 'left' | 'right') => RoomId | null;
}

/**
 * Which room the home shows: the player's device-local choice per Blobbi,
 * except that a sleeper is always in the bedroom. Pure UI state; nothing
 * here reads or writes Nostr.
 */
export function useRoom({ pubkey, blobbiD, sleeping, locked = false }: { pubkey: string | undefined; blobbiD: string; sleeping: boolean; locked?: boolean }): RoomState {
  const key = roomStorageKey(pubkey, blobbiD);
  const [chosen, setChosen] = useState<RoomId>(() => readStoredRoom(key));
  useEffect(() => {
    setChosen(readStoredRoom(key));
  }, [key]);

  const go = useCallback(
    (id: RoomId) => {
      setChosen(id);
      writeStoredRoom(key, id);
    },
    [key],
  );

  const current = resolveRoom(chosen, sleeping);
  return {
    room: roomById(current),
    chosen,
    canMove: !sleeping && !locked,
    order: ROOM_ORDER,
    go,
    neighbour: (direction) => neighbourRoom(current, direction),
  };
}
