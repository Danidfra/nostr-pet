/**
 * What the player has decorated THIS SESSION: the furniture and the surfaces
 * of each room, in memory and nowhere else.
 *
 * Ditto saves a room to the Blobbonaut profile (kind 11125). That is the
 * persistence milestone's; until then a saved room lives here, per room,
 * for as long as the page does: switching rooms keeps it, a reload loses
 * it. Nothing here touches Nostr, localStorage or any store, and a test
 * checks it (`room-session.test.ts`). A room never saved shows its
 * defaults (the registry's surfaces, Ditto's default furniture).
 */
import { useCallback, useMemo, useState } from 'react';

import type { RoomId } from '@/features/home/rooms/rooms';
import type { FurniturePlacement } from './room-furniture';
import { roomFurnitureFor } from './room-furniture';
import type { RoomLayout } from './room-layout';
import { roomLayoutFor } from './room-layout';

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
}

/** The session's rooms as React state: lives with the component that mounts it, which is the page. */
export function useRoomSession(initial: RoomSession = EMPTY_ROOM_SESSION): RoomSessionHandle {
  const [session, setSession] = useState<RoomSession>(initial);
  const saveRoom = useCallback((roomId: RoomId, saved: { furniture?: readonly FurniturePlacement[]; layout?: RoomLayout }) => {
    setSession((prev) => saveRoomToSession(prev, roomId, saved));
  }, []);
  return useMemo(
    () => ({ session, furnitureFor: (roomId: RoomId) => sessionFurniture(session, roomId), layoutFor: (roomId: RoomId) => sessionLayout(session, roomId), saveRoom }),
    [session, saveRoom],
  );
}
