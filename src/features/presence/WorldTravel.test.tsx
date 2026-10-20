/**
 * World travel on Nostr (M16) in the Standalone's two homes, end to end through the real router: the Blobbi's World
 * Location (kind 31126) on two in-memory relays (the ditto and primal urls, never a real socket) is the authority.
 * The account signs with a real key here (the kit checks every signature), as an nsec login (silent) or an extension
 * (it may prompt). Another device is played by writing its signed events straight to the relays.
 *
 * Revised 2026-10-19 (`world-travel-departure.ts`): opening the home is the player's intention to bring the Blobbi
 * here (one move per page load, once the place is confirmed), and choosing a world in the sheet moves it there from
 * here before the page goes. Nothing rides in a URL; no input moves the Blobbi.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { KIND_BLOBBI_STATE, KIND_WORLD_LOCATION, buildEggTags, buildPresenceTemplate, buildWorldLocationTemplate, parseWorldLocation, worldLocationStoreKey, type WorldLocation } from '@blobbi-kit/core';

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
import { setTravelMode, setTrustedInputCheck } from './travel-mode';
import { ACTIVE_PRESENCE_KEY } from './active-presence-choice';
import { useHomeTravel, useTravelStartsUnknown } from './useHomeTravel';
import { usePresence } from '@/features/teleport/react/usePresence';
import { setRoomArrivalEnabled } from '@/features/room/lib/room-arrival';
import { WORLD_ISLAND, worldById } from '@/features/worlds/worlds';
import { DEPARTURE } from '@/features/worlds/useWorldDeparture';
import { ARRIVAL_INTENT_TTL_MS, SIGN_PROMPT_TIMEOUT_MS } from './world-travel-departure';

// ─── The account (a real key) and its Blobbi ───
// A fresh key per test: each test is its own page, and the page's one arrival decision is kept per owner and Blobbi

let SK = generateSecretKey();
let PK = getPublicKey(SK);
const PET = '0000000001';
let D = `blobbi-${PK.slice(0, 12)}-${PET}`;
const T0 = 1_757_000_000;

function blobbi(o: { stage?: string; state?: string } = {}): NostrEvent {
  const tags = buildEggTags(PK, PET, T0, 'Brook', { visualGeneration: 'v3' }).map((t) => (t[0] === 'stage' ? ['stage', o.stage ?? 'adult'] : t[0] === 'state' ? ['state', o.state ?? 'active'] : t));
  return finalizeEvent({ kind: KIND_BLOBBI_STATE, created_at: T0, tags, content: '' }, SK) as NostrEvent;
}

// ─── Two in-memory relays at the travel urls ───

const URLS = ['wss://relay.ditto.pub', 'wss://relay.primal.net'];
interface FakeRelay {
  stored: NostrEvent[];
  refuse: boolean;
  /** Reads: answered this late (ms), failed outright, or never answered at all. */
  readDelay: number;
  readFails: boolean;
  readHangs: boolean;
  subs: Set<{ filters: NostrFilter[]; push: (m: unknown) => void }>;
  published: NostrEvent[];
}
const relays = new Map<string, FakeRelay>();
/** Reads and subscriptions that asked for a travel kind (31126 or 21124), on any relay. */
const travelAsks = { count: 0 };
const asksTravel = (filters: NostrFilter[]) => filters.some((f) => f.kinds?.some((k) => k === 31126 || k === 21124));
const base = { all: [] as NostrEvent[], poolEvents: [] as NostrEvent[] };

function matches(e: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(e.kind)) return false;
  if (f.authors && !f.authors.includes(e.pubkey)) return false;
  if (f.since !== undefined && e.created_at < f.since) return false;
  for (const [k, v] of Object.entries(f)) {
    if (!k.startsWith('#') || !Array.isArray(v)) continue;
    if (!e.tags.some((t) => t[0] === k.slice(1) && (v as string[]).includes(t[1]))) return false;
  }
  return true;
}
function accept(r: FakeRelay, e: NostrEvent): void {
  if (e.kind >= 30000 && e.kind < 40000) {
    const addr = (x: NostrEvent) => `${x.kind}:${x.pubkey}:${x.tags.find((t) => t[0] === 'd')?.[1]}`;
    const i = r.stored.findIndex((x) => addr(x) === addr(e));
    if (i >= 0 && (r.stored[i].created_at > e.created_at || (r.stored[i].created_at === e.created_at && r.stored[i].id <= e.id))) return;
    if (i >= 0) r.stored[i] = e;
    else r.stored.push(e);
  } else if (e.kind < 20000 || e.kind >= 30000) r.stored.push(e);
  // As on the wire: a plain copy (no library's cached "verified" mark travels with it)
  for (const s of r.subs) if (s.filters.some((f) => matches(e, f))) s.push(['EVENT', 'sub', structuredClone(e)]);
}
/** Another device's act: a signed event straight to every relay. */
function everywhere(e: NostrEvent) {
  for (const r of relays.values()) accept(r, e);
}
function remoteMove(world: string, atMs = Date.now(), latest: WorldLocation | null = newestLocation(), d = D): NostrEvent {
  const e = finalizeEvent(buildWorldLocationTemplate({ owner: PK, d, world, latest, now: atMs }), SK) as NostrEvent;
  everywhere(e);
  return e;
}
function newestLocation(d = D): WorldLocation | null {
  const all = [...relays.values()].flatMap((r) => r.stored).filter((e) => e.kind === 31126 && e.tags.some((t) => t[0] === 'd' && t[1] === d));
  return all.map((e) => parseWorldLocation(e)!).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))[0] ?? null;
}
/** The distinct events of a kind the page sent to any relay (accepted or refused). */
const sent = (kind: number) => [...new Set([...relays.values()].flatMap((r) => r.published).filter((e) => e.kind === kind).map((e) => e.id))];
/** The newest World Location the page published, parsed (the kit may also resend an older one to a lagging relay). */
const published = () =>
  [...relays.values()]
    .flatMap((r) => r.published)
    .filter((e) => e.kind === 31126)
    .map((e) => parseWorldLocation(e)!)
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))[0];

