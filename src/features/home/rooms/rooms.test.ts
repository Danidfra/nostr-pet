import { describe, expect, it } from 'vitest';
import { HOME_SPOT } from '../scene/objects';
import { FLOOR_LINE, clampPlacement } from '../space/room-space';
import { furnitureById, canPlaceInRoom, FURNITURE } from './furniture-registry';
import { normalizePlacement, parseRoomLayouts, placementExtent } from './layout-schema';
import { createLocalLayoutStore } from './layout-store';
import { DEFAULT_ROOM, ROOM_ORDER, SLEEP_ROOM, allRooms, approachSpot, entrySpot, isRoomId, neighbourRoom, readStoredRoom, resolveRoom, roomById, roomShowsItem, roomStorageKey, sleepSpotFor, writeStoredRoom } from './rooms';
import { parseSurface, surfaceBackground } from './surfaces';

describe('the room registry', () => {
  it("is Ditto's set in Ditto's order, and the line wraps", () => {
    expect(ROOM_ORDER).toEqual(['care', 'kitchen', 'home', 'rest', 'closet']);
    expect(DEFAULT_ROOM).toBe('home');
    expect(SLEEP_ROOM).toBe('rest');
    expect(neighbourRoom('home', 'left')).toBe('kitchen');
    expect(neighbourRoom('home', 'right')).toBe('rest');
    expect(neighbourRoom('care', 'left')).toBe('closet');
    expect(neighbourRoom('closet', 'right')).toBe('care');
    expect(isRoomId('garden')).toBe(false);
  });

  it('every room is complete: surfaces, an entry on the floor, legal default furniture that resolves and belongs there', () => {
    for (const room of allRooms()) {
      expect(room.label).toBeTruthy();
      expect(surfaceBackground(room.surfaces.wall)).toBeTruthy();
      expect(surfaceBackground(room.surfaces.floor)).toBeTruthy();
      expect(room.entry.x).toBeGreaterThan(0.1);
      expect(room.entry.y).toBeGreaterThanOrEqual(0.05);
      for (const placement of room.defaultFurniture) {
        const def = furnitureById(placement.id);
        expect(def, `${room.id}: ${placement.id}`).toBeDefined();
        expect(canPlaceInRoom(def!, room.id), `${room.id}: ${placement.id}`).toBe(true);
        expect(def!.allowedLayers).toContain(placement.layer);
        // Already legal: normalizing changes nothing.
        expect(normalizePlacement(placement, room.id)).toEqual(normalizePlacement(normalizePlacement(placement, room.id)!, room.id));
        const legal = clampPlacement(placement, placementExtent(def!, placement));
        expect(legal.x).toBeCloseTo(placement.x, 3);
        expect(legal.y).toBeCloseTo(placement.y, 3);
      }
    }
    expect(roomById('home').entry).toEqual(HOME_SPOT);
    expect(roomById('home').fixtures).toContain('door');
  });

  it('a sleeper is in the bedroom, in front of its bed, whatever was chosen; a room without a bed sleeps at its entry', () => {
    expect(resolveRoom('kitchen', true)).toBe('rest');
    expect(resolveRoom('kitchen', false)).toBe('kitchen');
    const rest = roomById('rest');
    const bed = rest.defaultFurniture.find((p) => furnitureById(p.id)?.use?.kind === 'rest')!;
    expect(bed).toBeDefined();
    expect(sleepSpotFor(rest.defaultFurniture, rest)).toEqual(approachSpot(bed));
    expect(entrySpot(rest, true)).toEqual(approachSpot(bed));
    expect(entrySpot(rest, false)).toEqual(rest.entry);
    expect(sleepSpotFor([], rest)).toEqual(rest.entry);
    // A moved bed moves the spot.
    const moved = { ...bed, x: 0.3, y: 0.9 };
    expect(sleepSpotFor([moved], rest).x).toBeCloseTo(0.3);
    expect(sleepSpotFor([moved], rest).y).toBeGreaterThan(sleepSpotFor([bed], rest).y);
  });

  it('shows items by what they do: toys at home, food in the kitchen, soap and medicine in the care room, nothing in the bedroom', () => {
    const item = (action: 'feed' | 'play' | 'clean' | 'medicine' | 'boost' | null) => ({ care: action ? { action, effects: {}, stages: ['baby' as const] } : null });
    const shown = (id: 'care' | 'kitchen' | 'home' | 'rest' | 'closet') => (['feed', 'play', 'clean', 'medicine', 'boost'] as const).filter((a) => roomShowsItem(roomById(id), item(a)));
    expect(shown('home')).toEqual(['play']);
    expect(shown('kitchen')).toEqual(['feed', 'boost']);
    expect(shown('care')).toEqual(['clean', 'medicine']);
    expect(shown('rest')).toEqual([]);
    expect(shown('closet')).toEqual([]);
    expect(roomShowsItem(roomById('home'), item(null))).toBe(false);
  });

  it('remembers the room per player and Blobbi, and falls back to the living room on junk or a broken storage', () => {
    const key = roomStorageKey('a'.repeat(64), 'blobbi-x');
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readStoredRoom(key, storage)).toBe(DEFAULT_ROOM);
    writeStoredRoom(key, 'kitchen', storage);
    expect(readStoredRoom(key, storage)).toBe('kitchen');
    store.set(key, 'garden');
    expect(readStoredRoom(key, storage)).toBe(DEFAULT_ROOM);
    const broken = { getItem: () => { throw new Error('nope'); }, setItem: () => { throw new Error('nope'); } };
    expect(readStoredRoom(key, broken)).toBe(DEFAULT_ROOM);
    expect(() => writeStoredRoom(key, 'kitchen', broken)).not.toThrow();
  });
});

