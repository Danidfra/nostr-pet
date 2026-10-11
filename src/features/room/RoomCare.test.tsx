/**
 * Care in the 3D room (milestone 4), end to end: the real `/room` page, the
 * real inventory, spend and care hooks, a relay that records what is
 * published, and the WebGL scene replaced by a fake whose walks the test
 * settles. What is checked is the contract:
 *
 *  - each room offers its registry activities: starters (free) and owned
 *    items (with their counts), selected with a tap or the arrow keys;
 *  - choosing, dragging, hovering, walking, furniture and navigation
 *    publish nothing;
 *  - a use writes exactly the home's kinds: a starter 31124 + 1124, an
 *    owned item 1416 + 31124 + 1124, once, however often it is pressed;
 *  - an item set down is used only when the Blobbi arrives; a walk that is
 *    stopped or refused uses nothing;
 *  - a failed use is never retried by itself; Retry is a tap, and an owned
 *    spend is resumed with the same signed event, never re-signed.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY_SPEND } from '@nostr-games/inventory';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_SOAP, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';
import { roomFurnitureFor } from './lib/room-furniture';
import { APPEARANCE_STORAGE_KEY } from './lib/blobbi-appearance';

// ─── A relay that records ───
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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: 0, silent: 0 };
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
const attempts: NostrEvent[] = [];
const event = vi.fn(async (ev: NostrEvent) => {
  attempts.push(ev);
  // A relay that says no (definitely not published), or that never answers (ambiguous)
  if (relay.refuse > 0) {
    relay.refuse -= 1;
    throw new AggregateError([new Error('blocked: no')], 'refused');
  }
  if (relay.silent > 0) {
    relay.silent -= 1;
    throw new Error('publish timed out');
  }
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

// ─── A 3D room whose walks the test settles ───
const scene = vi.hoisted(() => {
  type Outcome = 'arrived' | 'replaced' | 'stopped' | 'refused';
  const state = {
    walks: [] as { x: number; z: number; resolve: (o: Outcome) => void }[],
    autoArrive: false,
    /** What a point is over: the Blobbi in a box round (200, 300), an item by index above y 80, else the floor. */
    itemAt: null as number | null,
    hops: 0,
  };
  const fake = {
    pick: (x: number, y: number) => {
      if (x > 150 && x < 250 && y > 220 && y < 320) return { kind: 'actor' as const, id: 'main' };
      if (y < 0) return null;
      if (state.itemAt !== null && y < 80) return { kind: 'item' as const, index: state.itemAt };
      return { kind: 'floor' as const, x: Math.min(7.5, x / 60), z: Math.min(7.5, y / 60) };
    },
    floorAt: (x: number, y: number) => (y < 0 ? null : { x: Math.min(7.5, x / 60), z: Math.min(7.5, y / 60) }),
    requestWalk: (_id: string, x: number, z: number) =>
      new Promise<Outcome>((resolve) => {
        if (state.autoArrive) resolve('arrived');
        else state.walks.push({ x, z, resolve });
      }),
    stopWalk: () => state.walks.splice(0).forEach((w) => w.resolve('stopped')),
    positionOf: () => ({ x: 4, z: 4 }),
    hop: () => { state.hops += 1; },
    projectBlobbi: () => ({ x: 200, y: 320, pxPerTile: 40 }),
    projectFloor: () => ({ x: 200, y: 400, pxPerTile: 40 }),
    projectItemTop: () => ({ x: 150, y: 300, pxPerTile: 40 }),
    facingOf: () => 'front' as const,
    isWalking: () => false,
    actorModelDrawn: () => false,
    poke: () => {},
    toggleLamp: () => false,
    walkTo: () => {},
    beginDrag: () => false,
    dragTo: () => {},
    endDrag: () => null,
    findSpot: () => ({ at: 'floor' as const, x: 5.5, y: 5.5 }),
  };
  return { state, fake };
});
vi.mock('@/features/room/hooks/useRoomScene', () => ({
  useRoomScene: () => ({ status: 'ready', sceneRef: { current: scene.fake } }),
  webglAvailable: () => false,
}));

function renderRoom() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/room']}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>,
  );
}

const NOW = Math.floor(Date.now() / 1000);
const brook = () => blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });
const definitions = () => [
  officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }),
  officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }),
  officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 30 }),
];
const stock = () => [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_BALL]: 2, [OFFICIAL_SOAP]: 1 })];
const kinds = () => relay.published.map((e) => e.kind);

