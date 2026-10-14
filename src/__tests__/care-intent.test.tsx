/**
 * The single home and the care-intent model (M10): one space, no room
 * navigation, no editor; four verbs that open their options above the
 * row, the bag beside them; a new player with nothing owned can always
 * care; Rest brings the bed out and sleep happens only on arrival; Clean
 * brings the tub out; food and toys are set down where they belong and
 * leave after; a tap elsewhere cancels; the optimistic acknowledgment
 * never runs ahead of the authoritative write.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY_SPEND } from '@nostr-games/inventory';

import Home from '@/pages/Home';
import { MIN_USE_MS, OFFER_SPOT, SceneSettingsProvider, placeOnFloor, type SceneSettings } from '@/features/home/scene';
import { approachSpot } from '@/features/home/rooms';
import { HOME_SPACE, STAGE_OBJECTS } from '@/features/home/space/home-space';
import { readLedger } from '@/features/inventory';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { carouselCurrent, carouselItems, chooseCare, chooseFromCarousel, playBath, rubBath, useOwnedItem } from '@/test/care-ui';
import { FARM_CARROT, OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_GLASSES, OFFICIAL_SOAP, farmProduceDefinition, inventoryEvent, officialCareDefinition, officialCosmeticDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';
import { OFFICIAL_CATALOG_SNAPSHOT } from '@/features/inventory';

/** The starter tiles a verb shows for a baby: every official item whose care action answers it, in catalog order. */
const starterTiles = (actions: readonly string[]) => OFFICIAL_CATALOG_SNAPSHOT.filter((r) => actions.includes(r.action) && r.stages.includes('baby')).map((r) => r.d);
/** The starter items of the open carousel, in order. */
const startersShown = async () => (await carouselItems()).filter((i) => i.source === 'starter').map((i) => i.id);

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
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], spendMode: 'accept' as SpendMode, spendDelayMs: 0, careFails: false };
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
  if (ev.kind === KIND_BLOBBI_STATE && relay.careFails) throw new AggregateError([new Error('relay rejected')]);
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

const FAST: Partial<SceneSettings> = { walkSpeed: 4, idleEnabled: false };
const SLOW_WALK: Partial<SceneSettings> = { walkSpeed: 1.2, idleEnabled: false };
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
const brook = (set: Record<string, string> = {}, state: 'active' | 'sleeping' = 'active') =>
  blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state, createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70', ...set } });
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
const interactions = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_INTERACTION);
const dock = () => screen.getByTestId('care-dock');
const bed = () => screen.queryByTestId('furniture-home:bed-pet');
const tub = () => screen.queryByTestId('furniture-home:tub');
const BED_SPOT = approachSpot(STAGE_OBJECTS.bed);
const TUB_SPOT = approachSpot(STAGE_OBJECTS.tub);

function giveSceneABox() {
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
/** The home is up and the inventory read has come back (with items, or with nothing). */
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
  await waitFor(() => expect(query.mock.calls.some(([filters]) => filters.some((f) => f.kinds?.includes(31633)))).toBe(true));
  await settle(60);
}
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), ...definitions(), ...stock()];
  relay.published = [];
  relay.spendMode = 'accept';
  relay.spendDelayMs = 0;
  relay.careFails = false;
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
});

