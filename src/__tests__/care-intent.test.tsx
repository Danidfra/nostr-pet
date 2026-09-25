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
import { chooseCare, chooseItem } from '@/test/care-ui';
import { FARM_CARROT, OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_GLASSES, OFFICIAL_SOAP, farmProduceDefinition, inventoryEvent, officialCareDefinition, officialCosmeticDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';

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
    // Badges say how many owned items answer each verb (apple + carrot; ball; soap).
    expect(within(screen.getByTestId('care-feed')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('care-play')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('care-clean')).getByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items, 4 ready');
  });
});

describe('Choosing a verb', () => {
  it('opens that verb’s options above the row: the owned items that do it, then the plain way; another verb swaps, the same verb closes', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-feed'));
    const strip = screen.getByTestId('care-options');
    expect(strip).toHaveAttribute('data-verb', 'feed');
    expect(screen.getByTestId('care-feed')).toHaveAttribute('aria-expanded', 'true');
    // Above the row: the strip precedes the dock in the action bar.
    const bar = screen.getByTestId('action-bar');
    expect(bar.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(strip.compareDocumentPosition(dock()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const options = within(strip).getAllByRole('button');
    expect(options.map((o) => o.getAttribute('data-testid'))).toEqual(['care-option-blobbi:food:apple', 'care-option-farm:produce:carrot', 'care-option-plain-feed']);
    expect(options[0]).toHaveAccessibleName('Apple, 2');
    expect(options[2]).toHaveAccessibleName('A snack');

    await userEvent.click(screen.getByTestId('care-play'));
    expect(screen.getByTestId('care-options')).toHaveAttribute('data-verb', 'play');
    expect(within(screen.getByTestId('care-options')).getAllByRole('button').map((o) => o.getAttribute('data-testid'))).toEqual(['care-option-blobbi:toy:ball', 'care-option-plain-play']);
    expect(screen.getByTestId('care-feed')).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(screen.getByTestId('care-clean'));
    expect(within(screen.getByTestId('care-options')).getAllByRole('button').map((o) => o.getAttribute('data-testid'))).toEqual(['care-option-blobbi:hygiene:soap', 'care-option-plain-clean']);
    // Cosmetics never answer a verb.
    expect(screen.queryByTestId('care-option-blobbi:cosmetic:stargazer-glasses')).toBeNull();

    await userEvent.click(screen.getByTestId('care-clean'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });

  it('a new player with nothing owned still has every verb: the plain way writes the care and no spend', async () => {
    relay.all = [brook()];
    renderHome();
    await ready();
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items');
    await userEvent.click(screen.getByTestId('care-feed'));
    expect(within(screen.getByTestId('care-options')).getAllByRole('button').map((o) => o.getAttribute('data-testid'))).toEqual(['care-option-plain-feed']);
    await userEvent.click(screen.getByTestId('care-option-plain-feed'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(interactions()).toHaveLength(1));
    expect(spends()).toHaveLength(0);
    expect(Number(getTagValue(states()[0].tags, 'hunger'))).toBeGreaterThan(40);
    expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook/);
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    await userEvent.click(screen.getByTestId('care-play'));
    expect(screen.getByTestId('care-option-plain-play')).toBeInTheDocument();
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

describe('Clean brings the tub out', () => {
  it('the plain bath: the tub appears, the Blobbi walks to it, the write happens on arrival, the tub leaves after', async () => {
    renderHome(SLOW_WALK);
    await ready();
    await chooseCare('clean');
    expect(tub()).toHaveAttribute('data-state', 'walking');
    expect(actor()).toHaveAttribute('data-motion', 'walking');
    expect(states()).toHaveLength(0);
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    expect(Number(getTagValue(states()[0].tags, 'hygiene'))).toBeGreaterThan(45);
    expect(actor()).toHaveAttribute('data-x', TUB_SPOT.x.toFixed(3));
    await waitFor(() => expect(tub()).toHaveAttribute('data-state', 'done'));
    await waitFor(() => expect(tub()).toBeNull(), { timeout: 3000 });
    expect(spends()).toHaveLength(0);
  });

  it('a failed write puts the tub away and frees the verbs; nothing is left in the room', async () => {
    relay.careFails = true;
    renderHome();
    await ready();
    await chooseCare('clean');
    expect(await screen.findByTestId('care-error')).toBeInTheDocument();
    expect(states()).toHaveLength(0);
    await waitFor(() => expect(tub()).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId('care-feed')).toBeEnabled();
  });

  it('an egg is bathed where it lies: the tub comes out, there is no walk, the write is immediate', async () => {
    const eggSoap = officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { emoji: '🧼', stages: ['egg', 'baby', 'adult'] });
    relay.all = [blobbiEvent('0000000003', { name: 'Shell', stage: 'egg', createdAt: NOW - 60, set: { hygiene: '45' } }), ...definitions().filter((d) => !d.tags.some((t) => t[0] === 'd' && t[1] === 'blobbi:hygiene:soap')), eggSoap, ...stock()];
    renderHome();
    await ready();
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    await userEvent.click(screen.getByTestId('care-clean'));
    expect(within(screen.getByTestId('care-options')).getAllByRole('button').map((o) => o.getAttribute('data-testid'))).toEqual(['care-option-blobbi:hygiene:soap', 'care-option-plain-clean']);
    await userEvent.click(screen.getByTestId('care-option-plain-clean'));
    expect(actor()).not.toHaveAttribute('data-motion', 'walking');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 3000 });
    expect(getTagValue(states()[0].tags, 'stage')).toBe('egg');
  });
});

describe('Items from the strip', () => {
  it('food is set down at the offer spot; the Blobbi is glad at once, walks there, and the use stays visible for the floor even with an instant relay', async () => {
    renderHome();
    await ready();
    await chooseItem('feed', 'blobbi:food:apple');
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    expect(screen.getByTestId('speech-bubble')).toBeInTheDocument();
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
    // The strip shows the authoritative count afterwards.
    await userEvent.click(screen.getByTestId('care-feed'));
    await waitFor(() => expect(screen.getByTestId('care-option-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('a slow relay does not delay the acknowledgment and does not end the use early; the count changes only when the write is real', async () => {
    relay.spendMode = 'slow';
    relay.spendDelayMs = 600;
    renderHome();
    await ready();
    await chooseItem('feed', 'blobbi:food:apple');
    expect(actor()).toHaveAttribute('data-expression', 'excited');
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using'), { timeout: 2000 });
    await settle(300);
    expect(spends()).toHaveLength(0);
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'using');
    await waitFor(() => expect(states()).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    await userEvent.click(screen.getByTestId('care-feed'));
    await waitFor(() => expect(screen.getByTestId('care-option-blobbi:food:apple')).toHaveAccessibleName('Apple, 1'), { timeout: 4000 });
  });

  it('a refused spend consumes nothing: the item stays with a retry, the count is unchanged, no care write, no false celebration', async () => {
    relay.spendMode = 'reject';
    renderHome();
    await ready();
    await chooseItem('feed', 'blobbi:food:apple');
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'failed'), { timeout: 4000 });
    expect(screen.getByTestId('offer-retry')).toBeInTheDocument();
    expect(states()).toHaveLength(0);
    expect(spends()).toHaveLength(0);
    expect(readLedger(PUBKEY)).toEqual([]);
    expect(screen.getByTestId('care-status')).not.toHaveTextContent(/Fed/);
    await userEvent.click(screen.getByTestId('offer-put-away'));
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    await userEvent.click(screen.getByTestId('care-feed'));
    expect(screen.getByTestId('care-option-blobbi:food:apple')).toHaveAccessibleName('Apple, 2');
  });

  it('a toy is set down at the toy spot, played with, and leaves after; the plain way needs none', async () => {
    renderHome();
    await ready();
    await chooseItem('play', 'blobbi:toy:ball');
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
    await chooseItem('feed', 'farm:produce:carrot');
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
  it('too many pokes make it cross, briefly, and say so; none of it is written', async () => {
    renderHome();
    await ready();
    for (let i = 0; i < 3; i += 1) await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'happy');
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'upset');
    expect(screen.getByTestId('speech-bubble')).toHaveTextContent(/Enough|Stop|Not now/);
    expect(relay.published).toHaveLength(0);
  });

  it('says what it needs the moment a stat is critical, once', async () => {
    relay.all = [brook({ hunger: '8' }), ...definitions(), ...stock()];
    renderHome();
    await ready();
    expect(screen.getByTestId('speech-bubble')).toHaveTextContent('So hungry');
    expect(screen.getByTestId('condition-dots').querySelector('[data-stat="hunger"]')).toHaveAttribute('data-status', 'critical');
  });
});
