/**
 * World travel on Nostr (M16) in the Standalone's two homes, end to end through the real router: the Blobbi's World
 * Location (kind 31126) on two in-memory relays (the ditto and primal urls, never a real socket) is the authority.
 * The account signs with a real key here (the kit checks every signature), as an nsec login (silent) or an extension
 * (it may prompt). Another device is played by writing its signed events straight to the relays.
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
import { KIND_BLOBBI_STATE, KIND_WORLD_LOCATION, buildEggTags, buildPresenceTemplate, buildWorldLocationTemplate, parseWorldLocation, worldLocationStoreKey } from '@blobbi-kit/core';
import { verifyEvent } from 'nostr-tools/pure';

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
import { setCapturedHandoff } from './handoff-capture';
import { HANDOFF_PARAM, decodeHandoff } from './world-travel-handoff';
import { WORLD_ISLAND, worldById } from '@/features/worlds/worlds';

// ─── The account (a real key) and its Blobbi ───

const SK = generateSecretKey();
const PK = getPublicKey(SK);
const PET = '0000000001';
const D = `blobbi-${PK.slice(0, 12)}-${PET}`;
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
function remoteMove(world: string, atMs = Date.now(), latest = newestLocation()): NostrEvent {
  const e = finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world, latest, now: atMs }), SK) as NostrEvent;
  everywhere(e);
  return e;
}
function newestLocation() {
  const all = [...relays.values()].flatMap((r) => r.stored).filter((e) => e.kind === 31126);
  return all.map((e) => parseWorldLocation(e)!).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))[0] ?? null;
}
const sent = (kind: number) => [...new Set([...relays.values()].flatMap((r) => r.published).filter((e) => e.kind === kind).map((e) => e.id))];

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

const signing = { refuse: false, kinds: [] as number[] };
const signer = {
  getPublicKey: async () => PK,
  signEvent: vi.fn(async (t: { kind: number; created_at: number; tags: string[][]; content: string }) => {
    signing.kinds.push(t.kind);
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
/** Inputs closer than a second are one gesture to the kit: interactions a little more than that apart. */
const GAP = 1_050;
/** Interactions of the player's, each its own gesture: three, more than enough to bring it over (two do). */
async function playThrice(input: () => void = () => press()) {
  for (let i = 0; i < 3; i++) {
    if (i > 0) await pause(GAP);
    act(() => input());
  }
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
  localStorage.clear();
  window.localStorage.setItem('blobbi:home:3d-intro:v1', 'seen');
  relays.clear();
  for (const url of URLS) relays.set(url, { stored: [], refuse: false, readDelay: 0, readFails: false, readHangs: false, subs: new Set(), published: [] });
  base.all = [blobbi()];
  base.poolEvents = [];
  signing.refuse = false;
  signing.kinds = [];
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

describe('the classic home, on Nostr', () => {
  it('away in Pixel at load: shown away at once (no departure replayed), where it was last, nothing signed', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    const seen = watchActor();
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'));
    await waitFor(() => expect(presenceOf()).toBe('absent'));
    expect(seen).not.toContain('depart');
    const note = await screen.findByTestId('world-presence-away');
    expect(note).toHaveTextContent('Brook was last in Blobbi Pixel');
    expect(screen.getByTestId('blobbi-poke')).toBeDisabled();
    await pause(500);
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('Call home publishes exactly one World Location to the relays, then the arrival plays; again publishes nothing', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    fireEvent.click(await screen.findByTestId('world-presence-call-home'));
    await waitFor(() => expect(presenceOf()).toBe('arrive'), WAIT);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(sent(31126)).toHaveLength(1);
    const mine = parseWorldLocation(relays.get(URLS[0])!.stored.find((e) => e.kind === 31126))!;
    expect(mine).toMatchObject({ world: 'blobbi-home', from: 'blobbi-pixel', owner: PK, d: D });
    expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook is back home!');
    expect(status()).toHaveAttribute('data-travel-here', 'true');
    // Already home: presses publish nothing more
    press();
    press();
    await pause(300);
    expect(sent(31126)).toHaveLength(1);
    // Nothing went to the app's general pool (which writes to every application relay) for travel
    expect(base.poolEvents.filter((e) => e.kind === 31126 || e.kind === 21124)).toEqual([]);
  }, 20_000);

  it('a press anywhere while away brings it home; a press inside an ignored area (a sheet, a setting) does not', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    const ignored = document.createElement('div');
    ignored.setAttribute('data-world-travel', 'ignore');
    const inner = document.createElement('button');
    ignored.appendChild(inner);
    document.body.appendChild(ignored);
    press(inner);
    await pause(300);
    expect(signer.signEvent).not.toHaveBeenCalled();
    // Three interactions (a second apart) bring it over
    await playThrice(() => press(screen.getByTestId('care-dock')));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(sent(31126)).toHaveLength(1);
    ignored.remove();
  }, 20_000);

  it('no location at all is home: presses publish nothing, and nothing is signed on load or re-render', async () => {
    const view = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    expect(presenceOf()).toBe('present');
    press();
    for (let i = 0; i < 3; i++) view.again();
    expect(presenceOf()).toBe('present');
    await pause(400);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(sent(31126)).toEqual([]);
  });

  it('another device taking it to Pixel: the home departs live, then says where it went', async () => {
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await pause(1_600); // the page has been visible past the grace
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(presenceOf()).toBe('depart'), WAIT);
    expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook hopped over to Blobbi Pixel!');
    await waitFor(() => expect(presenceOf()).toBe('absent'), WAIT);
    expect(await screen.findByTestId('world-presence-away')).toHaveTextContent('Blobbi Pixel');
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);

  it('a departure waits for the home’s own moment (care in flight, a bath, a ceremony), then plays', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    );
    const { result, rerender } = renderHook(
      ({ busy }) => {
        const presence = usePresence();
        const travel = useHomeTravel({ pubkey: PK, d: D, travels: true, presence, busy, paused: false });
        return { presence, travel };
      },
      { wrapper, initialProps: { busy: false } },
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

  it('an egg and a sleeper stay home whatever the location says, and a press never moves them', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    base.all = [blobbi({ stage: 'egg' })];
    const egg = renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'));
    expect(presenceOf()).toBe('present');
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    press();
    await pause(300);
    egg.unmount();
    base.all = [blobbi({ state: 'sleeping' })];
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'));
    expect(presenceOf()).toBe('present');
    press();
    await pause(300);
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('a refused signature: said so, and further presses do not ask again (cooldown); Try again is the player asking', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    signIn('extension');
    signing.refuse = true;
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    await playThrice();
    await waitFor(() => expect(screen.getByTestId('world-presence-detail')).toHaveTextContent('did not approve'));
    // Casual following is suspended for the session: playing on asks nothing more
    expect(status()).toHaveAttribute('data-follow-suspended', 'true');
    await playThrice();
    await pause(300);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    signing.refuse = false;
    fireEvent.click(screen.getByTestId('world-travel-retry'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('no relay accepting: said so; Try again sends the same signed event (no second signature)', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    for (const r of relays.values()) r.refuse = true;
    fireEvent.click(screen.getByTestId('world-presence-call-home'));
    await waitFor(() => expect(screen.getByTestId('world-presence-detail')).toHaveTextContent("Couldn't reach"));
    expect(status()).toHaveAttribute('data-travel-reason', 'unreachable');
    for (const r of relays.values()) r.refuse = false;
    fireEvent.click(screen.getByTestId('world-travel-retry'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(sent(31126)).toHaveLength(1);
  }, 20_000);

  it('a reload during a move: the signed move is sent on load, with no new signature', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    const first = renderAt('/');
    await screen.findByTestId('world-presence-away');
    for (const r of relays.values()) r.refuse = true;
    fireEvent.click(screen.getByTestId('world-presence-call-home'));
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-reason', 'unreachable'));
    first.unmount();
    for (const r of relays.values()) r.refuse = false;
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-home'), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(newestLocation()?.world).toBe('blobbi-home');
  }, 20_000);

  it('relays disagreeing: the newest valid location wins, whichever relay holds it', async () => {
    const older = finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-home', latest: null, now: Date.now() - 120_000 }), SK) as NostrEvent;
    const newer = finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-pixel', latest: parseWorldLocation(older), now: Date.now() - 60_000 }), SK) as NostrEvent;
    accept(relays.get(URLS[0])!, older);
    accept(relays.get(URLS[1])!, newer);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'));
    // A forged event naming home (a bad signature) changes nothing
    act(() => everywhere({ ...older, created_at: older.created_at + 999, sig: '0'.repeat(128) }));
    await pause(300);
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel');
  });

  it('an extension signer is never asked on load, on re-renders or by the presence timer, even with presence on', async () => {
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

  it('a recent presence in Pixel: "playing there right now", and the arrival waits the departure window', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    act(() => everywhere(finalizeEvent(buildPresenceTemplate({ owner: PK, d: D, world: 'blobbi-pixel', now: Date.now() }), SK) as NostrEvent));
    await waitFor(() => expect(screen.getByTestId('world-presence-away')).toHaveTextContent('Brook is playing in Blobbi Pixel right now'));
    fireEvent.click(screen.getByTestId('world-presence-call-home'));
    await waitFor(() => expect(screen.getByTestId('world-presence-line')).toHaveTextContent('Brook is on the way home…'));
    expect(status()).toHaveAttribute('data-travel-phase', 'arriving');
    expect(presenceOf()).toBe('absent');
    await waitFor(() => expect(presenceOf()).toBe('arrive'), WAIT);
  }, 20_000);

  it('signed out or a guest: no session at all, the Blobbi home, nothing read from the travel relays', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    currentUser.user = undefined;
    localStorage.removeItem('test:login');
    renderAt('/');
    await pause(1_000);
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('the place is only ever the World Location: nothing about it is kept in a cookie', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away', undefined, WAIT);
    await playThrice();
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
      await playThrice();
      view.again();
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
});

describe('the 3D room, on Nostr', () => {
  it('away at entry: no arrival on entry, the word in the room; Call home plays the arrival in the scene', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/room');
    const note = await screen.findByTestId('world-presence-away', undefined, WAIT);
    expect(note).toHaveTextContent('Brook was last in Blobbi Pixel');
    await pause(600);
    expect(scene.state.journeys.filter(Boolean)).toEqual([]);
    fireEvent.click(screen.getByTestId('world-presence-call-home'));
    await waitFor(() => expect(scene.state.journeys).toContain('arrive'), WAIT);
    await waitFor(() => expect(screen.queryByTestId('world-presence-away')).toBeNull());
    expect(sent(31126)).toHaveLength(1);
  }, 20_000);

  it('another device taking it while the room is open: the room plays its departure', async () => {
    renderAt('/room');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'), WAIT);
    await pause(1_600);
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(scene.state.journeys).toContain('depart'), WAIT);
    expect(await screen.findByTestId('world-presence-away', undefined, WAIT)).toBeInTheDocument();
  }, 20_000);
});

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
const followCount = () => Number(status().getAttribute('data-follow-count'));

describe('following the player home: two interactions (M16.1, the threshold of 2026-10-19)', () => {
  it('the first interaction does not bring it over (it notices); the second does, with exactly one World Location', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    press();
    await waitFor(() => expect(followCount()).toBe(1));
    expect(screen.getByTestId('world-presence-detail')).toHaveTextContent('Brook noticed you playing here…');
    await pause(300);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(presenceOf()).toBe('absent');
    await pause(GAP - 300);
    press();
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(followCount()).toBe(0);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    // More play writes nothing more
    await playThrice();
    await pause(300);
    expect(sent(31126)).toHaveLength(1);
  }, 20_000);

  it('presses within one gesture (under a second apart) count once', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    for (let i = 0; i < 6; i++) press();
    await pause(300);
    expect(followCount()).toBe(1);
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('a window that expired starts the count over', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    press();
    await waitFor(() => expect(followCount()).toBe(1));
    // More than the rolling 20 s later: the earlier one has left the window
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 21_000 });
    try {
      press();
      await waitFor(() => expect(followCount()).toBe(1));
      await pause(300);
      expect(signer.signEvent).not.toHaveBeenCalled();
      expect(presenceOf()).toBe('absent');
    } finally {
      vi.useRealTimers();
    }
  }, 20_000);

  it('Call home is explicit and immediate: one click, no count', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    fireEvent.click(await screen.findByTestId('world-presence-call-home'));
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
    expect(followCount()).toBe(0);
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
  }, 20_000);

  it('a held key’s auto-repeat is never counted', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    await waitFor(() => expect(followCount()).toBe(1));
    for (let i = 0; i < 2; i++) {
      await pause(GAP);
      fireEvent.keyDown(document.body, { key: 'ArrowRight', repeat: true });
    }
    await pause(300);
    expect(followCount()).toBe(1);
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);

  it('a script’s (untrusted) events are never counted', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    setTrustedInputCheck(() => false);
    try {
      await playThrice();
      await playThrice(() => fireEvent.keyDown(document.body, { key: 'a' }));
      await pause(300);
      expect(followCount()).toBe(0);
      expect(signer.signEvent).not.toHaveBeenCalled();
    } finally {
      setTrustedInputCheck(() => true);
    }
  }, 20_000);

  it('no input at all: away it stays, nothing is signed (load, timers and re-renders are not interactions)', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    const view = renderAt('/');
    await screen.findByTestId('world-presence-away');
    for (let i = 0; i < 3; i++) view.again();
    act(() => void window.dispatchEvent(new Event('focus')));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await pause(2_000);
    expect(followCount()).toBe(0);
    expect(presenceOf()).toBe('absent');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('just moved to Pixel from another device: playing here does not pull it straight back (contended); Call home does', async () => {
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await pause(1_600);
    act(() => void remoteMove('blobbi-pixel'));
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel'));
    await playThrice();
    await pause(300);
    expect(signer.signEvent).not.toHaveBeenCalled();
    expect(status()).toHaveAttribute('data-travel-place', 'blobbi-pixel');
    fireEvent.click(await screen.findByTestId('world-presence-call-home', undefined, WAIT));
    await waitFor(() => expect(sent(31126)).toHaveLength(1), WAIT);
  }, 20_000);

  it('a Blobbi switch and an account switch start the count over', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    const { result, rerender } = renderHook(
      ({ d }) => {
        const presence = usePresence();
        return useHomeTravel({ pubkey: currentUser.user?.pubkey, d, travels: true, presence, busy: false, paused: false });
      },
      { wrapper: hookWrapper(), initialProps: { d: D } },
    );
    await waitFor(() => expect(result.current.place).toBe('blobbi-pixel'));
    press();
    await waitFor(() => expect(result.current.follow?.count).toBe(1));
    // Another Blobbi of the same account: a new session, nothing counted
    rerender({ d: `blobbi-${PK.slice(0, 12)}-0000000002` });
    await waitFor(() => expect(result.current.snapshot?.d).toBe(`blobbi-${PK.slice(0, 12)}-0000000002`));
    expect(result.current.follow?.count).toBe(0);
    // Back to the first: counted afresh too (the session is new)
    rerender({ d: D });
    await waitFor(() => expect(result.current.snapshot?.d).toBe(D));
    expect(result.current.follow?.count).toBe(0);
    press();
    await waitFor(() => expect(result.current.follow?.count).toBe(1));
    // Signed out: no session; signed in again: a new one, nothing counted
    currentUser.user = undefined;
    rerender({ d: D });
    await waitFor(() => expect(result.current.snapshot).toBeNull());
    signIn('nsec');
    rerender({ d: D });
    await waitFor(() => expect(result.current.snapshot?.place).toBe('blobbi-pixel'));
    expect(result.current.follow?.count).toBe(0);
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);
});

describe('loading: where it is, before the relays answer (M16.1)', () => {
  const slow = (ms: number) => {
    for (const r of relays.values()) r.readDelay = ms;
  };

  it('a fresh device, the Blobbi in Pixel: never shown home meanwhile, "looking for it", then away with no journey', async () => {
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
    await screen.findByTestId('world-presence-away', undefined, WAIT);
    expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed');
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    expect(seen).not.toContain('present');
    expect(seen).not.toContain('depart');
    expect(presenceOf()).toBe('absent');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

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

  it('a reload with a signed location kept on this device: shown at once (no looking), then confirmed', async () => {
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
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-resolution', 'confirmed'), WAIT);
    expect(seen).not.toContain('present');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('presses while looking count for nothing and sign nothing', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    slow(2_800);
    renderAt('/');
    await playThrice();
    expect(status()).toHaveAttribute('data-travel-resolution', 'pending');
    expect(followCount()).toBe(0);
    await screen.findByTestId('world-presence-away', undefined, WAIT);
    expect(signer.signEvent).not.toHaveBeenCalled();
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

  it('the 3D room on a fresh device: looking where it stands, no arrival on entry until the answer; away: none at all', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    slow(2_500);
    renderAt('/room');
    // The room's page loads first (a chunk of its own)
    expect(await screen.findByTestId('world-travel-looking', undefined, WAIT)).toHaveTextContent('Looking for Brook…');
    expect(screen.getByTestId('room-blobbi-cue')).toBeInTheDocument();
    expect(screen.queryByTestId('world-presence-away')).toBeNull();
    await screen.findByTestId('world-presence-away', undefined, WAIT);
    expect(screen.queryByTestId('world-travel-looking')).toBeNull();
    await pause(600);
    expect(scene.state.journeys.filter(Boolean)).toEqual([]);
    expect(signer.signEvent).not.toHaveBeenCalled();
  }, 20_000);

  it('a11y (M16.2): the room says "Looking for Brook…" in a live region no aria-hidden layer covers, then where it is, once each', async () => {
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
    await waitFor(() => expect(region).toHaveTextContent('Brook is in Blobbi Pixel.'), WAIT);
    const said: string[] = [];
    const watch = new MutationObserver(() => said.push(region.textContent ?? ''));
    watch.observe(region, { childList: true, characterData: true, subtree: true });
    await pause(1_500);
    watch.disconnect();
    expect(said).toEqual([]); // nothing repeated while nothing changes
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

  it('the 3D room on a fresh device without the entry arrival: still never shown home before the answer', async () => {
    remoteMove('blobbi-pixel', Date.now() - 3_600_000);
    slow(1_500);
    renderAt('/room');
    expect(await screen.findByTestId('world-travel-looking', undefined, WAIT)).toBeInTheDocument();
    await screen.findByTestId('world-presence-away', undefined, WAIT);
    expect(scene.state.journeys.filter(Boolean)).toEqual([]);
  }, 20_000);
});

describe('one sequence: the call, then the arrival (M16.1)', () => {
  it('a call home shows the calling cue where it stands until the arrival starts; the body forms the teleport’s lead later', async () => {
    remoteMove('blobbi-pixel', Date.now() - 60_000);
    renderAt('/');
    await screen.findByTestId('world-presence-away');
    // Played in Pixel right now: the arrival waits Pixel's departure window
    act(() => everywhere(finalizeEvent(buildPresenceTemplate({ owner: PK, d: D, world: 'blobbi-pixel', now: Date.now() }), SK) as NostrEvent));
    await waitFor(() => expect(screen.getByTestId('world-presence-away')).toHaveTextContent('right now'));
    fireEvent.click(screen.getByTestId('world-presence-call-home'));
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-phase', 'arriving'));
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

// ─── The World Travel hand-off (an explicit trip from or to another world) ───

describe('the World Travel hand-off', () => {
  const originalLocation = window.location;
  let assign: ReturnType<typeof vi.fn>;
  /** As it comes out of a fragment: JSON only (no library's cached "verified" mark travels with it). */
  const plain = <T,>(e: T): T => JSON.parse(JSON.stringify(e)) as T;
  const handoffStatus = () => status().getAttribute('data-handoff');
  beforeEach(() => {
    setCapturedHandoff(null);
    assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...originalLocation, assign }, writable: true, configurable: true });
  });
  afterEach(() => {
    setCapturedHandoff(null);
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  it('arriving from Blobbi Island with a signed move: nothing is signed here, the move is published once, the home plays the arrival', async () => {
    signIn('extension');
    const island = remoteMove(WORLD_ISLAND, Date.now() - 60_000);
    const signedAtIsland = plain(finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-home', latest: parseWorldLocation(island)!, now: Date.now(), departureWindowS: 0 }), SK));
    setCapturedHandoff(signedAtIsland);
    const seen = watchActor();
    renderAt('/');
    await waitFor(() => expect(handoffStatus()).toBe('done'), WAIT);
    expect(sent(31126)).toEqual([signedAtIsland.id]);
    expect(signer.signEvent).not.toHaveBeenCalled();
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-here', 'true'), WAIT);
    expect(status()).toHaveAttribute('data-travel-change', expect.stringMatching(/^live:/));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    expect(seen).toContain('arrive');
    expect(seen.filter((s) => s === 'arrive')).toHaveLength(1);
    // Play afterwards writes nothing more
    await playThrice();
    await pause(300);
    expect(sent(31126)).toHaveLength(1);
  }, 20_000);

  it('a hand-off for another World, or stale, is dropped: nothing published, the Blobbi away with Call home', async () => {
    const island = remoteMove(WORLD_ISLAND, Date.now() - 60_000);
    // Signed for Pixel, not for the home
    setCapturedHandoff(plain(finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-pixel', latest: parseWorldLocation(island)!, now: Date.now() }), SK)));
    const view = renderAt('/');
    await waitFor(() => expect(handoffStatus()).toBe('dropped'), WAIT);
    expect(status()).toHaveAttribute('data-handoff-reason', 'wrong-world');
    expect(sent(31126)).toEqual([]);
    expect(await screen.findByTestId('world-presence-away')).toHaveTextContent('Blobbi Island');
    expect(screen.getByTestId('world-presence-call-home')).toBeInTheDocument();
    view.unmount();
    // Signed at the Island, but another device moved it to Pixel meanwhile
    const stale = plain(finalizeEvent(buildWorldLocationTemplate({ owner: PK, d: D, world: 'blobbi-home', latest: parseWorldLocation(island)!, now: Date.now() - 30_000 }), SK));
    remoteMove('blobbi-pixel', Date.now() - 10_000);
    setCapturedHandoff(stale);
    renderAt('/');
    await waitFor(() => expect(handoffStatus()).toBe('dropped'), WAIT);
    expect(status()).toHaveAttribute('data-handoff-reason', 'stale');
    expect(sent(31126)).toEqual([]);
    expect(await screen.findByTestId('world-presence-away')).toHaveTextContent('Blobbi Pixel');
  }, 20_000);

  it('leaving for the Island: the move is signed here, once, on the choice; the page goes with it in the fragment; nothing is published', async () => {
    signIn('extension');
    const home = remoteMove('blobbi-home', Date.now() - 60_000);
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    fireEvent.click(screen.getByTestId('menu-button'));
    fireEvent.click(await screen.findByTestId('menu-worlds'));
    fireEvent.click(await screen.findByTestId('world-island'));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(signing.kinds).toEqual([KIND_WORLD_LOCATION]);
    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe(new URL(worldById('island')!.url!).href);
    expect(url.search).toBe('');
    const carried = decodeHandoff(new URLSearchParams(url.hash.slice(1)).get(HANDOFF_PARAM));
    expect(parseWorldLocation(carried!, { verify: (e) => verifyEvent(e as never) })).toMatchObject({ owner: PK, d: D, world: WORLD_ISLAND, from: 'blobbi-home', prev: home.id });
    expect(sent(31126)).toEqual([]);
  }, 20_000);

  it('refused at the door: the page still goes, with nothing attached, and nothing is published', async () => {
    signIn('extension');
    remoteMove('blobbi-home', Date.now() - 60_000);
    signing.refuse = true;
    renderAt('/');
    await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
    await waitFor(() => expect(presenceOf()).toBe('present'), WAIT);
    fireEvent.click(screen.getByTestId('menu-button'));
    fireEvent.click(await screen.findByTestId('menu-worlds'));
    fireEvent.click(await screen.findByTestId('world-island'));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1), WAIT);
    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][0]).toBe(worldById('island')!.url);
    expect(sent(31126)).toEqual([]);
  }, 20_000);
});
