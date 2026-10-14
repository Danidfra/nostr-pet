/**
 * The bath in the 3D room (M15), end to end: the real `/room` page over the
 * real inventory, spend and care hooks, a relay that records what is
 * published, and the WebGL scene replaced by a fake whose walks the test
 * settles and which records what the page asks it to draw. The contract:
 *
 *  - a cleaning item is the bath: the Blobbi walks to the tub and hops in
 *    (the scene is scripted), the bar shows one tool at a time, the scene is
 *    handed the bath to draw, and nothing is written before the last stage;
 *  - the three stages are played by rubbing, holding and rubbing on the
 *    layer over the Blobbi; a tap does nothing;
 *  - one write at the end (a starter: 31124 + 1124; an owned item: 1416 +
 *    31124 + 1124, exactly once), then the celebration, then the Blobbi is
 *    back on the floor and the tub is itself again;
 *  - Stop, a change of room and a failed write: nothing is written, nothing
 *    is consumed, the Blobbi is never left in the tub; Try again is a tap.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY_SPEND } from '@nostr-games/inventory';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { OFFICIAL_SOAP, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';
import { playBath, rubBath } from '@/test/care-ui';
import { carouselItems, focusOn } from './test/carousel';
import { BATH_ELEV } from './lib/scene/bath-scene';

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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: 0 };
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
  if (relay.refuse > 0) {
    relay.refuse -= 1;
    throw new AggregateError([new Error('blocked: no')], 'refused');
  }
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

// ─── A 3D room whose walks the test settles, and which records the bath it is asked to draw ───
const scene = vi.hoisted(() => {
  type Outcome = 'arrived' | 'replaced' | 'stopped' | 'refused';
  const state = {
    walks: [] as { x: number; z: number; how: string; resolve: (o: Outcome) => void }[],
    scripts: [] as ({ x: number; z: number; elev: number } | null)[],
    baths: [] as (Record<string, unknown> | null)[],
    gestures: [] as string[],
    faces: [] as unknown[],
    props: [] as { id: string; kind: string }[],
    at: { x: 4, z: 4 },
    /** Whether the scene can be choreographed: off while rooms are changed (a room change would play a scene), on for the bath. */
    scriptable: false,
  };
  const setActorScript = (_id: string, script: { x: number; z: number; elev: number } | null) => {
    state.scripts.push(script);
    if (script) state.at = { x: script.x, z: script.z };
  };
  const fake = {
    setProps(props: typeof state.props) { state.props = props; },
    kickProp: () => true,
    propPosition: () => null,
    propResting: () => true,
    pick: (x: number, y: number) => (y < 0 ? null : { kind: 'floor' as const, x: Math.min(7.5, x / 60), z: Math.min(7.5, y / 60) }),
    floorAt: (x: number, y: number) => (y < 0 ? null : { x: Math.min(7.5, x / 60), z: Math.min(7.5, y / 60) }),
    requestWalk: (_id: string, x: number, z: number, how: string) => new Promise<Outcome>((resolve) => { state.walks.push({ x, z, how, resolve }); }),
    stopWalk: () => state.walks.splice(0).forEach((w) => w.resolve('stopped')),
    positionOf: () => state.at,
    hop: () => {},
    playGesture: (_id: string, kind: string) => { state.gestures.push(kind); },
    setActorGaze: () => {},
    setActorFace: (_id: string, face: unknown) => { state.faces.push(face); },
    get setActorScript() {
      return state.scriptable ? setActorScript : undefined;
    },
    setBath: (bath: Record<string, unknown> | null) => { state.baths.push(bath); },
    // The care room's tub (its first placement): four tiles by two against the right wall
    itemFootprint: (index: number) => (index === 0 ? { x0: 3, x1: 7, z0: 0, z1: 2 } : null),
    overActor: () => false,
    hoverAt: () => null,
    pressItem: () => {},
    setMainWanders: () => {},
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
const brook = (set: Record<string, string> = {}) => blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70', ...set } });
const definitions = () => [officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'] })];
const stock = () => [inventoryEvent('blobbi:island', { [OFFICIAL_SOAP]: 1 })];
const kinds = () => relay.published.map((e) => e.kind);
const shell = () => screen.getByTestId('room-shell');
const goTo = async (room: string) => {
  for (let i = 0; i < 5 && shell().dataset.room !== room; i++) fireEvent.click(screen.getByTestId('room-nav-right'));
  expect(shell()).toHaveAttribute('data-room', room);
  // From here the room can stage the bath's scene (a room change found no scene to play, as in RoomCare.test)
  scene.state.scriptable = true;
  await waitFor(() => expect(screen.getByTestId('room-item-next')).toBeEnabled());
};
async function ready() {
  await screen.findByTestId('room-bar', {}, { timeout: 5000 });
  await waitFor(() => expect(carouselItems().length).toBeGreaterThan(0));
}
const settleWalk = (outcome: 'arrived' | 'replaced' | 'stopped' | 'refused') => act(() => { scene.state.walks.shift()?.resolve(outcome); });
const quiet = (ms = 400) => act(() => new Promise((r) => setTimeout(r, ms)));
const awaitWalk = () => waitFor(() => expect(scene.state.walks).toHaveLength(1), { timeout: 2000 });
const lastBath = () => scene.state.baths[scene.state.baths.length - 1];
const bar = () => screen.getByTestId('bath-bar');

/** Soap chosen in the care room: the walk to the tub, settled; the hop in; the soap in hand. */
async function intoTheTub(source: 'starter' | 'owned' = 'starter') {
  await goTo('care');
  fireEvent.click(focusOn('Soap', source));
  expect(await screen.findByTestId('bath-bar')).toHaveAttribute('data-status', 'entering');
  await awaitWalk();
  expect(scene.state.walks[0]).toMatchObject({ how: 'approach', x: 5, z: 1 });
  settleWalk('arrived');
  await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'soap'), { timeout: 3000 });
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook(), ...definitions(), ...stock()];
  relay.published = [];
  relay.refuse = 0;
  signCount = 0;
  resetInventoryFixtureIds();
  scene.state.walks = [];
  scene.state.scripts = [];
  scene.state.baths = [];
  scene.state.gestures = [];
  scene.state.faces = [];
  scene.state.props = [];
  scene.state.at = { x: 4, z: 4 };
  scene.state.scriptable = false;
  localStorage.clear();
  event.mockClear();
});
afterEach(() => localStorage.clear());