describe('One home', () => {
  it('is the only space: the living room with its door and furniture, no navigation, no editor, no bed or tub until asked for', async () => {
    renderHome();
    await ready();
    expect(screen.getByTestId('home-scene')).toHaveAttribute('data-room', 'home');
    expect(screen.getByTestId('scene-object-door')).toBeInTheDocument();
    for (const piece of HOME_SPACE.furniture) expect(screen.getByTestId(`furniture-${piece.id}`)).toBeInTheDocument();
    expect(bed()).toBeNull();
    expect(tub()).toBeNull();
    expect(screen.queryByTestId('room-arrow-left')).toBeNull();
    expect(screen.queryByTestId('room-arrow-right')).toBeNull();
    expect(screen.queryByTestId('room-pill')).toBeNull();
    expect(screen.queryByTestId('room-edit')).toBeNull();
    expect(document.querySelector('.game-rail')).toBeNull();
    expect(document.querySelector('.hotbar')).toBeNull();
    // A swipe is not a room change any more: the room stays, nothing happens.
    const scene = screen.getByTestId('home-scene');
    fireEvent.pointerDown(scene, { pointerType: 'touch', clientX: 300, clientY: 300 });
    fireEvent.pointerUp(scene, { pointerType: 'touch', clientX: 100, clientY: 300 });
    expect(scene).toHaveAttribute('data-room', 'home');
    expect(relay.published).toHaveLength(0);
  });

  it('the dock is four intents and the bag beside them, in one row; nothing sits above until a verb is chosen', async () => {
    renderHome();
    await ready();
    const buttons = within(dock()).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(['care-feed', 'care-play', 'care-clean', 'care-rest', 'action-items']);
    expect(screen.queryByTestId('care-options')).toBeNull();
    // The verbs carry no counts (the starter kit is always there); only the bag counts what is owned (apple ×2, carrot, ball, soap).
    for (const verb of ['care-feed', 'care-play', 'care-clean', 'care-rest']) expect(screen.getByTestId(verb).querySelector('.verb__count')).toBeNull();
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items, 4 ready');
  });
});