const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => base.all.filter((e) => filters.some((f) => matches(e, f)))),
  event: vi.fn(async (ev: NostrEvent) => {
    base.poolEvents.push(ev);
  }),
  relay: vi.fn((url: string) => {
    const r = relays.get(url);
    if (!r) throw new Error(`no relay ${url} in this test`);
    return {
      query: async (filters: NostrFilter[], opts?: { signal?: AbortSignal }) => {
        if (asksTravel(filters)) travelAsks.count++;
        if (r.readHangs) await new Promise<void>((res) => opts?.signal?.addEventListener('abort', () => res()));
        if (r.readDelay) await new Promise((res) => setTimeout(res, r.readDelay));
        if (r.readFails || r.readHangs) throw new Error('unreachable: test');
        return r.stored.filter((e) => filters.some((f) => matches(e, f))).map((e) => structuredClone(e));
      },
      event: async (e: NostrEvent) => {
        r.published.push(e);
        if (r.refuse) throw new Error('blocked: test');
        accept(r, structuredClone(e));
      },
      req: (filters: NostrFilter[], { signal }: { signal: AbortSignal }) => {
        if (asksTravel(filters)) travelAsks.count++;
        const queue: unknown[] = [['EOSE', 'sub']];
        let wake: (() => void) | null = null;
        let ended = false;
        const sub = { filters, push: (m: unknown) => (queue.push(m), wake?.()) };
        r.subs.add(sub);
        signal.addEventListener('abort', () => ((ended = true), wake?.()));
        return {
          async *[Symbol.asyncIterator]() {
            try {
              while (true) {
                if (queue.length) yield queue.shift();
                else if (ended) return;
                else await new Promise<void>((res) => (wake = res));
                wake = null;
              }
            } finally {
              r.subs.delete(sub);
            }
          },
        };
      },
    };
  }),
} as unknown as NPool;

// ─── The account's signer ───

/** `hang`: a prompt left open; `release` answers it late (the stale prompt approved after all). */
const signing = { refuse: false, hang: false, kinds: [] as number[], release: null as (() => void) | null };
const signer = {
  getPublicKey: async () => PK,
  signEvent: vi.fn(async (t: { kind: number; created_at: number; tags: string[][]; content: string }) => {
    signing.kinds.push(t.kind);
    if (t.kind === 31126 && signing.hang) {
      await new Promise<void>((resolve) => {
        signing.release = resolve;
      });
    }
    if (t.kind === 31126 && signing.refuse) throw new Error('user rejected');
    return finalizeEvent(t, SK);
  }),
};

function signIn(type: 'nsec' | 'extension') {
  currentUser.user = { pubkey: PK, signer };
  localStorage.setItem('test:login', JSON.stringify([{ id: `${type}:${PK}`, type, pubkey: PK, createdAt: new Date().toISOString(), data: type === 'nsec' ? { nsec: 'unused-the-user-is-mocked' } : null }]));
}

function app(path: '/' | '/room', client: QueryClient) {
  return (
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>
  );
}

function renderAt(path: '/' | '/room' = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(app(path, client));
  return { ...view, again: () => view.rerender(app(path, client)) };
}

const actor = () => screen.getByTestId('blobbi-actor');
const presenceOf = () => actor().getAttribute('data-presence');
const status = () => screen.getByTestId('world-travel-status');
const WAIT = { timeout: 9_000 };
/** A press of the player's (trusted, by this suite's word) on an element. */
const press = (el: Element | Window = document.body) => fireEvent.pointerDown(el);
const pause = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
/** Things that are not the player's intention: re-renders, a focus, a visibility change, presses. */
function noise(view: { again: () => void }) {
  for (let i = 0; i < 3; i++) view.again();
  act(() => void window.dispatchEvent(new Event('focus')));
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
  press();
  press();
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
  setTravelMode('nostr');
  setTrustedInputCheck(() => true);
});
afterAll(() => {
  setTravelMode('off');
  setTrustedInputCheck(null);
});
beforeEach(() => {
  SK = generateSecretKey();
  PK = getPublicKey(SK);
  D = `blobbi-${PK.slice(0, 12)}-${PET}`;
  localStorage.clear();
  window.localStorage.setItem('blobbi:home:3d-intro:v1', 'seen');
  relays.clear();
  for (const url of URLS) relays.set(url, { stored: [], refuse: false, readDelay: 0, readFails: false, readHangs: false, subs: new Set(), published: [] });
  base.all = [blobbi()];
  base.poolEvents = [];
  signing.refuse = false;
  signing.hang = false;
  signing.kinds = [];
  signing.release = null;
  travelAsks.count = 0;
  signer.signEvent.mockClear();
  scene.state.journeys = [];
  signIn('nsec');
});
afterEach(() => {
  localStorage.clear();
});

/** The journeys the classic home's actor went through (its data-presence over time). */
function watchActor(): string[] {
  const seen: string[] = [];
  const obs = new MutationObserver(() => {
    const el = document.querySelector('[data-testid="blobbi-actor"]');
    const v = el?.getAttribute('data-presence');
    if (v && seen.at(-1) !== v) seen.push(v);
  });
  obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-presence'], childList: true });
  return seen;
}

/** A wrapper for the hook alone, with this suite's relays and login. */
function hookWrapper() {
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>
  );
}

