/**
 * Items, end to end: inventories are discovered from the player's own kind
 * 31633 events, definitions from trusted issuers only, balances are derived
 * through the fold chain, and using a consumable is one kind 1416 spend, one
 * kind 31124 with the spend marker, one kind 1124 receipt, in that order,
 * with every failure leaving the ledger in a state the next tap can finish
 * and never a second spend for one use.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY_SPEND, parseGameInventorySpend } from '@nostr-games/inventory';

import Home from '@/pages/Home';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { PET_OP_TAG, INTERACTION_SPEND_MARKER, readLedger } from '@/features/inventory';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import {
  FARM_CARROT,
  ISLAND_INVENTORY,
  OFFICIAL_APPLE,
  OFFICIAL_COIN,
  OFFICIAL_GLASSES,
  OFFICIAL_SOAP,
  STRANGER_ITEM,
  farmProduceDefinition,
  inventoryEvent,
  officialCareDefinition,
  officialCosmeticDefinition,
  officialCurrencyDefinition,
  resetInventoryFixtureIds,
  spendEvent,
} from '@/test/inventory-fixtures';

// ─── Signed-in user with a fake signer ───────────────────────────────────────

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

// ─── Relay double: a generic NIP-01 matcher over one event store ─────────────

type SpendMode = 'accept' | 'reject' | 'silent' | 'silent-but-stored';
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], spendMode: 'accept' as SpendMode, stateFails: false };

function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    const name = key.slice(1);
    const wanted = values as string[];
    if (!event.tags.some((t) => t[0] === name && wanted.includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const seen = new Set<string>();
  const out: NostrEvent[] = [];
  for (const event of relay.all) {
    if (filters.some((f) => matches(event, f)) && !seen.has(event.id)) {
      seen.add(event.id);
      out.push(event);
    }
  }
  return out;
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (ev.kind === KIND_GAME_INVENTORY_SPEND) {
    if (relay.spendMode === 'reject') throw new AggregateError([new Error('blocked: spends not allowed here')]);
    if (relay.spendMode === 'silent' || relay.spendMode === 'silent-but-stored') {
      if (relay.spendMode === 'silent-but-stored') relay.all.push(ev);
      throw new AggregateError([new DOMException('The operation timed out', 'TimeoutError')]);
    }
  }
  if (ev.kind === KIND_BLOBBI_STATE && relay.stateFails) throw new Error('relay rejected the event');
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

const FAST: Partial<SceneSettings> = { walkSpeed: 4, idleEnabled: false };

function renderHome(settings: Partial<SceneSettings> = FAST) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={settings}>
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
}

const NOW = Math.floor(Date.now() / 1000);
const brook = (options: { stage?: 'egg' | 'baby'; state?: 'active' | 'sleeping'; set?: Record<string, string> } = {}) =>
  blobbiEvent('0000000001', { name: 'Brook', stage: options.stage ?? 'baby', state: options.state ?? 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70', ...options.set }, extra: [['custom_host_tag', 'keep-me']] });

const definitions = () => [
  officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25, hygiene: -2, energy: 5 }, { emoji: '🍎' }),
  officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'], emoji: '🧼' }),
  officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear'),
  officialCurrencyDefinition(),
  farmProduceDefinition(),
];

const published = (kind: number) => relay.published.filter((e) => e.kind === kind);
const spends = () => published(KIND_GAME_INVENTORY_SPEND);
const states = () => published(KIND_BLOBBI_STATE);
const receipts = () => published(KIND_BLOBBI_INTERACTION);

function giveSceneABox() {
  const scene = screen.getByTestId('room-canvas');
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}

async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
}

async function openItems() {
  await userEvent.click(screen.getByTestId('action-items'));
  return screen.findByTestId('inventory-sheet');
}

/** Select a tile and press Use; the sheet closes and the item lands in the room. */
async function useItem(itemId: string) {
  await openItems();
  await userEvent.click(await screen.findByTestId(`inventory-item-${itemId}`));
  await userEvent.click(screen.getByTestId('inventory-use'));
  await waitFor(() => expect(screen.queryByTestId('inventory-sheet')).toBeNull());
  return screen.getByTestId('scene-object-offer');
}