const shell = () => screen.getByTestId('room-shell');
const tiles = () => within(screen.getByTestId('room-item-list')).getAllByRole('option');
const tile = (name: string, source: 'starter' | 'owned') => tiles().find((t) => t.dataset.source === source && t.getAttribute('aria-label')!.startsWith(`${name},`))!;
const goTo = async (room: string) => {
  for (let i = 0; i < 5 && shell().dataset.room !== room; i++) fireEvent.click(screen.getByTestId('room-nav-right'));
  expect(shell()).toHaveAttribute('data-room', room);
};
async function ready() {
  await screen.findByTestId('room-care-panel');
  // The owned items are in once the inventory has been read
  await waitFor(() => expect(screen.getAllByTestId('room-item-badge').some((b) => b.textContent!.startsWith('×'))).toBe(true));
}
/** A finger or mouse carrying a tile into the room and letting go at (x, y). */
function dragTile(el: HTMLElement, x: number, y: number, finish: 'drop' | 'none' = 'drop') {
  fireEvent.pointerDown(el, { pointerId: 7, isPrimary: true, button: 0, pointerType: 'mouse', clientX: 100, clientY: 700 });
  act(() => { window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 120, clientY: 600, pointerType: 'mouse' })); });
  act(() => { window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: x, clientY: y, pointerType: 'mouse' })); });
  if (finish === 'drop') act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: x, clientY: y })); });
}
const settleWalk = (outcome: 'arrived' | 'replaced' | 'stopped' | 'refused') => act(() => { scene.state.walks.shift()?.resolve(outcome); });
const quiet = (ms = 400) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(async () => {
  // A drop swallows the click after it until the next task
  await new Promise((r) => setTimeout(r, 0));
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), ...definitions(), ...stock()];
  relay.published = [];
  relay.refuse = 0;
  relay.silent = 0;
  attempts.length = 0;
  signCount = 0;
  resetInventoryFixtureIds();
  scene.state.walks = [];
  scene.state.autoArrive = false;
  scene.state.itemAt = null;
  scene.state.hops = 0;
  localStorage.clear();
  event.mockClear();
});
afterEach(() => localStorage.clear());