describe('Choosing a verb', () => {
  it('opens that verb’s carousel above the row: the starter kit that does it, then what the player owns with how many are left; another verb swaps, the same verb closes', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-feed'));
    const strip = screen.getByTestId('care-options');
    expect(strip).toHaveAttribute('data-verb', 'feed');
    expect(screen.getByTestId('care-feed')).toHaveAttribute('aria-expanded', 'true');
    // Above the row: the carousel precedes the dock in the action bar.
    const bar = screen.getByTestId('action-bar');
    expect(bar.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(strip.compareDocumentPosition(dock()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The room's own carousel, one item in the middle
    expect(within(strip).getByTestId('care-item-carousel')).toBeInTheDocument();
    const items = await carouselItems();
    // Every official food and drink first, then the owned apple (two left) and carrot, by name
    expect(items.filter((i) => i.source === 'starter').map((i) => i.id)).toEqual(starterTiles(['feed', 'boost']));
    const owned = items.filter((i) => i.source === 'owned');
    expect(owned.map((i) => i.id)).toEqual(['blobbi:food:apple', 'farm:produce:carrot']);
    expect(owned[0].label).toMatch(/Apple, 2 left/);
    expect(items.indexOf(owned[0])).toBeGreaterThan(items.findIndex((i) => i.source === 'starter' && i.id === 'blobbi:food:apple'));
    // A starter in the middle: its name alone, no count badge (availability is not a price)
    expect(carouselCurrent().id).toBe('blobbi:food:apple');
    expect(carouselCurrent().label).toBe('Give Apple');
    expect(within(strip).queryByTestId('care-item-badge')).toBeNull();
    // The starter apple resolved from the fetched official definition
    expect(screen.getByTestId('care-item-use')).toHaveAttribute('data-definition', 'nostr');

    await userEvent.click(screen.getByTestId('care-play'));
    expect(screen.getByTestId('care-options')).toHaveAttribute('data-verb', 'play');
    expect(await startersShown()).toEqual(starterTiles(['play']));
    expect(screen.getByTestId('care-feed')).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(screen.getByTestId('care-clean'));
    expect(await startersShown()).toEqual(starterTiles(['clean', 'medicine']));
    // Cosmetics never answer a verb.
    expect((await carouselItems()).some((i) => i.id === 'blobbi:cosmetic:stargazer-glasses')).toBe(false);

    await userEvent.click(screen.getByTestId('care-clean'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });

  it('the carousel remembers which item was in the middle for each verb, and an owned item chosen there is spent the Inventory’s way', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-feed'));
    await userEvent.click(screen.getByTestId('care-item-next'));
    const second = carouselCurrent().id;
    await userEvent.click(screen.getByTestId('care-play'));
    await userEvent.click(screen.getByTestId('care-feed'));
    expect(carouselCurrent().id).toBe(second);
    // The owned carrot from the carousel: one spend, one state, one receipt
    await chooseFromCarousel('farm:produce:carrot');
    expect(screen.queryByTestId('care-options')).toBeNull();
    await waitFor(() => expect(spends()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(interactions()).toHaveLength(1), { timeout: 4000 });
  });

  it('a new player with nothing owned still has every verb through the starter kit: the food is set down, the care is written, nothing is spent', async () => {
    relay.all = [brook()];
    renderHome();
    await ready();
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items');
    await userEvent.click(screen.getByTestId('care-feed'));
    const items = await carouselItems();
    // Nothing owned: the starter kit alone
    expect(items.map((i) => i.id)).toEqual(starterTiles(['feed', 'boost']));
    expect(carouselCurrent()).toMatchObject({ id: 'blobbi:food:apple', source: 'starter' });
    expect(screen.getByTestId('care-item-use')).toHaveAttribute('data-definition', 'builtin'); // no definition relay answered here
    await userEvent.click(screen.getByTestId('care-item-use'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(screen.getByTestId('scene-object-offer')).toBeInTheDocument();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(interactions()).toHaveLength(1));
    expect(spends()).toHaveLength(0);
    expect(Number(getTagValue(states()[0].tags, 'hunger'))).toBeGreaterThan(40);
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    await userEvent.click(screen.getByTestId('care-play'));
    expect(carouselCurrent().id).toBe('blobbi:toy:ball');
  });

  it('a floor tap closes the options without choosing', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-feed'));
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 200, clientY: 520, detail: 1 });
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });
});

describe('Rest brings the bed out', () => {
  it('the bed appears, the Blobbi walks to it, and only on arrival is sleep written; the bed stays while it sleeps and leaves on waking', async () => {
    renderHome(SLOW_WALK);
    await ready();
    expect(bed()).toBeNull();
    await chooseCare('rest');
    expect(bed()).toHaveAttribute('data-state', 'walking');
    expect(actor()).toHaveAttribute('data-motion', 'walking');
    expect(screen.getByTestId('care-rest')).toHaveAttribute('aria-busy', 'true');
    expect(relay.published).toHaveLength(0);
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(getTagValue(states()[0].tags, 'state')).toBe('sleeping');
    await waitFor(() => expect(actor()).toHaveAttribute('data-sleeping', 'true'));
    expect(actor()).toHaveAttribute('data-x', BED_SPOT.x.toFixed(3));
    expect(bed()).toHaveAttribute('data-state', 'using');
    // Asleep: the other verbs are off and say why; the strip cannot open.
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    expect(screen.getByTestId('care-feed')).toHaveAttribute('aria-label', expect.stringMatching(/sleeping/i));
    await userEvent.click(screen.getByTestId('care-feed'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    // Wake: one tap, the bed goes away after a moment.
    expect(screen.getByTestId('care-rest')).toHaveAccessibleName('Wake');
    await userEvent.click(screen.getByTestId('care-rest'));
    await waitFor(() => expect(states()).toHaveLength(2), { timeout: 4000 });
    expect(getTagValue(states()[1].tags, 'state')).toBe('active');
    await waitFor(() => expect(bed()).toHaveAttribute('data-state', 'done'));
    await waitFor(() => expect(bed()).toBeNull(), { timeout: 3000 });
  });

  it('a sleeper opens the home in its bed', async () => {
    relay.all = [brook({}, 'sleeping'), ...definitions(), ...stock()];
    renderHome();
    await ready();
    expect(bed()).toHaveAttribute('data-state', 'using');
    expect(parseFloat(actor().style.left)).toBeCloseTo(parseFloat(placeOnFloor(BED_SPOT).left));
    expect(screen.getByTestId('care-rest')).toBeEnabled();
  });

  it('a tap elsewhere on the way cancels: the bed leaves, nothing is written, the verbs are free again', async () => {
    renderHome(SLOW_WALK);
    await ready();
    await chooseCare('rest');
    expect(bed()).not.toBeNull();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 150, clientY: 500, detail: 1 });
    await waitFor(() => expect(actor()).toHaveAttribute('data-motion', 'idle'), { timeout: 3000 });
    expect(actor()).toHaveAttribute('data-x', '0.150');
    expect(bed()).toBeNull();
    expect(relay.published).toHaveLength(0);
    expect(screen.getByTestId('care-rest')).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('care-feed')).toBeEnabled();
  });

  it('tapping the bed while it is out is rest too', async () => {
    renderHome(SLOW_WALK);
    await ready();
    await chooseCare('rest');
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 150, clientY: 500, detail: 1 });
    await waitFor(() => expect(bed()).toBeNull());
    await chooseCare('rest');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(getTagValue(states()[0].tags, 'state')).toBe('sleeping');
  });
});

