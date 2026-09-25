/**
 * The composition of the simplified home (M10.1): what is permanently in
 * the room and nothing else, where it stands (canonical coordinates, not
 * viewport numbers), that nothing an earlier build persisted can put
 * furniture back, that a sleeper lies on the bed's anchor, that opening the
 * chooser or an overlay moves nothing and writes nothing.
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

import Home from '@/pages/Home';
import { DOOR_POSITION, SceneSettingsProvider, placeOnFloor, type SceneSettings } from '@/features/home/scene';
import { FLOOR_LINE, roomToCss } from '@/features/home/space/room-space';
import { HOME_SPACE, PERMANENT_OBJECTS, STAGE_OBJECTS } from '@/features/home/space/home-space';
import { approachSpot, layoutStorageKey, roomStorageKey, toyStorageKey } from '@/features/home/rooms';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { chooseCare } from '@/test/care-ui';
import { OFFICIAL_APPLE, OFFICIAL_BALL, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';

const signer = {
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    return { ...t, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
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
const BROOK_D = 'blobbi-aaaaaaaaaaaa-0000000001';
const brook = (state: 'active' | 'sleeping' = 'active') => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state, createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });
const actor = () => screen.getByTestId('blobbi-actor');
const furniture = () => document.querySelectorAll('.furniture-anchor');
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  await waitFor(() => expect(query.mock.calls.some(([filters]) => filters.some((f) => f.kinds?.includes(31633)))).toBe(true));
  await settle(60);
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }), officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_BALL]: 1 })];
  relay.published = [];
  resetInventoryFixtureIds();
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('What is in the room', () => {
  it('by default: the wall and floor, the window, the door and the Blobbi; no furniture at all', async () => {
    renderHome();
    await ready();
    expect(HOME_SPACE.furniture).toEqual([]);
    expect(PERMANENT_OBJECTS).toEqual(['door', 'window']);
    expect(screen.getByTestId('scene-backdrop').querySelector('.decor-window')).not.toBeNull();
    expect(screen.getByTestId('scene-object-door')).toBeInTheDocument();
    expect(actor()).toBeInTheDocument();
    expect(furniture()).toHaveLength(0);
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    expect(screen.queryByTestId('furniture-home:bed-pet')).toBeNull();
    expect(screen.queryByTestId('furniture-home:tub')).toBeNull();
    // Nothing the registry calls a default for this room is drawn.
    for (const piece of HOME_SPACE.room.defaultFurniture) expect(screen.queryByTestId(`furniture-${piece.id}`)).toBeNull();
  });

  it('nothing an earlier build persisted (a room layout, a chosen room, placed toys) can put furniture back', async () => {
    window.localStorage.setItem(layoutStorageKey(PUBKEY, BROOK_D), JSON.stringify({ v: 1, rooms: { home: [{ id: 'official:rug-round', x: 0.5, y: 0.88, layer: 'floor' }, { id: 'official:lamp-floor', x: 0.3, y: 0.74, layer: 'front' }] } }));
    window.localStorage.setItem(roomStorageKey(PUBKEY, BROOK_D), 'kitchen');
    window.localStorage.setItem(toyStorageKey(PUBKEY, BROOK_D), JSON.stringify({ v: 1, by_room: { home: [{ address: OFFICIAL_BALL, inventoryAddress: `31633:${PUBKEY}:blobbi:island`, x: 0.3, y: 0.5 }] } }));
    renderHome();
    await ready();
    expect(furniture()).toHaveLength(0);
    expect(screen.queryByTestId('scene-object-toy-blobbi:toy:ball')).toBeNull();
    expect(screen.getByTestId('home-scene')).toHaveAttribute('data-room', 'home');
  });

  it('the door is a wall fixture: its bottom on the floor line, full size, behind whatever stands on the floor', async () => {
    renderHome();
    await ready();
    const door = screen.getByTestId('scene-object-door');
    expect(DOOR_POSITION.y).toBe(0);
    expect(parseFloat(door.style.top)).toBeCloseTo(FLOOR_LINE * 100, 3);
    expect(door.style.getPropertyValue('--object-scale')).toBe('1');
    expect(door).toHaveAttribute('data-wall', 'true');
    expect(Number(door.style.zIndex)).toBeLessThan(Number(actor().style.zIndex));
    expect(door.style.getPropertyValue('--object-width')).toBe('26%');
  });

  it('interaction objects appear only for their moment: the bed for rest, food for a feed, and go away after', async () => {
    renderHome();
    await ready();
    await chooseCare('rest');
    const bed = await screen.findByTestId('furniture-home:bed-pet');
    // Placed by canonical room coordinates, scaled for a Blobbi to lie on.
    const css = roomToCss({ x: STAGE_OBJECTS.bed.x, y: STAGE_OBJECTS.bed.y });
    expect(parseFloat(bed.style.left)).toBeCloseTo(parseFloat(css.left), 3);
    expect(parseFloat(bed.style.top)).toBeCloseTo(parseFloat(css.top), 3);
    expect(parseFloat(bed.style.getPropertyValue('--object-width'))).toBeCloseTo(0.3 * STAGE_OBJECTS.bed.scale! * 100, 2);
    await waitFor(() => expect(actor()).toHaveAttribute('data-sleeping', 'true'), { timeout: 4000 });
    // The sleeper's feet are the bed's use spot (on the cushion, in front of its back edge).
    const spot = approachSpot(STAGE_OBJECTS.bed);
    expect(actor()).toHaveAttribute('data-x', spot.x.toFixed(3));
    expect(actor()).toHaveAttribute('data-y', spot.y.toFixed(3));
    expect(Number(actor().style.zIndex)).toBeGreaterThan(Number(bed.style.zIndex));
    await userEvent.click(screen.getByTestId('care-rest'));
    await waitFor(() => expect(screen.queryByTestId('furniture-home:bed-pet')).toBeNull(), { timeout: 4000 });
    expect(furniture()).toHaveLength(0);
  });

  it('a sleeper opens the home already on the bed', async () => {
    relay.all = [brook('sleeping'), ...relay.all.slice(1)];
    renderHome();
    await ready();
    const spot = approachSpot(STAGE_OBJECTS.bed);
    expect(screen.getByTestId('furniture-home:bed-pet')).toHaveAttribute('data-state', 'using');
    expect(parseFloat(actor().style.left)).toBeCloseTo(parseFloat(placeOnFloor(spot).left));
  });
});

describe('Opening things moves nothing and writes nothing', () => {
  it('the care chooser floats over the room: the scene, the canvas and the actor are untouched while it is open', async () => {
    renderHome();
    await ready();
    const scene = screen.getByTestId('home-scene');
    const canvas = screen.getByTestId('room-canvas');
    const before = { x: actor().getAttribute('data-x'), y: actor().getAttribute('data-y'), left: actor().style.left, top: actor().style.top, children: scene.children.length, canvasChildren: canvas.children.length };
    await userEvent.click(screen.getByTestId('care-feed'));
    const strip = screen.getByTestId('care-options');
    expect(strip).toHaveAttribute('data-float', 'true');
    expect(strip.closest('.hud-bottom')).not.toBeNull();
    expect(scene.contains(strip)).toBe(false);
    expect(scene.children.length).toBe(before.children);
    expect(canvas.children.length).toBe(before.canvasChildren);
    expect(actor().style.left).toBe(before.left);
    expect(actor().style.top).toBe(before.top);
    expect(actor()).toHaveAttribute('data-x', before.x!);
    expect(actor()).toHaveAttribute('data-y', before.y!);
    expect(actor()).not.toHaveAttribute('data-motion', 'walking');
    await userEvent.click(screen.getByTestId('care-feed'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });

  it('the overlays (items, menu, details) are game screens over the home, opened and closed without a read or a write', async () => {
    renderHome();
    await ready();
    const reads = query.mock.calls.length;
    for (const [button, id] of [
      ['action-items', 'inventory-sheet'],
      ['menu-button', 'menu-sheet'],
      ['blobbi-chip', 'blobbi-sheet'],
    ] as const) {
      await userEvent.click(screen.getByTestId(button));
      const overlay = await screen.findByTestId(id);
      expect(overlay).toHaveAttribute('data-overlay', 'true');
      const dialog = within(overlay).getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.querySelector('.sheet-panel, .sheet-root, aside')).toBeNull();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByTestId(id)).toBeNull());
      expect(document.activeElement).toBe(screen.getByTestId(button));
    }
    await settle(100);
    expect(relay.published).toHaveLength(0);
    expect(event).not.toHaveBeenCalled();
    expect(query.mock.calls.length).toBe(reads);
  });

  it('the inventory screen shelves come from the item definitions, and only the shelves that exist', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('action-items'));
    const tabs = await screen.findByTestId('inventory-tabs');
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['All', 'Food', 'Toys']);
    await userEvent.click(within(tabs).getByRole('tab', { name: 'Toys' }));
    expect(screen.queryByTestId('inventory-item-blobbi:food:apple')).toBeNull();
    expect(screen.getByTestId('inventory-item-blobbi:toy:ball')).toHaveAttribute('data-shelf', 'toys');
    fireEvent.click(within(tabs).getByRole('tab', { name: 'All' }));
    expect(screen.getByTestId('inventory-item-blobbi:food:apple')).toHaveAttribute('data-shelf', 'food');
  });
});
