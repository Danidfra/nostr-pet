/**
 * Connection resilience (M11, quieter since M14.1): the home stays quiet
 * while healthy; a relay among several failing is a small dot, no words,
 * nothing to press (what is up still serves); only an outage that lasts
 * (every application relay failing, or the browser offline) becomes the
 * pill with one retry, which forgets the failures and re-reads; the read
 * path itself is nostrify's (a relay down contributes nothing and the
 * others serve, covered in relays.test.tsx).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import Home from '@/pages/Home';
import { OFFLINE_HOLD_MS } from '@/features/home/shell/ConnectionChip';
import { RelayHealthContext } from '@/hooks/useRelayHealth';
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
  it('is absent while healthy; when the only application relay fails it is a dot first and the pill once the outage lasts; a retry forgets the failures and reads again', async () => {
    const store = renderHome();
    await screen.findByRole('group', { name: /care for your blobbi/i });
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    expect(screen.queryByTestId('connection-dot')).toBeNull();
    const reads = query.mock.calls.length;

    act(() => store.log({ ns: 'relay.ws.retry', url: APP, backoff: 1000 }));
    // A reconnect under way is a dot, not a word: sockets dropped by a backgrounded tab come back on their own
    const dot = await screen.findByTestId('connection-dot');
    expect(dot).toHaveAttribute('data-level', 'offline'); // the only application relay is failing
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    const chip = await screen.findByTestId('connection-chip', {}, { timeout: OFFLINE_HOLD_MS + 2000 });
    expect(chip).toHaveAttribute('data-level', 'offline');
    expect(chip).toHaveTextContent(/Relays unreachable/);
    expect(chip).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('connection-dot')).toBeNull();
    expect(event).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('connection-retry'));
    await waitFor(() => expect(screen.queryByTestId('connection-chip')).toBeNull());
    await waitFor(() => expect(query.mock.calls.length).toBeGreaterThan(reads));
    expect(store.snapshot().relays[APP]).toBe('unknown');
  }, 20_000);

  it('some application relays failing is a dot with no button; the browser offline becomes the pill once it lasts; a socket opening again clears it all', async () => {
    const store = renderHome(createRelayHealthStore([APP, 'wss://app2.test']));
    await screen.findByRole('group', { name: /care for your blobbi/i });
    act(() => store.log({ ns: 'relay.ws.error', url: APP }));
    const dot = await screen.findByTestId('connection-dot');
    expect(dot).toHaveAttribute('data-level', 'degraded');
    expect(dot).toHaveAccessibleName(/some relays are not answering/i);
    expect(screen.queryByTestId('connection-retry')).toBeNull();
    // Nothing to press, nothing to read: a long time passes and it stays a dot
    await act(() => new Promise((r) => setTimeout(r, OFFLINE_HOLD_MS + 500)));
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    act(() => store.setOnline(false));
    expect(await screen.findByTestId('connection-chip', {}, { timeout: OFFLINE_HOLD_MS + 2000 })).toHaveTextContent(/Offline/);
    act(() => store.setOnline(true));
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    act(() => store.log({ ns: 'relay.ws.state', state: 'open', url: APP }));
    await waitFor(() => expect(screen.queryByTestId('connection-dot')).toBeNull());
  }, 20_000);
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