describe('Clean is a bath (M15)', () => {
  it('a cleaning item brings the bath\'s tub out, two layers round the Blobbi: it walks into it, the soap is in hand, nothing is written until the whole bath is played, then one write, the celebration, and the tub leaves', async () => {
    renderHome(SLOW_WALK);
    await ready();
    await chooseCare('clean');
    // The home's own tub stays away: the bath draws its own, the Blobbi between its layers
    expect(tub()).toBeNull();
    const tubs = await screen.findAllByTestId('bath-tub');
    expect(tubs.map((t) => t.dataset.tubPart)).toEqual(['back', 'front']);
    expect(Number(tubs[0].style.zIndex)).toBeLessThan(Number(tubs[1].style.zIndex));
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-status', 'entering');
    expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'entering');
    expect(actor()).toHaveAttribute('data-motion', 'walking');
    expect(actor()).toHaveAttribute('data-expression', 'curious');
    // The verbs and the floor wait for the bath; the carousel is gone
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    expect(screen.queryByTestId('care-item-carousel')).toBeNull();
    expect(screen.getByTestId('scene-floor')).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'soap'), { timeout: 5000 });
    expect(actor()).toHaveAttribute('data-x', TUB_SPOT.x.toFixed(3));
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-tool', 'soap');
    expect(screen.getByTestId('bath-guidance')).toHaveTextContent(/Rub the soap all over Brook/);
    expect(states()).toHaveLength(0);
    // A tap lays no foam; a stroke does, and the Blobbi follows the soap with its eyes
    fireEvent.pointerDown(screen.getByTestId('bath-layer'), { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(screen.getByTestId('bath-layer'), { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    await settle(60);
    expect(screen.getByTestId('bath-foam')).toHaveAttribute('data-count', '0');
    rubBath({ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
    await waitFor(() => expect(Number(screen.getByTestId('bath-foam').dataset.count)).toBeGreaterThan(0));
    expect(Number(screen.getByTestId('bath-progress').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    expect(states()).toHaveLength(0);
    await playBath({ through: 'soap' });
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-tool', 'shower');
    expect(screen.getAllByTestId('bath-tub')[0]).toHaveAttribute('data-stage', 'rinse');
    await playBath({ through: 'rinse' });
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-tool', 'towel');
    expect(states()).toHaveLength(0);
    await playBath();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(Number(getTagValue(states()[0].tags, 'hygiene'))).toBeGreaterThan(45);
    expect(interactions()).toHaveLength(1);
    expect(spends()).toHaveLength(0);
    // Squeaky clean: the home's chips, the glad face, then the tub goes and the Blobbi steps out
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Brook/), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-status', 'done'), { timeout: 3000 });
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('bath-tub')).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId('care-feed')).toBeEnabled();
    expect(states()).toHaveLength(1);
  }, 20_000);

  it('Stop at any step puts the soap away with nothing written, the tub goes, and the verbs are free again', async () => {
    renderHome();
    await ready();
    await chooseCare('clean');
    await playBath({ through: 'soap' });
    expect(states()).toHaveLength(0);
    await userEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    await waitFor(() => expect(screen.queryByTestId('bath-tub')).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId('care-feed')).toBeEnabled();
    await settle(300);
    expect(states()).toHaveLength(0);
    expect(spends()).toHaveLength(0);
  }, 20_000);

  it('a failed write leaves the bath waiting with why; Try again is the player\'s tap and writes once; Stop takes the tub away and frees the verbs', async () => {
    relay.careFails = true;
    renderHome();
    await ready();
    await chooseCare('clean');
    await playBath();
    expect(await screen.findByTestId('bath-error', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-status', 'failed');
    expect(actor()).toHaveAttribute('data-expression', 'worried');
    expect(states()).toHaveLength(0);
    expect(spends()).toHaveLength(0);
    // Nothing retries by itself
    await settle(800);
    expect(states()).toHaveLength(0);
    relay.careFails = false;
    await userEvent.click(screen.getByTestId('bath-retry'));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    expect(states()).toHaveLength(1);
  }, 20_000);

  it('a failed bath stopped: nothing written, the tub goes, the verbs free', async () => {
    relay.careFails = true;
    renderHome();
    await ready();
    await chooseCare('clean');
    await playBath();
    await screen.findByTestId('bath-error', {}, { timeout: 4000 });
    await userEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-tub')).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId('care-feed')).toBeEnabled();
    expect(states()).toHaveLength(0);
  }, 20_000);

  it('an owned cleaning item spends exactly once, after the bath, never before', async () => {
    renderHome();
    await ready();
    await useOwnedItem('blobbi:hygiene:soap');
    expect(screen.queryByTestId('inventory-sheet')).toBeNull();
    await playBath({ through: 'rinse' });
    expect(spends()).toHaveLength(0);
    expect(states()).toHaveLength(0);
    await playBath();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    expect(getTagValue(spends()[0].tags, 'purpose')).toBe('clean:blobbi');
  }, 20_000);

  it('an egg is bathed where it lies: no tub, no walk, the same game, then the write', async () => {
    const eggSoap = officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { emoji: '🧼', stages: ['egg', 'baby', 'adult'] });
    relay.all = [blobbiEvent('0000000003', { name: 'Shell', stage: 'egg', createdAt: NOW - 60, set: { hygiene: '45' } }), ...definitions().filter((d) => !d.tags.some((t) => t[0] === 'd' && t[1] === 'blobbi:hygiene:soap')), eggSoap, ...stock()];
    renderHome();
    await ready();
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    await userEvent.click(screen.getByTestId('care-clean'));
    // Owned soap first, then every official cleaning and medicine item an egg may use.
    const eggTiles = OFFICIAL_CATALOG_SNAPSHOT.filter((r) => ['clean', 'medicine'].includes(r.action) && r.stages.includes('egg')).map((r) => r.d);
    expect(await startersShown()).toEqual(eggTiles);
    await chooseFromCarousel('blobbi:hygiene:soap');
    await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'soap'));
    expect(screen.queryByTestId('bath-tub')).toBeNull();
    expect(actor()).not.toHaveAttribute('data-motion', 'walking');
    expect(states()).toHaveLength(0);
    await playBath();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    expect(getTagValue(states()[0].tags, 'stage')).toBe('egg');
  }, 20_000);

  it('a Blobbi already squeaky clean is not bathed: a word, nothing starts, nothing is written', async () => {
    relay.all = [brook({ hygiene: '100' }), ...definitions(), ...stock()];
    renderHome();
    await ready();
    await chooseCare('clean');
    expect(await screen.findByTestId('bath-notice')).toHaveTextContent(/squeaky clean/);
    expect(screen.queryByTestId('bath-bar')).toBeNull();
    expect(screen.queryByTestId('bath-tub')).toBeNull();
    await settle(300);
    expect(states()).toHaveLength(0);
  }, 20_000);

  it('medicine still goes to the home\'s own tub as before: no game', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-clean'));
    await chooseFromCarousel('blobbi:medicine:bandage');
    expect(screen.queryByTestId('bath-bar')).toBeNull();
    expect(tub()).toHaveAttribute('data-state', 'walking');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
  }, 20_000);
});