describe('the classic home, on Nostr', () => {
  it('away in Pixel at load: shown away first (no departure replayed), then opening the home brings it here with one World Location naming home, and the arrival plays', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    const seen = watchActor();
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'));
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel', owner: PK, d: D });
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    // Never shown home before its arrival, and nothing replayed as a departure
    expect(seen).not.toContain('depart');
    expect(seen.filter((s) => s === 'arrive')).toHaveLength(1);
    expect(seen.indexOf('present')).toBeGreaterThan(seen.indexOf('arrive'));
    expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook is back home!');
    expect(status()).toHaveAttribute('data-travel-here', 'true');
    expect(status()).toHaveAttribute('data-travel-change', expect.stringMatching(/^live:/));
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    // Already home: presses publish nothing more
    press();
    press();
    await pause(300);
    expect(sent(31126)).toHaveLength(1);
    // Nothing went to the app's general pool (which writes to every application relay) for travel
    expect(base.poolEvents.filter((e) => e.kind === 31126 || e.kind === 21124)).toEqual([]);
  }, 20_000);

  it('already home (no location at all, or one naming home): nothing is signed on load, on presses or on re-renders', async () => {
    const view = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    expect(presenceOf()).toBe('present');
    noise(view);
    expect(presenceOf()).toBe('present');
    await pause(400);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(sent(31126)).toEqual([]);
    view.unmount();
    remoteMove('blobbi-home', Date.now() - 60_000);
    const again = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'));
    noise(again);
    await pause(400);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(sent(31126)).toEqual([]);
  });

  it('the signer refusing on opening: said so, nothing published, and the page never asks again by itself; Try again (the player asking) publishes one', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    signIn('extension');
    signing.refuse = true;
    const view = renderAt('/');
    await waitFor(() => expect(screen.getByTestId('world-presence-detail')).toHaveTextContent('did not approve'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toEqual([]);
    expect(presenceOf()).toBe('absent');
    noise(view);
    await pause(1_200);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    signing.refuse = false;
    fireEvent.click(screen.getByTestId('world-travel-retry'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(2);
    expect(sent(31126)).toHaveLength(1);
    expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel' });
  }, 20_000);

  it('a signer that never answers: the card waits on it, nothing is published, and nothing else is asked; after a minute the move is declined (the retry offered), a late approval is dropped, and Call home publishes one event and one arrival', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    signIn('extension');
    signing.hang = true;
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    try {
      const seen = watchActor();
      const view = renderAt('/');
      await waitFor(() => expect(status()).toHaveAttribute('data-travel-phase', 'signing'), WAIT);
      expect(screen.getByTestId('world-presence-detail')).toHaveTextContent('Approve in your signer');
      noise(view);
      await pause(1_500);
      expect(signer.signEvent).toHaveBeenCalledTimes(1);
      expect(sent(31126)).toEqual([]);
      expect(presenceOf()).toBe('absent');
      // The prompt left open a minute (`boundedSigner`): the kit's move ends as declined; nothing was published
      await act(() => vi.advanceTimersByTimeAsync(SIGN_PROMPT_TIMEOUT_MS));
      await waitFor(() => expect(status()).toHaveAttribute('data-travel-reason', 'declined'), WAIT);
      expect(screen.getByTestId('world-presence-detail')).toHaveTextContent('did not approve');
      expect(sent(31126)).toEqual([]);
      expect(presenceOf()).toBe('absent');
      // The stale prompt approved now: dropped by the wrapper, never published, nothing moves
      expect(signing.release).not.toBeNull();
      act(() => signing.release?.());
      await pause(800);
      expect(sent(31126)).toEqual([]);
      expect(presenceOf()).toBe('absent');
      expect(status()).toHaveAttribute('data-travel-reason', 'declined');
      // Call home (the retry): a signature of its own, one event, one arrival
      signing.hang = false;
      fireEvent.click(screen.getByTestId('world-travel-retry'));
      await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
      expect(signer.signEvent).toHaveBeenCalledTimes(2);
      expect(sent(31126)).toHaveLength(1);
      expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel' });
      await pause(300);
      expect(seen.filter((s) => s === 'arrive')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  }, 30_000);

  it('no relay accepting on opening: said so; Try again sends the same signed event (no second signature)', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    for (const r of relays.values()) r.refuse = true;
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('world-presence-detail')).toHaveTextContent("Couldn't reach"), WAIT);
    expect(status()).toHaveAttribute('data-travel-reason', 'unreachable');
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(newestLocation()?.world).toBe('blobbi-pixel');
    for (const r of relays.values()) r.refuse = false;
    fireEvent.click(screen.getByTestId('world-travel-retry'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toHaveLength(1);
    expect(newestLocation()?.world).toBe('blobbi-home');
  }, 20_000);

  it('a reload during a move: the signed move is sent on load, with no new signature', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    for (const r of relays.values()) r.refuse = true;
    const first = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-reason', 'unreachable'), WAIT);
    first.unmount();
    for (const r of relays.values()) r.refuse = false;
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-home'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(newestLocation()?.world).toBe('blobbi-home');
  }, 20_000);

  it('another device taking it to Pixel: the home departs live, says where it went, and never pulls it back by itself', async () => {
    const view = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await pause(1_600); // the page has been visible past the grace
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(presenceOf()).toBe('depart'), WAIT);
    expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook hopped over to Blobbi Pixel!');
    await waitFor(() => expect(presenceOf()).toBe('absent'), WAIT);
    expect(await screen.findByTestId('world-presence-away')).toHaveTextContent('Blobbi Pixel');
    // This page already decided on opening (it was home): nothing automatic now, however the page is poked
    noise(view);
    await pause(1_500);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(presenceOf()).toBe('absent');
    expect(screen.getByTestId('world-presence-call-home')).toBeInTheDocument();
  }, 20_000);

  it('a departure waits for the home’s own moment (care in flight, a bath, a ceremony), then plays', async () => {
    const { result, rerender } = renderHook(
      ({ busy }) => {
        const presence = usePresence();
        const travel = useHomeTravel({ pubkey: PK, d: D, travels: true, presence, busy, paused: false });
        return { presence, travel };
      },
      { wrapper: hookWrapper(), initialProps: { busy: false } },
    );
    await waitFor(() => expect(result.current.travel.snapshot?.status).toBe('ready'));
    await pause(1_600);
    rerender({ busy: true });
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(result.current.travel.place).toBe('blobbi-pixel'));
    await pause(1_500);
    expect(result.current.presence.state).toBe('present');
    rerender({ busy: false });
    await waitFor(() => expect(result.current.presence.state).toBe('departing'), WAIT);
  }, 20_000);

  it('an egg and a sleeper stay home whatever the location says, and opening the home never moves them', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    base.all = [blobbi({ stage: 'egg' })];
    const egg = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'));
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel');
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    press();
    await pause(500);
    egg.unmount();
    base.all = [blobbi({ state: 'sleeping' })];
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'));
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel');
    expect(presenceOf()).toBe('present');
    press();
    await pause(500);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(sent(31126)).toEqual([]);
  });

  it('relays disagreeing: the newest valid location wins, whichever relay holds it, and the opening’s move follows it (`prev`, `from`)', async () => {
    const older = finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-home', latest: null, now: Date.now() - 120_000 }), SK) as NostrEvent;
    const newer = finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-pixel', latest: parseWorldLocation(older), now: Date.now() - 60_000 }), SK) as NostrEvent;
    accept(relays.get(URLS[0])!, older);
    accept(relays.get(URLS[1])!, newer);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-here', 'true'), WAIT);
    // The page's own move (the kit may also have healed the lagging relay with the newer event: not a move)
    expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel', prev: newer.id });
    expect(sent(31126).filter((id) => id !== newer.id)).toHaveLength(1);
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-home');
    // A forged event naming Pixel (a bad signature) changes nothing
    act(() => everywhere({ ...newer, created_at: Math.floor(Date.now() / 1000) + 5, sig: '0'.repeat(128) }));
    await pause(300);
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-home');
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('an extension signer is never asked on load, on re-renders or by the presence timer while the Blobbi is home, even with presence on', async () => {
    signIn('extension');
    localStorage.setItem(ACTIVE_PRESENCE_KEY(PK), 'on');
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-presence-status', 'on'));
    await pause(1_500);
    expect(signer.signEvent).not.toHaveBeenCalled();
    // The first real input may ask once (the player is here); a fast answer lets presence go on
    press();
    await waitFor(() => expect(signing.kinds).toEqual([21124]));
  });

  it('Active Presence is off by default; turned on, a short-lived 21124 is sent only once the player plays here', async () => {
    const view = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    press();
    await pause(400);
    expect(sent(21124)).toEqual([]);
    expect(status()).toHaveAttribute('data-presence-status', 'off');
    view.unmount();
    localStorage.setItem(ACTIVE_PRESENCE_KEY(PK), 'on');
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-presence-status', 'on'));
    await pause(300);
    expect(sent(21124)).toEqual([]); // no input yet
    press();
    await waitFor(() => expect(sent(21124)).toHaveLength(1));
    const p = relays.get(URLS[0])!.published.find((e) => e.kind === 21124)!;
    expect(p.tags).toContainEqual(['world', 'blobbi-home']);
    expect(Number(p.tags.find((t) => t[0] === 'expiration')![1]) - p.created_at).toBe(120);
    // Presence never wrote a location
    expect(sent(31126)).toEqual([]);
  });

  it('the account sheet offers the presence choice (a setting, never a travel press)', async () => {
    const { activePresenceOn, setActivePresence } = await import('./active-presence-choice');
    expect(activePresenceOn(PK)).toBe(false);
    setActivePresence(PK, true);
    expect(localStorage.getItem(ACTIVE_PRESENCE_KEY(PK))).toBe('on');
    setActivePresence(PK, false);
    expect(activePresenceOn(PK)).toBe(false);
  });

  it('played in Pixel right now: the opening’s move says "on the way home" and its arrival waits Pixel’s departure window', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    everywhere(finalizeEvent(buildPresenceTemplate({ owner: PK, d: D, world: 'blobbi-pixel', now: Date.now() }), SK) as NostrEvent);
    renderAt('/');
    await waitFor(() => expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook is on the way home…'), WAIT);
    expect(status()).toHaveAttribute('data-travel-phase', 'arriving');
    expect(presenceOf()).toBe('absent');
    await waitFor(() => expect(presenceOf()).toBe('arrive'), WAIT);
    expect(sent(31126)).toHaveLength(1);
  }, 20_000);

  it('signed out or a guest: no session at all, the Blobbi home, nothing read from the travel relays', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    currentUser.user = undefined;
    localStorage.removeItem('test:login');
    renderAt('/');
    await pause(1_000);
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(travelAsks.count).toBe(0);
  });

  it('the place is only ever the World Location: nothing about it is kept in a cookie', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(sent(31126)).toHaveLength(1);
    expect(document.cookie).not.toMatch(/blobbi/i);
  }, 20_000);
});

