/**
 * The way in since M11, end to end through the real router, login store,
 * signing and write paths (a relay that records): a new visitor's welcome, a
 * key made and kept, the egg at once, adopted, the room as the home, the
 * first egg's hatch as theatre opening by itself, the shell cracked tap by
 * tap (M12.3), and exactly one hatch written. A returning player
 * goes straight to the room. A hatch that does not land leaves the egg an
 * egg and is not retried by itself; a "refresh" before the write writes
 * nothing twice; a Blobbi that hatched elsewhere is not hatched again.
 *
 * jsdom has no WebGL, so the room is the simple room (the 2D fallback),
 * which is exactly the room a phone without WebGL gets. Reduced motion keeps
 * the theatre at its quick pace.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue } from '@blobbi-kit/core';

// A player already signed in (the room suites' seam); the new visitor goes through the real login store
const fake = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/useCurrentUser')>();
  return { useCurrentUser: () => (fake.user ? { user: fake.user, users: [fake.user] } : real.useCurrentUser()) };
});
import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { blobbiEvent, profileEvent, PUBKEY } from '@/test/fixtures';
import { TAPS_TO_HATCH, TAP_SETTLE_MS } from '@/features/room/lib/hatch-theater';

const STORAGE_KEY = 'nostr:login';
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: new Set<number>(), hold: null as null | Promise<void> };
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
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.hold && ev.kind === KIND_BLOBBI_STATE) await relay.hold;
  if (relay.refuse.has(ev.kind)) throw new AggregateError([new Error('blocked: no')], `relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  if (ev.kind === 0) relay.all = [...relay.all.filter((e) => !(e.kind === 0 && e.pubkey === ev.pubkey)), ev];
  else if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => !(e.kind === ev.kind && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd'))), ev];
  else relay.all.push(ev);
});
const pool = { query, event, group: () => pool } as unknown as NPool;

function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
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
const inRoom = () => screen.findByTestId('room-shell', {}, { timeout: 8000 });
const roomStage = () => screen.getByTestId('room-blobbi-anchor').querySelector('[data-blobbi-renderer]')?.getAttribute('data-blobbi-stage');
/** The player's taps on the egg in the theatre, each a moment after the last. */
async function tapTheShell(times: number = TAPS_TO_HATCH) {
  for (let i = 0; i < times; i++) {
    await userEvent.click(screen.getByTestId('hatch-theater-egg'));
    await act(() => new Promise((r) => setTimeout(r, TAP_SETTLE_MS + 30)));
  }
}
const consoleSpies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')];

/** A player already signed in as PUBKEY, with a signer that signs whatever it is handed. */
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

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  relay.refuse = new Set();
  relay.hold = null;
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

describe('a new visitor', () => {
  it('welcome → the key, kept → the egg at once → adopted → the room is the home → the theatre opens by itself → the shell cracks tap by tap → hatched, once → the baby in its room', async () => {
    renderApp('/');
    // The welcome: real Blobbis, what to do, and two doors; no key yet, nothing read about anyone
    const welcome = await screen.findByTestId('onboarding-welcome');
    expect(within(welcome).getByRole('heading', { level: 1 })).toHaveTextContent(/little friend is waiting/i);
    expect(screen.getByTestId('welcome-cast').querySelectorAll('[data-blobbi-renderer]').length).toBe(3);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(0);
    expect(relay.published).toHaveLength(0);

    await userEvent.click(screen.getByTestId('onboarding-create'));
    const nsec = (await screen.findByTestId('nsec-box')).textContent ?? '';
    // Kept (copied), then confirmed, then on
    await userEvent.click(screen.getByTestId('nsec-copy'));
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    await userEvent.click(screen.getByTestId('key-saved'));
    await userEvent.click(screen.getByTestId('onboarding-continue'));

    // The egg straight away: no profile step, nothing published to get here
    const card = await screen.findByTestId('adoption-egg');
    expect(card).toHaveAttribute('data-ready', 'true');
    expect(screen.queryByTestId('profile-skip')).toBeNull();
    expect(relay.published).toHaveLength(0);
    const d = screen.getByTestId('adoption-preview').getAttribute('data-d')!;
    await userEvent.type(screen.getByTestId('adoption-name'), 'Mochi');
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1), { timeout: 5000 });
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'd')).toBe(d);

    // Into the room, where the theatre opens on the first egg by itself and waits for the player's taps: no question,
    // no Later, no Hatch button, and nothing written however long it waits
    await inRoom();
    expect(roomStage()).toBe('egg');
    const theater = await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    expect(within(theater).getByTestId('hatch-theater-actor').querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'egg');
    expect(theater).toHaveAttribute('data-beat', 'stirring');
    expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent('Tap your egg to help it hatch!');
    expect(screen.queryByText(/Ready to hatch\?/)).toBeNull();
    expect(screen.queryByText('Later')).toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    expect(theater).toHaveAttribute('data-beat', 'stirring');
    expect(hatches()).toHaveLength(0);
    // Each tap a crack; nothing written until the shell opens
    await tapTheShell(TAPS_TO_HATCH - 1);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'heavy');
    expect(theater).toHaveAttribute('data-beat', 'breaking');
    expect(hatches()).toHaveLength(0);
    // The last tap opens it; more taps in the excitement change nothing: one write
    await tapTheShell(1);
    expect(screen.queryByTestId('hatch-theater-egg')).toBeNull();
    await userEvent.click(screen.getByTestId('hatch-theater-actor'));
    // One hatch, of this very Blobbi: same address
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    expect(getTagValue(hatches()[0].tags, 'd')).toBe(d);
    expect(getTagValue(hatches()[0].tags, 'name')).toBe('Mochi');
    await waitFor(() => expect(screen.getByTestId('hatch-theater-caption')).toHaveTextContent(/Mochi/), { timeout: 4000 });
    // The theatre ends and the baby is in its room
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(roomStage()).toBe('baby');
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    expect(hatches()).toHaveLength(1);
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(2);

    // The secret never left: not in a payload, a filter, the URL, or a log
    for (const ev of relay.published) expect(JSON.stringify(ev)).not.toContain(nsec.slice(5));
    for (const [filters] of query.mock.calls) expect(JSON.stringify(filters)).not.toContain(nsec.slice(5));
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(nsec.slice(5));
  }, 45_000);
});

