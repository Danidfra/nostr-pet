/**
 * The room's memory between visits (`room-memory.ts`), for one player and
 * one Blobbi: the last room, where the Blobbi stood in each, and which rooms
 * the player has seen built. Reads once per player and Blobbi; writes only
 * what changed (a room switched, a resting place more than a hair away from
 * the last one), positions gathered for a moment so a series of small moves
 * is one write. Never Nostr; a refusal (no storage) just means not
 * remembered.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RoomId } from '@/features/home/rooms/rooms';
import {
  movedEnough,
  parseNavMemory,
  parseSeenRooms,
  readItem,
  roomIntroKey,
  roomNavKey,
  safeStorage,
  serializeNavMemory,
  serializeSeenRooms,
  writeItem,
  type FloorPoint,
  type MemoryStorage,
  type RoomNavMemory,
} from '../lib/room-memory';

/** How long resting places gather before they are written. */
const WRITE_AFTER_MS = 600;

export interface RoomMemory {
  /** The room the player was last in, if remembered. */
  initialRoom: RoomId | null;
  positionIn: (room: RoomId) => FloorPoint | null;
  rememberRoom: (room: RoomId) => void;
  rememberPosition: (room: RoomId, at: FloorPoint) => void;
  seen: (room: RoomId) => boolean;
  markSeen: (room: RoomId) => void;
}

export function useRoomMemory(pubkey: string | undefined, blobbiD: string, storage: MemoryStorage | null = safeStorage()): RoomMemory {
  const navKey = roomNavKey(pubkey, blobbiD);
  const introKey = roomIntroKey(pubkey, blobbiD);
  const storageRef = useRef(storage);
  storageRef.current = storage;
  // Read once per player and Blobbi
  const loaded = useMemo(
    () => ({ nav: parseNavMemory(readItem(storageRef.current, navKey)), seen: parseSeenRooms(readItem(storageRef.current, introKey)) }),
    [navKey, introKey],
  );
  const nav = useRef<RoomNavMemory>(loaded.nav);
  const seenRooms = useRef<Set<RoomId>>(loaded.seen);
  useEffect(() => {
    nav.current = loaded.nav;
    seenRooms.current = loaded.seen;
  }, [loaded]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    writeItem(storageRef.current, navKey, serializeNavMemory(nav.current));
  }, [navKey]);
  // Written before leaving, so the last resting place is not lost
  useEffect(() => () => {
    if (timer.current) flush();
  }, [flush]);

  const rememberRoom = useCallback(
    (room: RoomId) => {
      if (nav.current.room === room) return;
      nav.current = { ...nav.current, room };
      flush();
    },
    [flush],
  );
  const rememberPosition = useCallback(
    (room: RoomId, at: FloorPoint) => {
      if (!movedEnough(nav.current.at[room], at)) return;
      nav.current = { ...nav.current, at: { ...nav.current.at, [room]: { x: at.x, z: at.z } } };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, WRITE_AFTER_MS);
    },
    [flush],
  );
  const markSeen = useCallback(
    (room: RoomId) => {
      if (seenRooms.current.has(room)) return;
      seenRooms.current = new Set([...seenRooms.current, room]);
      writeItem(storageRef.current, introKey, serializeSeenRooms(seenRooms.current));
    },
    [introKey],
  );

  return useMemo(
    () => ({
      initialRoom: loaded.nav.room,
      positionIn: (room: RoomId) => nav.current.at[room] ?? null,
      rememberRoom,
      rememberPosition,
      seen: (room: RoomId) => seenRooms.current.has(room),
      markSeen,
    }),
    [loaded, rememberRoom, rememberPosition, markSeen],
  );
}