describe('the furniture catalog', () => {
  it('has unique namespaced ids, a default layer among the allowed ones, and assets that exist', () => {
    const ids = FURNITURE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of FURNITURE) {
      expect(def.id).toMatch(/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/);
      expect(def.allowedLayers).toContain(def.defaultLayer);
      expect(def.baseWidth).toBeGreaterThan(0);
      expect(def.baseWidth).toBeLessThanOrEqual(0.5);
      expect(def.aspectRatio).toBeGreaterThan(0);
      if (def.use) expect(def.allowedLayers).toContain('floor');
    }
    expect(furnitureById('official:bed-single')?.use?.kind).toBe('rest');
    expect(furnitureById('official:rug-round')?.use).toBeUndefined();
  });
});

describe('placements', () => {
  it('normalizes: unknown ids and wrong rooms vanish, wrong layers fall back, scale is bounded, the anchor is clamped with the extent, flip only when allowed', () => {
    expect(normalizePlacement({ id: 'official:nothing', x: 0.5, y: 0.8, layer: 'floor' }, 'home')).toBeUndefined();
    expect(normalizePlacement({ id: 'official:bed-single', x: 0.5, y: 0.8, layer: 'floor' }, 'kitchen')).toBeUndefined();
    const shelf = normalizePlacement({ id: 'official:shelf-wall', x: 0.5, y: 0.9, layer: 'front', scale: 9, flip: true }, 'home')!;
    expect(shelf.layer).toBe('back');
    expect(shelf.scale).toBe(2);
    expect(shelf.y).toBe(FLOOR_LINE);
    expect(shelf.flip).toBeUndefined();
    const rug = normalizePlacement({ id: 'official:rug-round', x: 0, y: 0.1, layer: 'floor', scale: 0.1 }, 'home')!;
    expect(rug.scale).toBe(0.5);
    expect(rug.x).toBeCloseTo((0.32 * 0.5) / 2, 3);
    expect(rug.y).toBe(FLOOR_LINE);
    const bed = normalizePlacement({ id: 'official:bed-single', x: 0.6, y: 0.85, layer: 'floor', flip: true }, 'rest')!;
    expect(bed).toEqual({ id: 'official:bed-single', x: 0.6, y: 0.85, layer: 'floor', flip: true });
  });

  it('parses the v1 shape, drops junk, caps at twenty per room, ignores unknown rooms, never throws', () => {
    expect(parseRoomLayouts('not json')).toBeUndefined();
    expect(parseRoomLayouts('')).toBeUndefined();
    expect(parseRoomLayouts({ v: 2, by_room: {} })).toBeUndefined();
    expect(parseRoomLayouts({ v: 1, by_room: [] })).toBeUndefined();
    const many = Array.from({ length: 25 }, (_, i) => ({ id: 'official:plant-small', x: i / 25, y: 0.8, layer: 'front' }));
    const parsed = parseRoomLayouts({
      v: 1,
      by_room: {
        home: [...many, { id: 'BAD ID', x: 0.5, y: 0.5, layer: 'floor' }, { id: 'official:plant-small', x: 'a', y: 0.5, layer: 'floor' }, null, 'x'],
        garden: [{ id: 'official:plant-small', x: 0.5, y: 0.8, layer: 'front' }],
        rest: [],
      },
    })!;
    expect(parsed.v).toBe(1);
    expect(Object.keys(parsed.by_room)).toEqual(['home', 'rest']);
    expect(parsed.by_room.home).toHaveLength(20);
    expect(parsed.by_room.rest).toEqual([]); // an explicit empty room is a choice, not an absence
    const s = JSON.stringify({ v: 1, by_room: { home: [{ id: 'official:rug-round', x: 0.5, y: 0.9, layer: 'floor', scale: 1.2345 }] } });
    expect(parseRoomLayouts(s)!.by_room.home![0].scale).toBe(1.23);
  });
});

