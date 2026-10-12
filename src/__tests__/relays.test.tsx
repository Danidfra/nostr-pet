/**
 * Relay discovery through the REAL pool and fake relays: what the ecosystem
 * wrote elsewhere is found through read hints; a hint that misbehaves costs
 * nothing but its own answer; a hinted relay is never published to; and
 * nothing a relay serves is trusted for having been served.
 *
 * The application relay in these tests is `wss://app.test`, which is not an
 * ecosystem relay, so every ecosystem event has to be found through a hint.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NostrEvent } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY_SPEND, parseGameInventorySpend } from '@nostr-games/inventory';

import Home from '@/pages/Home';
import { createHomePool } from '@/lib/home-pool';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { PET_OP_TAG, readLedger } from '@/features/inventory';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import {
  FARM_CARROT,
  FARM_INVENTORY,
  ISLAND_INVENTORY,
  OFFICIAL_APPLE,
  OFFICIAL_GLASSES,
  farmProduceDefinition,
  inventoryEvent,
  officialCareDefinition,
  officialCosmeticDefinition,
  placementEvent,
  resetInventoryFixtureIds,
} from '@/test/inventory-fixtures';

let signCount = 0;
const signer = {
  async signEvent(template: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...template, id: String(signCount).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const APP = 'wss://app.test';
const DITTO = 'wss://relay.ditto.pub';
const PRIMAL = 'wss://relay.primal.net';
const DREAMITH = 'wss://relay.dreamith.to';
/** Well under the pool's grace period in these tests, so slow-but-alive relays are heard. */
const EOSE_GRACE_MS = 150;

let network: FakeNetwork;

const FAST: Partial<SceneSettings> = { walkSpeed: 4, idleEnabled: false };

function renderHome(options: { relays?: string[]; settings?: Partial<SceneSettings> } = {}) {
  const pool = createHomePool({ relays: options.relays ?? [APP], open: network.open, eoseTimeout: EOSE_GRACE_MS });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <SceneSettingsProvider value={options.settings ?? FAST}>
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <Home />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
  return { ...view, pool };
}

const NOW = Math.floor(Date.now() / 1000);
const BROOK_D = 'blobbi-aaaaaaaaaaaa-0000000001';
const brook = () => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });

const accessories = () => [...document.querySelectorAll('[data-testid="blobbi-actor"] [data-accessory-code]')].map((el) => el.getAttribute('data-accessory-code'));

function giveSceneABox() {
  const scene = screen.getByTestId('room-canvas');
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
}
async function openItems() {
  // A use stays visible for a moment after its write; the bag waits for it.
  await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 4000 });
  await userEvent.click(screen.getByTestId('action-items'));
  return screen.findByTestId('inventory-sheet');
}

/** The ecosystem as the live relays hold it: the Blobbi at home, everything else elsewhere. */
function seedEcosystem() {
  network.relay(APP).events = [brook()];
  network.relay(DITTO).events = [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_GLASSES]: 1 }), farmProduceDefinition(), placementEvent(BROOK_D, [{ id: 'eyewear', item: OFFICIAL_GLASSES, mode: 'equip', slot: 'eyewear', position: { x: 50, y: 46 } }])];
  network.relay(PRIMAL).events = [inventoryEvent('farm:main', { [FARM_CARROT]: 4 })];
  network.relay(DREAMITH).events = [officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }, { emoji: '🍎' }), officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear')];
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  network = fakeNetwork();
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
});

