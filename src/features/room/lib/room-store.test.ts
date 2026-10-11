/**
 * The stored rooms: one versioned document per player and Blobbi, read
 * defensively (whatever is invalid or obsolete is dropped, piece by piece,
 * and nothing throws), written whole, never over a newer version's.
 */
import { describe, expect, it, vi } from 'vitest';

import { roomFurnitureFor, MAX_FURNITURE_PER_ROOM, type FurniturePlacement } from './room-furniture';
import { roomLayoutFor } from './room-layout';
import { saveRoomToSession, EMPTY_ROOM_SESSION, type RoomSession } from './room-session';
import { MIGRATIONS, ROOM_STORE_PREFIX, ROOM_STORE_VERSION, loadRooms, parsePlacement, parseStoredRooms, roomStoreKey, saveRooms, serializeRooms } from './room-store';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      data.set(k, v);
    }),
  };
}

const KEY = roomStoreKey('a'.repeat(64), 'pet-1');
const plant: FurniturePlacement = { id: 'official:plant-small', at: 'floor', x: 2.5, y: 6.5 };
const clock: FurniturePlacement = { id: 'official:clock-wall', at: 'left', x: 3, y: 3.5 };

describe('the room store', () => {
  it('keys one document per player and Blobbi, namespaced', () => {
    expect(KEY.startsWith(ROOM_STORE_PREFIX)).toBe(true);
    expect(ROOM_STORE_PREFIX).toBe('blobbi:room3d:');
    expect(roomStoreKey('a'.repeat(64), 'pet-2')).not.toBe(KEY);
    expect(roomStoreKey('b'.repeat(64), 'pet-1')).not.toBe(KEY);
    expect(roomStoreKey(undefined, 'pet-1')).toBe(`${ROOM_STORE_PREFIX}anon:pet-1`);
  });

  it('round-trips what was saved: placements with turns and sizes, surfaces, and a room saved empty', () => {
    let session: RoomSession = EMPTY_ROOM_SESSION;
    session = saveRoomToSession(session, 'home', { furniture: [{ ...plant, rot: 1, scale: 1.5 }, clock], layout: { ...roomLayoutFor('home'), floor: { style: 'wood', palette: ['#aa7744', '#885522'], angle: 90 } } });
    session = saveRoomToSession(session, 'kitchen', { furniture: [] });
    const doc = JSON.parse(serializeRooms(session));
    expect(doc.v).toBe(ROOM_STORE_VERSION);
    expect(Object.keys(doc.rooms).sort()).toEqual(['home', 'kitchen']);
    const back = parseStoredRooms(doc);
    expect(back.status).toBe('loaded');
    expect(back.session).toEqual(session);
    expect(back.session.furniture.kitchen).toEqual([]);
    expect(back.session.layouts.kitchen).toBeUndefined();
  });

  it('stores size 1 and no turn as absent, as the editor does', () => {
    const json = serializeRooms(saveRoomToSession(EMPTY_ROOM_SESSION, 'home', { furniture: [{ ...plant, rot: 0, scale: 1 }] }));
    expect(JSON.parse(json).rooms.home.furniture[0]).toEqual(plant);
  });

  it('drops, piece by piece, what is invalid or obsolete: an unknown piece, one not allowed in the room, off the room, a bad turn or size', () => {
    const bad = [
      { id: 'official:retired-sofa', at: 'floor', x: 2, y: 2 },
      { id: 'network:abc', at: 'floor', x: 2, y: 2 },
      { id: 'official:fridge', at: 'floor', x: 1, y: 1 },
      { ...plant, x: -1 },
      { ...plant, y: 8.5 },
      { ...plant, x: Number.NaN },
      { ...plant, x: '2' },
      { ...plant, at: 'left' },
      { ...clock, y: 6 },
      { ...clock, rot: 1 },
      { ...clock, at: 'floor' },
      { ...plant, rot: 5 },
      { ...plant, rot: 1.5 },
      { ...plant, scale: 3 },
      { ...plant, scale: 0.2 },
      { ...plant, scale: Number.POSITIVE_INFINITY },
      null,
      'plant',
    ];
    for (const p of bad) expect(parsePlacement(p, 'home')).toBeNull();
    const result = parseStoredRooms({ v: 1, rooms: { home: { furniture: [...bad, plant] } } });
    expect(result.status).toBe('repaired');
    expect(result.dropped).toBe(bad.length);
    expect(result.session.furniture.home).toEqual([plant]);
  });

  it('every default room reads back whole: the defaults\' own sizes between the editor\'s steps are valid', () => {
    for (const roomId of ['home', 'kitchen', 'care', 'rest', 'closet'] as const) {
      const furniture = roomFurnitureFor(roomId);
      const back = parseStoredRooms(JSON.parse(serializeRooms(saveRoomToSession(EMPTY_ROOM_SESSION, roomId, { furniture }))));
      expect(back.status, roomId).toBe('loaded');
      expect(back.session.furniture[roomId], roomId).toEqual(furniture.map((p) => JSON.parse(JSON.stringify(p))));
    }
    expect(parsePlacement({ ...plant, scale: 1.4 }, 'home')).toEqual({ ...plant, scale: 1.4 });
  });

  it('a room whose every piece is obsolete shows its defaults; one saved empty stays empty', () => {
    const result = parseStoredRooms({ v: 1, rooms: { home: { furniture: [{ id: 'official:gone', at: 'floor', x: 1, y: 1 }] }, care: { furniture: [] } } });
    expect(result.session.furniture.home).toBeUndefined();
    expect(result.session.furniture.care).toEqual([]);
  });

  it('keeps at most the room\'s maximum, and drops unknown rooms and invalid surfaces', () => {
    const many = Array.from({ length: MAX_FURNITURE_PER_ROOM + 5 }, () => plant);
    const result = parseStoredRooms({ v: 1, rooms: { home: { furniture: many, layout: { wall: { style: 'neon', palette: ['#fff'] }, floor: roomLayoutFor('home').floor } }, attic: { furniture: [] } } });
    expect(result.session.furniture.home).toHaveLength(MAX_FURNITURE_PER_ROOM);
    expect(result.session.layouts.home).toBeUndefined();
    expect(result.dropped).toBe(5 + 1 + 1);
  });

  it('reads anything unreadable as nothing: bad JSON, the wrong shape, no version, a version it never had', () => {
    for (const raw of ['{', '"rooms"', '[]', 'null', '{"rooms":{}}', '{"v":0,"rooms":{}}', '{"v":"1","rooms":{}}', '{"v":1,"rooms":[]}', '{"v":1}']) {
      const result = loadRooms(memory({ [KEY]: raw }), KEY);
      expect(result.status, raw).toBe('corrupt');
      expect(result.session).toEqual(EMPTY_ROOM_SESSION);
    }
    expect(loadRooms(memory(), KEY).status).toBe('empty');
    expect(MIGRATIONS).toEqual({});
  });

  it('a document from a newer version is read as nothing and never overwritten', () => {
    const newer = JSON.stringify({ v: ROOM_STORE_VERSION + 1, rooms: { home: { furniture: [plant], sky: 'blue' } } });
    const store = memory({ [KEY]: newer });
    expect(loadRooms(store, KEY).status).toBe('newer');
    expect(saveRooms(store, KEY, saveRoomToSession(EMPTY_ROOM_SESSION, 'home', { furniture: [] }))).toBe('newer');
    expect(store.data.get(KEY)).toBe(newer);
  });

  it('storage that throws or is full is reported, never thrown', () => {
    const session = saveRoomToSession(EMPTY_ROOM_SESSION, 'home', { furniture: roomFurnitureFor('home') });
    expect(loadRooms({ getItem: () => { throw new Error('SecurityError'); } }, KEY).status).toBe('unavailable');
    expect(loadRooms(null, KEY).status).toBe('unavailable');
    expect(saveRooms(null, KEY, session)).toBe('unavailable');
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(saveRooms(full, KEY, session)).toBe('full');
    const blocked = { getItem: () => null, setItem: () => { throw new Error('denied'); } };
    expect(saveRooms(blocked, KEY, session)).toBe('unavailable');
  });

  it('writes one whole document per save under its own key, touching no other', () => {
    const store = memory({ [roomStoreKey('a'.repeat(64), 'pet-2')]: 'theirs' });
    const session = saveRoomToSession(EMPTY_ROOM_SESSION, 'home', { furniture: [plant] });
    expect(saveRooms(store, KEY, session)).toBe('saved');
    expect(store.setItem).toHaveBeenCalledTimes(1);
    expect(store.data.get(roomStoreKey('a'.repeat(64), 'pet-2'))).toBe('theirs');
    expect(loadRooms(store, KEY).session).toEqual(session);
  });
});
