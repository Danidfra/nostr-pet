/**
 * The bath in the 3D room (M15), end to end: the real `/room` page over the
 * real inventory, spend and care hooks, a relay that records what is
 * published, and the WebGL scene replaced by a fake whose walks the test
 * settles and which records what the page asks it to draw. The contract:
 *
 *  - a cleaning item is its ritual (M15 care refinement): Soap a wash where
 *    the Blobbi stands (no walk, no tub), the bar one tool at a time, the
 *    scene handed the frame to draw on the actor, nothing written before the
 *    last stage; Bubble Bath the soak in the tub: the walk, the jump in (the
 *    scene is scripted), the play in the water, the jump out, THEN the write,
 *    then the shake;
 *  - the wash's stages are played by rubbing and holding on the layer over
 *    the Blobbi; a tap does nothing;
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
import { KIND_GAME_INVENTORY_SPEND, buildGameItemAddress } from '@nostr-games/inventory';
import { OFFICIAL_ITEM_ISSUER } from '@/features/inventory/issuers';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { OFFICIAL_BANDAGE, OFFICIAL_SOAP, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';
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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: 0, refuseKind: null as number | null };
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
  // One refusal of one kind only (the spend lands, the state does not: a use left open in the ledger)
  if (relay.refuseKind === ev.kind) {
    relay.refuseKind = null;
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
    setBath: (frame: Record<string, unknown> | null, anchor: unknown) => { state.baths.push(frame ? { ...frame, anchor } : null); },
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
/** Shampoo and Soft Towel (M15 cleanup: not offered as care actions), with the ritual each still plays and its first stage. */
const EXTRAS = [['blobbi:hygiene:shampoo', 'Shampoo', 'wash', 'lather'], ['blobbi:hygiene:soft-towel', 'Soft Towel', 'towel', 'dry']] as const;
const address = (d: string) => buildGameItemAddress(OFFICIAL_ITEM_ISSUER, d);
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

/** Soap chosen in the care room: the wash begins where the Blobbi stands, the soap in hand. */
async function startSoap(source: 'starter' | 'owned' = 'starter') {
  await goTo('care');
  fireEvent.click(focusOn('Soap', source));
  expect(await screen.findByTestId('bath-bar')).toHaveAttribute('data-ritual', 'wash');
  await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'lather'), { timeout: 3000 });
}

