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
import { carouselItems, focusOn, middle, middleItem, offers } from './test/carousel';
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
    gestures: [] as string[],
    wanders: [] as boolean[],
    faces: [] as unknown[],
    hovers: [] as string[],
    presses: [] as (number | null)[],
    props: [] as { id: string; kind: string; x: number; z: number; bites?: { taken: number; of: number }; leaving?: boolean }[],
    kicks: [] as { id: string; power: number }[],
  };
  const fake = {
    setProps(props: typeof state.props) { state.props = props; },
    kickProp(id: string, _dir: unknown, power: number) { state.kicks.push({ id, power }); return true; },
    propPosition: (id: string) => (state.props.some((p) => p.id === id) ? { x: 5.5, z: 5.5 } : null),
    propResting: () => true,
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
    playGesture: (_id: string, kind: string) => { state.gestures.push(kind); },
    setActorGaze: () => {},
    setActorFace: (_id: string, face: unknown) => { state.faces.push(face); },
    overActor: (x: number, y: number) => x > 150 && x < 250 && y > 220 && y < 320,
    hoverAt: (x: number, y: number) => {
      const kind = x < 0 ? null : x > 150 && x < 250 && y > 220 && y < 320 ? 'actor' : state.itemAt !== null && y < 80 ? 'item' : 'floor';
      state.hovers.push(String(kind));
      return kind;
    },
    pressItem: (index: number | null) => { state.presses.push(index); },
    setMainWanders: (on: boolean) => { state.wanders.push(on); },
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
const goTo = async (room: string) => {
  for (let i = 0; i < 5 && shell().dataset.room !== room; i++) fireEvent.click(screen.getByTestId('room-nav-right'));
  expect(shell()).toHaveAttribute('data-room', room);
};
async function ready() {
  await screen.findByTestId('room-bar', {}, { timeout: 5000 });
  // The owned items are in once the inventory has been read
  await waitFor(() => expect(carouselItems().some((i) => i.source === 'owned')).toBe(true));
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
  scene.state.gestures = [];
  scene.state.faces = [];
  scene.state.hovers = [];
  scene.state.presses = [];
  scene.state.wanders = [];
  scene.state.props = [];
  scene.state.kicks = [];
  localStorage.clear();
  event.mockClear();
});
afterEach(() => localStorage.clear());
/** The Blobbi notices what was set down (a beat), then sets off: the walk the test settles. */
const awaitWalk = () => waitFor(() => expect(scene.state.walks).toHaveLength(1), { timeout: 2000 });
const dish = () => scene.state.props.find((p) => p.kind === 'dish');
const ball = () => scene.state.props.find((p) => p.kind === 'ball');

