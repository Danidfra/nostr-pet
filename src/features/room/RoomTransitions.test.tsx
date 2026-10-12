/**
 * Room transitions in the real room (the scene stubbed, able to stage a
 * scene): a first visit plays its spectacle and swaps the room part way,
 * nothing else starts meanwhile (no items, no decorating), the Blobbi is let
 * go on the floor at the end; a hurried player's next room cuts the scene
 * short; the last room and where the Blobbi stood come back after a reload,
 * already built; leaving mid-scene lets the Blobbi go; nothing is published.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const scene = vi.hoisted(() => {
  const state = {
    position: { x: 3.5, z: 3.5 },
    scripts: [] as ({ x: number; z: number; elev: number } | null)[],
    items: [] as { intro: unknown; spawn: unknown }[],
    /** The scene's word that the build of the room on screen played to its end (the test gives it). */
    built: null as ((key: string) => void) | null,
  };
  const fake = {
    pick: () => ({ kind: 'floor' as const, x: 3, z: 3 }),
    floorAt: () => ({ x: 3, z: 3 }),
    requestWalk: () => Promise.resolve('arrived' as const),
    stopWalk: () => {},
    positionOf: () => ({ ...state.position }),
    hop: () => {},
    playGesture: () => {},
    setActorGaze: () => {},
    setActorFace: () => {},
    setActorPose: () => {},
    setMainWanders: () => {},
    setActorJourney: () => {},
    setActorJourneyPreview: () => {},
    setActorScript: (_id: string, s: { x: number; z: number; elev: number } | null) => {
      state.scripts.push(s ? { x: s.x, z: s.z, elev: s.elev } : null);
      if (s) state.position = { x: s.x, z: s.z };
    },
    setWallsCover: () => {},
    behindWalls: () => false,
    wallsOnScreen: () => [],
    skyAt: () => 10,
    standPointNear: (x: number, z: number) => ({ x, z }),
    holdIntro: () => {},
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
  // The shell's scene: the room swap is what `setItems` would be handed, recorded with how it arrives
  useRoomScene: (options: { roomKey: string; roomEntry?: { intro: unknown; spawn: unknown }; onRoomBuilt?: (key: string) => void }) => {
    const last = scene.state.items[scene.state.items.length - 1] as { key?: string } | undefined;
    if (last?.key !== options.roomKey) scene.state.items.push({ key: options.roomKey, intro: options.roomEntry?.intro, spawn: options.roomEntry?.spawn } as never);
    scene.state.built = options.onRoomBuilt ?? null;
    return { status: 'ready', sceneRef: { current: scene.fake } };
  },
  webglAvailable: () => false,
}));

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { roomIntroKey, roomNavKey } from './lib/room-memory';

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

const room = () => screen.getByTestId('room-shell').getAttribute('data-room');
const PET = '0000000001';
/** The Blobbi's address (`d`), as its event states it: what the room's memory is keyed by. */
const D = blobbiEvent(PET, { stage: 'adult', visualGeneration: 'v3' }).tags.find(([n]) => n === 'd')![1];

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent(PET, { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
  relay.published = [];
  scene.state.position = { x: 3.5, z: 3.5 };
  scene.state.scripts = [];
  scene.state.items = [];
  scene.state.built = null;
  localStorage.clear();
});
const seen = () => (JSON.parse(localStorage.getItem(roomIntroKey(PUBKEY, D)) ?? '{"rooms":[]}') as { rooms: string[] }).rooms;
/** The scene says the room on screen has been built in front of the player. */
const buildDone = (key: string) => act(() => { scene.state.built?.(key); });
const spies: { mockRestore: () => void }[] = [];
const randomly = (value: number) => spies.push(vi.spyOn(Math, 'random').mockReturnValue(value));
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
  localStorage.clear();
});
const go = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`go to ${label.source}`, 'i') }));