/** A walk slow enough that a test can interrupt it. */
const SLOW: Partial<SceneSettings> = { walkSpeed: 0.02, idleEnabled: false };

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), ...definitions(), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_SOAP]: 1, [OFFICIAL_COIN]: 200, [OFFICIAL_GLASSES]: 1, [STRANGER_ITEM]: 3 }), inventoryEvent('farm:main', { [FARM_CARROT]: 4 })];
  relay.published = [];
  relay.spendMode = 'accept';
  relay.stateFails = false;
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('Inventory: discovery and resolution', () => {
  it('finds every inventory the player owns, resolves trusted definitions, and says what each item is', async () => {
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items, 3 ready'));
    await openItems();

    const island = within(screen.getByTestId('inventory-source-blobbi:island'));
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 2');
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveAttribute('data-usable', 'true');
    expect(island.getByTestId('inventory-item-blobbi:hygiene:soap')).toHaveAttribute('data-usable', 'true');
    expect(island.getByTestId('inventory-item-blobbi:currency:coin')).toHaveAccessibleName(/Blobbi Coin, 200, Spent on the Island/);
    expect(island.getByTestId('inventory-item-blobbi:cosmetic:stargazer-glasses')).toHaveAccessibleName(/Stargazer Glasses, 1, Equip it on the Island/);
    expect(island.getByTestId('inventory-item-weird:thing')).toHaveAccessibleName(/Unknown item, 3/);

    const farm = within(screen.getByTestId('inventory-source-farm:main'));
    expect(farm.getByTestId('inventory-item-farm:produce:carrot')).toHaveAccessibleName('Carrot, 4');

    // Definitions were asked only from trusted issuers, never from the stranger.
    const definitionFilters = query.mock.calls.flatMap(([filters]) => filters.filter((f) => f.kinds?.includes(31632)));
    expect(definitionFilters.length).toBeGreaterThan(0);
    for (const f of definitionFilters) expect(f.authors).not.toContain('b'.repeat(64));

    // Artwork: the cosmetic's blossom image is shown, the stranger gets no image, the apple its emoji.
    const glasses = island.getByTestId('inventory-item-blobbi:cosmetic:stargazer-glasses').querySelector('img');
    expect(glasses).toHaveAttribute('src', 'https://blossom.primal.net/abc.webp');
    expect(glasses).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(island.getByTestId('inventory-item-weird:thing').querySelector('img')).toBeNull();
    expect(island.getByTestId('inventory-item-blobbi:food:apple')).toHaveTextContent('🍎');

    // Detail row explains the four things.
    await userEvent.click(island.getByTestId('inventory-item-blobbi:currency:coin'));
    expect(screen.getByTestId('inventory-detail')).toHaveTextContent('×200 · Blobbi Island · Currency');
    expect(screen.getByTestId('inventory-detail-note')).toHaveTextContent('Spent on the Island, not here.');
    expect(screen.queryByTestId('inventory-use')).toBeNull();
    await userEvent.click(farm.getByTestId('inventory-item-farm:produce:carrot'));
    expect(screen.getByTestId('inventory-detail-note')).toHaveTextContent('Brook will eat it.');
    expect(screen.getByTestId('inventory-use')).toHaveTextContent('Use Carrot');
  });

  it('derives quantities through spends and folds; an unresolvable chain disables the whole inventory', async () => {
    const spent = spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE, { id: 'a'.repeat(64) });
    relay.all = [brook(), ...definitions(), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 }), spent, inventoryEvent('farm:main', { [FARM_CARROT]: 4 }, { fold: 'e'.repeat(64) })];
    renderHome();
    await ready();
    await openItems();
    expect(await screen.findByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1');
    const farm = within(screen.getByTestId('inventory-source-farm:main'));
    expect(farm.getByTestId('inventory-unverified')).toBeInTheDocument();
    expect(farm.getByTestId('inventory-item-farm:produce:carrot')).toHaveAttribute('data-usable', 'false');
    await userEvent.click(farm.getByTestId('inventory-item-farm:produce:carrot'));
    expect(screen.getByTestId('inventory-detail-note')).toHaveTextContent(/can't be verified/);
    expect(screen.queryByTestId('inventory-use')).toBeNull();
  });

  it('shows an empty state with the way to the Island when the player owns nothing', async () => {
    relay.all = [brook()];
    renderHome();
    await ready();
    await openItems();
    expect(await screen.findByTestId('inventory-empty')).toHaveTextContent(/Nothing here yet/);
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items');
  });

  it('an egg may use soap but not an apple; a sleeper nothing', async () => {
    relay.all = [brook({ stage: 'egg' }), ...definitions(), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_SOAP]: 1 })];
    renderHome();
    await ready();
    await openItems();
    expect(await screen.findByTestId('inventory-item-blobbi:hygiene:soap')).toHaveAttribute('data-usable', 'true');
    expect(screen.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName(/Not until it hatches/);
  });
});

