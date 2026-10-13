/**
 * M13: a first Blobbi is born into the 2D home, and the 3D room is the
 * player's choice. End to end through the real router, login store, signing
 * and write paths (a relay that records): a new visitor's welcome, the key,
 * the egg, adopted, the 2D home (never the room, and the room's code never
 * loaded), the theatre opening by itself over it, four taps, one hatch, the
 * baby where the egg lay. A stored choice (2D or 3D) is kept as it is;
 * nothing stored means 2D; going to one home from the other's menu is a
 * choice, remembered across a refresh. A refused hatch, Try again, Later,
 * the keyboard and "Hatch it for me", a refresh mid-cracks and a hatch from
 * another device all write one hatch at most. Adoption is not erased by a
 * relay a moment behind.
 *
 * jsdom has no WebGL: where a test goes into the room, it is the simple room
 * (the 2D fallback), the room a phone without WebGL gets.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue } from '@blobbi-kit/core';

const fake = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined, roomLoaded: 0 }));
vi.mock('@/hooks/useCurrentUser', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/useCurrentUser')>();
  return { useCurrentUser: () => (fake.user ? { user: fake.user, users: [fake.user] } : real.useCurrentUser()) };
});
// The room's page (three.js and everything 3D come with it, in its own chunk): counted when it is loaded at all
vi.mock('@/features/room/RoomPreviewPage', async (importOriginal) => {
  fake.roomLoaded += 1;
  return importOriginal();
});
import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { blobbiEvent, profileEvent, PUBKEY } from '@/test/fixtures';
import { TAPS_TO_HATCH, TAP_SETTLE_MS } from '@/features/room/lib/hatch-theater';
import { DEFAULT_EXPERIENCE, EXPERIENCE_STORAGE_KEY, parseExperience, readExperience } from '@/lib/home-experience';

const STORAGE_KEY = 'nostr:login';
/** `behind`: what a relay a moment behind still serves (the world as it was), while the writes land in `all`. */
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: new Set<number>(), behind: null as NostrEvent[] | null };
const fallBehind = () => {
  relay.behind = [...relay.all];
};
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const world = relay.behind ?? relay.all;
  const seen = new Set<string>();
  return world.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.refuse.has(ev.kind)) throw new AggregateError([new Error('blocked: no')], `relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  if (ev.kind === 0) relay.all = [...relay.all.filter((e) => !(e.kind === 0 && e.pubkey === ev.pubkey)), ev];
  else if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => !(e.kind === ev.kind && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd'))), ev];
  else relay.all.push(ev);
});
const pool = { query, event, group: () => pool } as unknown as NPool;

function renderApp(path = '/', reducedMotion = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion, idleEnabled: false }}>
      <NostrLoginProvider storageKey={STORAGE_KEY}>
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
              <AppRouter />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
}

const published = (kind: number) => relay.published.filter((e) => e.kind === kind);
const hatches = () => published(KIND_BLOBBI_STATE).filter((e) => getTagValue(e.tags, 'stage') === 'baby');
const stateWrites = () => event.mock.calls.filter(([e]) => (e as NostrEvent).kind === KIND_BLOBBI_STATE).length;
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
/** The 2D home, with its Blobbi in it. */
const in2d = async () => {
  await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
  expect(screen.queryByTestId('room-shell')).toBeNull();
};
const inRoom = () => screen.findByTestId('room-shell', {}, { timeout: 8000 });
const homeStage = () => screen.getByTestId('blobbi-actor').querySelector('[data-blobbi-renderer]')?.getAttribute('data-blobbi-stage');
/** Blobbis drawn in the scene right now, by any renderer (the HUD chip's little portrait is not one). */
const drawnBlobbis = () => [...document.querySelectorAll('[data-blobbi-renderer]')].filter((el) => !el.closest('[style*="visibility: hidden"]') && !el.closest('[data-testid="blobbi-chip"]'));
async function tapTheShell(times: number = TAPS_TO_HATCH) {
  for (let i = 0; i < times; i++) {
    await userEvent.click(screen.getByTestId('hatch-theater-egg'));
    await wait(TAP_SETTLE_MS + 30);
  }
}
const consoleSpies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')];

let signed = 0;
function signedInWithExtension() {
  fake.user = {
    pubkey: PUBKEY,
    signer: { signEvent: async (t: { kind: number; content: string; tags: string[][]; created_at: number }) => ({ ...t, id: String(++signed).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) }) },
  };
}
const NOW = Math.floor(Date.now() / 1000);
const anEgg = () => blobbiEvent('0000000009', { name: 'Pip', stage: 'egg', visualGeneration: 'v3', createdAt: NOW - 60, set: { progression_state: 'incubating' } });
const EGG_D = getTagValue(anEgg().tags, 'd')!;
const aBaby = () => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', visualGeneration: 'v3' });

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  relay.refuse = new Set();
  relay.behind = null;
  signed = 0;
  fake.user = undefined;
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
  for (const spy of consoleSpies) spy.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
afterEach(() => {
  delete (window as { nostr?: unknown }).nostr;
});

describe('a new player is born into the 2D home', () => {
  it('nothing stored is 2D; junk is 2D too', () => {
    expect(DEFAULT_EXPERIENCE).toBe('classic');
    expect(readExperience()).toBe('classic');
    for (const junk of ['3d', '', null, 'ROOM', undefined]) expect(parseExperience(junk)).toBe('classic');
  });

  it('welcome → key → egg → adopted → the 2D home → the theatre by itself → four taps → one hatch → the baby where the egg lay; the room never loaded', async () => {
    const roomLoadsBefore = fake.roomLoaded;
    renderApp('/');
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const nsec = (await screen.findByTestId('nsec-box')).textContent ?? '';
    await userEvent.click(screen.getByTestId('nsec-copy'));
    await userEvent.click(screen.getByTestId('key-saved'));
    await userEvent.click(screen.getByTestId('onboarding-continue'));
    expect(await screen.findByTestId('adoption-egg')).toHaveAttribute('data-ready', 'true');
    const d = screen.getByTestId('adoption-preview').getAttribute('data-d')!;
    await userEvent.type(screen.getByTestId('adoption-name'), 'Mochi');
    // Three taps on Adopt in the excitement: one adoption
    const adopt = screen.getByTestId('adoption-adopt');
    await userEvent.tripleClick(adopt);
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1), { timeout: 5000 });
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);

    // The 2D home, the egg on its nest; no room, no choice to make, no loading screen in between
    await in2d();
    expect(homeStage()).toBe('egg');
    expect(screen.queryByTestId('home-loading')).toBeNull();
    expect(screen.queryByText(/2D or 3D/i)).toBeNull();
    // The theatre opens by itself over the home; the home's own egg steps aside: one egg drawn
    const theater = await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    expect(theater).toHaveAttribute('data-beat', 'stirring');
    expect(theater).toHaveAttribute('data-reduced', 'true');
    expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Tap your egg to help it hatch!');
    expect(screen.getByTestId('home-actor-slot')).toHaveStyle({ visibility: 'hidden' });
    expect(drawnBlobbis()).toHaveLength(1);
    expect(hatches()).toHaveLength(0);
    // Reduced motion: the cracks and the words, step by step; nothing rocks
    await tapTheShell(1);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'light');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-rock', '0');
    await tapTheShell(TAPS_TO_HATCH - 2);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'heavy');
    expect(hatches()).toHaveLength(0);
    await tapTheShell(1);
    // More taps in the excitement change nothing
    await userEvent.click(screen.getByTestId('hatch-theater-actor'));
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    expect(getTagValue(hatches()[0].tags, 'd')).toBe(d);
    // The theatre ends; the baby is in the 2D home, drawn once, visible; still no room
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    expect(screen.getByTestId('home-actor-slot')).not.toHaveStyle({ visibility: 'hidden' });
    expect(drawnBlobbis()).toHaveLength(1);
    expect(screen.queryByTestId('room-shell')).toBeNull();
    // Care begins at once: the dock is there and not held
    expect(screen.queryByTestId('action-hatch')).toBeNull();
    await wait(2000);
    expect(hatches()).toHaveLength(1);
    expect(relay.published.map((e) => e.kind)).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_BLOBBI_STATE]);
    // The 3D room's code was never asked for
    expect(fake.roomLoaded).toBe(roomLoadsBefore);
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBeNull();
    // The secret never left
    for (const ev of relay.published) expect(JSON.stringify(ev)).not.toContain(nsec.slice(5));
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(nsec.slice(5));
  }, 60_000);

  it('an adoption the relays are a moment behind on is not erased: the egg stays, the theatre opens, one hatch', async () => {
    signedInWithExtension();
    relay.all = [];
    renderApp('/');
    await screen.findByTestId('adoption-egg', {}, { timeout: 8000 });
    fallBehind();
    await userEvent.type(screen.getByTestId('adoption-name'), 'Lag');
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1), { timeout: 5000 });
    await in2d();
    expect(await screen.findByTestId('hatch-theater', {}, { timeout: 8000 })).toBeInTheDocument();
    await wait(1500);
    // Not sent back to the way in by a stale "none"
    expect(screen.queryByTestId('adoption-egg')).toBeNull();
    expect(screen.queryByTestId('onboarding-welcome')).toBeNull();
    relay.behind = null;
    await tapTheShell();
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(2);
  }, 45_000);
});

describe('the relays a moment behind', () => {
  it('a hatch that landed is not undone by a re-read that still finds the egg: the baby stays, no second theatre, no second hatch', async () => {
    signedInWithExtension();
    relay.all = [anEgg(), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    renderApp('/');
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell(TAPS_TO_HATCH - 1);
    // From here every read is served the egg, while the hatch is accepted
    fallBehind();
    await tapTheShell(1);
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    // The lifecycle's re-read after the write has come back with the egg: the home still holds the baby
    await waitFor(() => expect(query.mock.calls.length).toBeGreaterThan(0));
    await wait(2500);
    expect(homeStage()).toBe('baby');
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(screen.queryByTestId('action-hatch')).toBeNull();
    expect(hatches()).toHaveLength(1);
  }, 45_000);

  it('a newer version from another device still comes through on the next read', async () => {
    signedInWithExtension();
    relay.all = [aBaby(), profileEvent()];
    const first = renderApp('/');
    await in2d();
    expect(homeStage()).toBe('baby');
    // Another device grew it up
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3', createdAt: NOW }), profileEvent()];
    first.unmount();
    cleanup();
    renderApp('/');
    await in2d();
    await waitFor(() => expect(homeStage()).toBe('adult'));
  });
});

describe('a returning player keeps their home', () => {
  it('nothing stored: the 2D home, nothing written, the room not loaded', async () => {
    const before = fake.roomLoaded;
    signedInWithExtension();
    relay.all = [aBaby(), profileEvent()];
    renderApp('/');
    await in2d();
    await wait(300);
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBeNull();
    expect(relay.published).toEqual([]);
    expect(fake.roomLoaded).toBe(before);
  });

  it('a stored 3D choice is kept: straight into the room, and the choice untouched', async () => {
    signedInWithExtension();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    relay.all = [aBaby(), profileEvent()];
    renderApp('/');
    await inRoom();
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('room');
    expect(relay.published).toEqual([]);
  });

  it('a stored 2D choice is kept', async () => {
    signedInWithExtension();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'classic');
    relay.all = [aBaby(), profileEvent()];
    renderApp('/');
    await in2d();
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('classic');
  });

  it('switching to 3D from the menu, a refresh, back to 2D from the room, a refresh: each choice holds; nothing published', async () => {
    signedInWithExtension();
    relay.all = [aBaby(), profileEvent()];
    const first = renderApp('/');
    await in2d();
    // The one switch, upper right (M14.1); the room greets the first visit itself (M14.2)
    expect(screen.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'classic');
    await userEvent.click(screen.getByTestId('mode-3d'));
    await inRoom();
    await userEvent.click(await screen.findByTestId('mode-intro-explore'));
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('room');
    // A refresh at the root opens where the player chose
    first.unmount();
    cleanup();
    const second = renderApp('/');
    await inRoom();
    // Back to 2D from the room's menu
    await userEvent.click(screen.getByTestId('mode-2d'));
    await in2d();
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('classic');
    second.unmount();
    cleanup();
    renderApp('/');
    await in2d();
    await wait(300);
    expect(screen.queryByTestId('room-shell')).toBeNull();
    expect(relay.published).toEqual([]);
  }, 30_000);

  it('a Blobbi that hatched on another device is the baby here: no theatre, no hatch', async () => {
    signedInWithExtension();
    relay.all = [blobbiEvent('0000000009', { name: 'Pip', stage: 'baby', visualGeneration: 'v3', createdAt: NOW - 60 }), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    renderApp('/');
    await in2d();
    await wait(2500);
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(homeStage()).toBe('baby');
    expect(relay.published).toEqual([]);
  });
});

describe('the first hatch on the 2D home, when it does not go straight', () => {
  const eggAtHome = () => {
    signedInWithExtension();
    relay.all = [anEgg(), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
  };

  it('refused: the egg stays an egg, said so, not retried by itself; Later leaves the Hatch! button, which opens a whole shell again', async () => {
    eggAtHome();
    relay.refuse = new Set([KIND_BLOBBI_STATE]);
    renderApp('/');
    await in2d();
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell();
    expect(await screen.findByTestId('hatch-theater-failed', {}, { timeout: 8000 })).toHaveTextContent(/did not hatch yet/);
    const tries = stateWrites();
    expect(tries).toBe(1);
    await wait(2500);
    expect(stateWrites()).toBe(tries);
    await userEvent.click(screen.getByTestId('hatch-theater-later'));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(homeStage()).toBe('egg');
    // Not offered again by itself this visit
    await wait(2500);
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    await userEvent.click(screen.getByTestId('action-hatch'));
    const again = await screen.findByTestId('hatch-theater');
    expect(again).toHaveAttribute('data-beat', 'stirring');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'none');
    // Then the relays take it: one hatch
    relay.refuse = new Set();
    await tapTheShell();
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(homeStage()).toBe('baby');
  }, 45_000);

  it('refused, then Try again: the same egg hatches, one hatch written', async () => {
    eggAtHome();
    relay.refuse = new Set([KIND_BLOBBI_STATE]);
    renderApp('/');
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell();
    await screen.findByTestId('hatch-theater-failed', {}, { timeout: 8000 });
    relay.refuse = new Set();
    await userEvent.click(screen.getByTestId('hatch-theater-retry'));
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    expect(getTagValue(hatches()[0].tags, 'd')).toBe(EGG_D);
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    expect(hatches()).toHaveLength(1);
  }, 30_000);

  it('the keyboard and "Hatch it for me": one write', async () => {
    eggAtHome();
    renderApp('/');
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    expect(document.activeElement).toBe(screen.getByTestId('hatch-theater-egg'));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'light');
    screen.getByTestId('hatch-theater-auto').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 10000 });
    expect(homeStage()).toBe('baby');
    expect(hatches()).toHaveLength(1);
  }, 30_000);

  it('a refresh mid-cracks starts the shell whole on the 2D home; the hatch is written once in all', async () => {
    eggAtHome();
    const first = renderApp('/');
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell(2);
    first.unmount();
    cleanup();
    expect(hatches()).toHaveLength(0);
    renderApp('/');
    await in2d();
    const again = await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    expect(again).toHaveAttribute('data-beat', 'stirring');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'none');
    await tapTheShell();
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    await wait(2000);
    expect(hatches()).toHaveLength(1);
  }, 45_000);

  it('with motion: the shell rocks harder as it cracks, and the baby is revealed in the theatre before the home', async () => {
    eggAtHome();
    renderApp('/', false);
    const theater = await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    expect(theater).not.toHaveAttribute('data-reduced');
    await tapTheShell(1);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-rock', '1');
    await tapTheShell(2);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-rock', '3');
    await tapTheShell(1);
    await waitFor(() => expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'baby'), { timeout: 8000 });
    expect(screen.getByTestId('hatch-theater-actor').querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'baby');
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 10000 });
    expect(homeStage()).toBe('baby');
    expect(hatches()).toHaveLength(1);
  }, 45_000);
});
