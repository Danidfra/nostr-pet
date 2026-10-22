/**
 * The Worlds door's rules: locked for a guest and through a save, open for a
 * confirmed save or an account of one's own; the word once, only for a save
 * seen confirmed on this visit.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  WORLDS_GUIDE_STORAGE_PREFIX,
  markWorldsGuideShown,
  noteWorldsAccess,
  readWorldsGuideShown,
  resetWorldsAccessSeen,
  unlockedBySave,
  worldsAccess,
  worldsGuideDue,
} from './worlds-access';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } };
}

beforeEach(() => {
  resetWorldsAccessSeen();
  window.localStorage.clear();
});

describe('worldsAccess', () => {
  it('locks a guest, and a save at every stage until the relays confirmed it', () => {
    expect(worldsAccess('active', null)).toBe('guest');
    // A guest who began saving but has not signed in yet is still a guest
    expect(worldsAccess('active', 'key')).toBe('guest');
    for (const stage of [null, 'key', 'profile', 'publishing', 'verifying'] as const) expect(worldsAccess('promoting', stage), String(stage)).toBe('saving');
    expect(worldsAccess('promoting', 'done')).toBe('open');
  });

  it('opens for an account of one\'s own: no guest record, or a guest record kept apart from another account', () => {
    expect(worldsAccess('none', null)).toBe('open');
    expect(worldsAccess('dormant', null)).toBe('open');
    expect(worldsAccess('dormant', 'publishing')).toBe('open');
  });
});

describe('unlockedBySave', () => {
  it('is a locked door opening for the same key', () => {
    expect(unlockedBySave({ access: 'saving', pubkey: A }, { access: 'open', pubkey: A })).toBe(true);
    expect(unlockedBySave({ access: 'guest', pubkey: A }, { access: 'open', pubkey: A })).toBe(true);
  });

  it('is not a door found open, another account, or a door still locked', () => {
    expect(unlockedBySave(null, { access: 'open', pubkey: A })).toBe(false);
    expect(unlockedBySave({ access: 'open', pubkey: A }, { access: 'open', pubkey: A })).toBe(false);
    expect(unlockedBySave({ access: 'guest', pubkey: A }, { access: 'open', pubkey: B })).toBe(false);
    expect(unlockedBySave({ access: 'guest', pubkey: A }, { access: 'saving', pubkey: A })).toBe(false);
    expect(unlockedBySave({ access: 'saving', pubkey: A }, { access: 'open', pubkey: undefined })).toBe(false);
  });
});

describe('the word, once', () => {
  it('is due after a save seen confirmed, and never again once shown, for that account only', () => {
    const storage = memoryStorage();
    noteWorldsAccess({ access: 'guest', pubkey: A }, storage);
    noteWorldsAccess({ access: 'saving', pubkey: A }, storage);
    expect(worldsGuideDue()).toBeNull();
    noteWorldsAccess({ access: 'open', pubkey: A }, storage);
    expect(worldsGuideDue()).toBe(A);
    markWorldsGuideShown(A, storage);
    expect(worldsGuideDue()).toBeNull();
    expect(readWorldsGuideShown(A, storage)).toBe(true);
    expect(storage.getItem(WORLDS_GUIDE_STORAGE_PREFIX + A)).toBe('shown');
    expect(readWorldsGuideShown(B, storage)).toBe(false);
    // The same moment again (another visit, a resumed save): shown before, so not due
    resetWorldsAccessSeen();
    noteWorldsAccess({ access: 'saving', pubkey: A }, storage);
    noteWorldsAccess({ access: 'open', pubkey: A }, storage);
    expect(worldsGuideDue()).toBeNull();
  });

  it('is not due for a door open from the start of the visit (an account restored at load)', () => {
    noteWorldsAccess({ access: 'open', pubkey: A });
    noteWorldsAccess({ access: 'open', pubkey: A });
    expect(worldsGuideDue()).toBeNull();
  });

  it('is not due when a guest signs in to another account, and a word due is dropped when the account changes', () => {
    noteWorldsAccess({ access: 'guest', pubkey: A });
    noteWorldsAccess({ access: 'open', pubkey: B });
    expect(worldsGuideDue()).toBeNull();
    resetWorldsAccessSeen();
    noteWorldsAccess({ access: 'saving', pubkey: A });
    noteWorldsAccess({ access: 'open', pubkey: A });
    expect(worldsGuideDue()).toBe(A);
    noteWorldsAccess({ access: 'open', pubkey: B });
    expect(worldsGuideDue()).toBeNull();
  });

  it('a browser that keeps nothing still works: the word may come once more, nothing throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(readWorldsGuideShown(A, broken)).toBe(false);
    expect(() => markWorldsGuideShown(A, broken)).not.toThrow();
  });
});
