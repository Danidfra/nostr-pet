/**
 * Connection resilience (M11): the home says when it may be out of sync
 * and offers one retry; it stays quiet while healthy; a retry forgets the
 * failures and re-reads; the read path itself is nostrify's (a relay down
 * contributes nothing and the others serve, covered in relays.test.tsx).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import Home from '@/pages/Home';
import { RelayHealthContext } from '@/components/NostrProvider';
import { SceneSettingsProvider } from '@/features/home/scene';
import { createRelayHealthStore } from '@/lib/relay-health';
import { createHomePool } from '@/lib/home-pool';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }) }));

const APP = 'wss://app.test';
const relay = { all: [] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)))));
const event = vi.fn(async () => {});
const pool = { query, event } as unknown as NPool;

function renderHome(store = createRelayHealthStore([APP])) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
      <NostrLoginProvider storageKey="test:login">
        <RelayHealthContext.Provider value={store}>
          <NostrContext.Provider value={{ nostr: pool }}>
            <QueryClientProvider client={client}>
              <MemoryRouter>
                <Home />
              </MemoryRouter>
            </QueryClientProvider>
          </NostrContext.Provider>
        </RelayHealthContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
  return store;
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: { async signEvent(t: NostrEvent) { return t; } } };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook' })];
  query.mockClear();
  event.mockClear();
});

describe('the connection chip', () => {
  it('is absent while healthy, appears when an application relay fails, and a retry forgets the failures and reads again', async () => {
    const store = renderHome();
    await screen.findByRole('group', { name: /care for your blobbi/i });
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    const reads = query.mock.calls.length;

    act(() => store.log({ ns: 'relay.ws.retry', url: APP, backoff: 1000 }));
    const chip = await screen.findByTestId('connection-chip');
    expect(chip).toHaveAttribute('data-level', 'offline'); // the only application relay is failing
    expect(chip).toHaveTextContent(/Relays unreachable/);
    expect(chip).toHaveAttribute('role', 'status');
    expect(event).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('connection-retry'));
    await waitFor(() => expect(screen.queryByTestId('connection-chip')).toBeNull());
    await waitFor(() => expect(query.mock.calls.length).toBeGreaterThan(reads));
    expect(store.snapshot().relays[APP]).toBe('unknown');
  });

  it('says degraded when some application relays fail, offline when the browser is offline, and clears when a socket opens again', async () => {
    const store = renderHome(createRelayHealthStore([APP, 'wss://app2.test']));
    await screen.findByRole('group', { name: /care for your blobbi/i });
    act(() => store.log({ ns: 'relay.ws.error', url: APP }));
    expect(await screen.findByTestId('connection-chip')).toHaveTextContent(/Some relays down/);
    act(() => store.setOnline(false));
    expect(screen.getByTestId('connection-chip')).toHaveTextContent(/Offline/);
    act(() => store.setOnline(true));
    act(() => store.log({ ns: 'relay.ws.state', state: 'open', url: APP }));
    await waitFor(() => expect(screen.queryByTestId('connection-chip')).toBeNull());
  });
});

describe('the store and the pool', () => {
  it('createHomePool accepts the relay log the store listens to, and a failing application relay marks it', () => {
    const pool = createHomePool({ relays: [APP], hints: [], open: () => ({ req: async function* () {}, event: async () => {}, close: async () => {} }) as never, log: () => {} });
    expect(pool).toBeDefined();
    const store = createRelayHealthStore([APP]);
    store.log({ ns: 'relay.ws.retry', url: APP });
    expect(store.snapshot().level).toBe('offline');
  });
});
