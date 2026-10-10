/**
 * The session store: each room keeps what was saved to it this session and
 * shows its defaults otherwise; saving one room never touches another; the
 * session is never mutated; and nothing reaches localStorage or a relay.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { ROOM_ORDER } from '@/features/home/rooms/rooms';
import { EMPTY_ROOM_SESSION, saveRoomToSession, sessionFurniture, sessionLayout, useRoomSession } from './room-session';
import { roomFurnitureFor } from './room-furniture';
import { roomLayoutFor } from './room-layout';

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
});