describe('world travel off (the default build)', () => {
  beforeEach(() => setTravelMode('off'));
  afterEach(() => setTravelMode('nostr'));

  for (const path of ['/', '/room'] as const) {
    it(`${path === '/' ? 'the classic home' : 'the 3D room'}: the Blobbi is home whatever the relays say; no travel read, no signature, no cookie`, async () => {
      remoteMove('blobbi-pixel', Date.now() - 60_000);
      const view = renderAt(path);
      if (path === '/') await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
      else await screen.findByTestId('room-preview', undefined, WAIT);
      noise(view);
      await pause(600);
      expect(screen.queryByTestId('world-presence-away')).toBeNull();
      expect(screen.queryByTestId('world-travel-looking')).toBeNull();
      expect(screen.queryByTestId('world-travel-status')).toBeNull();
      if (path === '/') expect(presenceOf()).toBe('present');
      expect(travelAsks.count).toBe(0);
      expect(signer.signEvent).not.toHaveBeenCalled();
      expect(sent(31126)).toEqual([]);
      expect(sent(21124)).toEqual([]);
      expect(base.poolEvents.filter((e) => e.kind === 31126 || e.kind === 21124)).toEqual([]);
      expect(document.cookie).not.toMatch(/blobbi/i);
    }, 20_000);
  }

  it('a signed location kept on this device from an earlier session is not read: the Blobbi starts home', async () => {
    localStorage.setItem(worldLocationStoreKey(PK, D), JSON.stringify(remoteMove('blobbi-pixel', Date.now() - 60_000)));
    renderAt('/');
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    await pause(300);
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(travelAsks.count).toBe(0);
  });

  it('leaving for the Island with travel off: the page goes to the plain address and nothing is signed or published', async () => {
    const originalLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...originalLocation, assign }, writable: true, configurable: true });
    try {
      renderAt('/');
      await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
      fireEvent.click(screen.getByTestId('menu-button'));
      fireEvent.click(await screen.findByTestId('menu-worlds'));
      fireEvent.click(await screen.findByTestId('world-island'));
      await waitFor(() => expect(assign).toHaveBeenCalledWith(worldById('island')!.url), WAIT);
      expect(signer.signEvent).not.toHaveBeenCalled();
      expect(sent(31126)).toEqual([]);
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    }
  }, 20_000);
});