describe('the room\'s items', () => {
  it('each room offers its own: toys here, food and drink in the kitchen, soap and medicine in the care room; Sleep in the bedroom; starters free, owned items counted', async () => {
    renderRoom();
    await ready();
    expect(shell()).toHaveAttribute('data-room', 'home');
    expect(tile('Ball', 'starter')).toHaveTextContent('Free');
    expect(tile('Ball', 'owned')).toHaveTextContent('×2');
    expect(tiles().some((t) => /Apple|Soap/.test(t.getAttribute('aria-label')!))).toBe(false);
    await goTo('rest');
    expect(screen.queryByTestId('room-item-strip')).toBeNull();
    expect(screen.getByTestId('room-rest')).toHaveTextContent('Sleep');
    await goTo('closet');
    expect(screen.getByTestId('room-closet-hint')).toHaveTextContent(/Island/);
    await goTo('care');
    expect(tile('Soap', 'owned')).toHaveTextContent('×1');
    expect(tiles().every((t) => !/Ball|Apple/.test(t.getAttribute('aria-label')!))).toBe(true);
    await goTo('kitchen');
    expect(tile('Apple', 'owned')).toHaveTextContent('×2');
    expect(tile('Apple', 'starter')).toHaveTextContent('Free');
    expect(relay.published).toEqual([]);
  });

  it('a tap or the arrow keys select, never use; the selection is the room\'s, kept while away; Use waits for one', async () => {
    renderRoom();
    await ready();
    const use = screen.getByTestId('room-item-use');
    expect(use).toBeDisabled();
    fireEvent.click(tile('Ball', 'owned'));
    expect(tile('Ball', 'owned')).toHaveAttribute('aria-selected', 'true');
    expect(use).toBeEnabled();
    expect(use).toHaveAccessibleName('Use Ball');
    const list = screen.getByTestId('room-item-list');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(tiles()[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(tiles()[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(tiles()[tiles().length - 1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'End' });
    const chosen = tiles()[tiles().length - 1].dataset.entryKey;
    await goTo('kitchen');
    expect(screen.getByTestId('room-item-use')).toBeDisabled();
    await goTo('home');
    expect(tiles().find((t) => t.getAttribute('aria-selected') === 'true')!.dataset.entryKey).toBe(chosen);
    await quiet(200);
    expect(relay.published).toEqual([]);
    expect(event).not.toHaveBeenCalled();
  });
});

describe('using an item in the room', () => {
  it('Give hands a starter to the Blobbi at once: one 31124 and its 1124, however often it is pressed, then the home\'s feedback on the Blobbi', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    fireEvent.click(tile('Apple', 'starter'));
    const give = screen.getByTestId('room-item-use');
    expect(give).toHaveAccessibleName('Give Apple');
    fireEvent.click(give);
    fireEvent.click(give);
    fireEvent.click(give);
    expect(screen.getByTestId('room-handed-item')).toBeInTheDocument();
    expect(give).toBeDisabled();
    expect(screen.getByRole('button', { name: /decorate this room/i })).toBeDisabled();
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/), { timeout: 3000 });
    expect(within(screen.getByTestId('room-blobbi-overlay')).getByTestId('care-hearts')).toBeInTheDocument();
    expect(scene.state.hops).toBe(1);
    expect(screen.queryByTestId('room-handed-item')).toBeNull();
    await quiet();
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  });

  it('Use sets an owned toy down by the Blobbi; nothing is written while it walks; on arrival exactly one spend, the state and the receipt, and the count goes down', async () => {
    renderRoom();
    await ready();
    fireEvent.click(tile('Ball', 'owned'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'walking');
    expect(scene.state.walks).toHaveLength(1);
    await quiet();
    expect(relay.published).toEqual([]);
    settleWalk('arrived');
    await waitFor(() => expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'using'));
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(tile('Ball', 'owned')).toHaveTextContent('×1'), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull(), { timeout: 3000 });
  });

  it('a walk that is stopped, replaced or refused uses nothing: the item goes back (a refusal says so)', async () => {
    renderRoom();
    await ready();
    for (const outcome of ['stopped', 'replaced', 'refused'] as const) {
      fireEvent.click(tile('Ball', 'starter'));
      fireEvent.click(screen.getByTestId('room-item-use'));
      expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
      settleWalk(outcome);
      await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull());
    }
    expect(screen.getByTestId('room-care-notice')).toHaveTextContent(/can't get to/);
    await quiet();
    expect(relay.published).toEqual([]);
  });

  it('a room switch on the way stops the walk: nothing is used', async () => {
    renderRoom();
    await ready();
    fireEvent.click(tile('Ball', 'starter'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
    // The scene ends any walk when the next room folds in
    fireEvent.click(screen.getByTestId('room-nav-left'));
    act(() => scene.fake.stopWalk());
    await goTo('home');
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull());
    expect(screen.getByTestId('room-item-use')).toBeEnabled();
    await quiet();
    expect(relay.published).toEqual([]);
  });
});

describe('dragging an item into the room', () => {
  it('food let go on the Blobbi is handed over and used at once; the ring lights while it is over the Blobbi', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    dragTile(tile('Apple', 'owned'), 200, 280, 'none');
    expect(shell()).toHaveAttribute('data-drop', 'blobbi');
    act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 200, clientY: 280 })); });
    expect(shell()).not.toHaveAttribute('data-drop');
    expect(screen.getByTestId('room-handed-item')).toBeInTheDocument();
    expect(scene.state.walks).toHaveLength(0);
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
  });

  it('a toy let go on the floor lies where it fell for the Blobbi to walk to; on arrival it is used', async () => {
    renderRoom();
    await ready();
    dragTile(tile('Ball', 'starter'), 300, 360);
    expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
    expect(scene.state.walks[0]).toMatchObject({ x: 5, z: 6 });
    await quiet(200);
    expect(relay.published).toEqual([]);
    settleWalk('arrived');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
  });

  it('let go off the floor, cancelled, or carried while the room changes: nothing happens and nothing is written', async () => {
    renderRoom();
    await ready();
    dragTile(tile('Ball', 'starter'), 300, -50);
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    // (A drop swallows the click that follows it in the same task; a person's next click is a later one)
    await quiet(0);
    dragTile(tile('Ball', 'owned'), 300, 360, 'none');
    act(() => { window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7 })); });
    act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 300, clientY: 360 })); });
    dragTile(tile('Ball', 'owned'), 300, 360, 'none');
    expect(screen.getByTestId('room-drag-ghost').style.display).toBe('');
    fireEvent.click(screen.getByTestId('room-nav-left'));
    expect(shell()).toHaveAttribute('data-room', 'kitchen');
    expect(screen.getByTestId('room-drag-ghost').style.display).toBe('none');
    act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 300, clientY: 360 })); });
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    expect(screen.queryByTestId('room-handed-item')).toBeNull();
    expect(scene.state.walks).toHaveLength(0);
    await quiet();
    expect(relay.published).toEqual([]);
    expect(event).not.toHaveBeenCalled();
  });
});

