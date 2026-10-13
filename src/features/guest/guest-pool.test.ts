/**
 * The guest pool: everything about the guest stays on the device; everything
 * else goes upstream, and an upstream that fails never fails the guest.
 */
import { describe, expect, it, vi } from 'vitest';
import type { NPool, NostrEvent } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';
import { createGuestPool } from './guest-pool';
import { localRecordSigner } from './guest-signer';

const GUEST = 'a'.repeat(64);
const ISSUER = '9'.repeat(64);

function world() {
  let events: NostrEvent[] = [];
  return { events: () => events, replace: vi.fn((next: NostrEvent[]) => void (events = next)) };
}

function upstream(events: NostrEvent[] = [], fail = false) {
  return {
    query: vi.fn(async () => {
      if (fail) throw new Error('relays down');
      return events;
    }),
    event: vi.fn(async () => {}),
    req: vi.fn(),
  } as unknown as NPool;
}

describe('guest-pool', () => {
  it('answers a query about the guest from the guest world, and never asks upstream for it', async () => {
    const w = world();
    const up = upstream();
    const pool = createGuestPool({ guestPubkey: GUEST, world: w, upstream: up, latencyMs: 0 });
    const record = await localRecordSigner(GUEST).signEvent({ kind: KIND_BLOBBI_STATE, tags: [['d', 'blobbi-x']], content: '', created_at: 1 });
    await pool.event(record);
    expect(w.replace).toHaveBeenCalledTimes(1);
    expect(await pool.query([{ kinds: [KIND_BLOBBI_STATE], authors: [GUEST] }])).toEqual([record]);
    expect(up.query).not.toHaveBeenCalled();
    expect(up.event).not.toHaveBeenCalled();
  });

  it('sends a query about someone else upstream, and answers empty when upstream fails', async () => {
    const catalogue: NostrEvent = { id: 'c'.repeat(64), pubkey: ISSUER, kind: 31632, created_at: 1, tags: [], content: '', sig: 'f'.repeat(128) };
    const ok = createGuestPool({ guestPubkey: GUEST, world: world(), upstream: upstream([catalogue]), latencyMs: 0 });
    expect(await ok.query([{ kinds: [31632], authors: [ISSUER] }])).toEqual([catalogue]);
    const down = createGuestPool({ guestPubkey: GUEST, world: world(), upstream: upstream([], true), latencyMs: 0 });
    expect(await down.query([{ kinds: [31632], authors: [ISSUER] }])).toEqual([]);
    const none = createGuestPool({ guestPubkey: GUEST, world: world(), upstream: null, latencyMs: 0 });
    expect(await none.query([{ kinds: [31632], authors: [ISSUER] }])).toEqual([]);
  });

  it('splits a mixed query: the guest part local, the rest upstream', async () => {
    const w = world();
    const record = await localRecordSigner(GUEST).signEvent({ kind: KIND_BLOBBI_STATE, tags: [['d', 'blobbi-x']], content: '', created_at: 1 });
    w.replace([record]);
    const catalogue: NostrEvent = { id: 'c'.repeat(64), pubkey: ISSUER, kind: 31632, created_at: 1, tags: [], content: '', sig: 'f'.repeat(128) };
    const up = upstream([catalogue]);
    const pool = createGuestPool({ guestPubkey: GUEST, world: w, upstream: up, latencyMs: 0 });
    const answer = await pool.query([{ authors: [GUEST] }, { kinds: [31632], authors: [ISSUER] }]);
    expect(answer).toEqual([record, catalogue]);
    expect(up.query).toHaveBeenCalledWith([{ kinds: [31632], authors: [ISSUER] }], undefined);
  });

  it('refuses to send a guest record upstream, and refuses a signed event as a guest record', async () => {
    const up = upstream();
    const pool = createGuestPool({ guestPubkey: GUEST, world: world(), upstream: up, latencyMs: 0 });
    const unsignedOther: NostrEvent = { id: 'd'.repeat(64), pubkey: ISSUER, kind: 1, created_at: 1, tags: [], content: '', sig: '' };
    await expect(pool.event(unsignedOther)).rejects.toThrow(/never leaves/);
    const signedGuest: NostrEvent = { id: 'd'.repeat(64), pubkey: GUEST, kind: 1, created_at: 1, tags: [], content: '', sig: 'f'.repeat(128) };
    await expect(pool.event(signedGuest)).rejects.toThrow(/must not carry a signature/);
    expect(up.event).not.toHaveBeenCalled();
    // Someone else's signed event (a signer's handshake) does go upstream
    const handshake: NostrEvent = { id: 'e'.repeat(64), pubkey: ISSUER, kind: 24133, created_at: 1, tags: [], content: '', sig: 'f'.repeat(128) };
    await pool.event(handshake);
    expect(up.event).toHaveBeenCalledWith(handshake, undefined);
  });

  it('stamps a guest record with the pubkey and a hash, and no signature', async () => {
    const record = await localRecordSigner(GUEST).signEvent({ kind: 1, tags: [], content: 'hi', created_at: 5 });
    expect(record.pubkey).toBe(GUEST);
    expect(record.id).toMatch(/^[0-9a-f]{64}$/);
    expect(record.sig).toBe('');
  });
});