describe('the bath in the room', () => {
  it('a starter soap is a bath: the walk to the tub, the hop in (scripted onto its floor, facing the room), the scene handed the bath to draw, one tool at a time, nothing written before the last stage, then one 31124 and its 1124, the celebration, and the Blobbi back on the floor', async () => {
    renderRoom();
    await ready();
    await intoTheTub();
    // In the tub: the last script puts it on the tub's floor at its middle; the carousel gave way to the bar
    const inTub = scene.state.scripts[scene.state.scripts.length - 1];
    expect(inTub).toMatchObject({ x: 5, z: 1 });
    expect(inTub?.elev).toBeCloseTo(BATH_ELEV, 6);
    expect(scene.state.scripts.filter(Boolean).length).toBeGreaterThan(3);
    expect(screen.queryByTestId('room-item-carousel')).toBeNull();
    expect(bar()).toHaveAttribute('data-tool', 'soap');
    expect(screen.getByTestId('bath-guidance')).toHaveTextContent(/Rub the soap all over Brook/);
    expect(shell()).toHaveAttribute('data-input-locked', 'true');
    expect(screen.getByRole('button', { name: /decorate this room/i })).toBeDisabled();
    // The scene draws the bath from the same state: the tub's index, the soap, no foam yet
    await waitFor(() => expect(lastBath()).toMatchObject({ itemIndex: 0, status: 'soap', tool: 'soap' }));
    expect(relay.published).toEqual([]);
    // A tap lays nothing; a stroke lays foam, which the scene is told of
    fireEvent.pointerDown(screen.getByTestId('bath-layer'), { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(screen.getByTestId('bath-layer'), { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    await quiet(80);
    expect(screen.getByTestId('bath-foam')).toHaveAttribute('data-count', '0');
    rubBath({ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
    await waitFor(() => expect(Number(screen.getByTestId('bath-foam').dataset.count)).toBeGreaterThan(0));
    await waitFor(() => expect((lastBath()?.foam as number[]).some((f) => f > 0)).toBe(true));
    await playBath({ through: 'soap' });
    expect(bar()).toHaveAttribute('data-tool', 'shower');
    expect(scene.state.gestures).toContain('bounce');
    await playBath({ through: 'rinse' });
    expect(bar()).toHaveAttribute('data-tool', 'towel');
    expect(relay.published).toEqual([]);
    await playBath();
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(Number(getTagValue(relay.published[0].tags, 'hygiene'))).toBeGreaterThan(45);
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Brook/), { timeout: 3000 });
    await waitFor(() => expect(bar()).toHaveAttribute('data-status', 'done'), { timeout: 3000 });
    // Out of the tub: the script is let go, the tub is itself again, the carousel is back, the lock is off
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull();
    expect(lastBath()).toBeNull();
    expect(screen.getByTestId('room-item-carousel')).toBeInTheDocument();
    expect(shell()).not.toHaveAttribute('data-input-locked');
    await quiet();
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  }, 25_000);

  it('an owned soap spends exactly once, after the bath: one 1416, the state with its marker, the receipt; the count goes down', async () => {
    renderRoom();
    await ready();
    await intoTheTub('owned');
    await playBath({ through: 'rinse' });
    expect(relay.published).toEqual([]);
    await playBath();
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    await waitFor(() => expect(carouselItems().some((i) => i.name === 'Soap' && i.source === 'owned')).toBe(false), { timeout: 3000 });
    await quiet();
    expect(kinds().filter((k) => k === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
  }, 25_000);

  it('Stop at the soap: nothing written, nothing spent, the Blobbi back on the floor, the tub itself again, the carousel back', async () => {
    renderRoom();
    await ready();
    await intoTheTub('owned');
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull();
    await waitFor(() => expect(lastBath()).toBeNull());
    expect(screen.getByTestId('room-item-carousel')).toBeInTheDocument();
    expect(focusOn('Soap', 'owned')).toHaveTextContent('×1');
    await quiet();
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('a walk to the tub that is stopped ends the bath with nothing written; a change of room mid-bath puts the Blobbi back before the room goes', async () => {
    renderRoom();
    await ready();
    await goTo('care');
    fireEvent.click(focusOn('Soap', 'starter'));
    await awaitWalk();
    settleWalk('stopped');
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    // Never in the tub: nothing scripted (the way out is let go all the same)
    expect(scene.state.scripts.filter(Boolean)).toEqual([]);
    await intoTheTub();
    await playBath({ through: 'soap' });
    const before = scene.state.scripts.length;
    fireEvent.click(screen.getByTestId('room-nav-right'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    // The bath lets the Blobbi go (back on the floor) before the room's own scene takes it anywhere
    expect(scene.state.scripts[before]).toBeNull();
    await waitFor(() => expect(lastBath()).toBeNull());
    await quiet();
    expect(relay.published).toEqual([]);
  }, 20_000);

  it('a refused write leaves the bath waiting with why, never retried by itself; Try again (a tap) writes once; Stop on a failed bath takes it back with nothing used', async () => {
    renderRoom();
    await ready();
    await intoTheTub();
    relay.refuse = 1;
    await playBath();
    expect(await screen.findByTestId('bath-error', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(bar()).toHaveAttribute('data-status', 'failed');
    // The room's own failure card does not double it; the Blobbi stays in the tub
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
    expect(scene.state.scripts[scene.state.scripts.length - 1]).not.toBeNull();
    const tries = event.mock.calls.length;
    await quiet(1000);
    expect(event.mock.calls.length).toBe(tries);
    expect(relay.published).toEqual([]);
    fireEvent.click(screen.getByTestId('bath-retry'));
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
  }, 25_000);

  it('Stop on a failed bath: nothing written, no failure card left behind, the Blobbi out of the tub', async () => {
    renderRoom();
    await ready();
    await intoTheTub();
    relay.refuse = 1;
    await playBath();
    await screen.findByTestId('bath-error', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
    expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull();
    await quiet();
    expect(relay.published).toEqual([]);
  }, 25_000);

  it('a Blobbi already squeaky clean is not bathed: a word in the room, nothing starts, nothing is written', async () => {
    relay.all = [brook({ hygiene: '100' }), ...definitions(), ...stock()];
    renderRoom();
    await ready();
    await goTo('care');
    fireEvent.click(focusOn('Soap', 'starter'));
    expect(await screen.findByTestId('room-care-notice')).toHaveTextContent(/squeaky clean/);
    expect(screen.queryByTestId('bath-bar')).toBeNull();
    expect(scene.state.walks).toEqual([]);
    await quiet();
    expect(relay.published).toEqual([]);
  });

  it('an egg is bathed where it lies: no walk, no tub, the same game, then the write', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Shell', stage: 'egg', state: 'active', visualGeneration: 'v3', createdAt: NOW - 120, set: { hygiene: '45' } }), ...definitions(), ...stock()];
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    await goTo('care');
    fireEvent.click(focusOn('Soap', 'starter'));
    await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'soap'), { timeout: 3000 });
    expect(scene.state.walks).toEqual([]);
    expect(scene.state.scripts).toEqual([]);
    expect(lastBath() ?? null).toBeNull();
    await playBath();
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(getTagValue(relay.published[0].tags, 'stage')).toBe('egg');
  }, 25_000);
});
