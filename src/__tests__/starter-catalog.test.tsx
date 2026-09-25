/**
 * The starter kit (M11): care is item-driven, and a starter item is a
 * gameplay affordance, never ownership. No magic button feeds, plays or
 * cleans; a starter use spends nothing and writes only the semantic care
 * events; an owned item still goes through the spend pipeline; a starter
 * never shows as owned inventory; when the definition relay is down the
 * built-in minimum stands in without granting anything; rest stays the
 * bed's; choosing writes nothing.
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
import { KIND_GAME_INVENTORY_SPEND, KIND_GAME_ITEM_DEFINITION, parseGameItemDefinition } from '@nostr-games/inventory';

import Home from '@/pages/Home';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { OFFICIAL_CATALOG_SNAPSHOT, SNAPSHOT_ADDRESSES, builtinStarterItem, resolveStarterEntries } from '@/features/inventory';
import { OFFICIAL_ITEM_ISSUER } from '@/features/inventory/issuers';
import { PET_OP_TAG } from '@/features/inventory/item-use-plan';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { chooseCare, chooseItem } from '@/test/care-ui';
import { OFFICIAL_APPLE, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';

let signCount = 0;
const signer = {
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...t, id: String(signCount).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }) }));

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], definitionsDown: false };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  if (relay.definitionsDown && filters.some((f) => f.kinds?.includes(KIND_GAME_ITEM_DEFINITION))) throw new Error('definition relay unreachable');
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
const brook = () => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state: 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });
const kinds = () => relay.published.map((e) => e.kind);
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  await waitFor(() => expect(query.mock.calls.some(([filters]) => filters.some((f) => f.kinds?.includes(31633)))).toBe(true));
  await settle(80);
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook()];
  relay.published = [];
  relay.definitionsDown = false;
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('the catalog itself', () => {
  it('the snapshot mirrors official definitions by their published addresses and carries only the immutable minimum, honest about not being fetched', () => {
    expect(OFFICIAL_CATALOG_SNAPSHOT.length).toBeGreaterThanOrEqual(19);
    const ds = OFFICIAL_CATALOG_SNAPSHOT.map((r) => r.d);
    expect(new Set(ds).size).toBe(ds.length);
    for (const d of ['blobbi:food:apple', 'blobbi:food:burger', 'blobbi:toy:ball', 'blobbi:toy:teddy', 'blobbi:hygiene:soap', 'blobbi:hygiene:bubble-bath', 'blobbi:medicine:bandage', 'blobbi:energy:drink']) expect(ds).toContain(d);
    for (const address of SNAPSHOT_ADDRESSES) expect(address.startsWith(`31632:${OFFICIAL_ITEM_ISSUER}:blobbi:`)).toBe(true);
    for (const row of OFFICIAL_CATALOG_SNAPSHOT) {
      expect(row.eventId).toMatch(/^[0-9a-f]{64}$/);
      expect(['feed', 'play', 'clean', 'medicine', 'boost']).toContain(row.action);
      expect(row.stages.length).toBeGreaterThan(0);
    }
    const built = builtinStarterItem(OFFICIAL_CATALOG_SNAPSHOT[0]);
    expect(built.definitionSource).toBe('builtin');
    expect(built.definition).toBeNull();
    expect(built.care).toEqual({ action: 'feed', effects: { hunger: 25, hygiene: -2, energy: 5 }, stages: ['baby', 'adult'] });
    expect(built.issuer?.pubkey).toBe(OFFICIAL_ITEM_ISSUER);
  });

  it('a fetched official definition replaces its snapshot row; a snapshot row stands in for the rest; an event from another author never gets in', () => {
    const apple = parseGameItemDefinition(officialCareDefinition('blobbi:food:apple', 'Apple (relay)', 'food', 'feed', { hunger: 30 }, { emoji: '🍎' }))!;
    const fresh = parseGameItemDefinition(officialCareDefinition('blobbi:food:mango', 'Mango', 'food', 'feed', { hunger: 20 }, { emoji: '🥭' }))!;
    const spoof = { ...parseGameItemDefinition({ ...officialCareDefinition('blobbi:toy:ball', 'Evil Ball', 'toy', 'play', { happiness: 99 }, { emoji: '💣' }), pubkey: 'e'.repeat(64) })! };
    const entries = resolveStarterEntries(new Map([[apple.address, apple], [fresh.address, fresh], [spoof.address, spoof]]), { stage: 'baby', state: 'active', name: 'Brook' });
    expect(entries.every((e) => e.source === 'starter' && !('quantity' in e) && !('inventoryAddress' in e))).toBe(true);
    const byId = new Map(entries.map((e) => [e.item.itemId, e.item]));
    expect(byId.get('blobbi:food:apple')).toMatchObject({ name: 'Apple (relay)', definitionSource: 'nostr' });
    expect(byId.get('blobbi:food:apple')!.care?.effects).toEqual({ hunger: 30 });
    expect(byId.get('blobbi:food:mango')).toMatchObject({ name: 'Mango', definitionSource: 'nostr' }); // a new official item is offered without a snapshot row
    expect(byId.get('blobbi:toy:ball')).toMatchObject({ name: 'Ball', definitionSource: 'builtin' }); // the spoof never replaced the snapshot
    expect([...byId.values()].some((i) => i.name === 'Evil Ball')).toBe(false);
    expect(byId.get('blobbi:hygiene:soap')).toMatchObject({ definitionSource: 'builtin' });
    // Ordered by category then name: foods first.
    expect(entries[0].item.itemId.startsWith('blobbi:food:')).toBe(true);
  });
});

describe('in the home', () => {
  it('no verb is a magic button: every option is an item, owned or starter; each verb offers every official item whose care action answers it; tapping a verb writes nothing', async () => {
    renderHome();
    await ready();
    const expected = { feed: ['feed', 'boost'], play: ['play'], clean: ['clean', 'medicine'] } as const;
    for (const verb of ['feed', 'play', 'clean'] as const) {
      await userEvent.click(screen.getByTestId(`care-${verb}`));
      const options = within(screen.getByTestId('care-options')).getAllByRole('button');
      const rows = OFFICIAL_CATALOG_SNAPSHOT.filter((r) => (expected[verb] as readonly string[]).includes(r.action) && r.stages.includes('baby'));
      expect(options.map((o) => o.getAttribute('data-testid'))).toEqual(rows.map((r) => `care-option-starter-${r.d}`));
      expect(options.length).toBeGreaterThan(0);
      for (const o of options) {
        expect(['owned', 'starter']).toContain(o.getAttribute('data-source'));
        expect(o.getAttribute('data-testid')).not.toMatch(/plain/);
      }
      await userEvent.click(screen.getByTestId(`care-${verb}`));
      expect(screen.queryByTestId('care-options')).toBeNull();
    }
    expect(document.querySelector('[data-testid^="care-option-plain"]')).toBeNull();
    await settle(50);
    expect(relay.published).toHaveLength(0);
  });

  it('a starter use spends nothing: exactly one 31124 and one 1124 naming the item, no 1416, no spend marker', async () => {
    renderHome();
    await ready();
    await chooseCare('feed');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    const [state, interaction] = relay.published;
    expect(kinds()).not.toContain(KIND_GAME_INVENTORY_SPEND);
    expect(state.tags.some(([n]) => n === PET_OP_TAG)).toBe(false);
    expect(getTagValue(interaction.tags, 'item') ?? interaction.tags.find((t) => t[1]?.includes('blobbi:food:apple'))?.[1]).toContain('blobbi:food:apple');
    expect(interaction.tags.some((t) => t[0] === 'e' && t[3] === 'inventory-spend')).toBe(false);
    expect(Number(getTagValue(state.tags, 'hunger'))).toBeGreaterThan(40);
  });

  it('an owned item still goes through the spend pipeline: 1416, then 31124 with the marker, then 1124', async () => {
    relay.all = [brook(), officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }, { emoji: '🍎' }), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 })];
    renderHome();
    await ready();
    await chooseItem('feed', 'blobbi:food:apple');
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(getTagValue(relay.published[1].tags, PET_OP_TAG)).toBe(relay.published[0].id);
  });

  it('a starter item never appears as owned inventory, in the screen or in the counts', async () => {
    renderHome();
    await ready();
    expect(screen.getByTestId('action-items')).toHaveAccessibleName('Items');
    expect(within(screen.getByTestId('care-feed')).queryByText(/\d/)).toBeNull();
    await userEvent.click(screen.getByTestId('action-items'));
    const overlay = await screen.findByTestId('inventory-sheet');
    expect(within(overlay).getByTestId('inventory-empty')).toBeInTheDocument();
    expect(within(overlay).queryByTestId('inventory-item-blobbi:food:apple')).toBeNull();
    expect(within(overlay).getByTestId('inventory-count')).toHaveTextContent(/Nothing yet/);
  });

  it('when the definition relay is down the built-in minimum stands in, says so, works, and grants nothing', async () => {
    relay.definitionsDown = true;
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-clean'));
    const soap = screen.getByTestId('care-option-starter-blobbi:hygiene:soap');
    expect(soap).toHaveAttribute('data-definition', 'builtin');
    expect(soap).toHaveAttribute('title', expect.stringMatching(/built-in/));
    await userEvent.click(soap);
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(kinds()).not.toContain(KIND_GAME_INVENTORY_SPEND);
    await waitFor(() => expect(screen.queryByTestId('scene-object-offer')).toBeNull(), { timeout: 3000 });
    await userEvent.click(screen.getByTestId('action-items'));
    expect(within(await screen.findByTestId('inventory-sheet')).getByTestId('inventory-empty')).toBeInTheDocument();
  });

  it('rest stays the bed’s: no options, the bed comes out, sleep on arrival', async () => {
    renderHome({ walkSpeed: 1.2, idleEnabled: false });
    await ready();
    await userEvent.click(screen.getByTestId('care-rest'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(screen.getByTestId('furniture-home:bed-pet')).toHaveAttribute('data-state', 'walking');
    expect(relay.published).toHaveLength(0);
    await waitFor(() => expect(kinds()).toContain(KIND_BLOBBI_STATE), { timeout: 4000 });
    expect(getTagValue(relay.published[0].tags, 'state')).toBe('sleeping');
    expect(kinds()).not.toContain(KIND_GAME_INVENTORY_SPEND);
  });
});
