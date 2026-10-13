/**
 * The Blobbi's appearance on `/room`: 2D by default, 3D (experimental) on
 * the player's choice, remembered on this device, switched without leaving
 * the room or changing anything about the Blobbi, and never published.
 */
import { isRoomMemoryKey } from '@/features/room/lib/room-memory';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { APPEARANCE_STORAGE_KEY } from './lib/blobbi-appearance';
import { blobbiBoxTiles } from './lib/room-geometry';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

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

function signedInWith(stage: 'egg' | 'baby' | 'adult', generation: 'v1' | 'v2' | 'v3' = 'v3') {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage, state: 'active', visualGeneration: generation })];
}

const shell = () => screen.getByTestId('room-shell');
function choose(appearance: '2d' | '3d') {
  // The room's settings are the menu's (M14.1)
  if (!screen.queryByTestId('room-appearance-panel')) fireEvent.click(screen.getByTestId('room-menu'));
  fireEvent.click(screen.getByTestId(`room-appearance-${appearance}`));
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('the Blobbi\'s appearance in the room', () => {
  it('is the canonical 2D drawing by default; 3D draws the model in its place, and 2D brings the drawing back', async () => {
    signedInWith('adult');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
    fireEvent.click(screen.getByTestId('room-menu'));
    expect(screen.getByTestId('room-settings')).toHaveAttribute('data-appearance', '2d');
    expect(screen.getByRole('radiogroup', { name: 'Blobbi appearance' })).toBeInTheDocument();
    expect(screen.getByTestId('room-appearance-2d')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('room-appearance-3d')).toHaveTextContent(/3D.*Experimental/);
    choose('3d');
    expect(shell()).toHaveAttribute('data-blobbi-render', '3d');
    expect(screen.getByTestId('room-appearance-3d')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('room-settings')).toHaveAttribute('data-appearance', '3d');
    choose('2d');
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
    expect(screen.getByTestId('room-blobbi-anchor').querySelector('[data-blobbi-renderer]')).not.toBeNull();
  });

  it('is remembered on this device: a reload comes back in 3D; something unknown saved comes back in 2D', async () => {
    signedInWith('baby');
    const first = renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    choose('3d');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('3d');
    first.unmount();
    const second = renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    expect(shell()).toHaveAttribute('data-blobbi-render', '3d');
    second.unmount();
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'holographic');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
  });

  it('switching keeps the room, the shell, the Blobbi and its size: only the drawing changes', async () => {
    signedInWith('adult');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    fireEvent.click(screen.getByTestId('room-nav-right'));
    const room = shell().getAttribute('data-room');
    expect(room).not.toBe('home');
    const before = shell();
    const anchor = screen.getByTestId('room-blobbi-anchor');
    expect(anchor.style.getPropertyValue('--blobbi-tiles')).toBe(String(blobbiBoxTiles('adult')));
    choose('3d');
    expect(shell()).toBe(before);
    expect(shell()).toHaveAttribute('data-room', room!);
    expect(screen.getByTestId('room-blobbi-anchor')).toBe(anchor);
    expect(anchor.style.getPropertyValue('--blobbi-tiles')).toBe(String(blobbiBoxTiles('adult')));
    expect(screen.getByTestId('room-header-name')).toHaveTextContent('Brook');
    choose('2d');
    expect(shell()).toHaveAttribute('data-room', room!);
  });

  it('an egg and V1/V2 art stay 2D: the 3D choice is off, and says why', async () => {
    for (const [stage, generation] of [['egg', 'v3'], ['adult', 'v2']] as const) {
      signedInWith(stage, generation);
      const view = renderRoom();
      await screen.findByTestId('room-blobbi-anchor');
      fireEvent.click(screen.getByTestId('room-menu'));
      expect(screen.getByTestId('room-appearance-3d')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('room-appearance-note')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('room-appearance-3d'));
      expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
      expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
      view.unmount();
    }
  });

  it('the panel closes on Escape and moves between the two choices with the arrows', async () => {
    signedInWith('adult');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    fireEvent.click(screen.getByTestId('room-menu'));
    const panel = screen.getByTestId('room-appearance-panel');
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    expect(shell()).toHaveAttribute('data-blobbi-render', '3d');
    fireEvent.keyDown(panel, { key: 'ArrowUp' });
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByTestId('room-appearance-panel')).toBeNull();
  });

  it('is never published: choosing writes only this device\'s preference', async () => {
    signedInWith('adult');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    choose('3d');
    choose('2d');
    expect(setItem.mock.calls.map((c) => c[0]).filter((k) => k !== 'test:login' && !isRoomMemoryKey(k) && !k.startsWith('blobbi:journey:'))).toEqual([APPEARANCE_STORAGE_KEY, APPEARANCE_STORAGE_KEY]);
    expect(relay.published).toEqual([]);
    setItem.mockRestore();
  });
});
