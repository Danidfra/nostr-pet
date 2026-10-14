/**
 * Removing a guest Blobbi from this device (M15): everything of the guest's,
 * nothing of anyone else's.
 */
import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { KIND_BLOBBI_STATE, getSelectedBlobbiKey } from '@blobbi-kit/core';
import type { NostrEvent } from '@blobbi-kit/core';
import { roomStorageKey } from '@/features/home/rooms/rooms';
import { toyStorageKey } from '@/features/home/rooms/toy-store';
import { layoutStorageKey } from '@/features/home/rooms/layout-store';
import { roomIntroKey, roomNavKey } from '@/features/room/lib/room-memory';
import { journeyStoreKey } from '@/features/journey/useJourney';
import { ledgerKey } from '@/features/inventory/spend-ledger';
import { GUEST_QUARANTINE_KEY, GUEST_STORAGE_KEY, createGuestDocument, readGuestDocument, writeGuestDocument, type StoredGuestDocument } from './guest-store';
import { guestBlobbiIds, guestDeviceKeys, isGuestOwnedKey, removeGuestFromDevice } from './guest-cleanup';
import { createGuestStore } from './guest-context';

const sk = generateSecretKey();
const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
const OTHER = getPublicKey(generateSecretKey());
const D = 'blobbi-aaaaaaaaaaaa-0000000001';

function stateEvent(pubkey: string, d: string): NostrEvent {
  return { id: 'e'.repeat(64), pubkey, kind: KIND_BLOBBI_STATE, created_at: 1, content: '', tags: [['d', d]], sig: '' };
}

function docWithBlobbi(): StoredGuestDocument {
  const doc = createGuestDocument(identity, 1_000);
  return { ...doc, blobbiD: D, events: [stateEvent(identity.pubkey, D)] };
}

/** A storage that holds a guest's whole device life, an account's, and the device's own preferences. */
function populate(storage: Storage, doc: StoredGuestDocument) {
  writeGuestDocument(doc, storage);
  const pk = identity.pubkey;
  storage.setItem(roomStorageKey(pk, D), '"kitchen"');
  storage.setItem(toyStorageKey(pk, D), '{"v":1,"by_room":{}}');
  storage.setItem(layoutStorageKey(pk, D), '{"v":1,"by_room":{}}');
  storage.setItem(roomNavKey(pk, D), '{"room":"kitchen"}');
  storage.setItem(roomIntroKey(pk, D), 'seen');
  storage.setItem(journeyStoreKey(pk), '{"v":1}');
  storage.setItem(ledgerKey(pk), '[]');
  storage.setItem(getSelectedBlobbiKey(pk), D);
  // A store added later that keys by pubkey, caught by the sweep
  storage.setItem(`blobbi:future:v9:${pk}:anything`, 'x');
  // Not the guest's: the account's keys, the device's preferences, the login, the quarantine
  storage.setItem(roomStorageKey(OTHER, 'blobbi-bbbbbbbbbbbb-0000000002'), '"bedroom"');
  storage.setItem(journeyStoreKey(OTHER), '{"v":1}');
  storage.setItem(getSelectedBlobbiKey(OTHER), 'blobbi-bbbbbbbbbbbb-0000000002');
  storage.setItem(roomStorageKey(undefined, D), '"anon"');
  storage.setItem('blobbi:room:appearance', '3d');
  storage.setItem('blobbi:room:zoom:v2', '1.2');
  storage.setItem('blobbi:sound:v1', 'on');
  storage.setItem('blobbi:home:experience', 'room');
  storage.setItem('blobbi:home:3d-intro:v1', 'seen');
  storage.setItem('nostr:login', JSON.stringify([{ id: 'x', type: 'nsec', pubkey: OTHER, data: { nsec: 'nsec1notreal' } }]));
  storage.setItem(GUEST_QUARANTINE_KEY, '{"v":1,"identity":{"pubkey":"' + pk + '"}}');
  storage.setItem(`${GUEST_QUARANTINE_KEY}:123`, 'older');
}

