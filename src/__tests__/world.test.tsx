/**
 * Inventory in the world: the Blobbi acknowledges a pick at once, a use is
 * visible for at least a moment however fast the relay is, a failed spend
 * consumes nothing, a toy can be set down and played with where it lies,
 * the verbs route to the room's objects (tub, toy, food in hand), the
 * closet shows what is worn, and too many pokes are too many.
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
import { MIN_USE_MS, SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { toyStorageKey } from '@/features/home/rooms';
import { readLedger } from '@/features/inventory';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { FARM_CARROT, OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_GLASSES, OFFICIAL_SOAP, farmProduceDefinition, inventoryEvent, officialCareDefinition, officialCosmeticDefinition, placementEvent, resetInventoryFixtureIds } from '@/test/inventory-fixtures';

let signCount = 0;
const signer = {
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...t, id: String(signCount).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

type SpendMode = 'accept' | 'reject' | 'slow';
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], spendMode: 'accept' as SpendMode, spendDelayMs: 0 };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (ev.kind === KIND_GAME_INVENTORY_SPEND) {
    if (relay.spendMode === 'reject') throw new AggregateError([new Error('blocked: spends not allowed here')]);
    if (relay.spendMode === 'slow') await new Promise((r) => setTimeout(r, relay.spendDelayMs));
  }
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
const BROOK_D = 'blobbi-aaaaaaaaaaaa-0000000001';
const brook = (set: Record<string, string> = {}) => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state: 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70', ...set } });
const definitions = () => [
  officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }, { emoji: '🍎' }),
  officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }, { emoji: '⚽' }),
  officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { emoji: '🧼' }),
  officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear'),
  farmProduceDefinition(),
];
const stock = (ball = 2) => [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_BALL]: ball, [OFFICIAL_SOAP]: 1, [OFFICIAL_GLASSES]: 1 }), inventoryEvent('farm:main', { [FARM_CARROT]: 4 })];

const actor = () => screen.getByTestId('blobbi-actor');
const spends = () => relay.published.filter((e) => e.kind === KIND_GAME_INVENTORY_SPEND);
const states = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);
const stored = () => JSON.parse(window.localStorage.getItem(toyStorageKey(PUBKEY, BROOK_D)) ?? 'null');

function giveSceneABox() {
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
  await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName(/Items, \d+ ready/));
}
const left = () => userEvent.click(screen.getByTestId('room-arrow-left'));
const right = () => userEvent.click(screen.getByTestId('room-arrow-right'));

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), ...definitions(), ...stock()];
  relay.published = [];
  relay.spendMode = 'accept';
  relay.spendDelayMs = 0;
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
});

describe('Optimistic reactions', () => {
  it('acknowledges the pick at once, before any write, and the use stays visible for the floor even when the relay is instant', async () => {
    renderHome();
    await ready();
    await left(); // kitchen
    await userEvent.click(screen.getByTestId('hotbar-item-blobbi:food:apple'));
    expect(actor()).toHaveAttribute('data-expression', 'neutral');
    await userEvent.click(screen.getByTestId('blobbi-poke')); // give
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    expect(document.querySelector('.speech-bubble')).not.toBeNull();
    expect(relay.published).toHaveLength(0);
    // The relay answers at once; the item is still visibly in use afterwards.
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    const usedAt = Date.now();
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using');
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    expect(Date.now() - usedAt).toBeGreaterThanOrEqual(MIN_USE_MS * 0.5);
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/);
    expect(spends()).toHaveLength(1);
  });

  it('a slow relay does not delay the acknowledgment and does not end the use early; the count changes only when the write is real', async () => {
    relay.spendMode = 'slow';
    relay.spendDelayMs = 600;
    renderHome();
    await ready();
    await left();
    await userEvent.click(screen.getByTestId('hotbar-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using'), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(spends()).toHaveLength(0);
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('a refused spend consumes nothing: the item stays with a retry, the count is unchanged, no care write, no false celebration', async () => {
    relay.spendMode = 'reject';
    renderHome();
    await ready();
    await left();
    await userEvent.click(screen.getByTestId('hotbar-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'failed'), { timeout: 4000 });
    expect(screen.getByTestId('offer-retry')).toBeInTheDocument();
    expect(states()).toHaveLength(0);
    expect(spends()).toHaveLength(0);
    expect(readLedger(PUBKEY)).toEqual([]);
    expect(screen.getByTestId('care-status')).not.toHaveTextContent(/Fed/);
    expect(screen.getByTestId('hotbar-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 2');
    await userEvent.click(screen.getByTestId('offer-put-away'));
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
  });
});

describe('Toys as world objects', () => {
  it('a held toy set down on the floor stays in the room without a spend, is remembered on this device, and is played with where it lies', async () => {
    renderHome();
    await ready();
    const ball = screen.getByTestId('hotbar-item-blobbi:toy:ball');
    await userEvent.click(ball);
    expect(screen.getByTestId('hotbar-hint')).toHaveTextContent('tap the floor to set the Ball down');
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 250, clientY: 520, detail: 1 });
    const toy = screen.getByTestId('scene-object-toy-blobbi:toy:ball');
    expect(toy).toHaveAttribute('data-state', 'placed');
    expect(actor()).toHaveAttribute('data-motion', 'idle'); // setting it down is not a walk
    expect(stored().by_room.home).toHaveLength(1);
    expect(stored().by_room.home[0].address).toBe(OFFICIAL_BALL);
    expect(relay.published).toHaveLength(0);
    expect(ball).toHaveAttribute('aria-pressed', 'false');

    // Playing with it: walk there, spend one, the toy stays (one is left).
    await userEvent.click(within(toy).getByRole('button'));
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId('scene-object-toy-blobbi:toy:ball')).toHaveAttribute('data-state', 'placed'), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('hotbar-item-blobbi:toy:ball')).toHaveAccessibleName('Ball, 1'), { timeout: 4000 });
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Played with Brook/);
    // It is not in the kitchen.
    await left();
    expect(screen.queryByTestId('scene-object-toy-blobbi:toy:ball')).toBeNull();
    await right();
    expect(screen.getByTestId('scene-object-toy-blobbi:toy:ball')).toBeInTheDocument();
  });

  it('a toy the player no longer owns is not in the room, however it was placed', async () => {
    window.localStorage.setItem(toyStorageKey(PUBKEY, BROOK_D), JSON.stringify({ v: 1, by_room: { home: [{ address: OFFICIAL_BALL, inventoryAddress: `31633:${PUBKEY}:blobbi:island`, x: 0.3, y: 0.5 }] } }));
    relay.all = [brook(), ...definitions(), ...stock(0)];
    renderHome();
    await ready();
    expect(screen.queryByTestId('scene-object-toy-blobbi:toy:ball')).toBeNull();
  });

  it('the Play verb uses a toy lying in the room, and stays plain care when there is none', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-play'));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    expect(spends()).toHaveLength(0); // plain play, no item
    await userEvent.click(screen.getByTestId('hotbar-item-blobbi:toy:ball'));
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 700, clientY: 520, detail: 1 });
    await waitFor(() => expect(screen.getByTestId('care-play')).toBeEnabled());
    await userEvent.click(screen.getByTestId('care-play'));
    await waitFor(() => expect(spends()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(states()).toHaveLength(2), { timeout: 4000 });
  });
});

describe('Care routed to the room', () => {
  it('Clean in the care room walks to the tub first; elsewhere it is immediate', async () => {
    renderHome({ walkSpeed: 1.2, idleEnabled: false });
    await ready();
    await left();
    await left(); // care room
    expect(screen.getByTestId('furniture-home:tub')).toHaveAttribute('data-use', 'clean');
    await userEvent.click(screen.getByTestId('care-clean'));
    expect(actor()).toHaveAttribute('data-motion', 'walking');
    expect(screen.getByTestId('care-clean')).toHaveAttribute('aria-busy', 'true');
    expect(states()).toHaveLength(0);
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(Number(getTagValue(states()[0].tags, 'hygiene'))).toBeGreaterThan(45);
    // Tapping the tub is the same; standing at it already, it needs no walk.
    await waitFor(() => expect(screen.getByTestId('care-clean')).toBeEnabled());
    expect(actor()).toHaveAttribute('data-x', '0.660');
    await userEvent.click(screen.getByTestId('furniture-button-home:tub'));
    await waitFor(() => expect(states()).toHaveLength(2), { timeout: 4000 });
    // The kitchen has no tub: immediate.
    await right();
    await waitFor(() => expect(screen.getByTestId('care-clean')).toBeEnabled());
    await userEvent.click(screen.getByTestId('care-clean'));
    expect(actor()).not.toHaveAttribute('data-motion', 'walking');
    await waitFor(() => expect(states()).toHaveLength(3), { timeout: 4000 });
  });

  it('Feed with food in hand gives that food; the bag is not needed', async () => {
    renderHome();
    await ready();
    await left();
    await userEvent.click(screen.getByTestId('hotbar-item-farm:produce:carrot'));
    await userEvent.click(screen.getByTestId('care-feed'));
    expect(screen.getByTestId('scene-object-offer')).toBeInTheDocument();
    await waitFor(() => expect(spends()).toHaveLength(1), { timeout: 4000 });
  });
});

describe('The closet', () => {
  it('shows what the Blobbi can wear, marks what it wears, and never offers a give', async () => {
    relay.all = [brook(), ...definitions(), ...stock(), placementEvent(BROOK_D, [{ id: 'eyewear', item: OFFICIAL_GLASSES, mode: 'equip', slot: 'eyewear' }])];
    renderHome();
    await ready();
    await right();
    await right(); // closet
    const glasses = await screen.findByTestId('hotbar-item-blobbi:cosmetic:stargazer-glasses');
    expect(glasses).toHaveAttribute('data-usable', 'false');
    await waitFor(() => expect(glasses).toHaveAccessibleName(/worn/));
    expect(screen.queryByTestId('hotbar-item-blobbi:food:apple')).toBeNull();
    await userEvent.click(glasses);
    expect(screen.getByTestId('hotbar-hint')).toHaveTextContent('Brook is wearing the Stargazer Glasses');
    expect(actor()).toHaveAttribute('data-invite', 'false');
    expect(screen.getByTestId('blobbi-poke')).toHaveAccessibleName('Poke Brook');
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(relay.published).toHaveLength(0);
  });
});

describe('Personality', () => {
  it('too many pokes make it cross, briefly, and say so', async () => {
    renderHome();
    await ready();
    for (let i = 0; i < 3; i += 1) await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'happy');
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'upset');
    expect(document.querySelector('.speech-bubble')).toHaveTextContent(/Enough|Stop|Not now/);
    expect(relay.published).toHaveLength(0);
  });

  it('says something on entering a room that answers a need', async () => {
    relay.all = [brook({ hunger: '8' }), ...definitions(), ...stock()];
    renderHome();
    await ready();
    await left(); // kitchen, hungry
    expect(document.querySelector('.speech-bubble')).toHaveTextContent('Is it snack time?');
  });
});