describe('the room\'s items', () => {
  it('each room offers its own in Ditto\'s carousel: toys here, food and drink in the kitchen, soap and medicine in the care room; Sleep in the bedroom; owned items counted, starters free', async () => {
    renderRoom();
    await ready();
    expect(shell()).toHaveAttribute('data-room', 'home');
    const home = carouselItems();
    expect(home.find((i) => i.name === 'Ball' && i.source === 'owned')?.quantity).toBe(2);
    expect(home.find((i) => i.name === 'Ball' && i.source === 'starter')?.quantity).toBeNull();
    expect(home.some((i) => /Apple|Soap/.test(i.name))).toBe(false);
    // The badge is on owned items only
    expect(focusOn('Ball', 'owned')).toHaveTextContent('×2');
    expect(within(focusOn('Ball', 'starter')).queryByTestId('room-item-badge')).toBeNull();
    await goTo('rest');
    expect(screen.queryByTestId('room-item-carousel')).toBeNull();
    expect(screen.getByTestId('room-rest')).toHaveTextContent('Sleep');
    await goTo('closet');
    expect(screen.getByTestId('room-closet-hint')).toHaveTextContent(/Island/);
    await goTo('care');
    expect(focusOn('Soap', 'owned')).toHaveTextContent('×1');
    expect(carouselItems().some((i) => /Ball|Apple/.test(i.name))).toBe(false);
    await goTo('kitchen');
    expect(focusOn('Apple', 'owned')).toHaveTextContent('×2');
    expect(offers('Apple', 'starter')).toBe(true);
    expect(relay.published).toEqual([]);
  });

  it('the arrows, the previews and the arrow keys only move the focus, which each room keeps for the visit; nothing is used', async () => {
    renderRoom();
    await ready();
    const first = middleItem().key;
    fireEvent.click(screen.getByTestId('room-item-next'));
    const second = middleItem().key;
    expect(second).not.toBe(first);
    fireEvent.click(screen.getByTestId('room-item-prev'));
    expect(middleItem().key).toBe(first);
    fireEvent.click(screen.getByTestId('room-item-preview-next'));
    expect(middleItem().key).toBe(second);
    fireEvent.keyDown(screen.getByTestId('room-item-carousel'), { key: 'ArrowLeft' });
    expect(middleItem().key).toBe(first);
    fireEvent.keyDown(screen.getByTestId('room-item-carousel'), { key: 'ArrowRight' });
    expect(screen.getByTestId('room-item-status')).toHaveTextContent(/2 of \d+/);
    await goTo('kitchen');
    expect(middleItem().name).not.toBe('Ball');
    await goTo('home');
    expect(middleItem().key).toBe(second);
    await quiet(200);
    expect(relay.published).toEqual([]);
    expect(event).not.toHaveBeenCalled();
  });

  it('an item that cannot be used now stays in the carousel, dimmed; tapping it says why and uses nothing', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'egg', state: 'active', visualGeneration: 'v3', createdAt: NOW - 120 }), ...definitions(), ...stock()];
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    await goTo('kitchen');
    const apple = focusOn('Apple', 'starter');
    expect(apple).toHaveAttribute('data-usable', 'false');
    fireEvent.click(apple);
    expect(screen.getByTestId('room-care-notice')).not.toBeEmptyDOMElement();
    await quiet();
    expect(relay.published).toEqual([]);
  });
});

