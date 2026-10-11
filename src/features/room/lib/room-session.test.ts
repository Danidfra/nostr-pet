/**
 * The session store: each room keeps what was saved to it and shows its
 * defaults otherwise; saving one room never touches another; the session is
 * never mutated. Without a storage key nothing reaches localStorage; with
 * one, each Save (and only a Save) writes the player's and Blobbi's
 * document, which the next mount reads back. Never a relay.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { ROOM_ORDER } from '@/features/home/rooms/rooms';
import { EMPTY_ROOM_SESSION, saveRoomToSession, sessionFurniture, sessionLayout, useRoomSession } from './room-session';
import { roomFurnitureFor } from './room-furniture';
import { roomLayoutFor } from './room-layout';
import { roomStoreKey } from './room-store';

afterEach(() => vi.restoreAllMocks());

describe('the room session', () => {
  it('shows every room its defaults until something is saved to it', () => {
    for (const id of ROOM_ORDER) {
      expect(sessionFurniture(EMPTY_ROOM_SESSION, id)).toBe(roomFurnitureFor(id));
      expect(sessionLayout(EMPTY_ROOM_SESSION, id)).toBe(roomLayoutFor(id));
    }
  });

  it('saves one room only, only what is given, without mutating the session', () => {
    const furniture = [{ id: 'official:plant-small', at: 'floor' as const, x: 2, y: 2 }];
    const next = saveRoomToSession(EMPTY_ROOM_SESSION, 'kitchen', { furniture });
    expect(next).not.toBe(EMPTY_ROOM_SESSION);
    expect(EMPTY_ROOM_SESSION.furniture).toEqual({});
    expect(sessionFurniture(next, 'kitchen')).toBe(furniture);
    expect(sessionLayout(next, 'kitchen')).toBe(roomLayoutFor('kitchen'));
    expect(sessionFurniture(next, 'home')).toBe(roomFurnitureFor('home'));
    const layout = { ...roomLayoutFor('home'), wall: { style: 'solid' as const, palette: ['#ffffff'] } };
    const after = saveRoomToSession(next, 'home', { layout });
    expect(sessionLayout(after, 'home')).toBe(layout);
    expect(sessionFurniture(after, 'home')).toBe(roomFurnitureFor('home'));
    expect(sessionFurniture(after, 'kitchen')).toBe(furniture);
    expect(saveRoomToSession(after, 'care', {})).toBe(after);
  });

  it('as a hook: a save is read back per room and survives switching rooms; nothing is written anywhere', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useRoomSession());
    const furniture = [{ id: 'official:rug-round', at: 'floor' as const, x: 3, y: 3 }];
    act(() => result.current.saveRoom('rest', { furniture }));
    expect(result.current.furnitureFor('rest')).toBe(furniture);
    expect(result.current.furnitureFor('home')).toBe(roomFurnitureFor('home'));
    expect(result.current.layoutFor('rest')).toBe(roomLayoutFor('rest'));
    expect(setItem).not.toHaveBeenCalled();
  });

  it('with a storage key: starts from what was kept, writes the whole document on each save only, and a remount (a reload) reads it back', () => {
    const data = new Map<string, string>();
    const storage = { getItem: vi.fn((k: string) => data.get(k) ?? null), setItem: vi.fn((k: string, v: string) => void data.set(k, v)) };
    const key = roomStoreKey('a'.repeat(64), 'pet-1');
    const first = renderHook(() => useRoomSession({ storageKey: key, storage }));
    expect(first.result.current.persistence).toEqual({ load: 'empty', save: null });
    expect(storage.setItem).not.toHaveBeenCalled();
    const furniture = [{ id: 'official:rug-round', at: 'floor' as const, x: 3, y: 3 }];
    act(() => first.result.current.saveRoom('rest', { furniture }));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(first.result.current.persistence.save).toBe('saved');
    // Saving nothing new writes nothing
    act(() => first.result.current.saveRoom('rest', {}));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    first.unmount();
    const again = renderHook(() => useRoomSession({ storageKey: key, storage }));
    expect(again.result.current.persistence.load).toBe('loaded');
    expect(again.result.current.furnitureFor('rest')).toEqual(furniture);
    expect(again.result.current.furnitureFor('home')).toBe(roomFurnitureFor('home'));
    // Another Blobbi of the same player: its own rooms, the defaults
    const other = renderHook(() => useRoomSession({ storageKey: roomStoreKey('a'.repeat(64), 'pet-2'), storage }));
    expect(other.result.current.furnitureFor('rest')).toBe(roomFurnitureFor('rest'));
  });

  it('a save the browser will not keep still holds for the visit, and says so', () => {
    const storage = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    const { result } = renderHook(() => useRoomSession({ storageKey: 'k', storage }));
    const furniture = [{ id: 'official:rug-round', at: 'floor' as const, x: 3, y: 3 }];
    act(() => result.current.saveRoom('rest', { furniture }));
    expect(result.current.furnitureFor('rest')).toBe(furniture);
    expect(result.current.persistence.save).toBe('full');
  });
});
