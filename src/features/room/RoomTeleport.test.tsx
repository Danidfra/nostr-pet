/**
 * The Blobbi's journeys in the real room (the development preview drives the
 * presence controller as a future coordinator would): the scene draws the
 * journey; while it travels nothing else happens (no items, no decorating,
 * no taps, no life); away, it is not in the room at all; back, it is the same
 * Blobbi with the same inventory; rapid triggers and cancel leave it
 * present; unmounting mid-journey leaves nothing running; none of it is
 * ever published.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

// The preview is a development tool behind the dev tools flag: on, for this suite
vi.hoisted(() => {
  (import.meta.env as Record<string, string>).VITE_BLOBBI_DEV_TOOLS = 'true';
});

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const scene = vi.hoisted(() => {
  const state = { journeys: [] as (string | null)[] };
  const fake = {
    pick: () => ({ kind: 'floor' as const, x: 3, z: 3 }),
    floorAt: () => ({ x: 3, z: 3 }),
    requestWalk: () => Promise.resolve('arrived' as const),
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
import { DEPART, ARRIVE } from '@/features/teleport/timeline';

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

const panel = async () => {
  fireEvent.click(await screen.findByTestId('teleport-dev-open'));
  return screen.getByTestId('teleport-dev');
};
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
  relay.published = [];
  scene.state.journeys = [];
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('the Blobbi\'s journeys in the room', () => {
  it('leaves and comes back: drawn by the scene, nothing else happening meanwhile, away for real, then the same Blobbi', async () => {
    renderRoom();
    await screen.findByTestId('room-bar');
    const item = await screen.findByTestId('room-item-use');
    const name = screen.getByTestId('room-header-name').textContent;
    const p = await panel();
    fireEvent.click(screen.getByTestId('teleport-dev-leave'));
    expect(p).toHaveAttribute('data-state', 'departing');
    expect(scene.state.journeys).toContain('depart');
    expect(screen.getByTestId('room-item-use')).toBeDisabled();
    expect(screen.getByRole('button', { name: /decorate this room/i })).toBeDisabled();
    await wait(DEPART.total + 150);
    expect(screen.getByTestId('teleport-dev')).toHaveAttribute('data-state', 'absent');
    // Away: not in the room at all
    expect(screen.queryByTestId('room-blobbi-anchor')).toBeNull();
    fireEvent.click(screen.getByTestId('teleport-dev-arrive'));
    expect(screen.getByTestId('teleport-dev')).toHaveAttribute('data-state', 'arriving');
    expect(scene.state.journeys[scene.state.journeys.length - 1]).toBe('arrive');
    await wait(ARRIVE.total + 150);
    expect(screen.getByTestId('teleport-dev')).toHaveAttribute('data-state', 'present');
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    // The same Blobbi, the same items, nothing written anywhere
    expect(screen.getByTestId('room-header-name').textContent).toBe(name);
    await waitFor(() => expect(screen.getByTestId('room-item-use')).toBeEnabled());
    expect(screen.getByTestId('room-item-use').getAttribute('aria-label')).toBe(item.getAttribute('aria-label'));
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('rapid triggers never stack, turning back mid-way is allowed, and cancel leaves it present at once', async () => {
    renderRoom();
    await screen.findByTestId('room-bar');
    await panel();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('teleport-dev-leave'));
      fireEvent.click(screen.getByTestId('teleport-dev-arrive'));
    }
    expect(screen.getByTestId('teleport-dev')).toHaveAttribute('data-state', 'arriving');
    fireEvent.click(screen.getByTestId('teleport-dev-cancel'));
    expect(screen.getByTestId('teleport-dev')).toHaveAttribute('data-state', 'present');
    expect(scene.state.journeys[scene.state.journeys.length - 1]).toBeNull();
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    await wait(300);
    expect(relay.published).toEqual([]);
  });

  it('leaving the room mid-journey leaves nothing running', async () => {
    const errors = vi.spyOn(console, 'error');
    const view = renderRoom();
    await screen.findByTestId('room-bar');
    await panel();
    fireEvent.click(screen.getByTestId('teleport-dev-leave'));
    view.unmount();
    await wait(DEPART.total + 200);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