describe('Owned items from the Inventory', () => {
  it('food is set down at the offer spot; the Blobbi is glad at once, walks there, and the use stays visible for the floor even with an instant relay', async () => {
    renderHome();
    await ready();
    await useOwnedItem('blobbi:food:apple');
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    expect(relay.published).toHaveLength(0);
    const offer = screen.getByTestId('scene-object-offer');
    expect(offer).toHaveAttribute('data-state', 'walking');
    expect(parseFloat(offer.style.left)).toBeCloseTo(parseFloat(placeOnFloor(OFFER_SPOT).left));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    const usedAt = Date.now();
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using');
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    expect(Date.now() - usedAt).toBeGreaterThanOrEqual(MIN_USE_MS * 0.5);
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/);
    expect(spends()).toHaveLength(1);
    // The Inventory shows the authoritative count afterwards.
    await userEvent.click(screen.getByTestId('action-items'));
    await waitFor(() => expect(screen.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('a slow relay does not delay the acknowledgment and does not end the use early; the count changes only when the write is real', async () => {
    relay.spendMode = 'slow';
    relay.spendDelayMs = 600;
    renderHome();
    await ready();
    await useOwnedItem('blobbi:food:apple');
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using'), { timeout: 2000 });
    await settle(300);
    expect(spends()).toHaveLength(0);
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    await userEvent.click(screen.getByTestId('action-items'));
    await waitFor(() => expect(screen.getByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('a refused spend consumes nothing: the item stays with a retry, the count is unchanged, no care write, no false celebration', async () => {
    relay.spendMode = 'reject';
    renderHome();
    await ready();
    await useOwnedItem('blobbi:food:apple');
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'failed'), { timeout: 4000 });
    expect(screen.getByTestId('offer-retry')).toBeInTheDocument();
    expect(states()).toHaveLength(0);
    expect(spends()).toHaveLength(0);
    expect(readLedger(PUBKEY)).toEqual([]);
    expect(screen.getByTestId('care-status')).not.toHaveTextContent(/Fed/);
    await userEvent.click(screen.getByTestId('offer-put-away'));
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    await userEvent.click(screen.getByTestId('action-items'));
    expect(await screen.findByTestId('inventory-item-blobbi:food:apple')).toHaveAccessibleName('Apple, 2');
  });

  it('an owned toy is set down at the toy spot, played with (one spend) and leaves; the starter ball plays for free', async () => {
    renderHome();
    await ready();
    await useOwnedItem('blobbi:toy:ball');
    const toy = screen.getByTestId('scene-object-offer');
    expect(parseFloat(toy.style.left)).toBeCloseTo(parseFloat(placeOnFloor(STAGE_OBJECTS.toySpot).left));
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Played with Brook/);
    await chooseCare('play');
    await waitFor(() => expect(states()).toHaveLength(2), { timeout: 4000 });
    expect(spends()).toHaveLength(1);
  });

  it('a floor tap on the way puts the item back: nothing is written, the verbs are free', async () => {
    renderHome(SLOW_WALK);
    await ready();
    await useOwnedItem('farm:produce:carrot');
    expect(actor()).toHaveAttribute('data-motion', 'walking');
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 150, clientY: 500, detail: 1 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('care-feed')).toBeEnabled());
    expect(relay.published).toHaveLength(0);
  });

  it('the bag beside the verbs opens everything owned and gives from there too', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('action-items'));
    const sheet = await screen.findByTestId('inventory-sheet');
    expect(within(sheet).getByText('Stargazer Glasses')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByTestId('inventory-item-blobbi:food:apple'));
    await userEvent.click(within(sheet).getByTestId('inventory-use'));
    expect(screen.queryByTestId('inventory-sheet')).toBeNull();
    expect(screen.getByTestId('scene-object-offer')).toBeInTheDocument();
    await waitFor(() => expect(spends()).toHaveLength(1), { timeout: 4000 });
  });
});

describe('Personality', () => {
  it('too many pokes make it cross, briefly; it never speaks; none of it is written', async () => {
    renderHome();
    await ready();
    for (let i = 0; i < 3; i += 1) await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'happy');
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'upset');
    expect(document.querySelector('.speech-bubble, [data-testid="speech-bubble"]')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });

  it('a critical need shows in the condition dots and the need bubbles, never as words from the Blobbi', async () => {
    relay.all = [brook({ hunger: '8' }), ...definitions(), ...stock()];
    renderHome();
    await ready();
    expect(screen.getByTestId('condition-dots').querySelector('[data-stat="hunger"]')).toHaveAttribute('data-status', 'critical');
    expect(document.querySelector('.speech-bubble, [data-testid="speech-bubble"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/So hungry|Play with me|I feel/);
  });
});
