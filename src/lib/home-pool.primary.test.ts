/**
 * The pool with a PRIMARY relay (`wss://relay.blobbi.pet` in the app; a fake
 * here, like every relay in this file: nothing touches a real one).
 *
 * What is proven: the primary is first for the Blobbi kinds and absent from
 * every other flow; an empty or fast primary never reads as "no Blobbi";
 * a silent relay never reads as "empty"; the NIP-01 winner stands whichever
 * relay had it; a write stands on a secondary's word and every destination's
 * verdict is told.
 */
import { describe, expect, it } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { createHomePool, type HomePoolObserver } from './home-pool';
import { RelayReadUnknownError, RelayTimeoutError } from './relay-transport';
import type { DeliveryResult } from './blobbi-relay-routing';
import type { RelayReadReport } from './relay-sync';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const PRIMARY = 'wss://primary.test';
const A = 'wss://a.test';
const B = 'wss://b.test';
const EXTRA = 'wss://extra.test';
const BLOBBI_KINDS = [31124, 11125, 1124, 31633, 1416];
const collection: NostrFilter[] = [{ kinds: [31124], authors: [PUBKEY] }];

function pool(network: FakeNetwork, over: Partial<Parameters<typeof createHomePool>[0]> = {}) {
  return createHomePool({
    relays: [A, B],
    hints: [],
    primary: { url: PRIMARY, readKinds: BLOBBI_KINDS, writeKinds: BLOBBI_KINDS },
    absenceRequired: [PRIMARY, A, B],
    open: network.open,
    transport: null,
    readTimeout: 2_000,
    relayTimeout: 80,
    eoseTimeout: 30,
    ...over,
  });
}

const older = () => blobbiEvent('0000000001', { name: 'Old', createdAt: 1_757_000_000 });
const newer = () => ({ ...blobbiEvent('0000000001', { name: 'New', createdAt: 1_757_000_500 }), id: 'f'.repeat(64) });

describe('routing with a primary relay', () => {
  it('asks the primary first for a Blobbi kind, and every application relay after it', async () => {
    const network = fakeNetwork();
    await pool(network).query(collection);
    expect([...network.relays.keys()]).toEqual([PRIMARY, A, B]);
  });

  it('never asks the primary for profile metadata, themes, NIP-46 or an ids lookup', async () => {
    const network = fakeNetwork();
    const p = pool(network);
    await p.query([{ kinds: [0], authors: [PUBKEY], limit: 1 }]);
    await p.query([{ kinds: [36767], authors: [PUBKEY], limit: 1 }]);
    await p.query([{ ids: ['c'.repeat(64)], limit: 1 }]);
    const stop = new AbortController();
    const stream = p.req([{ kinds: [24133], '#p': [PUBKEY] }], { signal: stop.signal })[Symbol.asyncIterator]();
    await stream.next();
    stop.abort();
    expect(network.relays.has(PRIMARY)).toBe(false);
    expect(network.relay(A).requests).toHaveLength(4);
  });

  it('in a mixed read the primary gets only the filters for its kinds', async () => {
    const network = fakeNetwork();
    const theme: NostrFilter = { kinds: [36767], authors: [PUBKEY] };
    await pool(network).query([collection[0], theme]);
    expect(network.relay(PRIMARY).requests).toEqual([[collection[0]]]);
    expect(network.relay(A).requests).toEqual([[collection[0], theme]]);
  });

  it('publishes a Blobbi kind to the primary and the application relays; kind 0 and NIP-46 to the application relays only', async () => {
    const network = fakeNetwork();
    const p = pool(network);
    await p.event(older());
    await p.event({ ...older(), id: '1'.repeat(64), kind: 0, tags: [] });
    await p.event({ ...older(), id: '2'.repeat(64), kind: 24133, tags: [] });
    await Promise.resolve();
    expect(network.published().map((x) => `${x.event.kind}@${x.url}`)).toEqual([`31124@${PRIMARY}`, `31124@${A}`, `0@${A}`, `24133@${A}`, `31124@${B}`, `0@${B}`, `24133@${B}`]);
  });
});