describe('what belongs to the guest', () => {
  it('lists the record and every key the stores build from the pubkey and the Blobbi', () => {
    const keys = guestDeviceKeys(docWithBlobbi());
    expect(keys[0]).toBe(GUEST_STORAGE_KEY);
    for (const key of [roomStorageKey(identity.pubkey, D), toyStorageKey(identity.pubkey, D), layoutStorageKey(identity.pubkey, D), roomNavKey(identity.pubkey, D), roomIntroKey(identity.pubkey, D), journeyStoreKey(identity.pubkey), ledgerKey(identity.pubkey), getSelectedBlobbiKey(identity.pubkey)]) {
      expect(keys).toContain(key);
    }
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).not.toContain(identity.nsec);
  });

  it('a guest who never adopted has only the per-pubkey keys', () => {
    const keys = guestDeviceKeys(createGuestDocument(identity));
    expect(keys).toContain(GUEST_STORAGE_KEY);
    expect(keys).toContain(journeyStoreKey(identity.pubkey));
    expect(keys.some((k) => k.startsWith('blobbi:home:room:v1:'))).toBe(false);
    expect(guestBlobbiIds(createGuestDocument(identity))).toEqual([]);
  });

  it('a key is the guest\'s by name only with blobbi: in front and the pubkey as a whole segment; the quarantine never is', () => {
    const pk = identity.pubkey;
    expect(isGuestOwnedKey(`blobbi:journey:v1:${pk}`, pk)).toBe(true);
    expect(isGuestOwnedKey(`blobbi:home:room:v1:${pk}:${D}`, pk)).toBe(true);
    expect(isGuestOwnedKey(`nostr:login`, pk)).toBe(false);
    expect(isGuestOwnedKey(`other:${pk}`, pk)).toBe(false);
    expect(isGuestOwnedKey(`blobbi:x:${pk}suffix`, pk)).toBe(false);
    expect(isGuestOwnedKey(`blobbi:journey:v1:${OTHER}`, pk)).toBe(false);
    expect(isGuestOwnedKey(GUEST_QUARANTINE_KEY, pk)).toBe(false);
    expect(isGuestOwnedKey(`${GUEST_QUARANTINE_KEY}:${pk}`, pk)).toBe(false);
  });
});

