/**
 * The room's scenes under interruption, in the real room over a fake 3D
 * scene whose walks the test settles: a change of room while food is
 * eaten (the write landed, the show is cut, nothing is left), a teleport
 * while the ball is played, a hand on the Blobbi while it walks to a toy
 * (the walk stops, the item goes back, nothing is written), the page put
 * away mid-scene, and a tap on the ball after the game (it rolls, nothing
 * is written). After each, no prop is duplicated, no face is stuck, and
 * the dock is usable again.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';

vi.hoisted(() => {
  (import.meta.env as Record<string, string>).VITE_BLOBBI_DEV_TOOLS = 'true';
});
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const scene = vi.hoisted(() => {
  type Outcome = 'arrived' | 'replaced' | 'stopped' | 'refused';
  type Prop = { id: string; kind: string; x: number; z: number; bites?: { taken: number; of: number }; leaving?: boolean };
  const state = {
    walks: [] as { x: number; z: number; resolve: (o: Outcome) => void }[],
    autoArrive: false,
    props: [] as Prop[],
    kicks: [] as string[],
    faces: [] as unknown[],
    gestures: [] as string[],
    position: { x: 4, z: 4 },
  };
  const fake = {
    setProps(props: Prop[]) { state.props = props; },
    kickProp(id: string) { state.kicks.push(id); return true; },
    propPosition: (id: string) => (state.props.some((p) => p.id === id) ? { x: 5.5, z: 5.5 } : null),
    propResting: () => true,
    pick: (x: number, y: number) => {
      if (x > 150 && x < 250 && y > 220 && y < 320) return { kind: 'actor' as const, id: 'main' };
      const ball = state.props.find((p) => p.kind === 'ball');
      if (ball && y > 380 && y < 440 && x > 240 && x < 300) return { kind: 'prop' as const, id: ball.id };
      return { kind: 'floor' as const, x: Math.min(7.5, x / 60), z: Math.min(7.5, y / 60) };
    },
    floorAt: (x: number, y: number) => ({ x: Math.min(7.5, x / 60), z: Math.min(7.5, y / 60) }),
    requestWalk: (_id: string, x: number, z: number) =>
      new Promise<Outcome>((resolve) => {
        if (state.autoArrive) resolve('arrived');
        else state.walks.push({ x, z, resolve });
      }),
    stopWalk: () => state.walks.splice(0).forEach((w) => w.resolve('stopped')),
    positionOf: () => ({ ...state.position }),
    hop: () => {},
    playGesture: (_id: string, kind: string) => { state.gestures.push(kind); },
    setActorGaze: () => {},
    setActorFace: (_id: string, face: unknown) => { state.faces.push(face); },
    setActorPose: () => {},
    setActorScript: () => {},
    setActorJourney: () => {},
    setActorJourneyPreview: () => {},
    setWallsCover: () => {},
    behindWalls: () => null,
    wallsOnScreen: () => [],
    skyAt: () => 10,
    standPointNear: (x: number, z: number) => ({ x, z }),
    holdIntro: () => {},
    renderNow: () => {},
    overActor: (x: number, y: number) => x > 150 && x < 250 && y > 220 && y < 320,
    hoverAt: () => null,
    pressItem: () => {},
    setMainWanders: () => {},
    projectBlobbi: () => ({ x: 200, y: 320, pxPerTile: 40 }),
    projectFloor: () => ({ x: 270, y: 410, pxPerTile: 40 }),
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
    tileFree: () => true,
  };
  return { state, fake };
});
vi.mock('@/features/room/hooks/useRoomScene', () => ({
  useRoomScene: () => ({ status: 'ready', sceneRef: { current: scene.fake } }),
  webglAvailable: () => false,
}));

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { officialCareDefinition } from '@/test/inventory-fixtures';
import { focusOn, middle } from './test/carousel';
import { roomById, type RoomId } from '@/features/home/rooms/rooms';

let signCount = 0;
const signer = {
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...t, id: String(signCount).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
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
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => matches(e, f)))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
    const d = getTagValue(ev.tags, 'd');
    if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
    else relay.all.push(ev);
  }),
} as unknown as NPool;

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
const kinds = () => relay.published.map((e) => e.kind);
const shell = () => screen.getByTestId('room-shell');
const goTo = async (room: RoomId) => {
  // The header steps from the room asked for (the scenes play out later): step until it names the one wanted
  const label = roomById(room).label;
  for (let i = 0; i < 5 && screen.getByTestId('room-label').textContent !== label; i++) fireEvent.click(screen.getByTestId('room-nav-right'));
  expect(screen.getByTestId('room-label')).toHaveTextContent(label);
  await waitFor(() => expect(shell()).toHaveAttribute('data-room', room), { timeout: 4000 });
  // The room change's scene over: the Blobbi is free again
  await waitFor(() => expect(screen.getByRole('button', { name: /decorate this room/i })).toBeEnabled(), { timeout: 6000 });
};
const awaitWalk = () => waitFor(() => expect(scene.state.walks).toHaveLength(1), { timeout: 2000 });
const settleWalk = (outcome: 'arrived' | 'replaced' | 'stopped' | 'refused') => act(() => { scene.state.walks.shift()?.resolve(outcome); });
const quiet = (ms = 400) => act(() => new Promise((r) => setTimeout(r, ms)));
const dish = () => scene.state.props.find((p) => p.kind === 'dish');
const ball = () => scene.state.props.find((p) => p.kind === 'ball');
const face = () => document.querySelector('[data-room-blobbi="main"]')?.getAttribute('data-expression') ?? '';
const layer = () => screen.getByTestId('room-tap-layer');
/** A finger rubbing back and forth across the Blobbi. */
const stroke = (passes = 6) => {
  fireEvent.pointerDown(layer(), { pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: 200, clientY: 280 });
  for (let i = 0; i < passes; i++) fireEvent.pointerMove(layer(), { pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: i % 2 ? 160 : 240, clientY: 280 + (i % 3) });
  fireEvent.pointerUp(layer(), { pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: 200, clientY: 282 });
};

