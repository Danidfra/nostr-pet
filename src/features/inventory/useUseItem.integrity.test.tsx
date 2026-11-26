/**
 * Using an item on the real pool over fake relays (the app's relay URLs, faked): nothing is spent on an
 * incomplete read, a spend is verified before its effect, an effect is applied at most once (found by id on a
 * resume, even after another write replaced the marker), and a use interrupted between the spend and the effect
 * finishes after a reload. None of this is distributed finality: see `useUseItem.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTagValue, updateBlobbiTags, type NostrEvent } from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, PRIMARY_KINDS, PRIMARY_READ_KINDS, PRIMARY_RELAY } from '@/config/relays';
import { createHomePool } from '@/lib/home-pool';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { ISLAND_INVENTORY, OFFICIAL_APPLE, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds, spendEvent } from '@/test/inventory-fixtures';
import { indexDefinitions, type HomeInventoryItem } from './useHomeInventory';
import { resolveHomeItem } from './item-model';
import { PET_OP_TAG } from './item-use-plan';
import { readLedger, updateStatus } from './spend-ledger';

let signed = 0;
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: PUBKEY, signer: { signEvent: async (t: { created_at: number }) => ({ ...t, pubkey: PUBKEY, id: `${String(++signed).padStart(4, '0')}`.padEnd(64, 'a'), sig: 's' }) } },
  }),
}));
import { useUseItem } from './useUseItem';

let network: FakeNetwork;
const D = getTagValue(blobbiEvent('0000000001').tags, 'd')!;
const definition = officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 20 });
const item = resolveHomeItem(OFFICIAL_APPLE, indexDefinitions([definition]).get(OFFICIAL_APPLE));
const entry = { item, quantity: 1, inventoryAddress: ISLAND_INVENTORY, source: {}, usability: { ok: true }, unverified: false } as unknown as HomeInventoryItem;

function seed() {
  const blobbi = blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', set: { hunger: '40' }, createdAt: Math.floor(Date.now() / 1000) - 600 });
  for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(blobbi, inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 1 }), definition);
}

function setup() {
  const nostr = createHomePool({ relays: BASE_RELAYS, hints: [], primary: { url: PRIMARY_RELAY, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS }, open: network.open, eoseTimeout: 30, relayTimeout: 300 });
  const updated: NostrEvent[] = [];
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <NostrContext.Provider value={{ nostr }}>{children}</NostrContext.Provider>
    </QueryClientProvider>
  );
  const view = renderHook(() => useUseItem({ pubkey: PUBKEY, known: [entry], updateCompanionEvent: (e) => void updated.push(e), invalidate: () => {} }), { wrapper });
  return { ...view, updated };
}

async function use(result: { current: ReturnType<typeof useUseItem> }): Promise<string | null> {
  await act(async () => {
    result.current.use({ entry, blobbiD: D });
  });
  await act(async () => {
    for (let i = 0; i < 1200 && result.current.isPending; i++) await new Promise((r) => setTimeout(r, 10));
  });
  return result.current.error?.message ?? null;
}

const published = (kind: number) => [...new Map(network.published().filter((p) => p.event.kind === kind).map((p) => [p.event.id, p.event])).values()];
const effects = () => published(31124).filter((e) => getTagValue(e.tags, PET_OP_TAG));

beforeEach(() => {
  network = fakeNetwork();
  signed = 0;
  resetInventoryFixtureIds();
  localStorage.clear();
});

describe('using an item, safely', () => {
  it('spends once, verifies, then applies the effect once, with the spend named on the Blobbi', async () => {
    seed();
    const { result, updated } = setup();
    expect(await use(result)).toBeNull();
    const [spend] = published(1416);
    const [effect] = effects();
    expect(getTagValue(effect.tags, PET_OP_TAG)).toBe(spend.id);
    expect(Number(getTagValue(effect.tags, 'hunger'))).toBeGreaterThan(40);
    expect(updated.map((e) => e.id)).toEqual([effect.id]);
    expect(readLedger(PUBKEY)[0]).toMatchObject({ spendId: spend.id, status: 'applied', effect: { id: effect.id } });
  });

  it('a relay that counts is silent before spending: nothing is signed or spent', async () => {
    seed();
    network.relay(ABSENCE_REQUIRED_RELAYS[1]).mode = 'hanging';
    const { result } = setup();
    expect(await use(result)).toMatch(/could not be checked for certain|could not be read/i);
    expect(signed).toBe(0);
    expect(published(1416)).toEqual([]);
  }, 15_000);

  it('another device took the last one first: the spend is rejected and no effect is applied', async () => {
    seed();
    // As our spend lands, a spend from another device, signed earlier, reaches the relays too
    const primary = network.relay(PRIMARY_RELAY);
    const original = primary.event.bind(primary);
    let injected = false;
    primary.event = async (e) => {
      await original(e);
      if (e.kind === 1416 && !injected) {
        injected = true;
        const theirs = spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE, { createdAt: e.created_at - 100 });
        for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(theirs);
      }
    };
    const { result, updated } = setup();
    expect(await use(result)).toMatch(/already used up elsewhere/);
    expect(effects()).toEqual([]);
    expect(updated).toEqual([]);
    expect(readLedger(PUBKEY)).toEqual([]);
  });

  it('an effect whose save was not confirmed is planned again from the Blobbi as it is, and lands once', async () => {
    seed();
    for (const url of ABSENCE_REQUIRED_RELAYS) {
      const relay = network.relay(url);
      const original = relay.event.bind(relay);
      relay.event = async (e) => {
        if (e.kind === 31124 && relay.refuseWith === null && (relay as unknown as { down?: boolean }).down) throw new Error('blocked: down');
        await original(e);
      };
      (relay as unknown as { down?: boolean }).down = true;
    }
    const { result } = setup();
    expect(await use(result)).toMatch(/Apple/);
    expect(readLedger(PUBKEY)[0]).toMatchObject({ status: 'effect-pending' });
    for (const url of ABSENCE_REQUIRED_RELAYS) (network.relay(url) as unknown as { down?: boolean }).down = false;
    expect(await use(result)).toBeNull();
    const onCounted = ABSENCE_REQUIRED_RELAYS.flatMap((url) => network.relay(url).events.filter((e) => e.kind === 31124 && getTagValue(e.tags, PET_OP_TAG)));
    expect(new Set(onCounted.map((e) => e.id)).size).toBe(1);
    expect(readLedger(PUBKEY)[0].status).toBe('applied');
  });

  it('an effect that landed is found by id on a resume, even after another app replaced the marker: never applied twice', async () => {
    seed();
    const { result } = setup();
    expect(await use(result)).toBeNull();
    const [effect] = effects();
    // The answer was lost (the page left before it came back), and another app wrote the Blobbi with its own marker
    updateStatus(PUBKEY, readLedger(PUBKEY)[0].spendId, 'effect-pending');
    const other = { ...effect, id: 'b'.repeat(64), created_at: effect.created_at + 5, tags: updateBlobbiTags(effect.tags, { [PET_OP_TAG]: 'c'.repeat(64) }) };
    for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(other);
    const before = effects().length;
    expect(await use(result)).toBeNull();
    expect(effects().length).toBe(before);
    expect(readLedger(PUBKEY)[0].status).toBe('applied');
  });

  it('a reload between the spend and the effect: the next use finishes this one first, once', async () => {
    seed();
    // The spend lands, then the page goes before the effect: the ledger keeps it established
    for (const url of ABSENCE_REQUIRED_RELAYS) {
      const relay = network.relay(url);
      const original = relay.event.bind(relay);
      relay.event = async (e) => {
        if (e.kind === 31124) throw new Error('timeout: the page went away');
        await original(e);
      };
    }
    const first = setup();
    await use(first.result);
    expect(readLedger(PUBKEY)[0].status).toMatch(/established|effect-pending/);
    first.unmount();
    // A new page: the relays work again
    for (const url of ABSENCE_REQUIRED_RELAYS) delete (network.relay(url) as unknown as { event?: unknown }).event;
    const second = setup();
    expect(await use(second.result)).toBeNull();
    expect(published(1416)).toHaveLength(1);
    // One effect on the relays that count; an earlier attempt only relay.nostr.band took is older, so superseded
    const counted = ABSENCE_REQUIRED_RELAYS.flatMap((url) => network.relay(url).events.filter((e) => e.kind === 31124 && getTagValue(e.tags, PET_OP_TAG)));
    expect(new Set(counted.map((e) => e.id)).size).toBe(1);
    expect(Math.max(...effects().map((e) => e.created_at))).toBe(counted[0].created_at);
    expect(readLedger(PUBKEY)[0].status).toBe('applied');
  });
});
