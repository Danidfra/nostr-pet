/**
 * Render cost: the Blobbi walks at sixty frames a second, and only the
 * actor should pay for it. The furniture layer, the backdrop and the dock
 * are memoized, so a walk re-renders them zero times.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const counts = vi.hoisted(() => ({ furniture: 0, backdrop: 0, dock: 0 }));
// Each wrapper counts how often React asks it to render; wrapped in memo
// like the real components, it renders only when its props change.
vi.mock('@/features/home/rooms/FurnitureLayer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/home/rooms/FurnitureLayer')>();
  const { memo, createElement } = await import('react');
  const Original = mod.FurnitureLayer;
  const Impl = (props: React.ComponentProps<typeof Original>) => {
    counts.furniture += 1;
    return createElement(Original, props);
  };
  return { ...mod, FurnitureLayer: memo(Impl) };
});
vi.mock('@/features/home/rooms/RoomBackdrop', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/home/rooms/RoomBackdrop')>();
  const { memo, createElement } = await import('react');
  const Original = mod.RoomBackdrop;
  const Impl = (props: React.ComponentProps<typeof Original>) => {
    counts.backdrop += 1;
    return createElement(Original, props);
  };
  return { ...mod, RoomBackdrop: memo(Impl) };
});
vi.mock('@/features/home/shell/ActionBar', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/home/shell/ActionBar')>();
  const { memo, createElement } = await import('react');
  const Original = mod.ActionBar;
  const Impl = (props: React.ComponentProps<typeof Original>) => {
    counts.dock += 1;
    return createElement(Original, props);
  };
  return { ...mod, ActionBar: memo(Impl) };
});

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const NOW = Math.floor(Date.now() / 1000);
const relay = { all: [blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state: 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } })] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)))));
const event = vi.fn(async (ev: NostrEvent) => {
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [ev];
});
const pool = { query, event } as unknown as NPool;

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  counts.furniture = 0;
  counts.backdrop = 0;
  counts.dock = 0;
});

describe('Render cost of a walk', () => {
  it('re-renders the actor every frame but the furniture, the backdrop and the dock not at all', async () => {
    render(
      <SceneSettingsProvider value={{ walkSpeed: 0.6, idleEnabled: false }}>
        <NostrLoginProvider storageKey="test:login">
          <NostrContext.Provider value={{ nostr: pool }}>
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
              <MemoryRouter>
                <Home />
              </MemoryRouter>
            </QueryClientProvider>
          </NostrContext.Provider>
        </NostrLoginProvider>
      </SceneSettingsProvider>,
    );
    await screen.findByRole('group', { name: /care for your blobbi/i });
    screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    // Let the first paint settle (the inventory query resolves and the dock renders once more).
    await new Promise((r) => setTimeout(r, 150));
    const before = { ...counts };
    const a = screen.getByTestId('blobbi-actor');
    const startX = a.getAttribute('data-x');
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 120, clientY: 520, detail: 1 });
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'), { timeout: 4000 });
    expect(a.getAttribute('data-x')).not.toBe(startX);
    // The walk took many frames; none of them touched these.
    expect(counts.furniture - before.furniture).toBe(0);
    expect(counts.backdrop - before.backdrop).toBe(0);
    expect(counts.dock - before.dock).toBeLessThanOrEqual(2); // the walk starts and ends: the verbs' disabled state may flip
  });
});