describe('Relay hints: discovery', () => {
  it('finds inventories, definitions and equipment that only ecosystem relays hold', async () => {
    seedEcosystem();
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items, 2 ready'), { timeout: 4000 });
    await openItems();
    const island = within(screen.getByTestId('inventory-source-blobbi:island'));
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 2');
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveAttribute('data-usable', 'true');
    expect(island.getByTestId('inventory-item-blobbi:cosmetic:stargazer-glasses')).toHaveAccessibleName(/Stargazer Glasses, 1/);
    expect(within(screen.getByTestId('inventory-source-farm:main')).getByTestId('inventory-item-farm:produce:carrot')).toHaveAccessibleName('Carrot, 4');
    await waitFor(() => expect(accessories()).toEqual([OFFICIAL_GLASSES]));

    // Transport was narrowed per relay: the issuer relay saw definition requests for the
    // official issuer and nothing else; the application relay saw everything.
    const kindsAsked = (url: string) => new Set(network.relay(url).requests.flat().flatMap((f) => f.kinds ?? []));
    expect(kindsAsked(DREAMITH)).toEqual(new Set([31632]));
    for (const f of network.relay(DREAMITH).requests.flat()) expect(f.authors).toEqual(['9efb8d3045ba753f3664d503308b49783356b26a6d5f4b944bfac4239afe63a9']);
    expect(kindsAsked(APP)).toEqual(new Set([31124, 11125, 31125, 31633, 1416, 1417, 31632, 31634]));
    expect(kindsAsked(DITTO).has(31124)).toBe(false);
    // Nothing was published anywhere for reading.
    expect(network.published()).toEqual([]);
  });

  it('spells a relay one way: duplicate hints and slashes open one connection and one request each', async () => {
    seedEcosystem();
    const pool = createHomePool({
      relays: ['wss://app.test/', 'WSS://APP.TEST', 'wss://relay.ditto.pub'],
      hints: [
        { label: 'twice', kinds: [31633], relays: ['wss://relay.ditto.pub/', 'wss://relay.ditto.pub', 'WSS://Relay.Ditto.Pub'] },
        { label: 'junk', kinds: [31633], relays: ['ws://relay.ditto.pub', 'relay.ditto.pub', 'javascript:alert(1)', ''] },
      ],
      open: network.open,
      eoseTimeout: EOSE_GRACE_MS,
    });
    const events = await pool.query([{ kinds: [31633], authors: [PUBKEY] }]);
    expect(events.map((e) => getTagValue(e.tags, 'd'))).toEqual(['blobbi:island']);
    expect([...network.relays.values()].filter((r) => r.requests.length > 0).map((r) => r.url)).toEqual([APP, DITTO]);
    expect(network.relay(APP).requests).toHaveLength(1);
    expect(network.relay(DITTO).requests).toHaveLength(1);
  });
});

describe('Relay hints: failure', () => {
  it('an offline, a hanging and a slow hinted relay leave the home standing with what the others served', async () => {
    seedEcosystem();
    network.relay(DREAMITH).mode = 'offline';
    network.relay(PRIMAL).mode = 'hanging';
    network.relay(DITTO).mode = 'slow';
    network.relay(DITTO).delayMs = 40;
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName(/Items/), { timeout: 4000 });
    await openItems();
    // The island inventory came from the slow relay; its definitions were on the offline one.
    const island = within(await screen.findByTestId('inventory-source-blobbi:island'));
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName(/Unknown Blobbi item, 2/);
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveAttribute('data-usable', 'false');
    // The farm inventory was behind the hanging relay: absent, not an error.
    expect(screen.queryByTestId('inventory-source-farm:main')).toBeNull();
    expect(screen.queryByTestId('inventory-error')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a hinted relay slower than the grace period is simply not waited for', async () => {
    seedEcosystem();
    network.relay(DITTO).mode = 'slow';
    network.relay(DITTO).delayMs = EOSE_GRACE_MS * 4;
    const pool = createHomePool({ relays: [APP], open: network.open, eoseTimeout: EOSE_GRACE_MS });
    const started = Date.now();
    const events = await pool.query([{ kinds: [31633], authors: [PUBKEY] }]);
    expect(Date.now() - started).toBeLessThan(EOSE_GRACE_MS * 3);
    expect(events.map((e) => getTagValue(e.tags, 'd'))).toEqual(['farm:main']);
  });

  it('every relay down still resolves: the read is empty, not stuck', async () => {
    seedEcosystem();
    for (const url of [APP, DITTO, PRIMAL, DREAMITH]) network.relay(url).mode = 'offline';
    const pool = createHomePool({ relays: [APP], open: network.open, eoseTimeout: EOSE_GRACE_MS });
    await expect(pool.query([{ kinds: [31633], authors: [PUBKEY] }], { signal: AbortSignal.timeout(1000) })).resolves.toEqual([]);
  });
});

