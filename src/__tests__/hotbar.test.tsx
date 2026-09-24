/**
 * The item hotbar: the room's usable consumables under the thumb, one
 * quantity each, from the same read as the sheet. Holding an item is UI
 * state; giving it is the M4 offer flow (set down, walk, spend, care) and
 * nothing else. Two taps stand between the player and a spend.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY_SPEND } from '@nostr-games/inventory';

import Home from '@/pages/Home';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { PET_OP_TAG, readLedger } from '@/features/inventory';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import {
  FARM_CARROT,
  OFFICIAL_APPLE,
  OFFICIAL_BALL,
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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    const name = key.slice(1);
    if (!event.tags.some((t) => t[0] === name && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
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
const brook = (options: { stage?: 'egg' | 'baby'; state?: 'active' | 'sleeping' } = {}) =>
  blobbiEvent('0000000001', { name: 'Brook', stage: options.stage ?? 'baby', state: options.state ?? 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });

const definitions = () => [
  officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }, { emoji: '🍎' }),
  officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20, energy: -5 }, { emoji: '⚽' }),
  officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'], emoji: '🧼' }),
  officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear'),
  officialCurrencyDefinition(),
  farmProduceDefinition(),
];
const stock = () => [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_BALL]: 1, [OFFICIAL_SOAP]: 1, [OFFICIAL_COIN]: 200, [OFFICIAL_GLASSES]: 1, [STRANGER_ITEM]: 3 }), inventoryEvent('farm:main', { [FARM_CARROT]: 4 })];

/** The kitchen is one room to the left of the living room. */
async function goToKitchen() {
  await userEvent.click(screen.getByTestId('room-arrow-left'));
}

const hotbar = () => within(screen.getByTestId('hotbar'));
const scene = () => screen.getByTestId('home-scene');
const tiles = () => hotbar().getAllByRole('listitem').slice(1).map((li) => within(li).getByRole('button').getAttribute('data-testid'));
const spends = () => relay.published.filter((e) => e.kind === KIND_GAME_INVENTORY_SPEND);
const states = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);

function giveSceneABox() {
  const scene = screen.getByTestId('room-canvas');
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
}
async function hotbarReady() {
  await ready();
  await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName(/Items, \d+ ready/));
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), ...definitions(), ...stock()];
  relay.published = [];
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('Hotbar: what it shows', () => {
  it('shows only what this Blobbi could use now, in this room, with quantities and artwork, the bag first', async () => {
    renderHome();
    await hotbarReady();
    // The living room is for toys.
    expect(tiles()).toEqual(['hotbar-item-blobbi:toy:ball']);
    expect(screen.getByTestId('hotbar-item-blobbi:toy:ball')).toHaveAccessibleName('Ball, 1');
    await goToKitchen();
    expect(tiles()).toEqual(['hotbar-item-blobbi:food:apple', 'hotbar-item-farm:produce:carrot']);
    expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 2');
    expect(screen.getByTestId('hotbar-item-farm:produce:carrot').querySelector('img')).toHaveAttribute('src', 'https://blossom.primal.net/carrot.webp');
    expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveTextContent('🍎');
    // Coins, cosmetics and the stranger's thing are the sheet's business, not the hotbar's.
    expect(screen.queryByTestId('hotbar-item-blobbi:currency:coin')).toBeNull();
    expect(screen.queryByTestId('hotbar-item-blobbi:cosmetic:stargazer-glasses')).toBeNull();
    expect(screen.queryByTestId('hotbar-item-weird:thing')).toBeNull();
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items, 4 ready');
    expect(screen.queryByTestId('hotbar-hint')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });

  it('follows the room: soap in the care room, nothing in the bedroom, nothing to use in the closet', async () => {
    renderHome();
    await hotbarReady();
    await goToKitchen();
    await userEvent.click(screen.getByTestId('room-arrow-left'));
    expect(scene()).toHaveAttribute('data-room', 'care');
    expect(tiles()).toEqual(['hotbar-item-blobbi:hygiene:soap']);
    await userEvent.click(screen.getByTestId('room-arrow-left'));
    expect(scene()).toHaveAttribute('data-room', 'closet');
    // The closet shows what can be worn, as information, never as something to give.
    expect(tiles()).toEqual(['hotbar-item-blobbi:cosmetic:stargazer-glasses']);
    expect(screen.getByTestId('hotbar-item-blobbi:cosmetic:stargazer-glasses')).toHaveAttribute('data-usable', 'false');
    await userEvent.click(screen.getByTestId('room-arrow-left'));
    expect(scene()).toHaveAttribute('data-room', 'rest');
    expect(tiles()).toEqual([]);
    expect(screen.getByTestId('hotbar-hint')).toHaveTextContent('Tap the bed to rest.');
  });

  it('an egg sees the soap alone, in the care room', async () => {
    relay.all = [brook({ stage: 'egg' }), ...definitions(), ...stock()];
    renderHome();
    await hotbarReady();
    expect(tiles()).toEqual([]);
    await goToKitchen();
    await userEvent.click(screen.getByTestId('room-arrow-left'));
    expect(tiles()).toEqual(['hotbar-item-blobbi:hygiene:soap']);
  });

  it('a sleeper sees nothing and is told why', async () => {
    relay.all = [brook({ state: 'sleeping' }), ...definitions(), ...stock()];
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('hotbar-hint')).toHaveTextContent('Brook is asleep.'));
    expect(tiles()).toEqual([]);
  });
});

