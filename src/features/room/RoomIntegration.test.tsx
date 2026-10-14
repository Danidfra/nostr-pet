/**
 * The 3D room as part of the app (milestone 6), through the real router: the
 * classic home stays the default; the room is one tap away in the menu, in
 * every build; a player may choose to open in the room (never chosen for
 * them), and is never bounced back into it from its own way out; a signed-out
 * visitor stays with the onboarding; the room works without WebGL, for V1
 * art and for an egg; and none of it publishes.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { EXPERIENCE_STORAGE_KEY, DEFAULT_EXPERIENCE, ROOM_INTRO_STORAGE_KEY, parseExperience, readExperience } from '@/lib/home-experience';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [], metadata: undefined }),
}));

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
  }),
} as unknown as NPool;

function renderAt(entry: string | { pathname: string; state?: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[entry]}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>,
  );
}

function signedInWith(stage: 'egg' | 'baby' | 'adult' = 'adult', generation: 'v1' | 'v2' | 'v3' = 'v3') {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage, state: 'active', visualGeneration: generation })];
}

/** The classic home with its Blobbi in it. */
const onClassicHome = () => screen.findByTestId('blobbi-actor', {}, { timeout: 4000 });
const inRoom = () => screen.findByTestId('room-shell', {}, { timeout: 4000 });

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  currentUser.user = undefined;
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('the room in the app', () => {
  it('the room is a choice: with nothing stored a player with a Blobbi opens in the 2D home; the menu takes them to the room and remembers it', async () => {
    expect(DEFAULT_EXPERIENCE).toBe('classic');
    expect(readExperience()).toBe('classic');
    for (const junk of ['3d', '', null, 'ROOM']) expect(parseExperience(junk)).toBe('classic');
    signedInWith();
    renderAt('/');
    await onClassicHome();
    expect(screen.queryByTestId('room-shell')).toBeNull();
    // The one switch (M14.1), upper right: 3D goes and remembers; the room greets a first visit itself (M14.2)
    expect(screen.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'classic');
    fireEvent.click(screen.getByTestId('mode-3d'));
    await inRoom();
    expect(localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('room');
    const intro = await screen.findByTestId('mode-intro');
    expect(intro).toHaveTextContent(/experimental/);
    expect(within(intro).getByTestId('mode-intro-appearance')).toHaveTextContent(/Both are the same Brook/);
    expect(within(intro).getByTestId('mode-intro-preview-2d')).toHaveTextContent(/Classic/);
    expect(within(intro).getByTestId('mode-intro-preview-3d')).toHaveTextContent(/3D Model/);
    expect(intro).toHaveTextContent(/2D home is always one tap away/);
    expect(within(intro).getByTestId('mode-intro-dismiss')).toBeChecked();
    fireEvent.click(within(intro).getByTestId('mode-intro-explore'));
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    expect(localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBe('seen');
    expect(screen.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'room');
    // One home: no way "back" in the header; the 2D home is the switch's
    expect(screen.queryByTestId('room-back')).toBeNull();
    expect(relay.published).toEqual([]);
  });

  it('the 2D home stays reachable from the room: the switch opens it without bouncing back, remembers the choice, and 3D asks nothing the second time', async () => {
    signedInWith();
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    renderAt('/');
    await inRoom();
    expect(screen.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'room');
    fireEvent.click(screen.getByTestId('mode-2d'));
    await onClassicHome();
    expect(screen.queryByTestId('room-shell')).toBeNull();
    expect(localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('classic');
    expect(screen.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'classic');
    fireEvent.click(screen.getByTestId('mode-3d'));
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    await inRoom();
    expect(relay.published).toEqual([]);
  });

  it('a player who chose the classic home keeps it: they open there; the room\'s introduction respects "Don\'t show this again", and comes back only when it was unticked', async () => {
    signedInWith();
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'classic');
    const first = renderAt('/');
    await onClassicHome();
    expect(screen.queryByTestId('room-shell')).toBeNull();
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    fireEvent.click(screen.getByTestId('mode-3d'));
    await inRoom();
    const intro = await screen.findByTestId('mode-intro');
    // Unticked: it may greet again next time
    fireEvent.click(within(intro).getByTestId('mode-intro-dismiss'));
    expect(within(intro).getByTestId('mode-intro-dismiss')).not.toBeChecked();
    fireEvent.click(within(intro).getByTestId('mode-intro-explore'));
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    expect(localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('room-shell')).toBeInTheDocument();
    first.unmount();
    renderAt('/');
    await inRoom();
    const again = await screen.findByTestId('mode-intro');
    // Ticked (the default): never again on this device
    fireEvent.click(within(again).getByTestId('mode-intro-explore'));
    expect(localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBe('seen');
    expect(screen.queryByTestId('mode-intro')).toBeNull();
  });

  it('the menu is the one settings entry: in the room it holds the room\'s own settings, sound and the account; the dock holds the Blobbi and the room', async () => {
    signedInWith();
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    renderAt('/room');
    await inRoom();
    expect(screen.queryByTestId('room-settings-toggle')).toBeNull();
    fireEvent.click(screen.getByTestId('room-menu'));
    const menu = screen.getByTestId('menu-sheet');
    expect(within(menu).getByTestId('menu-room-settings')).toBeInTheDocument();
    // The Blobbi's look is the Blobbi sheet's (M14.2), not a room setting
    expect(within(menu).queryByTestId('room-appearance-panel')).toBeNull();
    expect(within(menu).getByTestId('room-quality-select')).toBeInTheDocument();
    expect(within(menu).getByTestId('sound-toggle')).toBeInTheDocument();
    expect(within(menu).getByTestId('menu-account')).toBeInTheDocument();
    expect(within(menu).queryByTestId('open-classic')).toBeNull();
    expect(within(menu).queryByTestId('room-first-toggle')).toBeNull();
    fireEvent.click(screen.getByTestId('menu-sheet-close'));
    // The dock: the Blobbi on the left opens its sheet; the room on the right says why it cannot decorate here
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    expect(await screen.findByTestId('room-blobbi-sheet')).toBeInTheDocument();
    expect(within(screen.getByTestId('room-blobbi-sheet')).getByTestId('room-appearance-panel')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('room-bar-decorate')).toBeDisabled());
    expect(screen.getByTestId('room-bar-decorate')).toHaveAccessibleName(/decorating needs 3D graphics/i);
  });

  it('a signed-out visitor gets the welcome, at / and at /room alike', async () => {
    renderAt('/');
    expect(await screen.findByTestId('onboarding-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('room-shell')).toBeNull();
    cleanup();
    renderAt('/room');
    expect(await screen.findByTestId('onboarding-welcome')).toBeInTheDocument();
  });

  it('without WebGL the room still works: the Blobbi stands in it, its needs show, the carousel uses items; decorating says why it cannot', async () => {
    signedInWith();
    renderAt('/room');
    const shell = await inRoom();
    await waitFor(() => expect(shell).toHaveAttribute('data-scene', 'unavailable'));
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    expect(screen.getByTestId('room-status-hud')).toBeInTheDocument();
    expect(await screen.findByTestId('room-item-use')).toBeEnabled();
    expect(await screen.findByRole('button', { name: /decorating needs 3D graphics/i })).toBeDisabled();
  });

  it('changing rooms, the graphics quality, the Blobbi\'s look and the sound stays on this device: nothing is published, only local preferences are written', async () => {
    signedInWith();
    renderAt('/room');
    await inRoom();
    const before = new Set(Object.keys(localStorage));
    fireEvent.click(screen.getByTestId('room-nav-right'));
    fireEvent.click(screen.getByTestId('room-nav-right'));
    fireEvent.click(screen.getByTestId('room-menu'));
    fireEvent.change(screen.getByTestId('room-quality-select'), { target: { value: 'low' } });
    expect(localStorage.getItem('blobbi:room:quality')).toBe('low');
    fireEvent.click(screen.getByTestId('sound-toggle'));
    fireEvent.click(screen.getByTestId('menu-sheet-close'));
    fireEvent.click(screen.getByTestId('room-nav-left'));
    // Whatever was written is a local preference or the room's own memory, never an event
    await new Promise((r) => setTimeout(r, 50));
    const written = Object.keys(localStorage).filter((k) => !before.has(k));
    for (const key of written) expect(key).toMatch(/^blobbi[:-]/);
    expect(relay.published).toEqual([]);
    expect(pool.event).not.toHaveBeenCalled();
  });

  it('a V1 Blobbi and an egg have their room too: drawn by the kit, 2D, no blank screen', async () => {
    for (const [stage, generation] of [['adult', 'v1'], ['egg', 'v3']] as const) {
      signedInWith(stage, generation);
      const view = renderAt('/room');
      await inRoom();
      expect(screen.getByTestId('room-blobbi-anchor').querySelector('[data-blobbi-renderer]')).not.toBeNull();
      expect(screen.getByTestId('room-shell')).toHaveAttribute('data-blobbi-render', '2d');
      view.unmount();
    }
  });

  it('the stats show in the room, and a tap on one goes to the room that restores it (no write)', async () => {
    signedInWith();
    renderAt('/room');
    await inRoom();
    fireEvent.click(await screen.findByTestId('room-stat-hunger'));
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'kitchen');
    fireEvent.click(screen.getByTestId('room-stat-energy'));
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'rest');
    expect(relay.published).toEqual([]);
  });
});
