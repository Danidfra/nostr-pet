/**
 * Ecosystem cohesion (M5): the Blobbi wears at home what the Island dressed
 * it in (read-only, gated), and switching Blobbis leaves nothing of the
 * previous one behind in the room.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { HOME_SPOT, SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { PUBKEY, blobbiEvent, profileEvent } from '@/test/fixtures';
import {
  OFFICIAL_APPLE,
  OFFICIAL_CAP,
  OFFICIAL_GLASSES,
  OFFICIAL_SPARKLES,
  inventoryEvent,
  officialCareDefinition,
  officialCosmeticDefinition,
  officialEffectDefinition,
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
  else if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => e.kind !== KIND_BLOBBONAUT_PROFILE), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

const FAST: Partial<SceneSettings> = { walkSpeed: 4, idleEnabled: false };
const SLOW: Partial<SceneSettings> = { walkSpeed: 0.02, idleEnabled: false };

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
const ELDER_D = 'blobbi-aaaaaaaaaaaa-0000000002';
const brook = () => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });
const elder = () => blobbiEvent('0000000002', { name: 'Elder', stage: 'adult', createdAt: NOW - 400, set: { hunger: '60', happiness: '60', hygiene: '60', energy: '60' } });

const actor = () => screen.getByTestId('blobbi-actor');
const accessories = () => [...document.querySelectorAll('[data-testid="blobbi-actor"] [data-accessory-code]')].map((el) => el.getAttribute('data-accessory-code'));

function giveSceneABox() {
  const scene = screen.getByTestId('home-scene');
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
}

const wardrobe = () => [
  officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear'),
  officialCosmeticDefinition('blobbi:cosmetic:block-builder-cap', 'Block Builder Cap', 'headwear'),
  officialEffectDefinition(),
  officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }),
];

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [];
  relay.published = [];
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('Equipment at home', () => {
  it('draws the wearables and effects the Island equipped, owned and official only, and marks them in the sheet', async () => {
    relay.all = [
      brook(),
      ...wardrobe(),
      inventoryEvent('blobbi:island', { [OFFICIAL_GLASSES]: 1, [OFFICIAL_SPARKLES]: 1, [OFFICIAL_APPLE]: 1 }),
      placementEvent(BROOK_D, [
        { id: 'eyewear', item: OFFICIAL_GLASSES, mode: 'equip', slot: 'eyewear', position: { x: 50, y: 46 } },
        { id: 'headwear', item: OFFICIAL_CAP, mode: 'equip', slot: 'headwear' }, // not owned: never drawn
        { id: 'ambient-particles', item: OFFICIAL_SPARKLES, mode: 'equip', slot: 'ambient-particles' },
      ]),
    ];
    renderHome();
    await ready();
    await waitFor(() => expect(accessories()).toEqual([OFFICIAL_GLASSES]));
    const img = document.querySelector('[data-testid="blobbi-actor"] [data-accessory-code] img');
    expect(img?.getAttribute('src')).toBe('https://blossom.primal.net/abc.webp');
    // The effect item became a renderer effect around the body.
    await waitFor(() => expect(document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-effect="golden-sparkles"]')).not.toBeNull());
    // Nothing was published: reading equipment is read-only.
    expect(relay.published).toHaveLength(0);

    await userEvent.click(screen.getByTestId('action-items'));
    const glasses = await screen.findByTestId('inventory-item-blobbi:cosmetic:stargazer-glasses');
    expect(within(glasses).getByTestId('item-worn')).toHaveTextContent('Worn');
    await userEvent.click(glasses);
    expect(screen.getByTestId('inventory-detail')).toHaveTextContent('· Worn');
    expect(screen.getByTestId('inventory-detail-note')).toHaveTextContent('Equip it on the Island.');
  });

  it('draws nothing for an egg, a stranger-authored document, or a look-alike definition', async () => {
    const forged = officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Evil Glasses', 'eyewear');
    forged.pubkey = 'b'.repeat(64);
    const forgedAddress = `31632:${'b'.repeat(64)}:blobbi:cosmetic:stargazer-glasses`;
    relay.all = [
      brook(),
      ...wardrobe(),
      forged,
      inventoryEvent('blobbi:island', { [OFFICIAL_GLASSES]: 1, [forgedAddress]: 1 }),
      placementEvent(BROOK_D, [{ id: 'eyewear', item: OFFICIAL_GLASSES, mode: 'equip', slot: 'eyewear' }], { owner: 'c'.repeat(64) }),
      placementEvent(BROOK_D, [{ id: 'eyewear', item: forgedAddress, mode: 'equip', slot: 'eyewear' }], { createdAt: NOW - 1 }),
    ];
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('action-items')).toHaveAccessibleName(/Items/));
    await new Promise((r) => setTimeout(r, 200));
    expect(accessories()).toEqual([]);
  });
});

describe('Switching Blobbis', () => {
  it('resets movement, the offered item, speech, reactions and the dock for the newcomer', async () => {
    relay.all = [brook(), elder(), profileEvent({ has: [BROOK_D, ELDER_D], currentCompanion: BROOK_D }), ...wardrobe(), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 })];
    renderHome(SLOW);
    await ready();
    expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/Brook/);

    // Start an item offer: the apple is down, Brook is walking (slowly).
    await userEvent.click(screen.getByTestId('action-items'));
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('inventory-use'));
    await waitFor(() => expect(screen.queryByTestId('inventory-sheet')).toBeNull());
    expect(screen.getByTestId('scene-object-offer')).toBeInTheDocument();
    await waitFor(() => expect(actor()).toHaveAttribute('data-motion', 'walking'));
    expect(screen.getByTestId('care-feed')).toBeDisabled();

    // Switch to Elder from the Blobbi sheet.
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    const sheet = await screen.findByTestId('blobbi-sheet');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Elder' }));
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/Elder/));

    // The newcomer starts at home, idle, with nothing carried over.
    const a = actor();
    expect(a).toHaveAttribute('data-motion', 'idle');
    expect(a).toHaveAttribute('data-x', HOME_SPOT.x.toFixed(3));
    expect(a).toHaveAttribute('data-y', HOME_SPOT.y.toFixed(3));
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    expect(document.querySelector('.speech-bubble')).toBeNull();
    expect(a).toHaveAttribute('data-expression', 'neutral');
    expect(screen.getByTestId('care-feed')).not.toBeDisabled();
    expect(screen.getByTestId('action-items')).not.toBeDisabled();

    // Brook's abandoned offer never wrote anything (the walk never arrived), and the selection published the profile.
    await new Promise((r) => setTimeout(r, 300));
    expect(relay.published.filter((e) => e.kind !== KIND_BLOBBONAUT_PROFILE)).toHaveLength(0);
    expect(relay.published.filter((e) => e.kind === KIND_BLOBBONAUT_PROFILE)).toHaveLength(1);
  });
});