/** Bubble Bath chosen: the walk to the tub, settled; the jump in; the play in the water. */
async function intoTheTub() {
  await goTo('care');
  fireEvent.click(focusOn('Bubble Bath', 'starter'));
  expect(await screen.findByTestId('bath-bar')).toHaveAttribute('data-stage', 'jump-in');
  await awaitWalk();
  expect(scene.state.walks[0]).toMatchObject({ how: 'approach', x: 5, z: 1 });
  settleWalk('arrived');
  await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'play'), { timeout: 3000 });
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
  relay.refuseKind = null;
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
  it('a starter soap is a wash where the Blobbi stands: no walk, no tub, the scene handed the frame on the actor, one tool at a time, nothing written before the last stage, then one 31124 and its 1124, the shake and the celebration, and the room itself again', async () => {
    renderRoom();
    await ready();
    await startSoap();
    // No walk, no tub, no script: the wash is played where it stands
    expect(scene.state.walks).toEqual([]);
    expect(scene.state.scripts.filter(Boolean)).toEqual([]);
    expect(screen.queryByTestId('room-item-carousel')).toBeNull();
    expect(bar()).toHaveAttribute('data-tool', 'soap');
    expect(screen.getByTestId('bath-guidance')).toHaveTextContent(/Rub the soap all over Brook/);
    expect(shell()).toHaveAttribute('data-input-locked', 'true');
    expect(screen.getByRole('button', { name: /decorate this room/i })).toBeDisabled();
    // The scene draws the ritual from the same frame, on the actor, with no tub
    await waitFor(() => expect(lastBath()).toMatchObject({ ritual: 'wash', style: 'soap', place: 'in-place', status: 'stage', stage: { id: 'lather' }, tool: { kind: 'soap' }, anchor: { kind: 'world', tubIndex: null } }));
    expect(relay.published).toEqual([]);
    // A tap lays nothing; a stroke lays foam, which the scene is told of, cell for cell
    fireEvent.pointerDown(screen.getByTestId('bath-layer'), { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(screen.getByTestId('bath-layer'), { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    await quiet(80);
    expect(screen.getByTestId('bath-foam')).toHaveAttribute('data-count', '0');
    await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-ready', 'true'));
    rubBath({ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
    await waitFor(() => expect(Number(screen.getByTestId('bath-foam').dataset.count)).toBeGreaterThan(0));
    await waitFor(() => expect((lastBath()?.cells as { foamed: boolean }[]).filter((c) => c.foamed).length).toBe(Number(screen.getByTestId('bath-foam').dataset.count)));
    await playBath({ through: 'lather' });
    expect(bar()).toHaveAttribute('data-tool', 'shower');
    expect(scene.state.gestures).toContain('bounce');
    expect(relay.published).toEqual([]);
    await playBath();
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(Number(getTagValue(relay.published[0].tags, 'hygiene'))).toBeGreaterThan(45);
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Brook/), { timeout: 3000 });
    await waitFor(() => expect(bar()).toHaveAttribute('data-status', 'done'), { timeout: 3000 });
    // Wet from the rinse: it shakes once the write has landed, then celebrates
    await waitFor(() => expect((lastBath()?.cues as { kind: string }[] | undefined)?.map((c) => c.kind)).toEqual(['rinse', 'shake', 'done']), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    expect(lastBath()).toBeNull();
    expect(screen.getByTestId('room-item-carousel')).toBeInTheDocument();
    expect(shell()).not.toHaveAttribute('data-input-locked');
    await quiet();
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  }, 25_000);

  it('Bubble Bath is the soak in the tub: the walk, the jump in (scripted onto its floor), the play in the water, the jump out onto the floor, THEN one write, then the shake; no towel, nothing to rub', async () => {
    renderRoom();
    await ready();
    await intoTheTub();
    // In the tub: the jump put it on the tub's floor at its middle; the scene draws the tub item's bath
    const inTub = scene.state.scripts.filter(Boolean).at(-1);
    expect(inTub).toMatchObject({ x: 5, z: 1 });
    expect(inTub?.elev).toBeCloseTo(BATH_ELEV, 6);
    await waitFor(() => expect(lastBath()).toMatchObject({ ritual: 'soak', place: 'tub', stage: { id: 'play', kind: 'timed' }, tool: null, anchor: { tubIndex: 0 } }));
    expect((lastBath()?.cues as { kind: string }[]).map((c) => c.kind)).toEqual(['splash-in']);
    expect(bar()).toHaveAttribute('data-tool', 'none');
    // The play passes with time; nothing is written in the water, and nothing on the way out
    await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'jump-out'), { timeout: 8000 });
    expect(relay.published).toEqual([]);
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 6000 });
    // Out of the water before the write: the last script before it lands is on the floor (elev 0), in front of the tub
    const out = scene.state.scripts.filter(Boolean).at(-1);
    expect(out?.elev).toBe(0);
    expect(out!.z).toBeGreaterThan(2);
    expect(Number(getTagValue(relay.published[0].tags, 'hygiene'))).toBe(100);
    await waitFor(() => expect((lastBath()?.cues as { kind: string }[]).map((c) => c.kind)).toEqual(['splash-in', 'splash-out', 'shake', 'done']), { timeout: 4000 });
    expect(screen.queryByTestId('bath-tool-in-hand')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    expect(scene.state.scripts.at(-1)).toBeNull();
    expect(lastBath()).toBeNull();
    await quiet();
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  }, 30_000);

  it('Stop in the water (the play) writes nothing and lets the Blobbi go; a stopped walk to the tub ends the soak with nothing written', async () => {
    renderRoom();
    await ready();
    await goTo('care');
    fireEvent.click(focusOn('Bubble Bath', 'starter'));
    await awaitWalk();
    settleWalk('stopped');
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    expect(scene.state.scripts.filter(Boolean)).toEqual([]);
    scene.state.walks = [];
    await intoTheTub();
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    expect(scene.state.scripts.at(-1)).toBeNull();
    await waitFor(() => expect(lastBath()).toBeNull());
    await quiet(600);
    expect(relay.published).toEqual([]);
  }, 20_000);

  it('an owned soap spends exactly once, after the bath: one 1416, the state with its marker, the receipt; the count goes down', async () => {
    renderRoom();
    await ready();
    await startSoap('owned');
    await playBath({ through: 'lather' });
    expect(relay.published).toEqual([]);
    await playBath();
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    await waitFor(() => expect(carouselItems().some((i) => i.name === 'Soap' && i.source === 'owned')).toBe(false), { timeout: 3000 });
    await quiet();
    expect(kinds().filter((k) => k === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
  }, 25_000);

  it('Shampoo and Soft Towel are not care actions of their own (M15 cleanup): the care room never offers them; owned, from the bag, each is still its own ritual in place, one write each', async () => {
    relay.all = [brook(), ...definitions(), ...EXTRAS.map(([d, name]) => officialCareDefinition(d, name, 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'] })), inventoryEvent('blobbi:island', { [OFFICIAL_SOAP]: 1, [address(EXTRAS[0][0])]: 1, [address(EXTRAS[1][0])]: 1 })];
    // The Items sheet opens from the Blobbi's sheet, which waits behind the room's first-visit introduction (one layer at a time)
    window.localStorage.setItem('blobbi:home:3d-intro:v1', 'seen');
    renderRoom();
    await ready();
    for (const [d, , ritual, firstStage] of EXTRAS) {
      relay.published = [];
      // From the bag: the Blobbi's sheet, Items, the item, Use (a cleaning item from the bag is a bath where it stands)
      fireEvent.click(screen.getByTestId('room-bar-blobbi'));
      fireEvent.click(await screen.findByTestId('room-open-items'));
      fireEvent.click(await screen.findByTestId(`inventory-item-${d}`));
      fireEvent.click(screen.getByTestId('inventory-use'));
      await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', firstStage), { timeout: 3000 });
      await waitFor(() => expect(lastBath()).toMatchObject({ ritual, place: 'in-place', anchor: { tubIndex: null } }));
      expect(scene.state.walks).toEqual([]);
      await playBath();
      await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
      await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
      expect(scene.state.baths.filter(Boolean).every((b) => (b!.anchor as { tubIndex: number | null }).tubIndex === null)).toBe(true);
      expect(scene.state.scripts.filter(Boolean)).toEqual([]);
    }
    // The care room's dock: Soap and Bubble Bath, never Shampoo or Soft Towel (as a starter or an owned copy)
    await goTo('care');
    await waitFor(() => expect(carouselItems().some((i) => i.name === 'Soap' && i.source === 'owned')).toBe(true));
    const names = carouselItems().map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Soap', 'Bubble Bath']));
    expect(names).not.toContain('Shampoo');
    expect(names).not.toContain('Soft Towel');
  }, 40_000);

  it('Stop at the soap: nothing written, nothing spent, the scene drawing nothing, the carousel back', async () => {
    renderRoom();
    await ready();
    await startSoap('owned');
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    await waitFor(() => expect(lastBath()).toBeNull());
    expect(screen.getByTestId('room-item-carousel')).toBeInTheDocument();
    expect(focusOn('Soap', 'owned')).toHaveTextContent('×1');
    await quiet();
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('a change of room mid-wash ends it first, with nothing written', async () => {
    renderRoom();
    await ready();
    await startSoap();
    await playBath({ through: 'lather' });
    const before = scene.state.scripts.length;
    fireEvent.click(screen.getByTestId('room-nav-right'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    // The ritual lets the Blobbi go (back on the floor) before the room's own scene takes it anywhere
    expect(scene.state.scripts[before]).toBeNull();
    await waitFor(() => expect(lastBath()).toBeNull());
    await quiet();
    expect(relay.published).toEqual([]);
  }, 20_000);

  it('a refused write leaves the bath waiting with why, never retried by itself; Try again (a tap) writes once; Stop on a failed bath takes it back with nothing used', async () => {
    renderRoom();
    await ready();
    await startSoap();
    relay.refuse = 1;
    await playBath();
    expect(await screen.findByTestId('bath-error', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(bar()).toHaveAttribute('data-status', 'failed');
    // The room's own failure card does not double it; no shake before a landed write
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
    expect((lastBath()?.cues as { kind: string }[]).map((c) => c.kind)).toEqual(['rinse']);
    const tries = event.mock.calls.length;
    await quiet(1000);
    expect(event.mock.calls.length).toBe(tries);
    expect(relay.published).toEqual([]);
    fireEvent.click(screen.getByTestId('bath-retry'));
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    expect(screen.queryByTestId('room-offer-failure')).toBeNull();
  }, 25_000);

  it('Stop on a failed bath: nothing written, no failure card left behind, the Blobbi let go', async () => {
    renderRoom();
    await ready();
    await startSoap();
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
    await waitFor(() => expect(screen.getByTestId('bath-layer')).toHaveAttribute('data-stage', 'lather'), { timeout: 3000 });
    expect(scene.state.walks).toEqual([]);
    expect(scene.state.scripts).toEqual([]);
    expect(lastBath()).toMatchObject({ anchor: { tubIndex: null } });
    await playBath();
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(getTagValue(relay.published[0].tags, 'stage')).toBe('egg');
  }, 25_000);

  // ─── Integration (M15): the spend under a failed state write ───
  it('a spend that landed under a refused state write: Try again resumes the same spend (one 1416 in all) and applies the soap once', async () => {
    renderRoom();
    await ready();
    await startSoap('owned');
    relay.refuseKind = KIND_BLOBBI_STATE;
    await playBath();
    await screen.findByTestId('bath-error', {}, { timeout: 4000 });
    expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND]);
    const spendId = relay.published[0].id;
    fireEvent.click(screen.getByTestId('bath-retry'));
    await waitFor(() => expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND, KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    const state = relay.published[1];
    expect(state.tags.some((t) => t[0] === 'blobbi_op' && t[1] === spendId)).toBe(true);
    expect(Number(getTagValue(state.tags, 'hygiene'))).toBe(70);
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    await quiet();
    expect(kinds().filter((k) => k === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
  }, 25_000);

  it('a use left open (spent, state refused, then Stop) is finished first, never bathed with: the next owned soap resumes it with no new spend and no bath', async () => {
    relay.all = [brook(), ...definitions(), inventoryEvent('blobbi:island', { [OFFICIAL_SOAP]: 2 })];
    renderRoom();
    await ready();
    await startSoap('owned');
    relay.refuseKind = KIND_BLOBBI_STATE;
    await playBath();
    await screen.findByTestId('bath-error', {}, { timeout: 4000 });
    const spendId = relay.published[0].id;
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    await quiet();
    expect(kinds()).toEqual([KIND_GAME_INVENTORY_SPEND]);
    // The second soap: the room's old way (set down, the Blobbi comes, the open use is resumed), not a second bath
    fireEvent.click(focusOn('Soap', 'owned'));
    await quiet(200);
    expect(screen.queryByTestId('bath-bar')).toBeNull();
    for (let i = 0; i < 20 && !kinds().includes(KIND_BLOBBI_STATE); i++) {
      if (scene.state.walks.length > 0) settleWalk('arrived');
      await quiet(150);
    }
    await waitFor(() => expect(kinds()).toContain(KIND_BLOBBI_STATE), { timeout: 4000 });
    const state = relay.published.find((e) => e.kind === KIND_BLOBBI_STATE)!;
    expect(state.tags.some((t) => t[0] === 'blobbi_op' && t[1] === spendId)).toBe(true);
    await quiet();
    expect(kinds().filter((k) => k === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
  }, 30_000);

  it('the needs step aside for the bath (on a short phone they cover the top of the Blobbi, where the shower is held) and are back after it', async () => {
    renderRoom();
    await ready();
    expect(screen.getByTestId('room-status-hud')).toBeInTheDocument();
    await startSoap();
    expect(screen.queryByTestId('room-status-hud')).toBeNull();
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    expect(await screen.findByTestId('room-status-hud')).toBeInTheDocument();
  }, 15_000);
});

describe('medicine in the room (M15 care refinement)', () => {
  it('a moment where the Blobbi stands: no walk, no bath, no tub; the dose at its mouth, then the one write; relieved, "Treated"; the item never on the floor', async () => {
    relay.all = [brook({ health: '60' }), ...definitions(), ...stock()];
    renderRoom();
    await ready();
    await goTo('care');
    fireEvent.click(focusOn('Bandage', 'starter'));
    expect(await screen.findByTestId('medicine-dose')).toHaveAttribute('data-phase', 'dose');
    expect(screen.queryByTestId('bath-bar')).toBeNull();
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    expect(relay.published).toEqual([]);
    await waitFor(() => expect(screen.getByTestId('medicine-dose')).toHaveAttribute('data-phase', 'wiggle'), { timeout: 2000 });
    expect(scene.state.gestures).toContain('wiggle');
    expect(relay.published).toEqual([]);
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    expect(Number(getTagValue(relay.published[0].tags, 'health'))).toBe(85);
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Treated Brook/), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByTestId('medicine-dose')).toBeNull(), { timeout: 3000 });
    // Never a walk, never the bath, never the tub
    expect(scene.state.walks).toEqual([]);
    expect(scene.state.scripts.filter(Boolean)).toEqual([]);
    expect(scene.state.baths.filter(Boolean)).toEqual([]);
    await quiet();
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
  }, 20_000);

  it('its own rule: health full is a word in the room and nothing else; a full hygiene does not stop it', async () => {
    relay.all = [brook({ health: '100' }), ...definitions(), ...stock()];
    renderRoom();
    await ready();
    await goTo('care');
    fireEvent.click(focusOn('Bandage', 'starter'));
    expect(await screen.findByTestId('room-care-notice')).toHaveTextContent(/Brook is feeling fine/);
    expect(screen.queryByTestId('medicine-dose')).toBeNull();
    await quiet(1_600);
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('an owned medicine with a use left open: no moment, the open use resumed (no new spend), no walk to the tub', async () => {
    relay.all = [brook({ health: '60' }), ...definitions(), officialCareDefinition('blobbi:medicine:bandage', 'Bandage', 'medicine', 'medicine', { health: 25 }, { stages: ['egg', 'baby', 'adult'] }), inventoryEvent('blobbi:island', { [OFFICIAL_SOAP]: 1, [OFFICIAL_BANDAGE]: 1 })];
    renderRoom();
    await ready();
    await startSoap('owned');
    relay.refuseKind = KIND_BLOBBI_STATE;
    await playBath();
    await screen.findByTestId('bath-error', {}, { timeout: 4000 });
    const spendId = relay.published[0].id;
    fireEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    await quiet();
    fireEvent.click(focusOn('Bandage', 'owned'));
    await quiet(150);
    expect(screen.queryByTestId('medicine-dose')).toBeNull();
    const walked: { x: number; z: number }[] = [];
    for (let i = 0; i < 20 && !kinds().includes(KIND_BLOBBI_STATE); i++) {
      if (scene.state.walks.length > 0) {
        walked.push({ x: scene.state.walks[0].x, z: scene.state.walks[0].z });
        settleWalk('arrived');
      }
      await quiet(150);
    }
    await waitFor(() => expect(kinds()).toContain(KIND_BLOBBI_STATE), { timeout: 4000 });
    const state = relay.published.find((e) => e.kind === KIND_BLOBBI_STATE)!;
    expect(state.tags.some((t) => t[0] === 'blobbi_op' && t[1] === spendId)).toBe(true);
    expect(kinds().filter((k) => k === KIND_GAME_INVENTORY_SPEND)).toHaveLength(1);
    // The plain way sets it down in front of the Blobbi, never at the tub (the care room's tub stands at x 3..7, z 0..2)
    expect(walked.length).toBeGreaterThan(0);
    for (const w of walked) expect(w.z).toBeGreaterThan(2);
  }, 30_000);

  it('a change of room before the write writes nothing', async () => {
    relay.all = [brook({ health: '60', hygiene: '100' }), ...definitions(), ...stock()];
    renderRoom();
    await ready();
    await goTo('care');
    fireEvent.click(focusOn('Bandage', 'starter'));
    expect(await screen.findByTestId('medicine-dose')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('room-nav-right'));
    await waitFor(() => expect(screen.queryByTestId('medicine-dose')).toBeNull());
    await quiet(1_800);
    expect(relay.published).toEqual([]);
  }, 15_000);
});