describe('the 3D room, on Nostr', () => {
  it('away at entry: no arrival on entry; opening the room brings it here, and the room plays the arrival in the scene', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/room');
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel' });
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'), WAIT);
    await waitFor(() => expect(screen.queryByTestId('world-presence-away')).toBeNull());
    expect(scene.state.journeys.filter((j) => j === 'arrive')).toHaveLength(1);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('another device taking it while the room is open: the room plays its departure, and nothing pulls it back', async () => {
    renderAt('/room');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'), WAIT);
    await pause(1_600);
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(scene.state.journeys).toContain('depart'), WAIT);
    expect(await screen.findByTestId('world-presence-away', undefined, WAIT)).toBeInTheDocument();
    await pause(1_000);
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);
});

describe('opening the home brings it here: once per page (2026-10-19)', () => {
  it('direct opening with the Blobbi in the Island: one World Location naming home after the first confirmed answer; re-renders, a relay update, a focus and visibility toggles publish no second one', async () => {
    remoteMove(WORLD_ISLAND, Date.now() - 60_000);
    const view = renderAt('/');
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    expect(published()).toMatchObject({ world: 'blobbi-home', from: WORLD_ISLAND, owner: PK, d: D });
    expect(signing.kinds).toEqual([KIND_WORLD_LOCATION]);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    noise(view);
    // A relay update that is not a move (a presence note from the Island), and a look again
    act(() => everywhere(finalizeEvent(buildPresenceTemplate({ owner: PK, d: D, world: WORLD_ISLAND, now: Date.now() }), SK) as NostrEvent));
    await pause(1_500);
    expect(sent(31126)).toHaveLength(1);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('the hook refreshed, re-rendered, unmounted and mounted again: the page’s one decision stands; a Blobbi switch gets its own, once', async () => {
    const D2 = `blobbi-${PK.slice(0, 12)}-0000000002`;
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    remoteMove('blobbi-pixel', Date.now() - 60_000, null, D2);
    const first = renderHook(
      ({ d }) => {
        const presence = usePresence();
        return useHomeTravel({ pubkey: PK, d, travels: true, presence, busy: false, paused: false });
      },
      { wrapper: hookWrapper(), initialProps: { d: D } },
    );
    await waitFor(() => expect(first.result.current.place).toBe('blobbi-home'), WAIT);
    expect(sent(31126)).toHaveLength(1);
    act(() => first.result.current.refresh());
    first.rerender({ d: D });
    await pause(600);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    // Another Blobbi of the account, also away: its own one move
    first.rerender({ d: D2 });
    await waitFor(() => expect(first.result.current.snapshot?.d).toBe(D2), WAIT);
    await waitFor(() => expect(sent(31126)).toHaveLength(2), WAIT);
    expect(newestLocation(D2)?.world).toBe('blobbi-home');
    // Back to the first, and the hook mounted anew: nothing more (the page already decided for both)
    first.rerender({ d: D });
    await waitFor(() => expect(first.result.current.snapshot?.d).toBe(D), WAIT);
    first.unmount();
    const second = renderHook(
      () => {
        const presence = usePresence();
        return useHomeTravel({ pubkey: PK, d: D, travels: true, presence, busy: false, paused: false });
      },
      { wrapper: hookWrapper() },
    );
    await waitFor(() => expect(second.result.current.resolution).toBe('confirmed'), WAIT);
    // Even taken away again meanwhile: this page never reclaims it by itself
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(second.result.current.place).toBe('blobbi-pixel'), WAIT);
    await pause(1_000);
    expect(signer.signEvent).toHaveBeenCalledTimes(2);
    expect(sent(31126)).toHaveLength(2);
    // Call home is the player asking: it moves
    act(() => second.result.current.callHome());
    await waitFor(() => expect(second.result.current.place).toBe('blobbi-home'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(3);
  }, 30_000);

  it('an old page (shown later than ARRIVAL_INTENT_TTL_MS after its navigation start, as a background tab is) moves nothing by itself: nothing signed or published when the place confirms or on visibility changes; Call home still publishes one', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    const realNow = performance.now.bind(performance);
    const now = vi.spyOn(performance, 'now').mockImplementation(() => realNow() + ARRIVAL_INTENT_TTL_MS + 1);
    try {
      const view = renderAt('/');
      await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
      noise(view);
      await pause(1_500);
      expect(signer.signEvent).not.toHaveBeenCalled();
      expect(sent(31126)).toEqual([]);
      expect(presenceOf()).toBe('absent');
      expect(status()).toHaveAttribute('data-travel-phase', 'idle');
      // The player's own word still moves it, once
      fireEvent.click(screen.getByTestId('world-presence-call-home'));
      await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
      expect(signer.signEvent).toHaveBeenCalledTimes(1);
      expect(sent(31126)).toHaveLength(1);
      expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel' });
    } finally {
      now.mockRestore();
    }
  }, 20_000);

  it('a tab opened hidden moves nothing until it is first seen; then once', async () => {
    let visibility: DocumentVisibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    try {
      remoteMove('blobbi-pixel', Date.now() - 60_000);
      renderAt('/');
      await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
      expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel');
      await pause(1_200);
      expect(signer.signEvent).not.toHaveBeenCalled();
      expect(sent(31126)).toEqual([]);
      visibility = 'visible';
      act(() => void document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
      expect(published()).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel' });
      await waitFor(() => expect(status()).toHaveAttribute('data-travel-here', 'true'), WAIT);
      // Hidden and shown again: nothing more
      visibility = 'hidden';
      act(() => void document.dispatchEvent(new Event('visibilitychange')));
      visibility = 'visible';
      act(() => void document.dispatchEvent(new Event('visibilitychange')));
      await pause(800);
      expect(signer.signEvent).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as unknown as { visibilityState?: unknown }).visibilityState;
    }
  }, 20_000);

  it('unreachable relays on opening: nothing is signed; once they answer, this page still moves nothing by itself, and Call home works', async () => {
    for (const r of relays.values()) r.readFails = true;
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'unreachable'), WAIT);
    expect(signer.signEvent).not.toHaveBeenCalled();
    for (const r of relays.values()) r.readFails = false;
    fireEvent.click(screen.getByTestId('world-travel-refresh'));
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'), WAIT);
    await pause(1_000);
    expect(signer.signEvent).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('world-presence-call-home', undefined, WAIT));
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
  }, 20_000);
});

