/**
 * The reserved secret stays in the store (M14.1 audit, `SECURITY.md` §3): the
 * snapshot every component reads carries the pubkey alone; the record on
 * disk keeps the secret; one accessor gives it, for the save's key step.
 */
import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { createGuestStore, withInviteDismissed } from './guest-context';
import { GUEST_STORAGE_KEY, createGuestDocument, readGuestDocument } from './guest-store';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}
function identity() {
  const sk = generateSecretKey();
  return { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
}

describe('the reserved secret and the store', () => {
  it('never enters the snapshot: the document the app reads has the pubkey alone, and serializing it holds no nsec', () => {
    const storage = fakeStorage();
    const store = createGuestStore(storage);
    const id = identity();
    store.begin(createGuestDocument(id));
    const snap = store.snapshot();
    expect(snap.doc?.identity).toEqual({ pubkey: id.pubkey });
    expect(JSON.stringify(snap)).not.toContain('nsec');
    expect(JSON.stringify(snap)).not.toContain(id.nsec.slice(5, 20));
    // The record on disk keeps it, consistent with its pubkey
    expect(storage.getItem(GUEST_STORAGE_KEY)).toContain(id.nsec);
    const read = readGuestDocument(storage);
    expect(read.kind === 'guest' && read.doc.identity.nsec).toBe(id.nsec);
  });

  it('is given by one accessor, survives every change of the record and a reload, and goes with the record', () => {
    const storage = fakeStorage();
    const store = createGuestStore(storage);
    const id = identity();
    expect(store.revealSecret()).toBeNull();
    store.begin(createGuestDocument(id));
    expect(store.revealSecret()).toBe(id.nsec);
    store.update((d) => withInviteDismissed(d, 5));
    expect(store.snapshot().doc?.invite.dismissedAt).toBe(5);
    expect(JSON.stringify(store.snapshot())).not.toContain('nsec1');
    expect(storage.getItem(GUEST_STORAGE_KEY)).toContain(id.nsec);
    // Another store over the same storage (a reload) finds the same secret and the same record
    const again = createGuestStore(storage);
    expect(again.revealSecret()).toBe(id.nsec);
    expect(again.snapshot().doc?.invite.dismissedAt).toBe(5);
    again.clear();
    expect(again.revealSecret()).toBeNull();
    expect(storage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });

  it('a store whose storage refuses still keeps the secret for the session, and says the record is not persisted', () => {
    const refusing = { ...fakeStorage(), setItem: () => { throw new Error('quota'); } } as Storage;
    const store = createGuestStore(refusing);
    const id = identity();
    store.begin(createGuestDocument(id));
    expect(store.snapshot().persisted).toBe(false);
    expect(store.revealSecret()).toBe(id.nsec);
    expect(store.snapshot().doc?.identity.pubkey).toBe(id.pubkey);
  });
});
