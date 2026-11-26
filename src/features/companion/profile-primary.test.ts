/**
 * The profile (kind 11125) with the primary relay in the set: asked and
 * written first, never REQUIRED for a write, always required before a
 * profile is created from nothing, and sent what it missed later. In-memory
 * relays only (the companion tests' fake network).
 */
import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@blobbi-kit/core';
import type { NPool } from '@nostrify/nostrify';
import { deliverOwed, oweProfile, readOwed, type DeliveryStore } from './profile-delivery';
import { readProfileCensus, writeCompanionProfile, type ProfileRelays, type ProfileWriteDeps } from './profile-write';
import { PROFILE_RELAYS, poolProfileRelays } from './pool-relays';
import { BAND, DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';
import { PRIMARY_RELAY } from '@/config/relays';
import { createCarryGate, type CarryGate } from '@/lib/sync-consent';

const NOW = 1_800_000_000_000;
const S = NOW / 1000;
const URLS = [PRIMARY_RELAY, DITTO, PRIMAL, BAND];

/** The network as `poolProfileRelays` describes it: the primary in `urls` and `absence`, not in `required`. */
function network(): FakeNetwork & { relaysWithPrimary: ProfileRelays } {
  const net = fakeNetwork(URLS);
  return Object.assign(net, { relaysWithPrimary: { ...net.port, absence: [DITTO, PRIMAL, PRIMARY_RELAY] } });
}

function deps(relays: ProfileRelays, acc: TestAccount): ProfileWriteDeps {
  return { relays, sign: async (t) => acc.sign(t), onSigned: () => {}, stillAccount: () => true, online: () => true, now: () => NOW, timeoutMs: 50, sleep: async () => {} };
}

describe('the pool as profile relays', () => {
  const pool = { relay: () => ({ query: async () => [], event: async () => {} }) } as unknown as NPool;

  it('lists the primary first, requires only the two shared relays for a write, and all three before believing "no profile"', () => {
    const relays = poolProfileRelays(pool);
    expect(PROFILE_RELAYS).toEqual([PRIMARY_RELAY, DITTO, PRIMAL, BAND]);
    expect(relays.urls).toEqual(PROFILE_RELAYS);
    expect(relays.required).toEqual([DITTO, PRIMAL]);
    expect([...relays.absence!].sort()).toEqual([PRIMARY_RELAY, DITTO, PRIMAL].sort());
  });

  it("tells the pool each relay's verdict on a write made relay by relay", async () => {
    const told: string[] = [];
    const refusing = {
      relay: (url: string) => ({
        query: async () => [],
        event: async () => {
          if (url === PRIMARY_RELAY) throw new Error('blocked: this relay is in pilot mode; author is not on the write list');
          if (url === PRIMAL) throw new Error('duplicate: already have this event');
        },
      }),
      noteDelivery: (_event: NostrEvent, result: { relay: string; verdict: string }) => told.push(`${result.relay} ${result.verdict}`),
    } as unknown as NPool;
    const relays = poolProfileRelays(refusing);
    const acc = testAccount();
    const event = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S });
    await expect(relays.publish(PRIMARY_RELAY, event, AbortSignal.timeout(50))).rejects.toThrow(/^blocked:/);
    await expect(relays.publish(DITTO, event, AbortSignal.timeout(50))).resolves.toBeUndefined();
    await expect(relays.publish(PRIMAL, event, AbortSignal.timeout(50))).resolves.toBeUndefined();
    expect(told).toEqual([`${PRIMARY_RELAY} rejected`, `${DITTO} accepted`, `${PRIMAL} accepted`]);
  });
});

describe('a companion choice with the primary relay down', () => {
  it('is still written: the primary is not one of the relays that must answer', async () => {
    const acc = testAccount();
    const net = network();
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    net.seed(profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 100 }), [DITTO, PRIMAL, BAND]);
    net.relays.get(PRIMARY_RELAY)!.down = true;
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: null }, deps(net.relaysWithPrimary, acc));
    expect(out.kind).toBe('saved');
  });

  it('an EMPTY primary changes nothing: the profile on the other relays is the base, and the primary is sent the result', async () => {
    const acc = testAccount();
    const net = network();
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    net.seed(profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 100, extra: [['island_room', 'garden']] }), [DITTO, PRIMAL]);
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: null }, deps(net.relaysWithPrimary, acc));
    expect(out.kind).toBe('saved');
    const onPrimary = net.relays.get(PRIMARY_RELAY)!.events[0];
    expect(onPrimary.tags).toContainEqual(['island_room', 'garden']);
    expect(onPrimary.tags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual([a, b]);
  });
});

