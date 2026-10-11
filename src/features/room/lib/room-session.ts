/**
 * What the player has decorated: the furniture and the surfaces of each
 * room, as React state, per room. A room never saved shows its defaults
 * (the registry's surfaces, Ditto's default furniture).
 *
 * Given a storage key (milestone 5), the session starts from what this
 * device kept for that player and Blobbi (`room-store.ts`) and each Save is
 * written there as one whole document: it survives switching rooms, a
 * reload and a browser restart. Without a key it is memory only, for as
 * long as the page lives. Only `saveRoom` ever writes, and it is called on
 * the decorator's Save alone; drafts, drags and Cancel never reach it.
 * Nothing here touches Nostr (`room-session.test.ts`, `room-store.test.ts`).
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import type { RoomId } from '@/features/home/rooms/rooms';
import type { FurniturePlacement } from './room-furniture';
import { roomFurnitureFor } from './room-furniture';
import type { RoomLayout } from './room-layout';
import { roomLayoutFor } from './room-layout';
import { loadRooms, saveRooms, type LoadStatus, type SaveStatus } from './room-store';

export interface RoomSession {
  furniture: Partial<Record<RoomId, readonly FurniturePlacement[]>>;
  layouts: Partial<Record<RoomId, RoomLayout>>;
}

export const EMPTY_ROOM_SESSION: RoomSession = { furniture: {}, layouts: {} };

/** The furniture a room shows: what was saved this session, else the defaults. */
export function sessionFurniture(session: RoomSession, roomId: RoomId): readonly FurniturePlacement[] {
  return session.furniture[roomId] ?? roomFurnitureFor(roomId);
}

/** The surfaces a room shows: what was saved this session, else the registry's. */
export function sessionLayout(session: RoomSession, roomId: RoomId): RoomLayout {
  return session.layouts[roomId] ?? roomLayoutFor(roomId);
}

/** A saved room: only what is given changes, and only that room. The session is never mutated. */
export function saveRoomToSession(session: RoomSession, roomId: RoomId, saved: { furniture?: readonly FurniturePlacement[]; layout?: RoomLayout }): RoomSession {
  if (!saved.furniture && !saved.layout) return session;
  return {
    furniture: saved.furniture ? { ...session.furniture, [roomId]: saved.furniture } : session.furniture,
    layouts: saved.layout ? { ...session.layouts, [roomId]: saved.layout } : session.layouts,
  };
}

export interface RoomSessionHandle {
  session: RoomSession;
  furnitureFor: (roomId: RoomId) => readonly FurniturePlacement[];
  layoutFor: (roomId: RoomId) => RoomLayout;
  saveRoom: (roomId: RoomId, saved: { furniture?: readonly FurniturePlacement[]; layout?: RoomLayout }) => void;
  /** How the stored rooms read (null without a storage key), and how the last save went (null before one). */
  persistence: { load: LoadStatus | null; save: SaveStatus | null };
}

export interface RoomSessionOptions {
  /** Where this player's and Blobbi's rooms are kept (`roomStoreKey`); memory only without one. */
  storageKey?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** A starting session, for memory-only use and tests. */
  initial?: RoomSession;
}

/** The rooms as React state: lives with the component that mounts it, which is the page. */
export function useRoomSession({ storageKey, storage = storeOrNull(), initial = EMPTY_ROOM_SESSION }: RoomSessionOptions = {}): RoomSessionHandle {
  const [loaded] = useState(() => (storageKey ? loadRooms(storage, storageKey) : null));
  const [session, setSession] = useState<RoomSession>(() => loaded?.session ?? initial);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const saveRoom = useCallback(
    (roomId: RoomId, saved: { furniture?: readonly FurniturePlacement[]; layout?: RoomLayout }) => {
      const next = saveRoomToSession(sessionRef.current, roomId, saved);
      if (next === sessionRef.current) return;
      sessionRef.current = next;
      setSession(next);
      // One whole document per Save; refused, the save still holds for this visit
      if (storageKey) setSaveStatus(saveRooms(storage, storageKey, next));
    },
    [storage, storageKey],
  );
  const loadStatus = loaded?.status ?? null;
  return useMemo(
    () => ({
      session,
      furnitureFor: (roomId: RoomId) => sessionFurniture(session, roomId),
      layoutFor: (roomId: RoomId) => sessionLayout(session, roomId),
      saveRoom,
      persistence: { load: loadStatus, save: saveStatus },
    }),
    [session, saveRoom, loadStatus, saveStatus],
  );
}

function storeOrNull(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
