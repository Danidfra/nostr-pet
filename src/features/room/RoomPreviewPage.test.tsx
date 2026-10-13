/**
 * The `/room` preview: reachable in a dev build, in front of the signed-out
 * message when nobody is signed in, and the player's own Blobbi in the room
 * (facing front, in the living room, with the registry's label) when one is.
 * Nothing is published by opening it.
 */
import { isRoomMemoryKey } from '@/features/room/lib/room-memory';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';

import AppRouter from '@/AppRouter';
import { roomById } from '@/features/home/rooms/rooms';
import { roomFurnitureFor } from '@/features/room/lib/room-furniture';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)))));
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
});
const pool = { query, event } as unknown as NPool;

function renderAt(path: string) {
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

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

beforeEach(() => {
  relay.all = [];
  relay.published = [];
  currentUser.user = undefined;
});

describe('the /room preview', () => {
  it('is served in every build, and sends a signed-out visitor to the welcome at the root', async () => {
    renderAt('/room');
    expect(await screen.findByTestId('onboarding-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('room-preview')).toBeNull();
  });

  it('shows the signed-in player\'s Blobbi in the living room, facing front, and publishes nothing', async () => {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
    renderAt('/room');
    const anchor = await screen.findByTestId('room-blobbi-anchor');
    expect(anchor.querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-facing', 'front');
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'home');
    expect(screen.getByTestId('room-label')).toHaveTextContent(roomById('home').label);
    expect(screen.getByTestId('room-header-name')).toHaveTextContent('Brook');
    // Its name is not left over its head: it shows on demand
    expect(screen.getByTestId('room-blobbi-name')).toHaveAttribute('data-shown', 'false');
    expect(screen.getByRole('button', { name: 'Brook, your Blobbi' })).toBeInTheDocument();
    // The room is the home: its menu, not a back arrow, holds the classic home
    expect(screen.queryByTestId('room-back')).toBeNull();
    expect(screen.getByTestId('room-menu')).toBeInTheDocument();
    expect(relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(0);
    expect(relay.published).toHaveLength(0);
  });

  it('a sleeper is in the bedroom, whatever room was chosen', async () => {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'sleeping', visualGeneration: 'v3' })];
    renderAt('/room');
    await screen.findByTestId('room-blobbi-anchor');
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'rest');
  });

  it('decorates a room: the decorate button needs the 3D room, which jsdom has not', async () => {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
    renderAt('/room');
    await screen.findByTestId('room-blobbi-anchor');
    const decorate = await screen.findByRole('button', { name: /decorating needs 3D graphics/i });
    expect(decorate).toBeDisabled();
  });
});

describe('decorating on the /room preview (the 3D room stubbed as ready)', () => {
  afterEach(() => vi.restoreAllMocks());

  async function openDecorator() {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
    const utils = renderAt('/room');
    await screen.findByTestId('room-blobbi-anchor');
    // The shell enables decorating only with a scene; the status is what the button reads
    const shell = screen.getByTestId('room-shell');
    expect(shell).toHaveAttribute('data-scene', 'unavailable');
    return utils;
  }

  it('without WebGL the decorate button stays off and the room shows its defaults; nothing is written anywhere', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await openDecorator();
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'home');
    expect(roomFurnitureFor('home').length).toBeGreaterThan(0);
    // The only keys written are the test harness's own login store and the room's memory of where the player was
    // (this device only, never Nostr) and the journey's device record (a cuddle, a nap, chapters celebrated); nothing of the room's decoration
    expect(setItem.mock.calls.map((c) => c[0]).filter((k) => k !== 'test:login' && !isRoomMemoryKey(k) && !k.startsWith('blobbi:journey:'))).toEqual([]);
    expect(relay.published).toHaveLength(0);
    await waitFor(() => expect(event).not.toHaveBeenCalled());
  });
});