describe('a Blobbi read over the primary and the secondaries', () => {
  it('an EMPTY primary that answers first never hides what a slower secondary holds', async () => {
    const network = fakeNetwork();
    network.relay(A).mode = 'slow';
    network.relay(A).delayMs = 60; // well past the grace: the old pool would have answered [] here
    network.relay(A).events.push(older());
    const events = await pool(network).query(collection);
    expect(events.map((e) => e.id)).toEqual([older().id]);
  });

  it('an empty primary with the secondaries silent is UNKNOWN, never an empty answer', async () => {
    const network = fakeNetwork();
    network.relay(A).mode = 'hanging';
    network.relay(B).mode = 'offline';
    const reading = pool(network).query(collection);
    await expect(reading).rejects.toBeInstanceOf(RelayReadUnknownError);
    await expect(reading).rejects.toMatchObject({ silent: [A, B] });
  });

  it('a primary that is down, with the secondaries empty, is unknown too: the primary may be the only one holding it', async () => {
    const network = fakeNetwork();
    network.relay(PRIMARY).mode = 'offline';
    await expect(pool(network).query(collection)).rejects.toBeInstanceOf(RelayReadUnknownError);
  });

  it('empty is a fact once every relay that must answer said so', async () => {
    const network = fakeNetwork();
    await expect(pool(network).query(collection)).resolves.toEqual([]);
  });

  it('a relay that need not answer is heard in time and never waited for past the grace', async () => {
    const network = fakeNetwork();
    network.relay(EXTRA).mode = 'hanging';
    const p = pool(network, { relays: [A, B, EXTRA] });
    await expect(p.query(collection)).resolves.toEqual([]);
    network.relay(EXTRA).mode = 'ok';
    network.relay(EXTRA).events.push(older());
    await expect(p.query(collection)).resolves.toHaveLength(1);
  });

  it('nobody answering is the timeout it always was', async () => {
    const network = fakeNetwork();
    for (const url of [PRIMARY, A, B]) network.relay(url).mode = 'hanging';
    await expect(pool(network).query(collection)).rejects.toBeInstanceOf(RelayTimeoutError);
  });

  it("the caller's abort with nothing known is an error, not an empty answer", async () => {
    const network = fakeNetwork();
    for (const url of [A, B]) network.relay(url).mode = 'hanging';
    await expect(pool(network, { relayTimeout: 5_000 }).query(collection, { signal: AbortSignal.timeout(30) })).rejects.toBeInstanceOf(RelayReadUnknownError);
  });

  it('with events in hand a silent relay is waited for only for the grace: the answer is what the others hold', async () => {
    const network = fakeNetwork();
    network.relay(PRIMARY).mode = 'hanging';
    network.relay(A).events.push(older());
    const events = await pool(network, { relayTimeout: 5_000 }).query(collection);
    expect(events).toHaveLength(1);
  });

  it('the NIP-01 winner stands wherever it came from: a newer revision on a secondary beats the primary', async () => {
    const network = fakeNetwork();
    network.relay(PRIMARY).events.push(older());
    network.relay(A).events.push(older());
    network.relay(B).events.push(newer());
    const events = await pool(network).query(collection);
    expect(events.map((e) => e.id)).toEqual([newer().id]);
  });

  it('on equal created_at the lower id wins, and regular events are all kept, once each', async () => {
    const network = fakeNetwork();
    const tie = { ...older(), id: '0'.repeat(63) + '1' };
    network.relay(PRIMARY).events.push(older());
    network.relay(A).events.push(tie);
    const care = (id: string): NostrEvent => ({ id: id.repeat(64), pubkey: PUBKEY, kind: 1124, created_at: 1_757_000_100, tags: [], content: '', sig: '0'.repeat(128) });
    network.relay(PRIMARY).events.push(care('a'), care('b'));
    network.relay(B).events.push(care('b'), care('c'));
    const p = pool(network);
    expect((await p.query(collection)).map((e) => e.id)).toEqual([tie.id]);
    expect((await p.query([{ kinds: [1124], authors: [PUBKEY], limit: 500 }])).map((e) => e.id[0]).sort()).toEqual(['a', 'b', 'c']);
  });

  it('a relay holding an OLDER revision, answering alone, never undoes what this page already read', async () => {
    const network = fakeNetwork();
    network.relay(PRIMARY).events.push(newer());
    network.relay(A).events.push(older());
    network.relay(B).events.push(older());
    const p = pool(network);
    expect((await p.query(collection))[0].id).toBe(newer().id);
    // The relay with the newest goes silent: the others alone would answer with the old state
    network.relay(PRIMARY).mode = 'hanging';
    expect((await p.query(collection)).map((e) => e.id)).toEqual([newer().id]);
  });

  it('nor what this page just published, when only a relay that missed it answers', async () => {
    const network = fakeNetwork();
    network.relay(A).events.push(older());
    network.relay(B).mode = 'offline';
    network.relay(PRIMARY).mode = 'offline';
    const p = pool(network);
    network.relay(A).mode = 'offline';
    network.relay(B).mode = 'ok';
    await p.event(newer()); // lands on B only
    network.relay(B).mode = 'hanging';
    network.relay(A).mode = 'ok';
    expect((await p.query(collection)).map((e) => e.id)).toEqual([newer().id]);
  });
});