describe('loading: where it is, before the relays answer (M16.1)', () => {
  const slow = (ms: number) => {
    for (const r of relays.values()) r.readDelay = ms;
  };

  it('a fresh device, the Blobbi in Pixel: never shown home meanwhile, "looking for it", then the opening’s move and its arrival', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    slow(700);
    const seen = watchActor();
    renderAt('/');
    await screen.findByTestId('blobbi-actor');
    expect(seen[0] ?? presenceOf()).toBe('absent');
    expect(screen.getByTestId('world-travel-looking')).toHaveTextContent('Looking for Brook…');
    expect(status()).toHaveAttribute('data-travel-resolution', 'pending');
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(screen.getByTestId('blobbi-poke')).toBeDisabled();
    expect(signer.signEvent).not.toHaveBeenCalled();
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(seen).not.toContain('depart');
    expect(seen.indexOf('present')).toBeGreaterThan(seen.indexOf('arrive'));
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('a fresh device, the Blobbi home: looking, then it appears (settled, no arrival replayed)', async () => {
    remoteMove('blobbi-home', Date.now() - 3_600_000);
    slow(500);
    const seen = watchActor();
    renderAt('/');
    await screen.findByTestId('blobbi-actor');
    expect(seen[0] ?? presenceOf()).toBe('absent');
    expect(screen.getByTestId('world-travel-looking')).toBeInTheDocument();
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(seen).not.toContain('arrive');
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(screen.getByTestId('blobbi-poke')).not.toBeDisabled();
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('a fresh device, no location anywhere (it never travelled): home, with no journey', async () => {
    slow(300);
    const seen = watchActor();
    renderAt('/');
    await screen.findByTestId('blobbi-actor');
    expect(seen[0] ?? presenceOf()).toBe('absent');
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed');
    expect(seen).not.toContain('arrive');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('no relay answering: home by default, said honestly with a way to look again; never stuck looking', async () => {
    for (const r of relays.values()) r.readFails = true;
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'unreachable'), WAIT);
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    expect(screen.getByTestId('world-travel-unreachable')).toHaveTextContent("Couldn't reach the Blobbi relays");
    // The relays back: looking again finds it in Pixel (a live answer now: it leaves as a journey would)
    for (const r of relays.values()) r.readFails = false;
    fireEvent.click(screen.getByTestId('world-travel-refresh'));
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel');
    expect(screen.queryByTestId('world-travel-unreachable')).toBeNull();
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);

  it('relays that never answer: the look ends at the timeout (about 4 s), the Blobbi home', async () => {
    for (const r of relays.values()) r.readHangs = true;
    renderAt('/');
    expect(await screen.findByTestId('world-travel-looking')).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'unreachable'), WAIT);
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    expect(screen.getByTestId('world-travel-unreachable')).toBeInTheDocument();
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);

  it('a reload with a signed location kept on this device: shown away at once (no looking), nothing signed until confirmed, then the opening’s move', async () => {
    const e = remoteMove('blobbi-pixel', Date.now() - 60_000);
    localStorage.setItem(worldLocationStoreKey(PK, D), JSON.stringify(e));
    slow(600);
    const seen = watchActor();
    renderAt('/');
    await screen.findByTestId('blobbi-actor');
    expect(seen[0] ?? presenceOf()).toBe('absent');
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    expect(await screen.findByTestId('world-presence-away')).toHaveTextContent('Blobbi Pixel');
    expect(status()).toHaveAttribute('data-travel-resolution', 'cached');
    expect(signer.signEvent).not.toHaveBeenCalled();
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(seen.indexOf('present')).toBeGreaterThan(seen.indexOf('arrive'));
  }, 20_000);

  it('presses while looking sign nothing; the opening’s move waits for the answer', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    slow(2_800);
    renderAt('/');
    await screen.findByTestId('world-travel-status', undefined, WAIT);
    press();
    press();
    press();
    await pause(300);
    expect(status()).toHaveAttribute('data-travel-resolution', 'pending');
    expect(signer.signEvent).not.toHaveBeenCalled();
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('only a session that is coming starts unknown: never a signed-out page (or a guest), never with a kept location', async () => {
    const { result, rerender } = renderHook(({ pk }) => useTravelStartsUnknown(pk, D), { wrapper: hookWrapper(), initialProps: { pk: PK as string | undefined } });
    await waitFor(() => expect(result.current).toBe(true));
    const out = renderHook(() => useTravelStartsUnknown(undefined, D), { wrapper: hookWrapper() });
    await waitFor(() => expect(out.result.current).toBe(false));
    currentUser.user = undefined;
    const signedOut = renderHook(() => useTravelStartsUnknown(PK, D), { wrapper: hookWrapper() });
    await waitFor(() => expect(signedOut.result.current).toBe(false));
    signIn('nsec');
    localStorage.setItem(worldLocationStoreKey(PK, D), JSON.stringify(remoteMove('blobbi-pixel', Date.now() - 60_000)));
    const kept = renderHook(() => useTravelStartsUnknown(PK, D), { wrapper: hookWrapper() });
    await waitFor(() => expect(kept.result.current).toBe(false));
    // Read once: a re-render never changes the start
    rerender({ pk: PK });
    expect(result.current).toBe(true);
    // Travel off: never
    setTravelMode('off');
    try {
      const off = renderHook(() => useTravelStartsUnknown(PK, `${D}x`), { wrapper: hookWrapper() });
      await waitFor(() => expect(off.result.current).toBe(false));
    } finally {
      setTravelMode('nostr');
    }
  });

  it('the 3D room on a fresh device: looking where it stands, no journey until the answer; then the opening’s move and the room’s arrival', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    slow(2_500);
    renderAt('/room');
    // The room's page loads first (a chunk of its own)
    expect(await screen.findByTestId('world-travel-looking', undefined, WAIT)).toHaveTextContent('Looking for Brook…');
    expect(screen.getByTestId('room-blobbi-cue')).toBeInTheDocument();
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(scene.state.journeys.filter(Boolean)).toEqual([]);
    expect(signer.signEvent).not.toHaveBeenCalled();
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'), WAIT);
    expect(scene.state.journeys.filter(Boolean)).toEqual(['arrive']);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('a11y (M16.2): the room says "Looking for Brook…" in a live region no aria-hidden layer covers, then the call home, then that it is here, once each', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    slow(2_500);
    renderAt('/room');
    const region = await screen.findByTestId('world-travel-announcer', undefined, WAIT);
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region.closest('[aria-hidden="true"]')).toBeNull();
    await waitFor(() => expect(region).toHaveTextContent('Looking for Brook…'), WAIT);
    // The visual cue is decoration only (it sits in the room's aria-hidden 3D layer)
    expect(screen.getByTestId('world-travel-looking').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('status', { name: /Looking for/ })).toBeNull();
    const said: string[] = [];
    const watch = new MutationObserver(() => said.push(region.textContent ?? ''));
    watch.observe(region, { childList: true, characterData: true, subtree: true });
    await waitFor(() => expect(region).toHaveTextContent('Brook is here.'), WAIT);
    expect(said).toContain('Calling Brook home…');
    const before = said.length;
    await pause(1_500);
    watch.disconnect();
    expect(said.slice(before)).toEqual([]); // nothing repeated while nothing changes
  }, 20_000);

  it('a11y (M16.2): the classic home on a quick load says nothing, and its live region is outside any aria-hidden layer', async () => {
    renderAt('/');
    const region = await screen.findByTestId('world-travel-announcer', undefined, WAIT);
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    expect(region).toHaveTextContent(/^$/);
    expect(region.closest('[aria-hidden="true"]')).toBeNull();
  }, 20_000);

  it('the 3D room on a fresh device, the Blobbi home: looking, then the room’s own entry arrival (once)', async () => {
    setRoomArrivalEnabled(true);
    try {
      slow(1_500);
      renderAt('/room');
      expect(await screen.findByTestId('world-travel-looking', undefined, WAIT)).toBeInTheDocument();
      expect(scene.state.journeys).not.toContain('arrive');
      await waitFor(() => expect(scene.state.journeys).toContain('arrive'), WAIT);
      expect(screen.queryByTestId('world-travel-looking')).toBeNull();
      await pause(3_000);
      expect(scene.state.journeys.filter((j) => j === 'arrive')).toHaveLength(1);
      expect(signer.signEvent).not.toHaveBeenCalled();
    } finally {
      setRoomArrivalEnabled(false);
    }
  }, 20_000);

  it('the 3D room on a fresh device without the entry arrival: never shown home before the answer; the only journey is the opening’s arrival', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    slow(1_500);
    renderAt('/room');
    expect(await screen.findByTestId('world-travel-looking', undefined, WAIT)).toBeInTheDocument();
    expect(scene.state.journeys.filter(Boolean)).toEqual([]);
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'), WAIT);
    expect(scene.state.journeys.filter(Boolean)).toEqual(['arrive']);
  }, 20_000);
});

describe('one sequence: the call, then the arrival (M16.1)', () => {
  it('a move here shows the calling cue where it stands until the arrival starts; the body forms the teleport’s lead later', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    // Played in Pixel right now: the arrival waits Pixel's departure window
    everywhere(finalizeEvent(buildPresenceTemplate({ owner: PK, d: D, world: 'blobbi-pixel', now: Date.now() }), SK) as NostrEvent);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-phase', 'arriving'), WAIT);
    expect(screen.getByTestId('world-travel-coming')).toBeInTheDocument();
    expect(status()).toHaveAttribute('data-travel-view', 'coming');
    const at = Number(status().getAttribute('data-travel-at'));
    const formAt = Number(status().getAttribute('data-travel-form-at'));
    expect(formAt - at).toBe(550);
    await waitFor(() => expect(presenceOf()).toBe('arrive'), WAIT);
    expect(screen.queryByTestId('world-travel-coming')).toBeNull();
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    // One arrival, no loop
    await pause(500);
    expect(presenceOf()).toBe('present');
    expect(sent(31126)).toHaveLength(1);
  }, 20_000);
});

// ─── Leaving for another world: the origin moves the Blobbi there, then the page goes (2026-10-19) ───

describe('leaving for another world (the Worlds sheet)', () => {
  const originalLocation = window.location;
  let assign: ReturnType<typeof vi.fn>;
  /** How many World Locations had been sent at the moment the page was asked to go. */
  let sentAtAssign = -1;
  beforeEach(() => {
    sentAtAssign = -1;
    assign = vi.fn(() => {
      sentAtAssign = sent(31126).length;
    });
    Object.defineProperty(window, 'location', { value: { ...originalLocation, assign }, writable: true, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  async function openIsland() {
    fireEvent.click(screen.getByTestId('menu-button'));
    fireEvent.click(await screen.findByTestId('menu-worlds'));
    fireEvent.click(await screen.findByTestId('world-island'));
  }
  /** The departure card's phases as they came, each with what the signer had been asked and what had been sent by then. */
  function watchCard(): { phase: string; signed: number; sent: number }[] {
    const seen: { phase: string; signed: number; sent: number }[] = [];
    const obs = new MutationObserver(() => {
      const phase = document.querySelector('[data-testid="departure-card"]')?.getAttribute('data-phase');
      if (phase && seen.at(-1)?.phase !== phase) seen.push({ phase, signed: signer.signEvent.mock.calls.length, sent: sent(31126).length });
    });
    obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-phase'], childList: true });
    return seen;
  }
  async function homeReady() {
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
  }

  it.each([['noticing'], ['leaving']])('Stay during the goodbye (while %s): no signer prompt, nothing published, no navigation, the Blobbi back home', async (phase) => {
    signIn('extension');
    remoteMove('blobbi-home', Date.now() - 60_000);
    renderAt('/');
    await homeReady();
    await openIsland();
    const card = await screen.findByTestId('departure-card');
    expect(card).toHaveTextContent('Brook is off to Blobbi Island');
    await waitFor(() => expect(card).toHaveAttribute('data-phase', phase), WAIT);
    fireEvent.click(screen.getByTestId('departure-stay'));
    expect(screen.queryByTestId('departure-card')).toBeNull();
    await pause(DEPARTURE.noticeMs + DEPARTURE.waveMs + 1_500);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(sent(31126)).toEqual([]);
    expect(assign).not.toHaveBeenCalled();
    expect(presenceOf()).toBe('present');
    expect(newestLocation()?.world).toBe('blobbi-home');
  }, 20_000);

  it('the door press to the end: nothing is signed or published while Stay is offered; the one World Location is signed and published only once the goodbye is over (`gone`), and the page goes to the plain address after it', async () => {
    signIn('extension');
    remoteMove('blobbi-home', Date.now() - 60_000);
    renderAt('/');
    await homeReady();
    const phases = watchCard();
    await openIsland();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(phases.map((p) => p.phase)).toEqual(['noticing', 'waving', 'leaving', 'gone']);
    for (const p of phases) if (p.phase !== 'gone') expect(p).toMatchObject({ signed: 0, sent: 0 });
    expect(sentAtAssign).toBe(1);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toHaveLength(1);
    expect(assign.mock.calls[0][0]).toBe(worldById('island')!.url);
    expect(published()).toMatchObject({ world: WORLD_ISLAND, from: 'blobbi-home' });
  }, 20_000);

  it('after the move was published, a navigation that does not happen: the Blobbi has left (not brought back), Try again asks for the address again with no new move, and Dismiss hides the card without re-entering it', async () => {
    remoteMove('blobbi-home', Date.now() - 60_000);
    renderAt('/');
    await homeReady();
    await openIsland();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(sent(31126)).toHaveLength(1);
    // Still here after the departure's failMs: the move stands, and nothing offers to undo it
    const card = screen.getByTestId('departure-card');
    await waitFor(() => expect(card).toHaveAttribute('data-phase', 'failed'), { timeout: DEPARTURE.failMs + 4_000 });
    expect(card).toHaveTextContent('Brook has left for Blobbi Island, but it did not open.');
    expect(screen.queryByTestId('departure-stay')).toBeNull();
    expect(screen.getByTestId('departure-retry')).toHaveTextContent('Try again');
    expect(screen.getByTestId('departure-dismiss')).toHaveTextContent('Dismiss');
    expect(presenceOf()).toBe('absent');
    fireEvent.click(screen.getByTestId('departure-retry'));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(2), WAIT);
    expect(assign.mock.calls[1][0]).toBe(worldById('island')!.url);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId('departure-card')).toHaveAttribute('data-phase', 'failed'), { timeout: DEPARTURE.failMs + 4_000 });
    expect(screen.getByTestId('departure-card')).toHaveTextContent('has left for Blobbi Island');
    fireEvent.click(screen.getByTestId('departure-dismiss'));
    expect(screen.queryByTestId('departure-card')).toBeNull();
    await pause(1_200);
    expect(presenceOf()).toBe('absent');
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toHaveLength(1);
    expect(newestLocation()?.world).toBe(WORLD_ISLAND);
    expect(status()).toHaveAttribute('data-travel-place', WORLD_ISLAND);
  }, 40_000);

  it('Home → Island: one World Location naming the Island (from home, over the canonical one) is signed and published from here BEFORE the page goes to the plain address', async () => {
    signIn('extension');
    const home = remoteMove('blobbi-home', Date.now() - 60_000);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    await openIsland();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(sentAtAssign).toBe(1);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(signing.kinds).toEqual([KIND_WORLD_LOCATION]);
    const url = assign.mock.calls[0][0] as string;
    expect(url).toBe(worldById('island')!.url);
    expect(url).not.toContain('#');
    expect(published()).toMatchObject({ owner: PK, d: D, world: WORLD_ISLAND, from: 'blobbi-home', prev: home.id });
    expect(newestLocation()?.world).toBe(WORLD_ISLAND);
    // Nothing went to the app's general pool
    expect(base.poolEvents.filter((e) => e.kind === 31126)).toEqual([]);
  }, 20_000);

  it('a Blobbi that never travelled leaves the same way (no `prev`), with the goodbye played first', async () => {
    const seen = watchActor();
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    await openIsland();
    expect(await screen.findByTestId('departure-card')).toHaveTextContent('Brook is off to Blobbi Island');
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(seen).toContain('depart');
    expect(sentAtAssign).toBe(1);
    expect(published()).toMatchObject({ world: WORLD_ISLAND, from: 'blobbi-home', prev: null });
    expect(assign.mock.calls[0][0]).toBe(worldById('island')!.url);
  }, 20_000);

  it('refused at the door: the page still goes, to the plain address, and nothing is published (the Blobbi stays home on the relays)', async () => {
    signIn('extension');
    remoteMove('blobbi-home', Date.now() - 60_000);
    signing.refuse = true;
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    await openIsland();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][0]).toBe(worldById('island')!.url);
    expect(sent(31126)).toEqual([]);
    expect(newestLocation()?.world).toBe('blobbi-home');
  }, 20_000);

  it('no relay accepting at the door: the page still goes, nothing is left on the relays', async () => {
    remoteMove('blobbi-home', Date.now() - 60_000);
    renderAt('/');
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    for (const r of relays.values()) r.refuse = true;
    await openIsland();
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(assign.mock.calls[0][0]).toBe(worldById('island')!.url);
    expect(newestLocation()?.world).toBe('blobbi-home');
  }, 20_000);

  it('the hook alone: a signer that never answers publishes nothing and the departure does not resolve meanwhile (the wait is bounded by DEPART_SIGN_TIMEOUT_MS, tested with the module)', async () => {
    signIn('extension');
    signing.hang = true;
    const { result } = renderHook(
      () => {
        const presence = usePresence();
        return useHomeTravel({ pubkey: PK, d: D, travels: true, presence, busy: false, paused: false });
      },
      { wrapper: hookWrapper() },
    );
    await waitFor(() => expect(result.current.resolution).toBe('confirmed'), WAIT);
    let outcome: string | null = null;
    void result.current.departTo(WORLD_ISLAND).then((o) => (outcome = o));
    await pause(1_500);
    expect(outcome).toBeNull();
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toEqual([]);
    // Without a session (signed out) it says so at once and asks nothing
    currentUser.user = undefined;
    localStorage.removeItem('test:login');
  }, 20_000);

  it('the hook alone: already in the destination publishes nothing; a trip while the Blobbi is away moves it from where it is', async () => {
    remoteMove(WORLD_ISLAND, Date.now() - 60_000);
    const { result } = renderHook(
      () => {
        const presence = usePresence();
        // An egg's hook: it never travels by itself, so the Blobbi stays in the Island for this test
        return useHomeTravel({ pubkey: PK, d: D, travels: false, presence, busy: false, paused: true });
      },
      { wrapper: hookWrapper() },
    );
    await waitFor(() => expect(result.current.place).toBe(WORLD_ISLAND), WAIT);
    await waitFor(() => expect(result.current.resolution).toBe('confirmed'), WAIT);
    expect(await result.current.departTo(WORLD_ISLAND)).toBe('already-there');
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(await result.current.departTo('blobbi-pixel')).toBe('moved');
    expect(published()).toMatchObject({ world: 'blobbi-pixel', from: WORLD_ISLAND });
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
  }, 20_000);
});