describe('using an item in the room', () => {
  it('Give sets a starter down on a dish in front of the Blobbi; it notices and comes; on arrival one 31124 and its 1124, however often it was pressed; then it eats bite by bite, and the home\'s feedback follows', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    const give = focusOn('Apple', 'starter');
    expect(give).toHaveAccessibleName('Give Apple');
    fireEvent.click(give);
    fireEvent.click(give);
    fireEvent.click(give);
    // The apple is a thing in the room: on a dish, whole, where the Blobbi will come to it
    expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'walking');
    expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-physical', 'true');
    expect(screen.queryByTestId('room-handed-item')).toBeNull();
    expect(dish()).toMatchObject({ kind: 'dish', bites: { taken: 0, of: 4 } });
    expect(scene.state.props.filter((p) => p.kind === 'dish')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /decorate this room/i })).toBeDisabled();
    // Nothing is written while it notices and walks
    await awaitWalk();
    expect(relay.published).toEqual([]);
    settleWalk('arrived');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    // Eaten only now: the dish empties bite by bite
    await waitFor(() => expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'eating'), { timeout: 3000 });
    await waitFor(() => expect(dish()?.bites?.taken).toBe(4), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/), { timeout: 3000 });
    expect(within(screen.getByTestId('room-blobbi-overlay')).getByTestId('care-hearts')).toBeInTheDocument();
    // The celebration's glad bounce, played by whichever drawing stands in the room; the dish goes
    expect(scene.state.gestures).toEqual(['bounce']);
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    await waitFor(() => expect(dish()).toBeUndefined(), { timeout: 2000 });
    await quiet();
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  });

  it('food is eaten only once its use has landed: waited for, then held while the write is out, then bite by bite, then the celebration', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    const phases: string[] = [];
    const observer = new MutationObserver(() => {
      const phase = document.querySelector('[data-testid="room-floor-item"]')?.getAttribute('data-phase');
      if (phase && phases[phases.length - 1] !== phase) phases.push(phase);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    await waitFor(() => expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'eating'), { timeout: 3000 });
    // By the first bite the state and its receipt are written: nothing was eaten before the pipeline said so
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
    expect(dish()?.bites?.taken).toBeLessThan(4);
    // Still eating: no celebration yet
    expect(screen.queryByTestId('care-status')?.textContent ?? '').not.toMatch(/Fed Brook/);
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook with Apple/), { timeout: 3000 });
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    observer.disconnect();
    expect(phases).toEqual(['walking', 'using', 'eating']);
  });

  it('food whose use is refused is never eaten: the dish stays, whole, with Try again, and nothing is celebrated', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    relay.refuse = 5;
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    await waitFor(() => expect(screen.getByTestId('room-offer-failure')).toBeInTheDocument(), { timeout: 3000 });
    await quiet();
    expect(document.querySelector('[data-phase="eating"]')).toBeNull();
    expect(screen.queryByTestId('care-hearts')).toBeNull();
    expect(dish()).toMatchObject({ bites: { taken: 0, of: 4 } });
    expect(dish()?.leaving).toBeFalsy();
    relay.refuse = 0;
  });

  it('Use sets an owned ball down by the Blobbi; nothing is written while it notices and walks; on arrival exactly one spend, the state and the receipt, and the count goes down; then it plays: three nudges, the ball stays', async () => {
    renderRoom();
    await ready();
    fireEvent.click(focusOn('Ball', 'owned'));
    expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'walking');
    expect(ball()).toBeDefined();
    await awaitWalk();
    await quiet();
    expect(relay.published).toEqual([]);
    // From here every chase after the ball arrives by itself
    scene.state.autoArrive = true;
    settleWalk('arrived');
    await waitFor(() => expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'using'));
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(scene.state.kicks).toHaveLength(3), { timeout: 6000 });
    await waitFor(() => expect(focusOn('Ball', 'owned')).toHaveTextContent('×1'), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull(), { timeout: 3000 });
    expect(ball()).toBeDefined();
    expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  });

  it('a walk that is stopped, replaced or refused uses nothing: the item goes back (a refusal says so)', async () => {
    renderRoom();
    await ready();
    for (const outcome of ['stopped', 'replaced', 'refused'] as const) {
      fireEvent.click(focusOn('Ball', 'starter'));
      expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
      await awaitWalk();
      settleWalk(outcome);
      await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull());
      await waitFor(() => expect(ball()).toBeUndefined());
    }
    expect(screen.getByTestId('room-care-notice')).toHaveTextContent(/can't get to/);
    await quiet();
    expect(relay.published).toEqual([]);
  });

  it('choosing another item while one is waited for replaces it: the first goes back, the second is the one used', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    fireEvent.click(focusOn('Apple', 'starter'));
    expect(dish()).toBeDefined();
    const firstKey = dish()!.id;
    fireEvent.click(focusOn('Apple', 'owned'));
    await waitFor(() => expect(scene.state.props.filter((p) => p.kind === 'dish')).toHaveLength(1));
    expect(dish()!.id).not.toBe(firstKey);
    await awaitWalk();
    settleWalk('arrived');
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
  });

  it('a room switch on the way stops the walk: nothing is used', async () => {
    renderRoom();
    await ready();
    fireEvent.click(focusOn('Ball', 'starter'));
    expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
    // The scene ends any walk when the next room folds in
    fireEvent.click(screen.getByTestId('room-nav-left'));
    act(() => scene.fake.stopWalk());
    await goTo('home');
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull());
    expect(middle()).toBeEnabled();
    await quiet();
    expect(relay.published).toEqual([]);
  });
});