describe('when a use fails', () => {
  it('a refused write leaves the item with why, is never retried by itself, and Try again (a tap) uses it', async () => {
    relay.refuse = 1;
    renderRoom();
    await ready();
    await goTo('kitchen');
    fireEvent.click(tile('Apple', 'starter'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    await screen.findByTestId('room-offer-failure', {}, { timeout: 3000 });
    const tries = attempts.length;
    await quiet(1200);
    expect(attempts.length).toBe(tries);
    expect(relay.published).toEqual([]);
    fireEvent.click(screen.getByTestId('room-offer-retry'));
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByTestId('room-offer-failure')).toBeNull());
  });

  it('an owned spend whose publish is ambiguous stops; Try again sends the SAME signed spend, never a second one', async () => {
    relay.silent = 1;
    renderRoom();
    await ready();
    await goTo('kitchen');
    fireEvent.click(tile('Apple', 'owned'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    await screen.findByTestId('room-offer-failure', {}, { timeout: 4000 });
    const first = attempts.filter((e) => e.kind === KIND_GAME_INVENTORY_SPEND);
    expect(first).toHaveLength(1);
    await quiet(1200);
    expect(attempts.filter((e) => e.kind === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
    fireEvent.click(screen.getByTestId('room-offer-retry'));
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    const spends = attempts.filter((e) => e.kind === KIND_GAME_INVENTORY_SPEND);
    expect(new Set(spends.map((e) => e.id)).size).toBe(1);
  });

  it('Put away takes a failed item back with nothing used', async () => {
    relay.refuse = 1;
    renderRoom();
    await ready();
    await goTo('kitchen');
    fireEvent.click(tile('Apple', 'starter'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    fireEvent.click(await screen.findByTestId('room-offer-put-away', {}, { timeout: 3000 }));
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
    expect(screen.getByTestId('room-item-use')).toBeEnabled();
    await quiet();
    expect(relay.published).toEqual([]);
  });
});

describe('furniture', () => {
  const tapItemAt = (index: number) => {
    scene.state.itemAt = index;
    const layer = screen.getByTestId('room-tap-layer');
    fireEvent.pointerDown(layer, { pointerId: 3, isPrimary: true, clientX: 300, clientY: 40 });
    fireEvent.pointerUp(layer, { pointerId: 3, isPrimary: true, clientX: 300, clientY: 40 });
  };

  it('the bed: Brook walks to it and sleeps only on arrival; the dock then offers Wake up', async () => {
    renderRoom();
    await ready();
    await goTo('rest');
    tapItemAt(roomFurnitureFor('rest').findIndex((p) => p.id === 'official:bed-single'));
    expect(scene.state.walks).toHaveLength(1);
    await quiet(200);
    expect(relay.published).toEqual([]);
    settleWalk('arrived');
    // Rest is the state write alone (the home's contract: `planRestToggle` emits no interaction)
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE]), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('room-rest')).toHaveTextContent('Wake up'), { timeout: 3000 });
    fireEvent.click(screen.getByTestId('room-rest'));
    await waitFor(() => expect(kinds().filter((k) => k === KIND_BLOBBI_STATE)).toHaveLength(2), { timeout: 3000 });
  });

  it('the fridge points at the kitchen\'s own items; a toy box set in the kitchen opens its toys, and closes back to the kitchen\'s', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    tapItemAt(roomFurnitureFor('kitchen').findIndex((p) => p.id === 'official:fridge'));
    expect(screen.getByTestId('room-item-strip-glow')).toBeInTheDocument();
    expect(screen.queryByTestId('room-item-strip-close')).toBeNull();
    // Decorate: a toy box in the kitchen, saved for the session
    fireEvent.click(screen.getByRole('button', { name: /decorate this room/i }));
    fireEvent.click(screen.getByTestId('catalog-official:toybox'));
    fireEvent.click(screen.getByTestId('decorator-save'));
    await waitFor(() => expect(screen.getByTestId('room-care-panel')).toBeInTheDocument());
    tapItemAt(roomFurnitureFor('kitchen').length);
    expect(screen.getByTestId('room-item-strip-title')).toHaveTextContent('From the toy box');
    expect(tiles().some((t) => /Ball/.test(t.getAttribute('aria-label')!))).toBe(true);
    expect(tiles().some((t) => /Apple|Soap/.test(t.getAttribute('aria-label')!))).toBe(false);
    fireEvent.click(screen.getByTestId('room-item-strip-close'));
    expect(tiles().some((t) => /Apple/.test(t.getAttribute('aria-label')!))).toBe(true);
    await quiet(200);
    expect(relay.published).toEqual([]);
  });
});

describe('2D and 3D, one Blobbi, one care', () => {
  it('drawn in 3D, the same use writes the same events and the feedback still follows the Blobbi; switching mid-use interrupts nothing', async () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, '3d');
    renderRoom();
    await ready();
    expect(shell()).toHaveAttribute('data-blobbi-render', '3d');
    await goTo('kitchen');
    fireEvent.click(tile('Apple', 'starter'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    // Back to 2D while the write is out
    fireEvent.click(screen.getByTestId('room-appearance-toggle'));
    fireEvent.click(screen.getByTestId('room-appearance-2d'));
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook/), { timeout: 3000 });
    expect(within(screen.getByTestId('room-blobbi-overlay')).getByTestId('care-hearts')).toBeInTheDocument();
  });
});