describe('creating a profile from nothing', () => {
  const request = (acc: TestAccount) => ({ owner: acc.pubkey, d: dOf(acc.pubkey, 1), at: NOW, over: null, pending: null, create: { name: 'Blobbonaut' } });

  it('never happens while the primary is silent: it may be the only relay holding the profile', async () => {
    const acc = testAccount();
    const net = network();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 7)], companion: dOf(acc.pubkey, 7), createdAt: S - 100 }), [PRIMARY_RELAY]);
    net.relays.get(PRIMARY_RELAY)!.silent = true;
    const census = await readProfileCensus(net.relaysWithPrimary, acc.pubkey, 50);
    expect(census).toMatchObject({ complete: true, absenceKnown: false, newest: null });
    const out = await writeCompanionProfile(request(acc), deps(net.relaysWithPrimary, acc));
    expect(out.kind).toBe('unsafe');
    expect(net.sent()).toEqual([]);
  });

  it('happens once every relay that may hold one answered "none", the primary included', async () => {
    const acc = testAccount();
    const net = network();
    expect(await readProfileCensus(net.relaysWithPrimary, acc.pubkey, 50)).toMatchObject({ complete: true, absenceKnown: true, newest: null });
    const out = await writeCompanionProfile(request(acc), deps(net.relaysWithPrimary, acc));
    expect(out.kind).toBe('saved');
    expect(net.relays.get(PRIMARY_RELAY)!.events).toHaveLength(1);
  });

  it('a profile only the primary holds is built over, never replaced by a fresh one', async () => {
    const acc = testAccount();
    const net = network();
    const [old, chosen] = [dOf(acc.pubkey, 7), dOf(acc.pubkey, 1)];
    net.seed(profileEvent(acc, { has: [old], companion: old, createdAt: S - 100 }), [PRIMARY_RELAY]);
    const out = await writeCompanionProfile({ ...request(acc), d: chosen }, deps(net.relaysWithPrimary, acc));
    expect(out.kind).toBe('saved');
    const written = net.relays.get(DITTO)!.events[0];
    expect(written.tags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual([old, chosen]);
  });
});

describe('the redelivery of a profile, with the primary in the set', () => {
  const memory = (): DeliveryStore => {
    const data = new Map<string, string>();
    return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
  };

  it('a primary that was down when the profile was written is sent that very event later', async () => {
    const acc = testAccount();
    const net = network();
    const event = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S });
    net.seed(event, [DITTO, PRIMAL, BAND]);
    const store = memory();
    oweProfile(store, event);
    net.relays.get(PRIMARY_RELAY)!.down = true;
    expect(await deliverOwed(store, net.relaysWithPrimary, { timeoutMs: 50, sleep: async () => {} })).toBe(1);
    net.relays.get(PRIMARY_RELAY)!.down = false;
    expect(await deliverOwed(store, net.relaysWithPrimary, { timeoutMs: 50, sleep: async () => {} })).toBe(0);
    expect(net.relays.get(PRIMARY_RELAY)!.events.map((e) => e.id)).toEqual([event.id]);
    // The same signed event: same id, same signature
    expect(net.relays.get(PRIMARY_RELAY)!.sent[0]).toMatchObject({ id: event.id, sig: event.sig });
  });

  it('a primary that refuses (its write list) is no longer owed it: one offer, no resending', async () => {
    const acc = testAccount();
    const net = network();
    const event = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S });
    net.seed(event, [DITTO, PRIMAL, BAND]);
    net.relays.get(PRIMARY_RELAY)!.refuse = true;
    const store = memory();
    oweProfile(store, event);
    expect(await deliverOwed(store, net.relaysWithPrimary, { timeoutMs: 50, sleep: async () => {} })).toBe(0);
    await deliverOwed(store, net.relaysWithPrimary, { timeoutMs: 50, sleep: async () => {} });
    expect(net.relays.get(PRIMARY_RELAY)!.sent).toHaveLength(1);
    expect(readOwed(store)).toEqual({});
  });
});

describe('a profile owed from an earlier visit is an existing event', () => {
  const memory = (): DeliveryStore => {
    const data = new Map<string, string>();
    return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
  };
  function owed() {
    const acc = testAccount();
    const net = network();
    const event = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S });
    net.seed(event, [DITTO]);
    const store = memory();
    oweProfile(store, event);
    return { acc, net, event, store };
  }
  const run = (store: DeliveryStore, net: ReturnType<typeof network>, gate: CarryGate) => deliverOwed(store, net.relaysWithPrimary, { timeoutMs: 50, sleep: async () => {}, mayCarry: (e, url) => gate.mayCarry(e, url) });

  it('a restored session sends it nowhere, counts no try and keeps the record as it was', async () => {
    const { net, store } = owed();
    const before = JSON.stringify(readOwed(store));
    expect(await run(store, net, createCarryGate(null))).toBe(0);
    expect(net.sent()).toEqual([]);
    expect(JSON.stringify(readOwed(store))).toBe(before);
  });

  it('once the account turns copying on, it goes to the relays it agreed to, and to no other', async () => {
    const { acc, net, store } = owed();
    const gate = createCarryGate(null);
    gate.enable(acc.pubkey, [PRIMARY_RELAY, DITTO, PRIMAL]);
    await run(store, net, gate);
    expect(net.relays.get(PRIMARY_RELAY)!.sent).toHaveLength(1);
    expect(net.relays.get(PRIMAL)!.sent).toHaveLength(1);
    expect(net.relays.get(BAND)!.sent).toHaveLength(0); // not agreed to
    expect(net.relays.get(DITTO)!.sent).toHaveLength(0); // already has it
  });

  it('a profile written in this visit is delivered to the relays that missed it, as before', async () => {
    const { net, store, event } = owed();
    const gate = createCarryGate(null);
    gate.markSigned(event.id);
    await run(store, net, gate);
    expect(net.sent().map((e) => e.id)).toEqual([event.id, event.id, event.id]);
  });
});