describe('removeGuestFromDevice', () => {
  it('removes the record and every key of the guest, by the list and by the sweep, and nothing else', () => {
    const storage = window.localStorage;
    const doc = docWithBlobbi();
    populate(storage, doc);
    const before = Object.keys(storage).length;
    const result = removeGuestFromDevice(doc, storage);
    expect(result.ok).toBe(true);
    const pk = identity.pubkey;
    const gone = [GUEST_STORAGE_KEY, roomStorageKey(pk, D), toyStorageKey(pk, D), layoutStorageKey(pk, D), roomNavKey(pk, D), roomIntroKey(pk, D), journeyStoreKey(pk), ledgerKey(pk), getSelectedBlobbiKey(pk), `blobbi:future:v9:${pk}:anything`];
    for (const key of gone) {
      expect(storage.getItem(key)).toBeNull();
      expect(result.removed).toContain(key);
    }
    expect(result.removed).toHaveLength(gone.length);
    expect(Object.keys(storage)).toHaveLength(before - gone.length);
    // Untouched: the account's, the anonymous room, the device's preferences, the login, the quarantine
    expect(storage.getItem(roomStorageKey(OTHER, 'blobbi-bbbbbbbbbbbb-0000000002'))).toBe('"bedroom"');
    expect(storage.getItem(journeyStoreKey(OTHER))).toBe('{"v":1}');
    expect(storage.getItem(getSelectedBlobbiKey(OTHER))).toBe('blobbi-bbbbbbbbbbbb-0000000002');
    expect(storage.getItem(roomStorageKey(undefined, D))).toBe('"anon"');
    expect(storage.getItem('blobbi:room:appearance')).toBe('3d');
    expect(storage.getItem('blobbi:room:zoom:v2')).toBe('1.2');
    expect(storage.getItem('blobbi:sound:v1')).toBe('on');
    expect(storage.getItem('blobbi:home:experience')).toBe('room');
    expect(storage.getItem('blobbi:home:3d-intro:v1')).toBe('seen');
    expect(JSON.parse(storage.getItem('nostr:login')!)[0].pubkey).toBe(OTHER);
    expect(storage.getItem(GUEST_QUARANTINE_KEY)).not.toBeNull();
    expect(storage.getItem(`${GUEST_QUARANTINE_KEY}:123`)).toBe('older');
    // Nothing of the identity is left anywhere in storage
    for (const key of Object.keys(storage)) {
      if (key.startsWith(GUEST_QUARANTINE_KEY)) continue;
      expect(storage.getItem(key)).not.toContain(identity.nsec);
      expect(key).not.toContain(pk);
    }
  });

  it('a storage without a key walk (the minimal shape) still removes the listed keys', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
    const doc = docWithBlobbi();
    writeGuestDocument(doc, storage);
    storage.setItem(journeyStoreKey(identity.pubkey), '{}');
    storage.setItem(`blobbi:future:v9:${identity.pubkey}`, 'x');
    const result = removeGuestFromDevice(doc, storage);
    expect(result.ok).toBe(true);
    expect(map.has(GUEST_STORAGE_KEY)).toBe(false);
    expect(map.has(journeyStoreKey(identity.pubkey))).toBe(false);
    // The sweep needs the walk; without it the unknown key stays (and is reported as nothing more than that)
    expect(map.has(`blobbi:future:v9:${identity.pubkey}`)).toBe(true);
    expect(result.removed).not.toContain(`blobbi:future:v9:${identity.pubkey}`);
  });

  it('a storage that refuses reports it and removes what it can; no storage removes nothing', () => {
    const map = new Map<string, string>([[GUEST_STORAGE_KEY, 'x'], [journeyStoreKey(identity.pubkey), 'y']]);
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: () => {},
      removeItem: (k: string) => {
        if (k === GUEST_STORAGE_KEY) throw new Error('refused');
        map.delete(k);
      },
    };
    const result = removeGuestFromDevice(docWithBlobbi(), storage);
    expect(result.ok).toBe(false);
    expect(result.removed).toEqual([journeyStoreKey(identity.pubkey)]);
    expect(removeGuestFromDevice(docWithBlobbi(), null)).toEqual({ removed: [], ok: false });
  });

  it('through the store: remove() empties the snapshot, forgets the secret, and sweeps the device; clear() (a confirmed save) keeps the account\'s keys', () => {
    const storage = window.localStorage;
    const doc = docWithBlobbi();
    populate(storage, doc);
    const store = createGuestStore(storage);
    expect(store.snapshot().doc?.identity.pubkey).toBe(identity.pubkey);
    store.remove();
    expect(store.snapshot().doc).toBeNull();
    expect(store.revealSecret()).toBeNull();
    expect(readGuestDocument(storage).kind).toBe('none');
    expect(storage.getItem(journeyStoreKey(identity.pubkey))).toBeNull();
    expect(storage.getItem(roomStorageKey(identity.pubkey, D))).toBeNull();
    expect(storage.getItem(journeyStoreKey(OTHER))).toBe('{"v":1}');
    // A second remove is nothing
    store.remove();
    expect(store.snapshot().doc).toBeNull();

    storage.clear();
    populate(storage, doc);
    const saved = createGuestStore(storage);
    saved.clear();
    expect(readGuestDocument(storage).kind).toBe('none');
    // Saved to the same key: the device's memory of this Blobbi is the account's now
    expect(storage.getItem(journeyStoreKey(identity.pubkey))).toBe('{"v":1}');
    expect(storage.getItem(roomStorageKey(identity.pubkey, D))).toBe('"kitchen"');
  });
});