describe('Relay hints: trust', () => {
  it('a definition served by a hinted relay is not believed for being served', async () => {
    seedEcosystem();
    const stranger = 'b'.repeat(64);
    const forged = officialCareDefinition('blobbi:food:apple', 'Poison Apple', 'food', 'feed', { hunger: 999 });
    forged.pubkey = stranger;
    // The issuer relay misbehaves: it serves the stranger's look-alike although the
    // filter asked for the official issuer, and it does not hold the real one.
    network.relay(DREAMITH).mode = 'unfiltered';
    network.relay(DREAMITH).events = [forged, officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear')];
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName(/Items/), { timeout: 4000 });
    await openItems();
    const apple = within(screen.getByTestId('inventory-source-blobbi:island')).getByTestId('inventory-item-blobbi:food:apple');
    expect(apple).toHaveAccessibleName(/Unknown Blobbi item, 2/);
    expect(apple).toHaveAttribute('data-usable', 'false');
    expect(screen.queryByText('Poison Apple')).toBeNull();
    // The genuine cosmetic from the same relay is fine: trust is per event, not per relay.
    await waitFor(() => expect(accessories()).toEqual([OFFICIAL_GLASSES]));
  });

  it("equipment on the Island's relay is drawn only through the same gates as before", async () => {
    seedEcosystem();
    // A second document by someone else for the same Blobbi, newer, on the same relay.
    network.relay(DITTO).events.push(placementEvent(BROOK_D, [{ id: 'eyewear', item: OFFICIAL_GLASSES, mode: 'equip', slot: 'headwear' }], { owner: 'c'.repeat(64), createdAt: NOW }));
    renderHome();
    await ready();
    await waitFor(() => expect(accessories()).toEqual([OFFICIAL_GLASSES]));
    expect(network.published()).toEqual([]);
  });
});

describe('Relay hints: writes', () => {
  it('using an item found through a hint spends once, to the application relays only', async () => {
    seedEcosystem();
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items, 2 ready'), { timeout: 4000 });
    await openItems();
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('inventory-use'));
    await waitFor(() => expect(screen.queryByTestId('inventory-sheet')).toBeNull());

    await waitFor(() => expect(network.relay(APP).published.filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(1), { timeout: 4000 });
    const spends = network.published().filter(({ event }) => event.kind === KIND_GAME_INVENTORY_SPEND);
    expect(spends).toHaveLength(1);
    expect(spends[0].url).toBe(APP);
    expect(parseGameInventorySpend(spends[0].event)).toMatchObject({ inventoryAddress: ISLAND_INVENTORY, itemAddress: OFFICIAL_APPLE, quantity: 1 });
    for (const url of [DITTO, PRIMAL, DREAMITH]) expect(network.relay(url).published, url).toEqual([]);

    const [state] = network.relay(APP).published.filter((e) => e.kind === KIND_BLOBBI_STATE);
    expect(getTagValue(state.tags, PET_OP_TAG)).toBe(spends[0].event.id);
    expect(signCount).toBeGreaterThanOrEqual(2); // one spend, one state (and a best-effort receipt)
    expect(network.published().filter(({ event }) => event.kind === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
    await waitFor(() => expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['applied']), { timeout: 4000 });

    // The balance merges the inventory from the hinted relay with the spend on the application relay.
    await openItems();
    await waitFor(() => expect(screen.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('the pool never publishes to a hinted relay, whatever the event', async () => {
    const pool = createHomePool({ relays: [APP], open: network.open, eoseTimeout: EOSE_GRACE_MS });
    await pool.event({ ...brook(), id: 'f'.repeat(64) });
    await pool.event({ ...inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 1 }), id: '1'.repeat(64) });
    expect([...network.relays.keys()]).toEqual([APP]);
    expect(network.relay(APP).published).toHaveLength(2);
  });
});

// Keeps the fixture import list honest for the reader: the farm inventory address is what the Farm writes.
void FARM_INVENTORY;
