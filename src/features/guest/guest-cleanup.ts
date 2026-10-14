/**
 * Removing a guest Blobbi from this device, completely and only it (M15).
 *
 * "Remove from this device" is the one destructive thing a player can do to
 * a guest Blobbi, and before M15 it removed the record alone
 * (`blobbi:guest:v1`) and left everything the device had kept about that
 * Blobbi under the guest's pubkey: the room it was in, its toys and
 * furniture layout, the 3D room's memory and introduction, the Journey's
 * day book, the item-spend ledger, the selected-Blobbi pointer. Those keys
 * named a Blobbi that no longer existed, and would have greeted a NEW guest
 * on the same device only by luck of a different key.
 *
 * What belongs to the guest identity, and nothing else, is what goes:
 *
 *   1. the record itself (with the reserved key inside it);
 *   2. every key one of the app's stores builds from the guest's PUBKEY
 *      (and its Blobbi's `d`), listed here from the builders themselves so
 *      a renamed key cannot be missed by this file alone;
 *   3. as a net under the list, any other `blobbi:`-prefixed key whose
 *      colon-separated segments carry the guest's pubkey: a store added
 *      later that keys by pubkey is still cleaned.
 *
 * What stays, deliberately:
 *
 *   - the signed-in account's login (`nostr:login`) and everything keyed by
 *     ITS pubkey: the player is removing a guest, not signing out;
 *   - the quarantine (`blobbi:guest:v1:unreadable*`): unreadable documents
 *     cannot be attributed to this guest, and the store's rule is that it
 *     never deletes them;
 *   - device-wide preferences that are nobody's (appearance, zoom, sound,
 *     the room introduction seen, the look guide): they are the device's;
 *   - keys of any other Blobbi or account on the device.
 *
 * Pure over its storage, so every path is pinned by tests.
 */
import { KIND_BLOBBI_STATE, getSelectedBlobbiKey, type NostrEvent } from '@blobbi-kit/core';
import { roomStorageKey } from '@/features/home/rooms/rooms';
import { toyStorageKey } from '@/features/home/rooms/toy-store';
import { layoutStorageKey } from '@/features/home/rooms/layout-store';
import { roomIntroKey, roomNavKey } from '@/features/room/lib/room-memory';
import { journeyStoreKey } from '@/features/journey/useJourney';
import { ledgerKey } from '@/features/inventory/spend-ledger';
import { GUEST_QUARANTINE_KEY, GUEST_STORAGE_KEY, type GuestDocument, type GuestStorage } from './guest-store';

const HEX64 = /^[0-9a-f]{64}$/;

/** Every `d` the guest's records name: the one Blobbi, plus any state record's `d`, should the two ever differ. */
export function guestBlobbiIds(doc: Pick<GuestDocument, 'blobbiD' | 'events'>): string[] {
  const ids = new Set<string>();
  if (doc.blobbiD) ids.add(doc.blobbiD);
  for (const event of doc.events as NostrEvent[]) {
    if (event.kind !== KIND_BLOBBI_STATE) continue;
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    if (d) ids.add(d);
  }
  return [...ids];
}

/**
 * The keys this device keeps for a guest identity, from the stores' own
 * builders. The record's key is first; the rest are per pubkey, or per
 * pubkey and Blobbi.
 */
export function guestDeviceKeys(doc: Pick<GuestDocument, 'identity' | 'blobbiD' | 'events'>): string[] {
  const pubkey = doc.identity.pubkey;
  const keys = new Set<string>([GUEST_STORAGE_KEY, journeyStoreKey(pubkey), ledgerKey(pubkey), getSelectedBlobbiKey(pubkey)]);
  for (const d of guestBlobbiIds(doc)) {
    keys.add(roomStorageKey(pubkey, d));
    keys.add(toyStorageKey(pubkey, d));
    keys.add(layoutStorageKey(pubkey, d));
    keys.add(roomNavKey(pubkey, d));
    keys.add(roomIntroKey(pubkey, d));
  }
  return [...keys];
}

/** True for a key that is the guest's by its name: `blobbi:`-prefixed, with the pubkey as one of its segments. */
export function isGuestOwnedKey(key: string, pubkey: string): boolean {
  if (!key.startsWith('blobbi:')) return false;
  if (key === GUEST_QUARANTINE_KEY || key.startsWith(`${GUEST_QUARANTINE_KEY}:`)) return false;
  return key.split(':').includes(pubkey);
}

export interface GuestRemoval {
  /** The keys that were removed, in order. */
  removed: string[];
  /** True when every removal held (a storage that refuses leaves the record in memory for the session, as a write does). */
  ok: boolean;
}

/**
 * Remove the guest Blobbi and everything the device kept about it. The
 * record goes first (so a failure halfway never leaves a guest with
 * half a home), then the stores' keys, then the sweep.
 */
export function removeGuestFromDevice(doc: Pick<GuestDocument, 'identity' | 'blobbiD' | 'events'>, storage: GuestStorage | null): GuestRemoval {
  if (!storage) return { removed: [], ok: false };
  const pubkey = doc.identity.pubkey;
  const removed: string[] = [];
  let ok = true;
  const remove = (key: string) => {
    try {
      if (storage.getItem(key) === null) return;
      storage.removeItem(key);
      removed.push(key);
    } catch {
      ok = false;
    }
  };
  for (const key of guestDeviceKeys(doc)) remove(key);
  // The net: whatever else names this pubkey. Collected first, then removed, so the walk is not disturbed by itself.
  if (HEX64.test(pubkey) && typeof storage.length === 'number' && typeof storage.key === 'function') {
    const others: string[] = [];
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key && isGuestOwnedKey(key, pubkey) && !removed.includes(key)) others.push(key);
      }
    } catch {
      ok = false;
    }
    for (const key of others) remove(key);
  }
  return { removed, ok };
}
