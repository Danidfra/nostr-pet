/**
 * The home never looks for a Blobbi forever. A page that cannot reach
 * relays at all (plain HTTP on a LAN address: the browser withholds
 * `crypto.randomUUID`, which every relay subscription needs) is told so at
 * once, with the way out and a retry, before any socket; a read no relay
 * answers ends in an error with a retry, and the retry reads again. The
 * room route says the same, in its own frame.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool } from '@nostrify/nostrify';

import AppRouter from '@/AppRouter';
import { NostrProvider } from '@/components/NostrProvider';
import { RelayHealthContext } from '@/hooks/useRelayHealth';
import { SceneSettingsProvider } from '@/features/home/scene';
import { createRelayHealthStore } from '@/lib/relay-health';
import { createHomePool } from '@/lib/home-pool';
import { fakeNetwork } from '@/test/fake-relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }) }));

const APP = 'wss://app.test';
const socket = vi.fn();

function Providers({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
      <NostrLoginProvider storageKey="test:login">
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NostrLoginProvider>
    </SceneSettingsProvider>
  );
}

/** The browser as a plain-HTTP LAN page sees it: getRandomValues, no randomUUID, not secure. */
function asInsecureLanPage() {
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
}
function asSecurePage() {
  delete (globalThis.crypto as unknown as Record<string, unknown>).randomUUID;
  delete (window as unknown as Record<string, unknown>).isSecureContext;
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', socket);
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
afterEach(() => {
  asSecurePage();
  vi.unstubAllGlobals();
  socket.mockClear();
});

describe('a page that cannot reach relays', () => {
  it('the home says why at once, with the way out and a retry, and opens no socket', async () => {
    asInsecureLanPage();
    expect(typeof crypto.randomUUID).toBe('undefined');
    render(
      <Providers>
        <NostrProvider relays={[APP]}>
          <MemoryRouter>
            <AppRouter />
          </MemoryRouter>
        </NostrProvider>
      </Providers>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Could not reach your Blobbi/);
    expect(alert).toHaveTextContent(/plain HTTP/);
    expect(alert).toHaveTextContent(/https:\/\//);
    expect(alert).toHaveTextContent(/localhost/);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/Looking for your Blobbi/)).toBeNull();
    expect(socket).not.toHaveBeenCalled();
  });

  it('the room route says the same in its frame, with a retry and the way home', async () => {
    asInsecureLanPage();
    render(
      <Providers>
        <NostrProvider relays={[APP]}>
          <MemoryRouter initialEntries={['/room']}>
            <AppRouter />
          </MemoryRouter>
        </NostrProvider>
      </Providers>,
    );
    const message = await screen.findByTestId('room-message');
    expect(message).toHaveAttribute('data-status', 'error');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent(/plain HTTP/);
    expect(screen.getByTestId('room-retry')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(socket).not.toHaveBeenCalled();
  });

  it('a secure page with Web Crypto is not refused: the read goes out', async () => {
    const network = fakeNetwork();
    network.relay(APP).events.push(blobbiEvent('0000000001', { name: 'Brook' }));
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, eoseTimeout: 10 });
    render(
      <Providers>
        <RelayHealthContext.Provider value={createRelayHealthStore([APP])}>
          <NostrContext.Provider value={{ nostr: pool }}>
            <MemoryRouter>
              <AppRouter />
            </MemoryRouter>
          </NostrContext.Provider>
        </RelayHealthContext.Provider>
      </Providers>,
    );
    expect(await screen.findByTestId('blobbi-actor', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe('a read no relay answers', () => {
  it('ends in an error with a retry instead of looking forever, and the retry reads again', async () => {
    const network = fakeNetwork();
    network.relay(APP).mode = 'hanging';
    const pool = createHomePool({ relays: [APP], hints: [], open: network.open, transport: null, readTimeout: 50, eoseTimeout: 10 }) as NPool;
    const store = createRelayHealthStore([APP]);
    render(
      <Providers>
        <RelayHealthContext.Provider value={store}>
          <NostrContext.Provider value={{ nostr: pool }}>
            <MemoryRouter>
              <AppRouter />
            </MemoryRouter>
          </NostrContext.Provider>
        </RelayHealthContext.Provider>
      </Providers>,
    );
    expect(await screen.findByText(/Looking for your Blobbi/)).toBeInTheDocument();
    // The kit's collection read retries three times (1 s, 2 s, 4 s); each attempt hits the deadline
    const alert = await screen.findByRole('alert', {}, { timeout: 12_000 });
    expect(alert).toHaveTextContent(/No relay answered within/);
    expect(screen.queryByText(/Looking for your Blobbi/)).toBeNull();

    // The relay comes back; the player tries again
    network.relay(APP).mode = 'ok';
    network.relay(APP).events.push(blobbiEvent('0000000001', { name: 'Brook' }));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('blobbi-actor', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  }, 20_000);
});