describe('a returning player', () => {
  it('with a Blobbi opens straight in the room: no welcome, no onboarding, nothing written', async () => {
    signedInWithExtension();
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3' }), profileEvent()];
    renderApp('/');
    await inRoom();
    expect(screen.queryByTestId('onboarding-welcome')).toBeNull();
    expect(screen.getByTestId('room-header-name')).toHaveTextContent('Brook');
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(relay.published).toEqual([]);
  });

  it('a Blobbi that already hatched (on another device, before a refresh) is shown as the baby; no theatre, no second hatch', async () => {
    signedInWithExtension();
    relay.all = [blobbiEvent('0000000009', { name: 'Pip', stage: 'baby', visualGeneration: 'v3', createdAt: NOW - 60 }), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    renderApp('/');
    await inRoom();
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(roomStage()).toBe('baby');
    expect(relay.published).toEqual([]);
  });
});

describe('when the hatch does not land', () => {
  it('a refused write: the egg stays an egg, the theatre says so; it is not retried by itself; Later leaves the room as it was', async () => {
    signedInWithExtension();
    relay.all = [anEgg(), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    relay.refuse = new Set([KIND_BLOBBI_STATE]);
    renderApp('/');
    await inRoom();
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell();
    const failed = await screen.findByTestId('hatch-theater-failed', {}, { timeout: 8000 });
    expect(failed).toHaveTextContent(/did not hatch yet/);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'egg');
    const tries = event.mock.calls.filter(([e]) => (e as NostrEvent).kind === KIND_BLOBBI_STATE).length;
    expect(tries).toBe(1);
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    expect(event.mock.calls.filter(([e]) => (e as NostrEvent).kind === KIND_BLOBBI_STATE).length).toBe(tries);
    await userEvent.click(screen.getByTestId('hatch-theater-later'));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(roomStage()).toBe('egg');
    expect(hatches()).toHaveLength(0);
    // Not offered again by itself this visit: the room keeps a quiet invitation, and the player can come back to it
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    await userEvent.click(screen.getByTestId('room-hatch-invite'));
    // Back to the moment with the shell whole again: never left half cracked
    const again = await screen.findByTestId('hatch-theater');
    expect(again).toHaveAttribute('data-beat', 'stirring');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'none');
    expect(event.mock.calls.filter(([e]) => (e as NostrEvent).kind === KIND_BLOBBI_STATE).length).toBe(tries);
  }, 30_000);

  it('a refused write, then Try again once the relays take it: the same egg hatches, with one hatch written', async () => {
    signedInWithExtension();
    relay.all = [anEgg(), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    relay.refuse = new Set([KIND_BLOBBI_STATE]);
    renderApp('/');
    await inRoom();
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell();
    await screen.findByTestId('hatch-theater-failed', {}, { timeout: 8000 });
    relay.refuse = new Set();
    await userEvent.click(screen.getByTestId('hatch-theater-retry'));
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    expect(getTagValue(hatches()[0].tags, 'd')).toBe(EGG_D);
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(roomStage()).toBe('baby');
    expect(hatches()).toHaveLength(1);
  }, 30_000);

  it('for whoever cannot tap again and again: "Hatch it for me", from the keyboard, hatches it with one write', async () => {
    signedInWithExtension();
    relay.all = [anEgg(), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    renderApp('/');
    await inRoom();
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    // The egg holds the focus as it is presented: the keyboard can tap it at once
    expect(document.activeElement).toBe(screen.getByTestId('hatch-theater-egg'));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'light');
    screen.getByTestId('hatch-theater-auto').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 10000 });
    expect(screen.queryByTestId('room-hatch-invite')).toBeNull();
    expect(roomStage()).toBe('baby');
    expect(hatches()).toHaveLength(1);
  }, 30_000);

  it('a "refresh" before the taps, and another in the middle of the cracks: each next visit opens on a whole shell; the hatch is written once in all', async () => {
    signedInWithExtension();
    relay.all = [anEgg(), profileEvent({ currentCompanion: EGG_D, has: [EGG_D] })];
    const first = renderApp('/');
    await inRoom();
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    // Gone before the player even tapped (a reload, the tab closed)
    first.unmount();
    cleanup();
    expect(hatches()).toHaveLength(0);
    const second = renderApp('/');
    await inRoom();
    expect(await screen.findByTestId('hatch-theater', {}, { timeout: 8000 })).toHaveAttribute('data-beat', 'stirring');
    // Gone again mid-story, two cracks in, before the write
    await tapTheShell(2);
    expect(screen.getByTestId('hatch-theater')).toHaveAttribute('data-beat', 'cracking');
    second.unmount();
    cleanup();
    expect(hatches()).toHaveLength(0);
    renderApp('/');
    await inRoom();
    // The canonical egg is still unhatched: the shell is whole again, never stuck half cracked
    expect(await screen.findByTestId('hatch-theater', {}, { timeout: 8000 })).toHaveAttribute('data-beat', 'stirring');
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-crack', 'none');
    await tapTheShell();
    await waitFor(() => expect(hatches()).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    await act(() => new Promise((r) => setTimeout(r, 2000)));
    expect(hatches()).toHaveLength(1);
  }, 60_000);
});
