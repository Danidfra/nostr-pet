/**
 * The guest record on the device: written whole, read defensively, never
 * deleted by a bug. Storage that refuses is reported, not thrown.
 */
import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';
import {
  GUEST_QUARANTINE_KEY,
  GUEST_STORAGE_KEY,
  clearGuestDocument,
  createGuestDocument,
  identityConsistent,
  parseGuestDocument,
  readGuestDocument,
  storageAvailable,
  writeGuestDocument,
  type GuestStorage,
} from './guest-store';

function fakeStorage(initial: Record<string, string> = {}, opts: { refuse?: boolean } = {}): GuestStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (opts.refuse) throw new DOMException('quota', 'QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function identity() {
  const sk = generateSecretKey();
  return { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
}

describe('guest-store', () => {
  it('round-trips a document and reads it back as a guest', () => {
    const storage = fakeStorage();
    const doc = createGuestDocument(identity(), 1_000);
    expect(writeGuestDocument(doc, storage)).toBe(true);
    const read = readGuestDocument(storage);
    expect(read.kind).toBe('guest');
    if (read.kind === 'guest') expect(read.doc).toEqual(doc);
  });

  it('reads nothing where nothing was stored, and nothing without storage', () => {
    expect(readGuestDocument(fakeStorage())).toEqual({ kind: 'none' });
    expect(readGuestDocument(null)).toEqual({ kind: 'none' });
  });

  it('keeps the key and the pubkey consistent, and refuses a document where they are not', () => {
    const id = identity();
    expect(identityConsistent(id)).toBe(true);
    const other = identity();
    expect(identityConsistent({ nsec: id.nsec, pubkey: other.pubkey })).toBe(false);
    const parsed = parseGuestDocument({ ...createGuestDocument(id), identity: { nsec: id.nsec, pubkey: other.pubkey } });
    expect(parsed.ok).toBe(false);
  });

  it('quarantines an unreadable record instead of deleting it, and reads "unreadable"', () => {
    const storage = fakeStorage({ [GUEST_STORAGE_KEY]: '{not json' });
    const read = readGuestDocument(storage);
    expect(read).toEqual({ kind: 'unreadable', reason: 'not JSON' });
    expect(storage.map.get(GUEST_STORAGE_KEY)).toBeUndefined();
    expect(storage.map.get(GUEST_QUARANTINE_KEY)).toBe('{not json');
    // A second unreadable record never overwrites the first quarantine
    storage.map.set(GUEST_STORAGE_KEY, '{"v":99}');
    readGuestDocument(storage);
    expect(storage.map.get(GUEST_QUARANTINE_KEY)).toBe('{"v":99}');
    expect([...storage.map.keys()].some((k) => k.startsWith(`${GUEST_QUARANTINE_KEY}:`))).toBe(true);
  });

  it('refuses a record whose events belong to another key or are not event-shaped', () => {
    const id = identity();
    const base = createGuestDocument(id);
    const foreign = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), kind: KIND_BLOBBI_STATE, created_at: 1, tags: [['d', 'x']], content: '', sig: '' };
    expect(parseGuestDocument({ ...base, events: [foreign] }).ok).toBe(false);
    expect(parseGuestDocument({ ...base, events: [{ nope: true }] }).ok).toBe(false);
    expect(parseGuestDocument({ ...base, events: [{ ...foreign, pubkey: id.pubkey }] }).ok).toBe(true);
  });

  it('tolerates missing optional fields and drops unknown ones', () => {
    const id = identity();
    const parsed = parseGuestDocument({ v: 1, identity: id, events: [], extra: 'ignored' });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.doc.care).toEqual({ count: 0, lastAt: null });
      expect(parsed.doc.invite).toEqual({ dismissedAt: null, shownCount: 0, activeMs: 0, optOut: false });
      expect(parsed.doc.migration).toBeNull();
      expect('extra' in parsed.doc).toBe(false);
    }
  });

  it('refuses an unknown migration stage (a newer app wrote it)', () => {
    const parsed = parseGuestDocument({ ...createGuestDocument(identity()), migration: { stage: 'teleporting', startedAt: 1, landed: {}, profileDone: false } });
    expect(parsed.ok).toBe(false);
  });

  it('reports a write that storage refused, and says storage is unavailable', () => {
    const refusing = fakeStorage({}, { refuse: true });
    expect(writeGuestDocument(createGuestDocument(identity()), refusing)).toBe(false);
    expect(storageAvailable(refusing)).toBe(false);
    expect(storageAvailable(fakeStorage())).toBe(true);
    expect(storageAvailable(null)).toBe(false);
  });

  it('clears the record on request', () => {
    const storage = fakeStorage();
    writeGuestDocument(createGuestDocument(identity()), storage);
    expect(clearGuestDocument(storage)).toBe(true);
    expect(readGuestDocument(storage)).toEqual({ kind: 'none' });
  });
});
