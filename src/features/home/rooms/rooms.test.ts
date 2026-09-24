import { describe, expect, it } from 'vitest';
import { BED_SLEEP_SPOT, HOME_SPOT } from '../scene/objects';
import { DEFAULT_ROOM, ROOM_ORDER, SLEEP_ROOM, entrySpot, isRoomId, neighbourRoom, readStoredRoom, resolveRoom, roomById, roomStorageKey, writeStoredRoom } from './rooms';

describe('rooms', () => {
  it('lie on a line with the living room in the middle and no wrap', () => {
    expect(ROOM_ORDER).toEqual(['garden', 'home', 'bedroom']);
    expect(neighbourRoom('home', 'left')).toBe('garden');
    expect(neighbourRoom('home', 'right')).toBe('bedroom');
    expect(neighbourRoom('garden', 'left')).toBeNull();
    expect(neighbourRoom('bedroom', 'right')).toBeNull();
  });

  it('keep the furniture the rest of the home relies on where it was', () => {
    expect(roomById('home').objects).toContain('door');
    expect(roomById('home').entry).toEqual(HOME_SPOT);
    expect(roomById('bedroom').objects).toContain('bed');
    expect(roomById('bedroom').sleepSpot).toEqual(BED_SLEEP_SPOT);
    expect(roomById('garden').objects).toEqual([]);
  });

  it('a sleeper is in the bedroom, in the bed, whatever was chosen', () => {
    expect(resolveRoom('garden', true)).toBe(SLEEP_ROOM);
    expect(resolveRoom('garden', false)).toBe('garden');
    expect(entrySpot(roomById('bedroom'), true)).toEqual(BED_SLEEP_SPOT);
    expect(entrySpot(roomById('bedroom'), false)).toEqual(roomById('bedroom').entry);
    expect(entrySpot(roomById('garden'), true)).toEqual(roomById('garden').entry);
  });

  it('show consumables by what they do: everything at home, snacks and toys outside, medicine and pick-me-ups in the bedroom', () => {
    const item = (action: 'feed' | 'play' | 'clean' | 'medicine' | 'boost' | null) => ({ care: action ? { action, effects: {}, stages: ['baby' as const] } : null });
    const shown = (id: 'home' | 'garden' | 'bedroom') => (['feed', 'play', 'clean', 'medicine', 'boost'] as const).filter((a) => roomById(id).shows(item(a)));
    expect(shown('home')).toEqual(['feed', 'play', 'clean', 'medicine', 'boost']);
    expect(shown('garden')).toEqual(['feed', 'play']);
    expect(shown('bedroom')).toEqual(['medicine', 'boost']);
    expect(roomById('garden').shows(item(null))).toBe(false);
  });

  it('remember the choice per player and Blobbi, and fall back to the living room on junk or a broken storage', () => {
    const key = roomStorageKey('a'.repeat(64), 'blobbi-x');
    expect(key).toContain('a'.repeat(64));
    expect(key).toContain('blobbi-x');
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readStoredRoom(key, storage)).toBe(DEFAULT_ROOM);
    writeStoredRoom(key, 'garden', storage);
    expect(readStoredRoom(key, storage)).toBe('garden');
    store.set(key, 'attic');
    expect(readStoredRoom(key, storage)).toBe(DEFAULT_ROOM);
    const broken = {
      getItem: () => {
        throw new Error('nope');
      },
      setItem: () => {
        throw new Error('nope');
      },
    };
    expect(readStoredRoom(key, broken)).toBe(DEFAULT_ROOM);
    expect(() => writeStoredRoom(key, 'garden', broken)).not.toThrow();
    expect(isRoomId('garden')).toBe(true);
    expect(isRoomId('attic')).toBe(false);
  });
});
