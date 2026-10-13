/**
 * Coming home (M12.1): entering the room is an arrival. The Blobbi is away
 * while the room comes on screen, then gathers from motes and lands, through
 * the room's one presence controller (the teleport's arrival, the same
 * machine and timeline as a journey). An egg never arrives (its first moment
 * is the hatch theatre); a sleeper is in its bed; a re-render never replays
 * it; nothing is ever written.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { ARRIVAL_BUILD_CAP_MS, ARRIVAL_LEAD_MS, arrivalDelay, arrivesOnEntry, setRoomArrivalEnabled } from './lib/room-arrival';
import { roomIntroKey, serializeSeenRooms } from './lib/room-memory';
import { roomFurnitureFor } from './lib/room-furniture';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const scene = vi.hoisted(() => {
  const state = { journeys: [] as (string | null)[], walks: 0, itemAt: null as number | null };
  const fake = {
    pick: () => (state.itemAt !== null ? { kind: 'item' as const, index: state.itemAt } : { kind: 'floor' as const, x: 3, z: 3 }),
    floorAt: () => ({ x: 3, z: 3 }),
    requestWalk: () => {
      state.walks += 1;
      return Promise.resolve('arrived' as const);
    },
    stopWalk: () => {},
    positionOf: () => ({ x: 4, z: 4 }),
    hop: () => {},
    playGesture: () => {},
    setActorGaze: () => {},
    setMainWanders: () => {},
    setActorJourney: (_id: string, j: { kind: string } | null) => { state.journeys.push(j ? j.kind : null); },
    setActorJourneyPreview: () => {},
    renderNow: () => {},
    projectBlobbi: () => ({ x: 200, y: 320, pxPerTile: 40 }),
    projectFloor: () => ({ x: 200, y: 400, pxPerTile: 40 }),
    projectItemTop: () => ({ x: 150, y: 300, pxPerTile: 40 }),
    facingOf: () => 'front' as const,
    isWalking: () => false,
    actorModelDrawn: () => false,
    poke: () => {},
    toggleLamp: () => false,
    walkTo: () => {},
    findSpot: () => null,
  };
  return { state, fake };
});
vi.mock('@/features/room/hooks/useRoomScene', () => ({
  useRoomScene: () => ({ status: 'ready', sceneRef: { current: scene.fake } }),
  webglAvailable: () => false,
}));

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { ARRIVE } from '@/features/teleport/timeline';

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
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

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
/** How the Blobbi is drawn now: 'away' when it is not in the room at all (nothing drawn), else the 2D frame's journey. */
const teleport = () => document.querySelector('[data-teleport]')?.getAttribute('data-teleport') ?? 'away';
const D = (id: string) => `blobbi-${PUBKEY.slice(0, 12)}-${id}`;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
  setRoomArrivalEnabled(true);
});
afterAll(() => setRoomArrivalEnabled(false));
beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
  relay.published = [];
  scene.state.journeys = [];
  scene.state.walks = 0;
  scene.state.itemAt = null;
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('when to arrive (pure)', () => {
  it('a hatched, awake Blobbi arrives; an egg and a sleeper do not', () => {
    expect(arrivesOnEntry({ stage: 'baby', sleeping: false })).toBe(true);
    expect(arrivesOnEntry({ stage: 'adult', sleeping: false })).toBe(true);
    expect(arrivesOnEntry({ stage: 'egg', sleeping: false })).toBe(false);
    expect(arrivesOnEntry({ stage: 'adult', sleeping: true })).toBe(false);
  });
  it('waits for the room: nothing while it loads; a beat once drawn (or flat); the cap while a first build has not ended', () => {
    expect(arrivalDelay(null, true)).toBeNull();
    expect(arrivalDelay('loading', true)).toBeNull();
    expect(arrivalDelay('ready', true)).toBe(ARRIVAL_LEAD_MS);
    expect(arrivalDelay('unavailable', false)).toBe(ARRIVAL_LEAD_MS);
    expect(arrivalDelay('ready', false)).toBe(ARRIVAL_BUILD_CAP_MS);
  });
});

describe('entering the room', () => {
  it('a room seen before: away at first, then the arrival once the room is drawn, then here; nothing written', async () => {
    localStorage.setItem(roomIntroKey(PUBKEY, D('0000000001')), serializeSeenRooms(['home', 'kitchen', 'care', 'rest', 'closet']));
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(teleport()).toBe('away');
    expect(scene.state.journeys).not.toContain('arrive');
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'), { timeout: ARRIVAL_LEAD_MS + 1_000 });
    expect(teleport()).toBe('arrive');
    await waitFor(() => expect(teleport()).toBe('none'), { timeout: ARRIVE.total + 2_000 });
    expect(scene.state.journeys.filter((j) => j === 'arrive')).toHaveLength(1);
    expect(relay.published).toEqual([]);
    // Home, it walks again: the room's navigation heard the scene was ready (the arrival listens to the scene's status
    // without taking it away from the navigation): a tap on the bed is a walk to it, not a nap where it stands
    for (let i = 0; i < 5 && screen.getByTestId('room-shell').dataset.room !== 'rest'; i++) fireEvent.click(screen.getByTestId('room-nav-right'));
    scene.state.itemAt = roomFurnitureFor('rest').findIndex((p) => p.id === 'official:bed-single');
    const layer = screen.getByTestId('room-tap-layer');
    fireEvent.pointerDown(layer, { pointerId: 5, isPrimary: true, clientX: 300, clientY: 40 });
    fireEvent.pointerUp(layer, { pointerId: 5, isPrimary: true, clientX: 300, clientY: 40 });
    await waitFor(() => expect(scene.state.walks).toBe(1));
  }, 15_000);

  it('a room built for the first time: the arrival waits for the build (here, its cap: the fake scene never reports one)', async () => {
    renderRoom();
    await screen.findByTestId('room-bar');
    await wait(ARRIVAL_LEAD_MS + 300);
    expect(teleport()).toBe('away');
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'), { timeout: ARRIVAL_BUILD_CAP_MS + 1_000 });
  }, 15_000);

  it('is not replayed by a re-render: screens opened and closed over the room leave it where it is', async () => {
    localStorage.setItem(roomIntroKey(PUBKEY, D('0000000001')), serializeSeenRooms(['home']));
    renderRoom();
    await waitFor(() => expect(teleport()).toBe('none'), { timeout: ARRIVAL_LEAD_MS + ARRIVE.total + 3_000 });
    fireEvent.click(screen.getByTestId('room-menu'));
    await screen.findByTestId('menu-sheet');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    fireEvent.click(screen.getByTestId('sheet-journey'));
    await wait(ARRIVAL_LEAD_MS + 500);
    expect(scene.state.journeys.filter((j) => j === 'arrive')).toHaveLength(1);
    expect(teleport()).toBe('none');
  }, 15_000);

  it('an egg is simply there: no arrival before its hatch', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Shell', stage: 'egg', state: 'active', visualGeneration: 'v3' })];
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(teleport()).toBe('none');
    await wait(ARRIVAL_BUILD_CAP_MS + 300);
    expect(scene.state.journeys).not.toContain('arrive');
  }, 15_000);

  it('a sleeper is in its bed: no arrival', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'sleeping', visualGeneration: 'v3' })];
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(teleport()).toBe('none');
    await wait(ARRIVAL_BUILD_CAP_MS + 300);
    expect(scene.state.journeys).not.toContain('arrive');
  }, 15_000);
});