describe('Inventory: using an item', () => {
  it('sets the item down, walks there, then spends once, republishes with the marker, and logs a receipt', async () => {
    renderHome();
    await ready();
    const offer = await useItem('blobbi:food:apple');
    expect(offer).toHaveAttribute('data-state', 'walking');
    expect(within(offer).getByRole('button', { name: 'Apple' })).toBeInTheDocument();
    expect(spends()).toHaveLength(0);

    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    const [spend] = spends();
    expect(spend).toBeDefined();
    const parsedSpend = parseGameInventorySpend(spend)!;
    expect(parsedSpend).toMatchObject({ inventoryAddress: ISLAND_INVENTORY, itemAddress: OFFICIAL_APPLE, quantity: 1, purpose: 'feed:blobbi' });
    expect(parsedSpend.nonce).toBeTruthy();

    const [state] = states();
    expect(getTagValue(state.tags, PET_OP_TAG)).toBe(spend.id);
    expect(state.tags.filter(([n]) => n === PET_OP_TAG)).toHaveLength(1);
    expect(Number(getTagValue(state.tags, 'hunger'))).toBeGreaterThan(40);
    expect(getTagValue(state.tags, 'custom_host_tag')).toBe('keep-me');
    // Order: the spend was accepted before the state was written.
    expect(relay.published.indexOf(spend)).toBeLessThan(relay.published.indexOf(state));

    await waitFor(() => expect(receipts()).toHaveLength(1), { timeout: 4000 });
    const [receipt] = receipts();
    expect(getTagValue(receipt.tags, 'item')).toBe(OFFICIAL_APPLE);
    expect(receipt.tags).toContainEqual(['e', spend.id, '', INTERACTION_SPEND_MARKER]);

    // The item is gone from the room, the Blobbi reacted, and the balance shows one fewer.
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 4000 });
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/);
    expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['applied']);
    await openItems();
    await waitFor(() => expect(screen.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('a tap on the floor while walking puts the item away: nothing is written', async () => {
    renderHome(SLOW);
    await ready();
    await useItem('blobbi:food:apple');
    await userEvent.click(screen.getByTestId('scene-floor'));
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull());
    await new Promise((r) => setTimeout(r, 300));
    expect(relay.published).toHaveLength(0);
    expect(readLedger(PUBKEY)).toEqual([]);
    expect(screen.getByTestId('action-items')).not.toBeDisabled();
  });

  it('an egg cannot walk: the item is used where it lies', async () => {
    relay.all = [brook({ stage: 'egg' }), ...definitions(), inventoryEvent('blobbi:island', { [OFFICIAL_SOAP]: 1 })];
    renderHome();
    await ready();
    await openItems();
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:hygiene:soap'));
    await userEvent.click(screen.getByTestId('inventory-use'));
    // No walk: the use starts at once, so the spend and the state land without the actor moving.
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-motion', 'idle');
    expect(getTagValue(spends()[0].tags, 'purpose')).toBe('clean:blobbi');
    expect(Number(getTagValue(states()[0].tags, 'hygiene'))).toBeGreaterThan(45);
  });

  it('a refused spend consumes nothing: no state write, a clear error, and a fresh spend on retry', async () => {
    relay.spendMode = 'reject';
    renderHome();
    await ready();
    await useItem('blobbi:food:apple');
    const error = await screen.findByTestId('item-error', {}, { timeout: 4000 });
    expect(error).toHaveTextContent(/refused the spend/);
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'failed');
    expect(states()).toHaveLength(0);
    expect(readLedger(PUBKEY)).toEqual([]);

    relay.spendMode = 'accept';
    await userEvent.click(screen.getByTestId('offer-retry'));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    expect(signCount).toBe(4); // two spend signatures (one refused), one state, one receipt
  });

  it('silent relays: the spend is not re-signed; found by id it proceeds, not found it waits', async () => {
    relay.spendMode = 'silent';
    renderHome();
    await ready();
    await useItem('blobbi:food:apple');
    const error = await screen.findByTestId('item-error', {}, { timeout: 4000 });
    expect(error).toHaveTextContent(/did not confirm/);
    expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['unconfirmed']);
    const firstSpendId = readLedger(PUBKEY)[0].spendId;
    expect(states()).toHaveLength(0);

    // The relays kept it after all: the retry offers the SAME event, finds it, and finishes.
    relay.spendMode = 'silent-but-stored';
    await userEvent.click(screen.getByTestId('offer-retry'));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(getTagValue(states()[0].tags, PET_OP_TAG)).toBe(firstSpendId);
    expect(relay.all.filter((e) => e.kind === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
    expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['applied']);
  });

  it('a failed care write after an established spend is finished on the next tap, without a second spend', async () => {
    relay.stateFails = true;
    renderHome();
    await ready();
    await useItem('blobbi:food:apple');
    const error = await screen.findByTestId('item-error', {}, { timeout: 4000 });
    expect(error).toHaveTextContent(/taken from the inventory, but the care write failed/);
    expect(spends()).toHaveLength(1);
    expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['effect-pending']);

    // Put it away: the ledger keeps the open use, and the sheet says so.
    await userEvent.click(screen.getByTestId('offer-put-away'));
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    relay.stateFails = false;
    await openItems();
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:hygiene:soap'));
    expect(screen.getByTestId('inventory-use')).toHaveTextContent('Finish earlier use');
    await userEvent.click(screen.getByTestId('inventory-use'));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    expect(getTagValue(states()[0].tags, PET_OP_TAG)).toBe(spends()[0].id);
    expect(Number(getTagValue(states()[0].tags, 'hunger'))).toBeGreaterThan(40); // the apple, not the soap
    expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['applied']);
  });

  it('an effect that already landed is never applied twice', async () => {
    // A slower walk: the offer must still be in the room when it is looked for, even on a loaded machine.
    renderHome({ walkSpeed: 1, idleEnabled: false });
    await ready();
    await useItem('blobbi:food:apple');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    // Pretend this device lost the "applied" status (a crash between the write and the ledger update).
    const ledger = readLedger(PUBKEY);
    window.localStorage.setItem(`blobbi:home:item-spends:v1:${PUBKEY}`, JSON.stringify(ledger.map((r) => ({ ...r, status: 'effect-pending' }))));
    await openItems();
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('inventory-use'));
    await waitFor(() => expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['applied']), { timeout: 4000 });
    expect(states()).toHaveLength(1);
    expect(spends()).toHaveLength(1);
  });

  it('the dock is out of the way while an item is in play, and the second tap on Use does nothing', async () => {
    renderHome();
    await ready();
    await openItems();
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:food:apple'));
    const use = screen.getByTestId('inventory-use');
    await userEvent.dblClick(use);
    await waitFor(() => expect(screen.queryByTestId('inventory-sheet')).toBeNull());
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    expect(screen.getByTestId('action-items')).toBeDisabled();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull());
    expect(spends()).toHaveLength(1);
    expect(screen.getByTestId('care-feed')).not.toBeDisabled();
  });

  it('is keyboard-usable: tiles are buttons in the sheet, Use is a button, focus is trapped', async () => {
    renderHome();
    await ready();
    screen.getByTestId('action-items').focus();
    await userEvent.keyboard('{Enter}');
    const sheet = await screen.findByTestId('inventory-sheet');
    expect(sheet.contains(document.activeElement)).toBe(true);
    const apple = await screen.findByTestId('inventory-item-blobbi:food:apple');
    apple.focus();
    await userEvent.keyboard('{Enter}');
    expect(apple).toHaveAttribute('aria-pressed', 'true');
    screen.getByTestId('inventory-use').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByTestId('inventory-sheet')).toBeNull());
    expect(screen.getByTestId('scene-object-offer')).toBeInTheDocument();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
  });
});