describe('the local layout store', () => {
  it('reads defaults as absence, writes per room, removes an override with null, and survives a broken storage', () => {
    const map = new Map<string, string>();
    const store = createLocalLayoutStore({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) });
    expect(store.read('p', 'd')).toBeUndefined();
    store.write('p', 'd', 'home', [{ id: 'official:rug-round', x: 0.5, y: 0.9, layer: 'floor' }]);
    store.write('p', 'd', 'rest', []);
    expect(store.read('p', 'd')).toEqual({ v: 1, by_room: { home: [{ id: 'official:rug-round', x: 0.5, y: 0.9, layer: 'floor' }], rest: [] } });
    expect(store.read('p', 'other')).toBeUndefined();
    store.write('p', 'd', 'home', null);
    expect(store.read('p', 'd')).toEqual({ v: 1, by_room: { rest: [] } });
    const broken = createLocalLayoutStore({ getItem: () => { throw new Error('nope'); }, setItem: () => { throw new Error('nope'); } });
    expect(broken.read('p', 'd')).toBeUndefined();
    expect(() => broken.write('p', 'd', 'home', [])).not.toThrow();
  });
});

describe('surfaces', () => {
  it('accepts only the schema: known styles, hex colours, known variants, a whole-number angle', () => {
    expect(parseSurface({ style: 'wood', palette: ['#b45309', '#78350f', 'red', 'url(x)'], variant: 'wide', angle: 45.4 }, 'floor')).toEqual({ style: 'wood', palette: ['#b45309', '#78350f'], variant: 'wide', angle: 45 });
    expect(parseSurface({ style: 'wood', palette: ['#fff'] }, 'wall')).toBeUndefined(); // wood is a floor style
    expect(parseSurface({ style: 'solid', palette: ['linear-gradient(red, blue)'] }, 'wall')).toBeUndefined();
    expect(parseSurface({ style: 'solid', palette: ['#fff'], variant: 'huge' }, 'wall')).toEqual({ style: 'solid', palette: ['#fff'] });
    expect(parseSurface(null, 'wall')).toBeUndefined();
  });

  it('generates CSS only from validated values', () => {
    expect(surfaceBackground({ style: 'solid', palette: ['#fff'] })).toBe('#fff');
    expect(surfaceBackground({ style: 'gradient', palette: ['#fef9ef', '#fef3c7'] })).toBe('linear-gradient(180deg, #fef9ef 0%, #fef3c7 100%)');
    expect(surfaceBackground({ style: 'wood', palette: ['#b45309', '#78350f'], variant: 'wide' })).toContain('repeating-linear-gradient(90deg, #b45309 0px, #b45309 22px, #78350f 22px, #78350f 24px)');
    expect(surfaceBackground({ style: 'tile', palette: ['#f0f9ff', '#bae6fd'], angle: 45 })).toContain('45deg');
    expect(surfaceBackground({ style: 'tile', palette: ['#f0f9ff', '#bae6fd'] })).toContain('0deg');
  });
});