describe('dragging an item into the room', () => {
  it('food let go on the Blobbi is set down on a dish at its feet, and used once it has stepped to it; the ring lights while it is over the Blobbi', async () => {
    renderRoom();
    await ready();
    await goTo('kitchen');
    dragTile(focusOn('Apple', 'owned'), 200, 280, 'none');
    expect(shell()).toHaveAttribute('data-drop', 'blobbi');
    act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 200, clientY: 280 })); });
    expect(shell()).not.toHaveAttribute('data-drop');
    expect(screen.queryByTestId('room-handed-item')).toBeNull();
    expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
    // In front of it, toward the viewer, clear of its body (an adult reaches 1.27 tiles; the dish 0.62)
    expect(dish()).toMatchObject({ x: expect.closeTo(5.45, 1), z: expect.closeTo(5.45, 1) });
    await awaitWalk();
    settleWalk('arrived');
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
  });

  it('a toy let go on the floor lies where it fell for the Blobbi to walk to; on arrival it is used', async () => {
    renderRoom();
    await ready();
    dragTile(focusOn('Ball', 'starter'), 300, 360);
    expect(screen.getByTestId('room-floor-item')).toBeInTheDocument();
    expect(ball()).toMatchObject({ x: 5, z: 6 });
    await awaitWalk();
    expect(scene.state.walks[0]).toMatchObject({ x: 5, z: 6 });
    await quiet(200);
    expect(relay.published).toEqual([]);
    scene.state.autoArrive = true;
    settleWalk('arrived');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
  });

  it('let go off the floor, cancelled, or carried while the room changes: nothing happens and nothing is written', async () => {
    renderRoom();
    await ready();
    dragTile(focusOn('Ball', 'starter'), 300, -50);
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    // (A drop swallows the click that follows it in the same task; a person's next click is a later one)
    await quiet(0);
    dragTile(focusOn('Ball', 'owned'), 300, 360, 'none');
    act(() => { window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7 })); });
    act(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 300, clientY: 360 })); });
    dragTile(focusOn('Ball', 'owned'), 300, 360, 'none');
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
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    await screen.findByTestId('room-offer-failure', {}, { timeout: 3000 });
    const tries = attempts.length;
    await quiet(1200);
    expect(attempts.length).toBe(tries);
    expect(relay.published).toEqual([]);
    fireEvent.click(screen.getByTestId('room-offer-retry'));
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByTestId('room-offer-failure')).toBeNull());
    // And then it is eaten, as it would have been the first time
    await waitFor(() => expect(dish()?.bites?.taken).toBe(4), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook/), { timeout: 3000 });
  });

  it('an owned spend whose publish is ambiguous stops; Try again sends the SAME signed spend, never a second one', async () => {
    relay.silent = 1;
    renderRoom();
    await ready();
    await goTo('kitchen');
    fireEvent.click(focusOn('Apple', 'owned'));
    await awaitWalk();
    settleWalk('arrived');
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
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    fireEvent.click(await screen.findByTestId('room-offer-put-away', {}, { timeout: 3000 }));
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
    expect(middle()).toBeEnabled();
    await waitFor(() => expect(dish()).toBeUndefined());
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

  it('pieces answer before they are touched: a hovering mouse marks what can be tapped, a press gives the piece a little until it lifts; a finger never hovers', async () => {
    renderRoom();
    await ready();
    scene.state.itemAt = 2;
    const layer = screen.getByTestId('room-tap-layer');
    fireEvent.pointerMove(layer, { pointerId: 9, pointerType: 'mouse', buttons: 0, clientX: 300, clientY: 40 });
    expect(layer).toHaveAttribute('data-hover', 'item');
    fireEvent.pointerMove(layer, { pointerId: 9, pointerType: 'mouse', buttons: 0, clientX: 200, clientY: 280 });
    expect(layer).toHaveAttribute('data-hover', 'actor');
    fireEvent.pointerMove(layer, { pointerId: 9, pointerType: 'mouse', buttons: 0, clientX: 420, clientY: 420 });
    expect(layer).toHaveAttribute('data-hover', 'floor');
    fireEvent.pointerLeave(layer, { pointerId: 9, pointerType: 'mouse' });
    expect(layer).toHaveAttribute('data-hover', '');
    const hovered = scene.state.hovers.length;
    fireEvent.pointerMove(layer, { pointerId: 10, pointerType: 'touch', buttons: 0, clientX: 300, clientY: 40 });
    expect(scene.state.hovers).toHaveLength(hovered);
    tapItemAt(2);
    expect(scene.state.presses).toEqual([2, null]);
    expect(relay.published).toEqual([]);
  });

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
    // Ditto's guide ring on the middle card, for a moment
    expect(middle().className).toContain('ring-primary');
    expect(screen.queryByTestId('room-shelf-back')).toBeNull();
    // Decorate: a toy box in the kitchen, saved for the session
    fireEvent.click(screen.getByRole('button', { name: /decorate this room/i }));
    fireEvent.click(screen.getByTestId('catalog-official:toybox'));
    fireEvent.click(screen.getByTestId('decorator-save'));
    await waitFor(() => expect(screen.getByTestId('room-bar')).toBeInTheDocument());
    tapItemAt(roomFurnitureFor('kitchen').length);
    expect(screen.getByTestId('room-shelf-back')).toHaveTextContent('Back');
    expect(carouselItems().some((i) => i.name === 'Ball')).toBe(true);
    expect(carouselItems().some((i) => /Apple|Soap/.test(i.name))).toBe(false);
    fireEvent.click(screen.getByTestId('room-shelf-back'));
    expect(carouselItems().some((i) => i.name === 'Apple')).toBe(true);
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
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    // Back to 2D while the write is out
    fireEvent.click(screen.getByTestId('room-settings-toggle'));
    fireEvent.click(screen.getByTestId('room-appearance-2d'));
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook/), { timeout: 3000 });
    expect(within(screen.getByTestId('room-blobbi-overlay')).getByTestId('care-hearts')).toBeInTheDocument();
  });
});