describe('Hotbar: holding and giving', () => {
  it('a tap holds the item and invites the Blobbi tap; tapping the Blobbi gives it through the one spend path', async () => {
    renderHome();
    await hotbarReady();
    await goToKitchen();
    const apple = screen.getByTestId('hotbar-item-blobbi:food:apple');
    await userEvent.click(apple);
    expect(apple).toHaveAttribute('aria-pressed', 'true');
    expect(apple).toHaveAccessibleName('Apple, 2, in hand');
    expect(screen.getByTestId('hotbar-hint')).toHaveTextContent('Tap Brook to give the Apple.');
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-invite', 'true');
    expect(screen.getByTestId('blobbi-poke')).toHaveAccessibleName('Give Brook the Apple');
    expect(relay.published).toHaveLength(0);

    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'walking');
    expect(apple).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-invite', 'false');
    // While the item is out, the hotbar and the verbs wait.
    expect(screen.getByTestId('hotbar-item-farm:produce:carrot')).toBeDisabled();
    expect(screen.getByTestId('care-feed')).toBeDisabled();

    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    expect(getTagValue(states()[0].tags, PET_OP_TAG)).toBe(spends()[0].id);
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 4000 });
    expect(readLedger(PUBKEY).map((r) => r.status)).toEqual(['applied']);
    await waitFor(() => expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/);
  });

  it('tapping the held tile again gives it too; an egg uses it where it lies', async () => {
    relay.all = [brook({ stage: 'egg' }), ...definitions(), ...stock()];
    renderHome();
    await hotbarReady();
    await goToKitchen();
    await userEvent.click(screen.getByTestId('room-arrow-left'));
    const soap = screen.getByTestId('hotbar-item-blobbi:hygiene:soap');
    const a = screen.getByTestId('blobbi-actor');
    const x = a.getAttribute('data-x');
    await userEvent.click(soap);
    expect(soap).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(soap);
    // No walk for an egg: the use starts where it lies.
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    expect(a).toHaveAttribute('data-x', x);
    expect(a).not.toHaveAttribute('data-motion', 'walking');
    expect(soap).toHaveAttribute('aria-pressed', 'false');
  });

  it('a tap on the floor or another room puts the held item back: nothing is written, and only one item is ever in hand', async () => {
    renderHome();
    await hotbarReady();
    await goToKitchen();
    await userEvent.click(screen.getByTestId('hotbar-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('hotbar-item-farm:produce:carrot'));
    expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('hotbar-item-farm:produce:carrot')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 200, clientY: 500, detail: 1 });
    expect(screen.getByTestId('hotbar-item-farm:produce:carrot')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('hotbar-hint')).toBeNull();
    expect(screen.getByTestId('blobbi-poke')).toHaveAccessibleName('Poke Brook');

    await userEvent.click(screen.getByTestId('hotbar-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('room-arrow-right'));
    expect(screen.queryByTestId('hotbar-item-blobbi:food:apple')).toBeNull();
    await userEvent.click(screen.getByTestId('room-arrow-left'));
    expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveAttribute('aria-pressed', 'false');
    await new Promise((r) => setTimeout(r, 100));
    expect(relay.published).toHaveLength(0);
    expect(readLedger(PUBKEY)).toEqual([]);
  });

  it('the bag opens the full sheet, and using from there still works', async () => {
    renderHome();
    await hotbarReady();
    await userEvent.click(screen.getByTestId('action-items'));
    const sheet = await screen.findByTestId('inventory-sheet');
    expect(within(sheet).getByTestId('inventory-item-blobbi:currency:coin')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByTestId('inventory-item-farm:produce:carrot'));
    await userEvent.click(screen.getByTestId('inventory-use'));
    await waitFor(() => expect(screen.queryByTestId('inventory-sheet')).toBeNull());
    expect(screen.getByTestId('scene-object-offer')).toBeInTheDocument();
    await waitFor(() => expect(spends()).toHaveLength(1), { timeout: 4000 });
  });
});
