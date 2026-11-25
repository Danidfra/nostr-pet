/**
 * The player's extra relays in the pool (`setExtraRelays`): routed without a new pool, never counted for a
 * complete read or a saved write, and closed only once no write to them is on its way.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { PRIMARY_KINDS, PRIMARY_READ_KINDS } from '@/config/relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import { createHomePool } from './home-pool';
import { PublishUnconfirmedError } from './relay-transport';

const PRIMARY = 'wss://primary.test';
const DITTO = 'wss://ditto.test';
const PRIMAL = 'wss://primal.test';
const MINE = 'wss://mine.test';

let network: FakeNetwork;
const pool = () =>
  createHomePool({
    relays: [DITTO, PRIMAL],
    hints: [],
    primary: { url: PRIMARY, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS },
    absenceRequired: [PRIMARY, DITTO, PRIMAL],
    open: network.open,
    eoseTimeout: 30,
    relayTimeout: 300,
  });
const brook = (s = 100): NostrEvent => ({ ...blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: s }), id: String(s).padStart(64, '0') });

beforeEach(() => {
  network = fakeNetwork();
});

describe('extra relays', () => {
  it('a read relay is asked with every filter; a silent one never holds a read up or makes absence unknown', async () => {
    const nostr = pool();
    nostr.setExtraRelays([{ url: MINE, read: true, write: false }]);
    network.relay(MINE).mode = 'hanging';
    expect(await nostr.query([{ kinds: [31124], authors: [PUBKEY] }])).toEqual([]);
    expect(await nostr.query([{ kinds: [0], authors: [PUBKEY] }])).toEqual([]);
    expect(network.relay(MINE).requests.length).toBe(2);
  });

  it('an essential relay cannot be added as an extra (it keeps its own rules)', async () => {
    const nostr = pool();
    nostr.setExtraRelays([{ url: DITTO, read: false, write: false }]);
    network.relay(PRIMARY).events.push(brook());
    await nostr.query([{ kinds: [31124], authors: [PUBKEY] }]);
    expect(network.relay(DITTO).requests.length).toBe(1);
  });

  it('a write relay receives every write but its acceptance alone saves nothing', async () => {
    const nostr = pool();
    nostr.setExtraRelays([{ url: MINE, read: false, write: true }]);
    for (const url of [PRIMARY, DITTO, PRIMAL]) network.relay(url).refuseWith = 'blocked: no';
    await expect(nostr.event(brook(200))).rejects.toBeInstanceOf(PublishUnconfirmedError);
    expect(network.relay(MINE).published.map((e) => e.id)).toEqual([brook(200).id]);
  });

  it('a relay with read and send off is asked nothing and sent nothing', async () => {
    const nostr = pool();
    nostr.setExtraRelays([{ url: MINE, read: false, write: false }]);
    await nostr.event(brook(200));
    await nostr.query([{ kinds: [31124], authors: [PUBKEY] }]);
    expect(network.relays.has(MINE)).toBe(false);
  });

  it('taken out while a write to it is on its way: the write finishes, then the connection closes', async () => {
    const nostr = pool();
    nostr.setExtraRelays([{ url: MINE, read: true, write: true }]);
    const mine = network.relay(MINE);
    let release!: () => void;
    const original = mine.event.bind(mine);
    mine.event = async (e) => {
      await new Promise<void>((r) => (release = r));
      await original(e);
    };
    const write = nostr.event(brook(200));
    await new Promise((r) => setTimeout(r, 10));
    nostr.setExtraRelays([]);
    expect(mine.closed).toBe(false);
    release();
    await write;
    await new Promise((r) => setTimeout(r, 10));
    expect(mine.published).toHaveLength(1);
    expect(mine.closed).toBe(true);
    // Not asked again once out
    await nostr.query([{ kinds: [0], authors: [PUBKEY] }]);
    expect(mine.requests.length).toBe(0);
  });

  it('taken out while idle: closed at once; the essential connections are untouched', async () => {
    const nostr = pool();
    nostr.setExtraRelays([{ url: MINE, read: true, write: false }]);
    await nostr.query([{ kinds: [0], authors: [PUBKEY] }]);
    nostr.setExtraRelays([]);
    expect(network.relay(MINE).closed).toBe(true);
    expect([PRIMARY, DITTO, PRIMAL].map((u) => network.relay(u).closed)).toEqual([false, false, false]);
  });
});