describe('its life and its reactions', () => {
  const tapBlobbi = () => {
    const layer = screen.getByTestId('room-tap-layer');
    fireEvent.pointerDown(layer, { pointerId: 4, isPrimary: true, clientX: 200, clientY: 280 });
    fireEvent.pointerUp(layer, { pointerId: 4, isPrimary: true, clientX: 200, clientY: 280 });
  };

  /** A finger rubbing back and forth across the Blobbi. */
  const stroke = (passes = 6) => {
    const layer = screen.getByTestId('room-tap-layer');
    fireEvent.pointerDown(layer, { pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: 200, clientY: 280 });
    for (let i = 0; i < passes; i++) fireEvent.pointerMove(layer, { pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: i % 2 ? 160 : 240, clientY: 280 + (i % 3) });
    fireEvent.pointerUp(layer, { pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: 200, clientY: 282 });
  };

  it('a stroke across the Blobbi is petting: contentment (eyes closed, a smile), hearts, a wiggle; never a poke, a walk, a care or a write', async () => {
    renderRoom();
    await ready();
    stroke(8);
    expect(screen.getByTestId('room-pet-heart')).toBeInTheDocument();
    // Contentment on the 3D model's face too: the kit's face with its eyes closed and a smile
    expect(scene.state.faces).toContainEqual({ expression: {}, face: expect.objectContaining({ eyes: 'closed', mouth: 'smile' }) });
    // Never a poke (no bounce or recoil), never a walk
    expect(scene.state.gestures.every((g) => g === 'wiggle')).toBe(true);
    expect(scene.state.walks).toHaveLength(0);
    await quiet(300);
    expect(relay.published).toEqual([]);
    expect(attempts).toEqual([]);
  });

  it('a press that does not rub (a tap) is still the poke, and a stroke over nothing but the floor is not petting', async () => {
    renderRoom();
    await ready();
    const layer = screen.getByTestId('room-tap-layer');
    fireEvent.pointerDown(layer, { pointerId: 6, isPrimary: true, clientX: 420, clientY: 420 });
    fireEvent.pointerMove(layer, { pointerId: 6, isPrimary: true, clientX: 300, clientY: 420 });
    fireEvent.pointerUp(layer, { pointerId: 6, isPrimary: true, clientX: 300, clientY: 420 });
    expect(screen.queryByTestId('room-pet-heart')).toBeNull();
    tapBlobbi();
    expect(scene.state.gestures).toEqual(['bounce']);
    expect(screen.queryByTestId('room-pet-heart')).toBeNull();
  });

  it('the room drives its life itself: the scene does not amble it about on its own', async () => {
    renderRoom();
    await ready();
    expect(scene.state.wanders).toContain(false);
    expect(scene.state.wanders).not.toContain(true);
  });

  it('a tap is the home\'s poke: a glad bounce, then, overdone, a recoil; a face, never a write', async () => {
    renderRoom();
    await ready();
    tapBlobbi();
    expect(scene.state.gestures).toEqual(['bounce']);
    for (let i = 0; i < 3; i++) tapBlobbi();
    expect(scene.state.gestures[scene.state.gestures.length - 1]).toBe('recoil');
    expect(scene.state.hops).toBe(0);
    await quiet(200);
    expect(relay.published).toEqual([]);
  });
});
