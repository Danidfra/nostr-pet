/**
 * When a write counts as saved (`home-pool.ts`, `confirmationRelaysFor`): on
 * fake relays, the primary and the two relays every Blobbi app writes to
 * count for the Blobbi kinds; an extra relay does not.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { PRIMARY_KINDS, PRIMARY_READ_KINDS } from '@/config/relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import { isAmbiguousPublishError } from '@/features/inventory/useUseItem';
import { classifyPublication, createHomePool, type PublishOutcome } from './home-pool';
import { PublishUnconfirmedError } from './relay-transport';

const PRIMARY = 'wss://primary.test';
const DITTO = 'wss://ditto.test';
const PRIMAL = 'wss://primal.test';
const EXTRA = 'wss://extra.test';

let network: FakeNetwork;
let outcomes: PublishOutcome[];

function pool() {
  return createHomePool({
    relays: [DITTO, PRIMAL, EXTRA],
    hints: [],
    primary: { url: PRIMARY, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS },
    absenceRequired: [PRIMARY, DITTO, PRIMAL],
    profileRequired: [DITTO, PRIMAL],
    open: network.open,
    eoseTimeout: 30,
    relayTimeout: 300,
    observer: { outcome: (_, outcome) => outcomes.push(outcome) },
  });
}

const revision = (seconds: number, name: string): NostrEvent => ({ ...blobbiEvent('0000000001', { name, stage: 'baby', createdAt: seconds }), id: String(seconds).padStart(64, '0') });
const settled = () => new Promise((r) => setTimeout(r, 50));

beforeEach(() => {
  network = fakeNetwork();
  outcomes = [];
});

describe('a write that counts', () => {
  it('only an extra relay took a Blobbi write: not confirmed, ambiguous, and not what the page builds on next', async () => {
    const old = revision(100, 'Old');
    for (const url of [PRIMARY, DITTO, PRIMAL]) {
      network.relay(url).events.push(old);
      network.relay(url).refuseWith = 'blocked: not now';
    }
    const nostr = pool();
    const error = await nostr.event(revision(200, 'New')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PublishUnconfirmedError);
    expect((error as PublishUnconfirmedError).acceptedBy).toEqual([EXTRA]);
    expect(isAmbiguousPublishError(error)).toBe(true);
    await settled();
    expect(outcomes).toEqual(['unconfirmed']);
    // The extra relay silent now: the read is the counted relays' answer, never the unconfirmed revision from memory
    network.relay(EXTRA).mode = 'hanging';
    const [read] = await nostr.query([{ kinds: [31124], authors: [PUBKEY] }]);
    expect(read.id).toBe(old.id);
  });

  it('waits for a counted relay: a fast extra relay alone does not end the write', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).refuseWith = 'blocked: no';
    const nostr = pool();
    const original = network.relay(PRIMARY).event.bind(network.relay(PRIMARY));
    let primaryDone = false;
    network.relay(PRIMARY).event = async (e) => {
      await new Promise((r) => setTimeout(r, 120));
      await original(e);
      primaryDone = true;
    };
    await nostr.event(revision(200, 'New'));
    expect(primaryDone).toBe(true);
  });

  it('partially delivered: saved by the primary, refused by the others; a reload reads it back', async () => {
    for (const url of [DITTO, PRIMAL]) {
      network.relay(url).events.push(revision(100, 'Old'));
      network.relay(url).refuseWith = 'blocked: no';
    }
    network.relay(PRIMARY).events.push(revision(100, 'Old'));
    await pool().event(revision(200, 'New'));
    await settled();
    expect(outcomes).toEqual(['partial']);
    // A reload: a new pool, nothing remembered; the primary's newer revision wins the read
    const [read] = await pool().query([{ kinds: [31124], authors: [PUBKEY] }]);
    expect(read.id).toBe(revision(200, 'New').id);
  });

  it('a stale relay answering an older revision after the write never takes the page back', async () => {
    const nostr = pool();
    for (const url of [PRIMARY, DITTO, PRIMAL, EXTRA]) network.relay(url).events.push(revision(100, 'Old'));
    await nostr.event(revision(200, 'New'));
    // Every relay but the primary lost the write (a relay restored from a backup); the primary is silent
    for (const url of [DITTO, PRIMAL, EXTRA]) network.relay(url).events = [revision(100, 'Old')];
    network.relay(PRIMARY).mode = 'hanging';
    const read = await nostr.query([{ kinds: [31124], authors: [PUBKEY] }]).catch((e: Error) => e);
    // Either unknown (the primary must answer) or the newer revision this page wrote: never the old one
    if (Array.isArray(read)) expect(read[0].id).toBe(revision(200, 'New').id);
    else expect(read.name).toBe('RelayReadUnknownError');
  });

  it('the same bytes offered again once a counted relay is back: saved, and nothing else is written', async () => {
    for (const url of [PRIMARY, DITTO, PRIMAL]) network.relay(url).refuseWith = 'blocked: down';
    const nostr = pool();
    const event = revision(200, 'New');
    await expect(nostr.event(event)).rejects.toBeInstanceOf(PublishUnconfirmedError);
    network.relay(PRIMARY).refuseWith = null;
    network.relay(EXTRA).refuseWith = 'duplicate: already have it';
    await nostr.event(event);
    expect(new Set(network.published().map((p) => p.event.id))).toEqual(new Set([event.id]));
  });

  it('refused everywhere: the refusals, as before, and not ambiguous', async () => {
    for (const url of [PRIMARY, DITTO, PRIMAL, EXTRA]) network.relay(url).refuseWith = 'blocked: no';
    const error = await pool().event(revision(200, 'New')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AggregateError);
    expect(isAmbiguousPublishError(error)).toBe(false);
    await settled();
    expect(outcomes).toEqual(['rejected']);
  });

  it('a kind 0 counts on the profile relays; a plain kind on any relay, as before', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).refuseWith = 'blocked: no';
    const metadata: NostrEvent = { id: '0'.repeat(63) + '1', pubkey: PUBKEY, kind: 0, created_at: 1, tags: [], content: '{}', sig: 's' };
    await expect(pool().event(metadata)).rejects.toBeInstanceOf(PublishUnconfirmedError);
    const receipt: NostrEvent = { ...metadata, id: '0'.repeat(63) + '2', kind: 1124 };
    await pool().event(receipt);
  });
});

describe('classifying a write', () => {
  it.each([
    [[true, true], 'confirmed'],
    [[true, false], 'partial'],
    [[false, false], 'rejected'],
  ] as const)('counted relays %j', (accepted, outcome) => {
    expect(classifyPublication([{ relay: 'a', accepted: accepted[0] }, { relay: 'b', accepted: accepted[1] }, { relay: 'x', accepted: false }], ['a', 'b'])).toBe(outcome);
  });

  it('only another relay: unconfirmed; a plain kind counts everyone', () => {
    expect(classifyPublication([{ relay: 'a', accepted: false }, { relay: 'x', accepted: true }], ['a'])).toBe('unconfirmed');
    expect(classifyPublication([{ relay: 'a', accepted: false }, { relay: 'x', accepted: true }], null)).toBe('partial');
  });
});