describe('what the pool tells its observer', () => {
  function observed() {
    const deliveries: { id: string; result: DeliveryResult }[] = [];
    const reads: RelayReadReport[][] = [];
    const observer: HomePoolObserver = { delivery: (event, result) => deliveries.push({ id: event.id, result }), read: (_filters, reports) => reads.push([...reports]) };
    return { deliveries, reads, observer };
  }
  const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

  it('a write the primary refuses stands on the secondary, and each destination is reported', async () => {
    const network = fakeNetwork();
    network.relay(PRIMARY).refuseWith = 'blocked: this relay is in pilot mode; author is not on the write list';
    network.relay(B).mode = 'offline';
    const { deliveries, observer } = observed();
    await expect(pool(network, { observer }).event(older())).resolves.toBeUndefined();
    await settled();
    const by = Object.fromEntries(deliveries.map((d) => [d.result.relay, d.result.verdict]));
    expect(by).toEqual({ [PRIMARY]: 'rejected', [A]: 'accepted', [B]: 'retry' });
    expect(deliveries.find((d) => d.result.relay === PRIMARY)?.result.message).toMatch(/^blocked:/);
  });

  it('a write nobody accepts still fails, as before; `duplicate:` counts as held', async () => {
    const network = fakeNetwork();
    for (const url of [PRIMARY, A, B]) network.relay(url).refuseWith = 'blocked: no';
    await expect(pool(network).event(older())).rejects.toBeInstanceOf(AggregateError);
    network.relay(A).refuseWith = 'duplicate: already have this event';
    await expect(pool(network).event(older())).resolves.toBeUndefined();
  });

  it('a finished read is reported relay by relay, with what each was asked and how it ended', async () => {
    const network = fakeNetwork();
    network.relay(A).events.push(older());
    network.relay(B).mode = 'hanging';
    const { reads, observer } = observed();
    await pool(network, { observer }).query(collection);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(reads).toHaveLength(1);
    expect(reads[0].map((r) => [r.relay, r.status, r.events.length])).toEqual([
      [PRIMARY, 'eose', 0],
      [A, 'eose', 1],
      [B, 'failed', 0],
    ]);
    expect(reads[0][0].asked).toEqual(collection);
  });
});
