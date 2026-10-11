/**
 * What the room remembers: per player and per Blobbi, versioned, only
 * points on the floor and rooms that exist, nothing from a newer version or
 * a broken document, and the intro's own versioned key; written only when
 * something changed, never to Nostr.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { floorPoint, isRoomMemoryKey, movedEnough, parseNavMemory, parseSeenRooms, roomIntroKey, roomNavKey, serializeNavMemory, serializeSeenRooms, ROOM_INTRO_VERSION, type MemoryStorage } from './room-memory';
import { useRoomMemory } from '../hooks/useRoomMemory';

function memoryStorage(): MemoryStorage & { data: Map<string, string>; writes: string[] } {
  const data = new Map<string, string>();
  const writes: string[] = [];
  return { data, writes, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { writes.push(k); data.set(k, v); } };
}

describe('the room memory documents', () => {
  it('are scoped to the player and the Blobbi, and the intro\'s key carries its version', () => {
    expect(roomNavKey('pk', 'd1')).not.toBe(roomNavKey('pk', 'd2'));
    expect(roomNavKey('pk', 'd1')).not.toBe(roomNavKey('pk2', 'd1'));
    expect(roomNavKey(undefined, 'd1')).toContain(':anon:');
    expect(roomIntroKey('pk', 'd1')).toContain(`:intro:v${ROOM_INTRO_VERSION}:`);
    expect(isRoomMemoryKey(roomNavKey('pk', 'd1'))).toBe(true);
    expect(isRoomMemoryKey('blobbi:room3d:pk:d1')).toBe(false);
  });

  it('read back what was written, and only what is valid: rooms that exist, points on the floor', () => {
    const doc = serializeNavMemory({ room: 'kitchen', at: { kitchen: { x: 2.345, z: 6 }, home: { x: 4, z: 4 } } });
    expect(parseNavMemory(doc)).toEqual({ room: 'kitchen', at: { kitchen: { x: 2.35, z: 6 }, home: { x: 4, z: 4 } } });
    const messy = JSON.stringify({ v: 1, room: 'attic', at: { kitchen: { x: 'a', z: 1 }, home: { x: -2, z: 3 }, rest: { x: 1, z: 99 }, care: { x: 1, z: 1 }, attic: { x: 1, z: 1 } } });
    expect(parseNavMemory(messy)).toEqual({ room: null, at: { care: { x: 1, z: 1 } } });
    expect(floorPoint({ x: Infinity, z: 1 })).toBeNull();
    expect(floorPoint(null)).toBeNull();
  });

  it('a broken document or one from a newer version is read as nothing (the defaults stand)', () => {
    for (const text of ['{', 'null', '[]', JSON.stringify({ v: 2, room: 'kitchen', at: {} }), JSON.stringify({ room: 'kitchen' })]) {
      expect(parseNavMemory(text)).toEqual({ room: null, at: {} });
    }
    expect([...parseSeenRooms('{oops')]).toEqual([]);
    expect([...parseSeenRooms(serializeSeenRooms(['kitchen', 'home', 'kitchen']))].sort()).toEqual(['home', 'kitchen']);
    expect([...parseSeenRooms(JSON.stringify({ rooms: ['home', 'attic', 3] }))]).toEqual(['home']);
  });

  it('only a move of more than a hair is worth remembering', () => {
    expect(movedEnough(undefined, { x: 1, z: 1 })).toBe(true);
    expect(movedEnough({ x: 1, z: 1 }, { x: 1.02, z: 1.01 })).toBe(false);
    expect(movedEnough({ x: 1, z: 1 }, { x: 1.5, z: 1 })).toBe(true);
  });
});

describe('useRoomMemory', () => {
  it('remembers the room at once, resting places after a moment and only when moved, and the rooms seen', () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const { result, unmount } = renderHook(() => useRoomMemory('pk', 'd1', storage));
    expect(result.current.initialRoom).toBeNull();
    act(() => result.current.rememberRoom('kitchen'));
    expect(storage.writes).toEqual([roomNavKey('pk', 'd1')]);
    act(() => result.current.rememberRoom('kitchen'));
    expect(storage.writes).toHaveLength(1);
    act(() => {
      result.current.rememberPosition('kitchen', { x: 2, z: 3 });
      result.current.rememberPosition('kitchen', { x: 2.5, z: 3 });
      result.current.rememberPosition('kitchen', { x: 2.51, z: 3 });
    });
    expect(storage.writes).toHaveLength(1);
    act(() => vi.advanceTimersByTime(700));
    expect(storage.writes).toHaveLength(2);
    expect(result.current.positionIn('kitchen')).toEqual({ x: 2.5, z: 3 });
    expect(result.current.seen('kitchen')).toBe(false);
    act(() => result.current.markSeen('kitchen'));
    act(() => result.current.markSeen('kitchen'));
    expect(storage.writes.filter((k) => k === roomIntroKey('pk', 'd1'))).toHaveLength(1);
    unmount();
    // Back again: the same player and Blobbi find it all; another Blobbi finds nothing
    const again = renderHook(() => useRoomMemory('pk', 'd1', storage)).result.current;
    expect(again.initialRoom).toBe('kitchen');
    expect(again.positionIn('kitchen')).toEqual({ x: 2.5, z: 3 });
    expect(again.seen('kitchen')).toBe(true);
    const other = renderHook(() => useRoomMemory('pk', 'd2', storage)).result.current;
    expect(other.initialRoom).toBeNull();
    expect(other.seen('kitchen')).toBe(false);
    vi.useRealTimers();
  });

  it('storage that refuses only means not remembered: nothing throws', () => {
    const broken: MemoryStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    const { result } = renderHook(() => useRoomMemory('pk', 'd1', broken));
    expect(() => act(() => {
      result.current.rememberRoom('care');
      result.current.markSeen('care');
    })).not.toThrow();
    expect(result.current.initialRoom).toBeNull();
  });
});
