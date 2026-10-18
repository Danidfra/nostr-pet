import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@blobbi-kit/core';
import { deliverOwed, DELIVERY_MAX_TRIES, oweProfile, readOwed, type DeliveryStore } from './profile-delivery';
import { writeCompanionProfile, type ProfileWriteDeps } from './profile-write';
import { BAND, DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';

const NOW = 1_800_000_000_000;
const S = NOW / 1000;
const noSleep = async () => {};

function memory(): DeliveryStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}
function writer(net: FakeNetwork, acc: TestAccount) {
  const signed: NostrEvent[] = [];
  const deps: ProfileWriteDeps = {
    relays: net.port,
    sign: async (t) => {
      const e = acc.sign(t);
      signed.push(e);
      return e;
    },
    onSigned: () => {},
    stillAccount: () => true,
    online: () => true,
    now: () => NOW,
    timeoutMs: 50,
    sleep: noSleep,
  };
  return { deps, signed };
}
/** A relay that answers reads but whose writes fail for now (a 502 on the write path, a rate limit). */
function failWrites(net: FakeNetwork, url: string, message = 'rate-limited: slow down') {
  const publish = net.port.publish;
  const state = { failing: true };
  net.port.publish = async (u, e, s) => (u === url && state.failing ? Promise.reject(new Error(message)) : publish(u, e, s));
  return state;
}
const holdsOn = (net: FakeNetwork, url: string, id: string) => net.relays.get(url)!.events.some((e) => e.id === id);
const sentTo = (net: FakeNetwork, url: string) => net.relays.get(url)!.sent.filter((e) => e.kind === 11125);

async function savedWith(net: FakeNetwork, acc: TestAccount, store: DeliveryStore) {
  const w = writer(net, acc);
  const out = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, w.deps);
  expect(out.kind).toBe('saved');
  if (out.kind !== 'saved') throw new Error(out.kind);
  oweProfile(store, out.event); // what companion-sync and the kit writer's wrapper do after a save
  return { event: out.event, signed: w.signed };
}

describe('profile deliveries owed after a save on one relay (2026-10-17 outage)', () => {
  it('Ditto failing writes, Primal fine: saved; Ditto gets the very same event once it accepts again', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    const ditto = failWrites(net, DITTO, 'error: 502 bad gateway');
    const store = memory();
    const { event, signed } = await savedWith(net, acc, store);
    expect(holdsOn(net, DITTO, event.id)).toBe(false);
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(1); // still failing: still owed
    ditto.failing = false;
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0); // every relay holds it now
    expect(holdsOn(net, DITTO, event.id)).toBe(true);
    expect(readOwed(store)).toEqual({});
    expect(signed).toHaveLength(1); // nothing signed again: no signer is even reachable here
    expect(new Set(net.sent().filter((e) => e.kind === 11125).map((e) => e.id))).toEqual(new Set([event.id]));
  });

  it('Primal failing writes, Ditto fine: the same, the other way round; nothing more once every relay holds it', async () => {
    const acc = testAccount();
    const net = fakeNetwork([DITTO, PRIMAL]);
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    const primal = failWrites(net, PRIMAL);
    const store = memory();
    const { event } = await savedWith(net, acc, store);
    primal.failing = false;
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0);
    expect(holdsOn(net, PRIMAL, event.id)).toBe(true);
    expect(readOwed(store)).toEqual({});
    const before = net.sent().length;
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0);
    expect(net.sent()).toHaveLength(before);
  });

  it('both relays down: no read is complete, so nothing is built, signed, saved or owed (the replaceable rule)', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    for (const url of [DITTO, PRIMAL]) net.relays.get(url)!.down = true;
    const w = writer(net, acc);
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, w.deps);
    expect(out.kind).toBe('unsafe');
    expect(w.signed).toHaveLength(0);
    const store = memory();
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0);
  });

  it('a relay that does not answer is not sent blindly: still owed, and delivered after it reconnects', async () => {
    const acc = testAccount();
    const net = fakeNetwork([DITTO, PRIMAL]);
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    const primal = failWrites(net, PRIMAL);
    const store = memory();
    const { event } = await savedWith(net, acc, store);
    primal.failing = false;
    net.relays.get(PRIMAL)!.down = true;
    const sent = sentTo(net, PRIMAL).length;
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(1);
    expect(sentTo(net, PRIMAL)).toHaveLength(sent);
    net.relays.get(PRIMAL)!.down = false;
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0);
    expect(holdsOn(net, PRIMAL, event.id)).toBe(true);
  });

  it('never overwrites a newer profile: a newer one anywhere drops the owed event, never sent again', async () => {
    const acc = testAccount();
    const net = fakeNetwork([DITTO, PRIMAL]);
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    failWrites(net, DITTO);
    const store = memory();
    const { event } = await savedWith(net, acc, store);
    // Another app writes a newer profile, to Ditto only
    const newer = profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: event.created_at + 30 });
    net.seed(newer, [DITTO]);
    const sent = sentTo(net, DITTO).length;
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0);
    expect(sentTo(net, DITTO)).toHaveLength(sent);
    expect(readOwed(store)).toEqual({});
    expect(net.relays.get(DITTO)!.events.find((e) => e.kind === 11125)!.id).toBe(newer.id);
  });

  it('a relay that refuses for good is no longer owed; a relay that keeps failing gets a bounded number of rounds', async () => {
    const acc = testAccount();
    const net = fakeNetwork([DITTO, PRIMAL]);
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    failWrites(net, DITTO, 'blocked: not allowed');
    const store = memory();
    await savedWith(net, acc, store);
    expect(await deliverOwed(store, net.port, { sleep: noSleep, timeoutMs: 50 })).toBe(0);
    expect(readOwed(store)).toEqual({});

    const b = testAccount();
    const net2 = fakeNetwork([DITTO, PRIMAL]);
    net2.seed(profileEvent(b, { has: [dOf(b.pubkey, 1), dOf(b.pubkey, 2)], companion: dOf(b.pubkey, 1), createdAt: S - 100 }));
    failWrites(net2, DITTO);
    const store2 = memory();
    await savedWith(net2, b, store2);
    let calls = 0;
    const counted = { ...net2.port, publish: (u: string, e: NostrEvent, s: AbortSignal) => (u === DITTO && calls++, net2.port.publish(u, e, s)) };
    for (let i = 0; i < DELIVERY_MAX_TRIES + 4; i++) await deliverOwed(store2, counted, { sleep: noSleep, timeoutMs: 50 });
    expect(calls).toBe(DELIVERY_MAX_TRIES);
  });

  it('only the newest owed profile of an account is kept; an older one never replaces it', () => {
    const acc = testAccount();
    const store = memory();
    const a = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 50 });
    const b = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 10 });
    oweProfile(store, b);
    oweProfile(store, a);
    expect(readOwed(store)[acc.pubkey].event.id).toBe(b.id);
    expect(BAND).toBeTruthy();
  });

  it('both writers hand their saved profile to the deliveries', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/features/companion/companion-sync.ts', 'utf8')).toMatch(/profileDelivery\.owe\(outcome\.event, env\.relays\)/);
    expect(readFileSync('src/features/companion/safe-profile-write.ts', 'utf8')).toMatch(/if \(out\.kind === 'sent'\) profileDelivery\.owe\(out\.event, relays\)/);
    expect(readFileSync('src/hooks/useHomeBlobbi.ts', 'utf8')).toMatch(/profileDelivery\.start\(env\.relays\)/);
  });
});