let hidden = false;
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 0));
  hidden = false;
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [
    blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } }),
    officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }),
    officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }),
  ];
  relay.published = [];
  signCount = 0;
  scene.state.walks = [];
  scene.state.autoArrive = false;
  scene.state.props = [];
  scene.state.kicks = [];
  scene.state.faces = [];
  scene.state.gestures = [];
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('a scene interrupted', () => {
  it('a change of room while the food is eaten: the write stands (it had landed), the show is cut, the dish is gone with the room, the dock is free', async () => {
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    await goTo('kitchen');
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    await waitFor(() => expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'eating'), { timeout: 3000 });
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
    const bitten = dish()!.bites!.taken;
    fireEvent.click(screen.getByTestId('room-nav-right'));
    act(() => scene.fake.stopWalk());
    await waitFor(() => expect(shell()).toHaveAttribute('data-room', 'home'), { timeout: 3000 });
    // Nothing of the meal is left in the new room, and no second write follows
    expect(scene.state.props).toEqual([]);
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
    await quiet(1600);
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
    expect(dish()).toBeUndefined();
    expect(bitten).toBeLessThanOrEqual(4);
    // Once the new room's own scene is over (an unseen room builds), the dock is free
    await waitFor(() => expect(middle()).toBeEnabled(), { timeout: 6000 });
    // The face is its own again (no chewing left on it)
    await waitFor(() => expect(face()).not.toMatch(/"mouth":"open"/), { timeout: 2000 });
  }, 15_000);

  it('a change of room while the food is waited for: nothing is written, the dish goes, the item is back in the dock', async () => {
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    await goTo('kitchen');
    fireEvent.click(focusOn('Apple', 'starter'));
    expect(dish()).toBeDefined();
    fireEvent.click(screen.getByTestId('room-nav-left'));
    act(() => scene.fake.stopWalk());
    await waitFor(() => expect(shell()).toHaveAttribute('data-room', 'care'));
    expect(scene.state.props).toEqual([]);
    await quiet(800);
    expect(relay.published).toEqual([]);
    await goTo('kitchen');
    expect(middle()).toBeEnabled();
  });

  it('a hand on the Blobbi while it walks to the ball: the walk stops, the ball goes back, nothing is written, and the petting is the petting', async () => {
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    fireEvent.click(focusOn('Ball', 'starter'));
    expect(ball()).toBeDefined();
    await awaitWalk();
    stroke(8);
    // The stroke stopped the walk (the scene settles it so) and is itself a petting
    expect(scene.state.walks).toHaveLength(0);
    expect(screen.getByTestId('room-pet-heart')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull());
    await waitFor(() => expect(ball()).toBeUndefined());
    await quiet(600);
    expect(relay.published).toEqual([]);
    expect(middle()).toBeEnabled();
  });

  it('a teleport while the ball is played: the game ends there, the ball stays a thing on the floor until the room changes, the play was written once', async () => {
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    fireEvent.click(focusOn('Ball', 'starter'));
    await awaitWalk();
    scene.state.autoArrive = true;
    settleWalk('arrived');
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(scene.state.kicks.length).toBeGreaterThanOrEqual(1), { timeout: 4000 });
    // Off it goes (the development tools' Leave)
    fireEvent.click(screen.getByTestId('dev-tools-open'));
    fireEvent.click(screen.getByTestId('dev-tools-tab-teleport'));
    fireEvent.click(screen.getByTestId('teleport-dev-leave'));
    const kicked = scene.state.kicks.length;
    await quiet(1500);
    expect(scene.state.kicks.length).toBe(kicked);
    expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]);
    expect(screen.queryByTestId('room-floor-item')).toBeNull();
  }, 15_000);

  it('the page put away mid-scene: the waits are not kept, the write that was out finishes, the meal is not shown, nothing is stuck', async () => {
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    await goTo('kitchen');
    fireEvent.click(focusOn('Apple', 'starter'));
    await awaitWalk();
    settleWalk('arrived');
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(kinds()).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION]), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook/), { timeout: 4000 });
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(dish()).toBeUndefined(), { timeout: 3000 });
    expect(middle()).toBeEnabled();
  });

  it('after the game, a tap on the ball sends it rolling and the Blobbi looks; nothing is written', async () => {
    renderRoom();
    await screen.findByTestId('room-bar', {}, { timeout: 5000 });
    fireEvent.click(focusOn('Ball', 'starter'));
    await awaitWalk();
    scene.state.autoArrive = true;
    settleWalk('arrived');
    await waitFor(() => expect(scene.state.kicks).toHaveLength(3), { timeout: 6000 });
    await waitFor(() => expect(screen.queryByTestId('room-floor-item')).toBeNull(), { timeout: 3000 });
    expect(ball()).toBeDefined();
    await quiet(900);
    const written = relay.published.length;
    fireEvent.pointerDown(layer(), { pointerId: 8, isPrimary: true, pointerType: 'touch', clientX: 270, clientY: 410 });
    fireEvent.pointerUp(layer(), { pointerId: 8, isPrimary: true, pointerType: 'touch', clientX: 270, clientY: 410 });
    expect(scene.state.kicks).toHaveLength(4);
    await waitFor(() => expect(face()).toMatch(/surprised":0\.55/));
    await quiet(300);
    expect(relay.published).toHaveLength(written);
  }, 15_000);
});
