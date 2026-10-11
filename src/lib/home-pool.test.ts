/**
 * The home pool never leaves a read hanging: a page that cannot reach
 * relays at all is refused at once with the reason (reads and writes
 * alike, before any socket), and a read no relay answers ends at the
 * deadline in an error rather than in a silent empty answer. A caller's own
 * abort still gets what the pool has, as before.
 */
import { describe, expect, it } from 'vitest';
import { createHomePool } from './home-pool';
import { checkRelayTransport, RelayTimeoutError, RelayTransportError } from './relay-transport';
import { fakeNetwork } from '@/test/fake-relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const APP = 'wss://app.test';
const BLOCKED = checkRelayTransport({ crypto: { getRandomValues: () => {} }, isSecureContext: false, location: { protocol: 'http:', host: '192.168.1.4:8080' } })!;
const read = [{ kinds: [31124], authors: [PUBKEY] }];

describe('the home pool', () => {
  it('refuses every read and write at once, with the reason, when the page cannot reach relays; no socket is opened', async () => {
    const network = fakeNetwork();
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, transport: BLOCKED });
    await expect(pool.query(read)).rejects.toBeInstanceOf(RelayTransportError);
    await expect(pool.query(read)).rejects.toThrow(/plain HTTP/);
    await expect(pool.event(blobbiEvent('0000000001', { name: 'Brook' }))).rejects.toBeInstanceOf(RelayTransportError);
    await expect((async () => {
      for await (const _ of pool.req(read)) void _;
    })()).rejects.toBeInstanceOf(RelayTransportError);
    expect(network.relays.size).toBe(0);
  });

  it('a read no relay answers fails at the deadline instead of hanging, and a relay whose REQ throws counts as silence', async () => {
    const network = fakeNetwork();
    network.relay(APP).mode = 'hanging';
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, transport: null, readTimeout: 60 });
    await expect(pool.query(read)).rejects.toBeInstanceOf(RelayTimeoutError);
    network.relay(APP).mode = 'offline';
    await expect(pool.query(read)).rejects.toThrow(/No relay answered/);
  });

  it('a relay that answers is read as before, within the deadline', async () => {
    const network = fakeNetwork();
    network.relay(APP).events.push(blobbiEvent('0000000001', { name: 'Brook' }));
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, transport: null, readTimeout: 500, eoseTimeout: 10 });
    const events = await pool.query(read);
    expect(events).toHaveLength(1);
  });

  it("the caller's own abort still gets what the pool has (not an error), as nostrify promises", async () => {
    const network = fakeNetwork();
    network.relay(APP).mode = 'hanging';
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, transport: null, readTimeout: 5_000 });
    await expect(pool.query(read, { signal: AbortSignal.timeout(30) })).resolves.toEqual([]);
  });

  it('asks the browser when not told: under vitest the page is secure, so nothing is refused', async () => {
    const network = fakeNetwork();
    network.relay(APP).events.push(blobbiEvent('0000000001', { name: 'Brook' }));
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, eoseTimeout: 10 });
    await expect(pool.query(read)).resolves.toHaveLength(1);
  });
});
