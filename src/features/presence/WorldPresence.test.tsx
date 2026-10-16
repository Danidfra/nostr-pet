/**
 * World presence in the Standalone's two homes, end to end through the real router: the Blobbi is away while the
 * player plays in Blobbi Pixel (a lease in the shared cookie, written here as Pixel would write it), departs with the
 * teleport's own journey when Pixel takes it, comes back when the player calls it (a press in the home) or when
 * Pixel's lease lapses, never leaves in the middle of the home's own moment, and nothing is published.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
    setActorJourney: (_id: string, j: { kind: string } | null) => {
      state.journeys.push(j ? j.kind : null);
    },
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
import { setWorldPresenceEnabled, PRESENCE_OFF_KEY } from './presence-switch';
import { cookieLeaseStore, cookieName } from './presence-page';
import { HOME_APP, LEASE_MS, PIXEL_APP, placeOf } from './world-presence';

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
  }),
} as unknown as NPool;

function renderAt(path: '/' | '/room') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>,
  );
}

/** Pixel takes the Blobbi, as its page would: a lease in the shared cookie. */
function pixelHasIt({ claimedAgo = 10_000, lastsFor = LEASE_MS - 10_000 } = {}) {
  const now = Date.now();
  cookieLeaseStore(PUBKEY).write({ app: PIXEL_APP, tab: 'pixeltab', at: now - claimedAgo, exp: now + lastsFor }, now);
}
const lease = () => cookieLeaseStore(PUBKEY).read();
const actor = () => screen.getByTestId('blobbi-actor');
const presenceOf = () => actor().getAttribute('data-presence');
const JOURNEY_WAIT = { timeout: 9_000 };

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  setWorldPresenceEnabled(true);
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
  relay.published = [];
  scene.state.journeys = [];
  localStorage.clear();
  window.localStorage.setItem('blobbi:home:3d-intro:v1', 'seen');
});
afterEach(() => {
  document.cookie = `${cookieName(PUBKEY)}=; max-age=0; path=/`;
  localStorage.clear();
});
afterAll(() => setWorldPresenceEnabled(false));

describe('the classic home', () => {
  it('a Blobbi playing in Pixel is away when the home opens: no departure, a word saying where, the care dock waiting', async () => {
    pixelHasIt();
    renderAt('/');
    await waitFor(() => expect(actor()).toBeInTheDocument());
    expect(presenceOf()).toBe('absent');
    const note = await screen.findByTestId('world-presence-away');
    expect(note).toHaveTextContent('Brook is playing in Blobbi Pixel');
    expect(note).toHaveTextContent('Brook comes home when you play here.');
    expect(screen.getByTestId('blobbi-poke')).toBeDisabled();
    expect(relay.published).toEqual([]);
  });

  it('calling it home claims the lease for the home and plays the arrival; nothing is published', async () => {
    pixelHasIt();
    renderAt('/');
    fireEvent.click(await screen.findByTestId('world-presence-call-home'));
    expect(lease()?.app).toBe(HOME_APP);
    await waitFor(() => expect(presenceOf()).toBe('arrive'));
    await waitFor(() => expect(presenceOf()).toBe('present'), JOURNEY_WAIT);
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook is back home!');
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('Pixel taking it while the home is open: the home sees it within a poll and departs gently, then says where it went', async () => {
    renderAt('/');
    await waitFor(() => expect(presenceOf()).toBe('present'));
    pixelHasIt({ claimedAgo: 0 });
    await waitFor(() => expect(presenceOf()).toBe('depart'), JOURNEY_WAIT);
    expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook hopped over to Blobbi Pixel!');
    await waitFor(() => expect(presenceOf()).toBe('absent'), JOURNEY_WAIT);
    expect(await screen.findByTestId('world-presence-away')).toHaveTextContent('Blobbi Pixel');
    expect(relay.published).toEqual([]);
  }, 20_000);

  it('a lease Pixel stops renewing lapses, and the Blobbi drifts home by itself', async () => {
    pixelHasIt({ claimedAgo: 40_000, lastsFor: 2_500 });
    renderAt('/');
    await waitFor(() => expect(presenceOf()).toBe('absent'));
    await waitFor(() => expect(presenceOf()).toBe('arrive'), JOURNEY_WAIT);
    await waitFor(() => expect(presenceOf()).toBe('present'), JOURNEY_WAIT);
    // The lease names its own end; the cookie's max-age (whole seconds) takes it out of the jar a moment later
    expect(placeOf(lease(), Date.now())).toBe(HOME_APP);
  }, 20_000);

  it('an egg never travels: it stays on its nest whatever the lease says', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Pip', stage: 'egg', state: 'active', visualGeneration: 'v3' })];
    pixelHasIt();
    renderAt('/');
    await waitFor(() => expect(actor()).toBeInTheDocument());
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
  });

  it('turned off for the browser: the cookie is not read and the Blobbi is home, as before', async () => {
    localStorage.setItem(PRESENCE_OFF_KEY, 'off');
    pixelHasIt();
    renderAt('/');
    await waitFor(() => expect(actor()).toBeInTheDocument());
    await act(() => new Promise((r) => setTimeout(r, 2_500)));
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
  });

  it('signed out: no presence at all', async () => {
    currentUser.user = undefined;
    pixelHasIt();
    renderAt('/');
    await act(() => new Promise((r) => setTimeout(r, 1_500)));
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
  });
});

describe('the 3D room', () => {
  it('away at entry: no arrival on entry, the word in the room; calling it home plays the arrival in the scene', async () => {
    pixelHasIt();
    renderAt('/room');
    const note = await screen.findByTestId('world-presence-away');
    expect(note).toHaveTextContent('Brook is playing in Blobbi Pixel');
    await act(() => new Promise((r) => setTimeout(r, 800)));
    expect(scene.state.journeys.filter(Boolean)).toEqual([]);
    fireEvent.click(screen.getByTestId('world-presence-call-home'));
    expect(lease()?.app).toBe(HOME_APP);
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'));
    await waitFor(() => expect(screen.queryByTestId('world-presence-away')).toBeNull());
    expect(relay.published).toEqual([]);
  }, 15_000);

  it('Pixel taking it while the room is open: the room plays its departure', async () => {
    renderAt('/room');
    await screen.findByTestId('room-dock-blobbi').catch(() => undefined);
    await act(() => new Promise((r) => setTimeout(r, 500)));
    pixelHasIt({ claimedAgo: 0 });
    await waitFor(() => expect(scene.state.journeys).toContain('depart'), JOURNEY_WAIT);
    expect(await screen.findByTestId('world-presence-away', undefined, JOURNEY_WAIT)).toBeInTheDocument();
  }, 20_000);
});
