/**
 * The home with the primary relay (`wss://relay.blobbi.pet` in the app; fake
 * relays here, never a real socket): a new, EMPTY primary that answers first
 * must never make the home say "no Blobbi lives here" and offer adoption to a
 * player whose Blobbi is on the other relays, and relays that did not answer
 * are an unknown state with Try again, never the way in.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): the one whose states are plain to read here
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { createHomePool } from '@/lib/home-pool';
import { SceneSettingsProvider } from '@/features/home/scene';
import { OWN_SYNC_KINDS, PRIMARY_KINDS, PRIMARY_READ_KINDS } from '@/config/relays';
import { createRelaySync } from '@/lib/relay-sync';
import { createCarryGate, type CarryGate } from '@/lib/sync-consent';
import { PROFILE_DELIVERY_KEY } from '@/features/companion/profile-delivery';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }) }));

const PRIMARY = 'wss://primary.test';
const DITTO = 'wss://ditto.test';
const PRIMAL = 'wss://primal.test';

let network: FakeNetwork;

/** The page's wiring, as `NostrProvider` does it: the pool tells the sync, the sync asks the gate. */
function renderHome(gate: CarryGate = createCarryGate(null)) {
  const ref: { pool: NPool | null } = { pool: null };
  const sync = createRelaySync({
    primary: PRIMARY,
    kinds: OWN_SYNC_KINDS,
    destinations: () => [PRIMARY, DITTO, PRIMAL],
    send: (relay, event, signal) => ref.pool!.relay(relay).event(event, { signal }),
    verify: () => true, // the fixtures carry no real signature
    gate,
  });
  sync.setAccount(PUBKEY);
  const pool = (ref.pool = createHomePool({
    observer: { delivery: (event, result) => sync.noteResult(event, result), read: (filters, reports) => void sync.noteRead(filters, reports) },
    relays: [DITTO, PRIMAL],
    hints: [],
    primary: { url: PRIMARY, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS },
    absenceRequired: [PRIMARY, DITTO, PRIMAL],
    open: network.open,
    eoseTimeout: 40,
    relayTimeout: 250,
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <Home />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
  return { ...view, pool };
}

const brook = (): NostrEvent => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: Math.floor(Date.now() / 1000) - 120 });
const careBar = () => screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 4000 });
/** The adoption entry of a signed-in player with no Blobbi (the profile step, then the egg). */
const wayIn = () => document.querySelector('[data-testid^="adoption-"], [data-testid^="profile-"]');
// The kit's collection read retries before it gives up (three times, a growing pause)
const SETTLED = { timeout: 15_000 };

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  network = fakeNetwork();
  window.localStorage.clear();
});

describe('the home over a primary relay that is new and empty', () => {
  it('shows the Blobbi the other relays hold, though the empty primary answered long before them', async () => {
    for (const url of [DITTO, PRIMAL]) {
      network.relay(url).mode = 'slow';
      network.relay(url).delayMs = 150; // far past the grace: the first EOSE (the primary's, empty) no longer ends the read
      network.relay(url).events.push(brook());
    }
    renderHome();
    await careBar();
    expect(screen.queryByText(/No Blobbi lives here yet/)).toBeNull();
    expect(wayIn()).toBeNull();
    // It was asked for the collection, and it did answer: it simply had nothing
    expect(network.relay(PRIMARY).requests.some((filters) => filters.some((f) => f.kinds?.includes(KIND_BLOBBI_STATE)))).toBe(true);
    expect(network.relay(PRIMARY).events).toEqual([]);
  });

  it('with the other relays silent the state is unknown: Try again, never the adoption entry; and the retry finds the Blobbi', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).mode = 'hanging';
    renderHome();
    const alert = await screen.findByRole('alert', {}, SETTLED);
    expect(alert).toHaveTextContent(/Could not reach your Blobbi/);
    expect(alert).toHaveTextContent(/could not be read for certain/);
    expect(wayIn()).toBeNull();
    expect(screen.queryByText(/No Blobbi lives here yet/)).toBeNull();
    for (const url of [DITTO, PRIMAL]) {
      network.relay(url).mode = 'ok';
      network.relay(url).events.push(brook());
    }
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await careBar();
  }, 30_000);

  it('an account with nothing anywhere still reaches the way in, once every relay said so', async () => {
    renderHome();
    await waitFor(() => expect(wayIn()).not.toBeNull(), SETTLED);
    expect(network.relay(DITTO).requests.length).toBeGreaterThan(0);
    expect(network.relay(PRIMAL).requests.length).toBeGreaterThan(0);
  });
});

describe('a restored session is read mode', () => {
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  /** Everything a relay was offered through `event()`, anywhere on the network. */
  const offered = () => network.published().map((x) => `${x.event.kind}@${x.url}`);
  const profile = (): NostrEvent => ({ id: 'd'.repeat(64), pubkey: PUBKEY, kind: 11125, created_at: Math.floor(Date.now() / 1000) - 3600, tags: [['d', 'profile']], content: '', sig: '0'.repeat(128) });

  it('opening the home with a saved sign-in, state on the relays and a profile owed from before sends no relay a single EVENT', async () => {
    // The Blobbi on one secondary only, older on the other, nothing on the primary: three gaps a carry would fill
    network.relay(DITTO).events.push(brook());
    network.relay(PRIMAL).events.push({ ...brook(), id: 'b'.repeat(64), created_at: brook().created_at - 500 });
    // A profile delivery left owed by an earlier visit (`profile-delivery.ts`)
    window.localStorage.setItem(PROFILE_DELIVERY_KEY, JSON.stringify({ version: 1, owed: { [PUBKEY]: { event: profile(), tries: 0, refused: [] } } }));
    renderHome();
    await careBar();
    // Past the pool's linger, the sync's run and the first round of the profile redelivery (10 s after start)
    await pause(11_500);
    expect(offered()).toEqual([]);
    // It did read, everywhere, and shows the newest revision
    for (const url of [PRIMARY, DITTO, PRIMAL]) expect(network.relay(url).requests.length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem(PROFILE_DELIVERY_KEY)!).owed[PUBKEY].tries).toBe(0);
  }, 30_000);

  it('the same session once the account turned copying on: the Blobbi goes to the relays that lack the newest, and nowhere else', async () => {
    network.relay(DITTO).events.push(brook());
    network.relay(PRIMAL).events.push({ ...brook(), id: 'b'.repeat(64), created_at: brook().created_at - 500 });
    const gate = createCarryGate(null);
    gate.enable(PUBKEY, [PRIMARY, PRIMAL]);
    renderHome(gate);
    await careBar();
    await waitFor(() => expect(offered().filter((x) => x.startsWith(`${KIND_BLOBBI_STATE}@`)).sort()).toEqual([`${KIND_BLOBBI_STATE}@${PRIMAL}`, `${KIND_BLOBBI_STATE}@${PRIMARY}`].sort()), { timeout: 4000 });
    expect(network.relay(DITTO).published).toEqual([]);
  });

  it('with copying off, something the player does is still published to the primary and the secondaries', async () => {
    network.relay(DITTO).events.push(brook());
    const { pool } = renderHome();
    await careBar();
    await pause(400);
    expect(offered()).toEqual([]);
    const cared = { ...brook(), id: 'c'.repeat(64), created_at: Math.floor(Date.now() / 1000) };
    await pool.event(cared);
    await pause(50);
    expect(offered().sort()).toEqual([PRIMARY, DITTO, PRIMAL].map((url) => `${KIND_BLOBBI_STATE}@${url}`).sort());
  });
});
