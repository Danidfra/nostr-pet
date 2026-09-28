/**
 * The protocol boundary, as a regression suite: everything that is
 * presentation (positions, gaze, the options strip, the bed and tub
 * coming out, items set down, reactions, pokes) writes nothing to Nostr and reads
 * nothing new; the semantic actions write exactly their kinds. Also the
 * renderer contract: a V1 Blobbi draws without expressions, a V2 Blobbi
 * carries them, and the home hands both the same inputs.
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
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { chooseCare, useOwnedItem } from '@/test/care-ui';
import { OFFICIAL_APPLE, OFFICIAL_BALL, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';

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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
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
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

const FAST: Partial<SceneSettings> = { walkSpeed: 4, idleEnabled: false };
const SLOW: Partial<SceneSettings> = { walkSpeed: 1.2, idleEnabled: false };
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
const brook = (extra: string[][] = []) => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state: 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' }, extra });
const definitions = () => [officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }), officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 })];
const stock = () => [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_BALL]: 2 })];

const actor = () => screen.getByTestId('blobbi-actor');
const renderer = () => document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]') as HTMLElement;
const kinds = () => relay.published.map((e) => e.kind);

function giveSceneABox() {
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 100, width: 400, height: 500, right: 400, bottom: 600, x: 0, y: 100, toJSON: () => ({}) });
}
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
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

describe('Presentation never touches Nostr', () => {
  it('walking, looking, poking, opening the options, setting an item down and putting it back write nothing and read nothing new', async () => {
    renderHome(SLOW);
    await ready();
    const reads = query.mock.calls.length;
    const scene = screen.getByTestId('home-scene');

    // Walking, looking, poking.
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 100, clientY: 520, detail: 1 });
    await waitFor(() => expect(actor()).toHaveAttribute('data-motion', 'idle'), { timeout: 3000 });
    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 350, clientY: 50 });
    for (let i = 0; i < 4; i += 1) await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'upset');
    await waitFor(() => expect(actor()).toHaveAttribute('data-expression', 'neutral'), { timeout: 4000 });

    // Opening and closing the options of every verb.
    for (const verb of ['feed', 'play', 'clean'] as const) {
      await userEvent.click(screen.getByTestId(`care-${verb}`));
      expect(screen.getByTestId('care-options')).toHaveAttribute('data-verb', verb);
    }
    await userEvent.click(screen.getByTestId('care-clean'));
    expect(screen.queryByTestId('care-options')).toBeNull();

    // The bed comes out and goes back without a sleep: a tap on the way.
    await chooseCare('rest');
    expect(screen.getByTestId('furniture-home:bed-pet')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 150, clientY: 500, detail: 1 });
    await waitFor(() => expect(screen.queryByTestId('furniture-home:bed-pet')).toBeNull(), { timeout: 3000 });

    // An item set down and put back before the Blobbi reaches it.
    await useOwnedItem('blobbi:toy:ball');
    expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'walking');
    await userEvent.click(within(screen.getByTestId('scene-object-offer')).getByRole('button'));
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull());

    await new Promise((r) => setTimeout(r, 200));
    expect(relay.published).toEqual([]);
    expect(event).not.toHaveBeenCalled();
    expect(query.mock.calls.length).toBe(reads);
  });

  it('the semantic actions write exactly their kinds: care is 31124 and 1124, an item use is 1416, 31124 and 1124', async () => {
    renderHome();
    await ready();
    await chooseCare('feed');
    await waitFor(() => expect(kinds().filter((k) => k === KIND_BLOBBI_STATE)).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    relay.published = [];
    await useOwnedItem('blobbi:toy:ball');
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
  });
});

describe('The renderer contract', () => {
  it('a V1 Blobbi (no visual_generation) draws as V1; whether its face can show an expression is the renderer\'s word, and the home still hands it every input', async () => {
    renderHome();
    await ready();
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v1');
    // Renderer 0.4.0 says yes for the V1 baby front (0.3.0 said no for every
    // V1 drawing). The home reads the answer, it never decides it.
    expect(renderer()).toHaveAttribute('data-blobbi-expression-support', '');
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'happy'); // the home's state
    expect(renderer()).toHaveAttribute('data-blobbi-facing', 'front');
  });

  it('an adult V2 Blobbi carries the expression the home composes (egg artwork has no face to compose on)', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' }, extra: [['visual_generation', 'v2']] }), ...definitions(), ...stock()];
    renderHome();
    await ready();
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2');
    expect(renderer()).toHaveAttribute('data-blobbi-expression-support');
    await userEvent.click(screen.getByTestId('blobbi-poke'));
    expect(actor()).toHaveAttribute('data-expression', 'happy');
  });

  it('under reduced motion the Blobbi is simply there, and a give still reaches the relay once', async () => {
    renderHome({ ...FAST, reducedMotion: true });
    await ready();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 100, clientY: 520, detail: 1 });
    expect(actor()).toHaveAttribute('data-motion', 'idle');
    expect(actor()).toHaveAttribute('data-x', '0.250');
    await useOwnedItem('blobbi:toy:ball');
    await waitFor(() => expect(kinds().filter((k) => k === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1), { timeout: 4000 });
    expect(relay.published).toHaveLength(kinds().length);
  });
});
