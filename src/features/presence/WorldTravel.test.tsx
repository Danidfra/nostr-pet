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
import { KIND_BLOBBI_STATE, buildEggTags, buildPresenceTemplate, buildWorldLocationTemplate, parseWorldLocation } from '@blobbi-kit/core';

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
import { setWorldPresenceEnabled } from './presence-switch';
import { cookieName } from './presence-page';
import { setTravelMode, setTrustedInputCheck } from './travel-mode';
import { ACTIVE_PRESENCE_KEY } from './active-presence-choice';
import { useHomeTravel } from './useHomeTravel';
import { usePresence } from '@/features/teleport/react/usePresence';

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
  subs: Set<{ filters: NostrFilter[]; push: (m: unknown) => void }>;
  published: NostrEvent[];
}
const relays = new Map<string, FakeRelay>();
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
      query: async (filters: NostrFilter[]) => r.stored.filter((e) => filters.some((f) => matches(e, f))).map((e) => structuredClone(e)),
      event: async (e: NostrEvent) => {
        r.published.push(e);
        if (r.refuse) throw new Error('blocked: test');
        accept(r, structuredClone(e));
      },
      req: (filters: NostrFilter[], { signal }: { signal: AbortSignal }) => {
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

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
  setTravelMode('nostr');
  setTrustedInputCheck(() => true);
});
afterAll(() => {
  setTravelMode('v1');
  setTrustedInputCheck(null);
});
beforeEach(() => {
  localStorage.clear();
  window.localStorage.setItem('blobbi:home:3d-intro:v1', 'seen');
  relays.clear();
  for (const url of URLS) relays.set(url, { stored: [], refuse: false, subs: new Set(), published: [] });
  base.all = [blobbi()];
  base.poolEvents = [];
  signing.refuse = false;
  signing.kinds = [];
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
    press(screen.getByTestId('care-dock'));
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
    press();
    await waitFor(() => expect(screen.getByTestId('world-presence-detail')).toHaveTextContent('did not approve'));
    for (let i = 0; i < 4; i++) press();
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

  it('the cookie of world presence v1 is never read or written in this mode', async () => {
    document.cookie = `${cookieName(PK)}=${encodeURIComponent(`1.pixel.tab.${Date.now().toString(36)}.${(Date.now() + 40_000).toString(36)}`)}; path=/`;
    setWorldPresenceEnabled(true);
    try {
      renderAt('/');
      await waitFor(() => expect(status()).toHaveAttribute('data-travel-status', 'ready'));
      expect(presenceOf()).toBe('present');
      expect(screen.queryByTestId('world-presence-away')).toBeNull();
    } finally {
      setWorldPresenceEnabled(false);
      document.cookie = `${cookieName(PK)}=; max-age=0; path=/`;
    }
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
