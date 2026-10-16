/**
 * The automatic retries of a companion share, over an in-memory relay network and fake timers: after the player's
 * own attempt, at most AUTO_RETRIES (3) automatic ones, the first 15 s later, then 60 s, then 180 s; never a new
 * signature (the same signed event is resent); and what the player is told meanwhile.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { companionChoices } from './choice-store';
import { AUTO_RETRIES, companionSync } from './companion-sync';
import { syncNote } from './sync-note';
import { BAND, DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';

let acc: TestAccount;
let net: FakeNetwork;
let signs: number;

function choose(d: string) {
  companionChoices.set({ version: 1, account: acc.pubkey, d, at: Date.now(), by: 'player', synced: null, pending: null, over: null, note: null });
  companionSync.setEnv(acc.pubkey, {
    account: () => acc.pubkey,
    relays: net.port,
    sign: async (t) => (signs++, acc.sign(t)),
    online: () => true,
    timeoutMs: 20,
    sleep: async () => {},
  });
}
const status = () => companionSync.status(acc.pubkey);
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  companionChoices.reset();
  companionSync.reset();
  acc = testAccount();
  net = fakeNetwork();
  signs = 0;
  net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: Math.floor(Date.now() / 1000) - 600 }));
});
afterEach(() => {
  companionSync.reset();
  vi.useRealTimers();
});

describe('automatic retries of a share', () => {
  it('after the player\'s attempt: the first automatic retry 15 s later, then 60 s, then 180 s, then none; one signature in all', async () => {
    for (const r of net.relays.values()) r.refuse = true;
    choose(dOf(acc.pubkey, 2));
    await companionSync.start(acc.pubkey);
    expect(status()).toMatchObject({ kind: 'waiting', reason: 'failed' });
    const after = (n: number) => expect(net.sent().length).toBe(n * 3);
    after(1);
    await advance(14_999);
    after(1);
    await advance(1);
    after(2);
    await advance(59_999);
    after(2);
    await advance(1);
    after(3);
    await advance(179_999);
    after(3);
    await advance(1);
    after(4);
    // Retries used up: no more by themselves; the player's Try again still works
    await advance(3_600_000);
    after(1 + AUTO_RETRIES);
    expect(signs).toBe(1);
    expect(status()).toMatchObject({ kind: 'waiting', reason: 'failed' });
    for (const r of net.relays.values()) r.refuse = false;
    await companionSync.retry(acc.pubkey);
    expect(status()).toEqual({ kind: 'saved' });
    expect(signs).toBe(1);
  });

  it('sent but not confirmed yet: "Still telling…" while a retry is on its way; the warning (and Try again) once retries are used up', async () => {
    // Only ditto keeps it: one relay of the two a share must be read back from
    net.relays.get(PRIMAL)!.forget = true;
    net.relays.get(BAND)!.down = true;
    choose(dOf(acc.pubkey, 2));
    await companionSync.start(acc.pubkey);
    expect(status()).toEqual({ kind: 'waiting', reason: 'partial', retrying: true });
    expect(syncNote(status(), 'Bambu')).toBe('Still telling your other Blobbi games about Bambu...');
    expect(net.relays.get(DITTO)!.events.some((e) => e.kind === 11125 && e.tags.some((t) => t[0] === 'current_companion' && t[1] === dOf(acc.pubkey, 2)))).toBe(true);
    await advance(15_000 + 60_000 + 180_000);
    expect(status()).toEqual({ kind: 'waiting', reason: 'partial' });
    expect(syncNote(status(), 'Bambu')).toBe("Your other Blobbi games don't know about Bambu yet.");
    // Primal keeps it again: the player's Try again confirms it, with the same signed event
    net.relays.get(PRIMAL)!.forget = false;
    await companionSync.retry(acc.pubkey);
    expect(status()).toEqual({ kind: 'saved' });
    expect(signs).toBe(1);
  });

  it('a partial share confirmed by its automatic retry: said as on its way, then saved, nothing asked of the player', async () => {
    net.relays.get(PRIMAL)!.forget = true;
    net.relays.get(BAND)!.down = true;
    choose(dOf(acc.pubkey, 2));
    await companionSync.start(acc.pubkey);
    expect(status()).toMatchObject({ reason: 'partial', retrying: true });
    net.relays.get(PRIMAL)!.forget = false;
    await advance(15_000);
    expect(status()).toEqual({ kind: 'saved' });
    expect(signs).toBe(1);
  });
});