describe('changing rooms', () => {
  it('a first visit plays its scene: the room comes on screen part way, nothing else starts meanwhile, and the Blobbi is let go on the floor', async () => {
    randomly(0.1); // the big jump
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(room()).toBe('home');
    go(/bedroom/);
    // The room on screen waits for the scene's swap
    expect(room()).toBe('home');
    await waitFor(() => expect(scene.state.scripts.length).toBeGreaterThan(0));
    // Mid-scene: decorating is off
    expect(screen.getByRole('button', { name: /decorate this room/i })).toBeDisabled();
    await waitFor(() => expect(room()).toBe('rest'), { timeout: 3000 });
    // The bedroom built in front of the player (its first visit), the Blobbi where it was going
    expect(scene.state.items.find((i) => (i as { key?: string }).key === 'rest')?.intro).toBe('build');
    await waitFor(() => expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull(), { timeout: 5000 });
    expect(scene.state.scripts.some((s) => s && s.elev > 10)).toBe(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /decorate this room/i })).toBeEnabled());
    expect(relay.published).toEqual([]);
    // The scene ended, but the room is not seen until its build has played to its end in front of the player
    expect(seen()).not.toContain('rest');
    buildDone('rest');
    expect(seen()).toContain('rest');
    // Back and forth again: a room seen built comes back quickly, with no spectacle
    go(/living room/);
    await waitFor(() => expect(room()).toBe('home'), { timeout: 3000 });
    await waitFor(() => expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull(), { timeout: 5000 });
    const before = scene.state.scripts.length;
    randomly(0.9); // nothing theatrical
    go(/bedroom/);
    await waitFor(() => expect(room()).toBe('rest'), { timeout: 2000 });
    expect(scene.state.items[scene.state.items.length - 1]).toMatchObject({ key: 'rest', intro: 'quick' });
    await waitFor(() => expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull(), { timeout: 3000 });
    expect(scene.state.scripts.slice(before).some((s) => s && s.elev > 10)).toBe(false);
  }, 20_000);

  it('the first room is seen only once the scene says it was built; a build cut short (the next room before it is done) leaves the room unseen, so it builds next time', async () => {
    randomly(0.1);
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(room()).toBe('home');
    expect(scene.state.items[0]).toMatchObject({ key: 'home', intro: 'build' });
    await act(() => new Promise((r) => setTimeout(r, 1800)));
    // Time alone marks nothing
    expect(seen()).toEqual([]);
    buildDone('home');
    expect(seen()).toEqual(['home']);
    // Off to the bedroom, and on to the closet before the bedroom's build has played
    go(/bedroom/);
    await waitFor(() => expect(room()).toBe('rest'), { timeout: 3000 });
    go(/closet/);
    await waitFor(() => expect(room()).toBe('closet'), { timeout: 3000 });
    buildDone('closet');
    await waitFor(() => expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull(), { timeout: 5000 });
    expect(seen()).toEqual(['closet', 'home']);
    // The bedroom builds again on the next visit (its full introduction)
    go(/bedroom/);
    await waitFor(() => expect(scene.state.items[scene.state.items.length - 1]).toMatchObject({ key: 'rest', intro: 'build' }), { timeout: 5000 });
    expect(relay.published).toEqual([]);
  }, 20_000);

  it('a room seen built survives a reload: it is simply there, and the others still build', async () => {
    localStorage.setItem(roomIntroKey(PUBKEY, D), JSON.stringify({ rooms: ['home'] }));
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(scene.state.items[0]).toMatchObject({ key: 'home', intro: 'none' });
    randomly(0.1);
    go(/kitchen/);
    await waitFor(() => expect(room()).toBe('kitchen'), { timeout: 3000 });
    expect(scene.state.items[scene.state.items.length - 1]).toMatchObject({ key: 'kitchen', intro: 'build' });
  }, 15_000);

  it('a hurried player: the next room cuts the scene short and comes quickly; the Blobbi is never left scripted', async () => {
    randomly(0.1);
    renderRoom();
    await screen.findByTestId('room-bar');
    go(/bedroom/);
    await waitFor(() => expect(scene.state.scripts.length).toBeGreaterThan(0));
    // On to the next room before the jump has landed
    go(/closet/);
    await waitFor(() => expect(room()).toBe('closet'), { timeout: 2000 });
    await waitFor(() => expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull(), { timeout: 3000 });
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('a reload comes back to the last room, already built, the Blobbi where it last stood there', async () => {
    localStorage.setItem(roomNavKey(PUBKEY, D), JSON.stringify({ v: 1, room: 'kitchen', at: { kitchen: { x: 2.5, z: 6.5 } } }));
    localStorage.setItem(roomIntroKey(PUBKEY, D), JSON.stringify({ rooms: ['kitchen'] }));
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(room()).toBe('kitchen');
    expect(scene.state.items[0]).toMatchObject({ key: 'kitchen', intro: 'none', spawn: { x: 2.5, z: 6.5 } });
  });

  it('a corrupted memory is no harm: the living room, the middle, built', async () => {
    localStorage.setItem(roomNavKey(PUBKEY, D), '{"v":1,"room":"attic","at":{"kitchen":{"x":"far"}}');
    renderRoom();
    await screen.findByTestId('room-bar');
    expect(room()).toBe('home');
    expect(scene.state.items[0]).toMatchObject({ key: 'home', intro: 'build' });
  });

  it('leaving the room mid-scene lets the Blobbi go and leaves nothing running', async () => {
    randomly(0.1);
    const errors = vi.spyOn(console, 'error');
    spies.push(errors);
    const view = renderRoom();
    await screen.findByTestId('room-bar');
    go(/bedroom/);
    await waitFor(() => expect(scene.state.scripts.length).toBeGreaterThan(0));
    view.unmount();
    expect(scene.state.scripts[scene.state.scripts.length - 1]).toBeNull();
    const count = scene.state.scripts.length;
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(scene.state.scripts).toHaveLength(count);
    expect(errors).not.toHaveBeenCalled();
  });
});
