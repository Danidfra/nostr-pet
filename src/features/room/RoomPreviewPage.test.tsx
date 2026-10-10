/**
 * The `/room` preview: reachable in a dev build, in front of the signed-out
 * message when nobody is signed in, and the player's own Blobbi in the room
 * (facing front, in the living room, with the registry's label) when one is.
 * Nothing is published by opening it.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';

import AppRouter from '@/AppRouter';
import { roomById } from '@/features/home/rooms/rooms';
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
  it('is a dev route, and asks a signed-out visitor to sign in on the home', async () => {
    expect(import.meta.env.DEV).toBe(true);
    renderAt('/room');
    expect(await screen.findByTestId('room-preview')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/sign in/i);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('shows the signed-in player\'s Blobbi in the living room, facing front, and publishes nothing', async () => {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
    renderAt('/room');
    const anchor = await screen.findByTestId('room-blobbi-anchor');
    expect(anchor.querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-facing', 'front');
    expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'home');
    expect(screen.getByTestId('room-label')).toHaveTextContent(roomById('home').label);
    expect(screen.getByTestId('room-dock')).toHaveTextContent('Brook');
    expect(screen.getByTestId('room-back')).toHaveAttribute('href', '/');
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
});
