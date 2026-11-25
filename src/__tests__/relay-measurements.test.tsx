/**
 * Reproducible measurements of the relay layer, on fake relays (no socket
 * leaves the test), recorded by the development diagnostics
 * (`relay-diagnostics.ts`). Each scenario asserts the invariants that must
 * always hold (bounded connections, subscriptions closed after use) and
 * records numbers; `RELAY_MEASURE=1 npx vitest run src/__tests__/relay-measurements.test.tsx`
 * prints them as one table, to compare a change before and after.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import { NRelay1, type NPool, type NostrEvent } from '@nostrify/nostrify';
import { poolWorldTravelRelays } from '@blobbi-kit/react';
import type { ReactNode } from 'react';

import Home from '@/pages/Home';
import { createHomePool } from '@/lib/home-pool';
import { createRelayDiagnostics, openSubscriptions, type DiagnosticsSnapshot, type RelayDiagnostics } from '@/lib/relay-diagnostics';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PRIMARY_KINDS, PRIMARY_READ_KINDS } from '@/config/relays';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }) }));

const PRIMARY = 'wss://primary.test';
const DITTO = 'wss://ditto.test';
const PRIMAL = 'wss://primal.test';
const EXTRA = 'wss://extra.test';

let network: FakeNetwork;
let diagnostics: RelayDiagnostics;
const table: Record<string, Record<string, number | string>> = {};

function pool(): NPool {
  return createHomePool({
    relays: [DITTO, PRIMAL, EXTRA],
    hints: [],
    primary: { url: PRIMARY, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS },
    absenceRequired: [PRIMARY, DITTO, PRIMAL],
    open: network.open,
    eoseTimeout: 40,
    relayTimeout: 400,
    diagnostics: { wrap: diagnostics.instrument, probe: diagnostics },
  });
}

function summary(s: DiagnosticsSnapshot) {
  const done = s.queries.filter((q) => q.finishedAt !== null);
  const durations = done.map((q) => q.finishedAt! - q.startedAt).sort((a, b) => a - b);
  const blobbi = done.filter((q) => q.path === 'blobbi');
  return {
    relays: new Set(s.relaysOpened).size,
    relayObjects: s.relaysOpened.length,
    subscriptions: s.totals.subscriptionsOpened,
    openSubscriptions: openSubscriptions(s).length,
    queries: s.totals.queries,
    blobbiQueries: blobbi.length,
    medianQueryMs: durations.length ? Math.round(durations[Math.floor(durations.length / 2)]) : 0,
    maxQueryMs: durations.length ? Math.round(durations[durations.length - 1]) : 0,
    crossRelayDuplicates: blobbi.reduce((n, q) => n + (q.received - q.unique), 0),
    publications: s.totals.publications,
  };
}

function renderHome(nostr: NPool) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr }}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <Home />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
}

const brook = (): NostrEvent => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: Math.floor(Date.now() / 1000) - 120 });

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  network = fakeNetwork();
  diagnostics = createRelayDiagnostics();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());
afterAll(() => {
  if (process.env.RELAY_MEASURE) console.log(`RELAY MEASUREMENTS\n${JSON.stringify(table, null, 2)}`);
});

describe('relay measurements', () => {
  it('startup of a signed-in home: one relay object per URL, every subscription closed once the home settled, and after unmount', async () => {
    for (const url of [PRIMARY, DITTO, PRIMAL, EXTRA]) network.relay(url).events.push(brook());
    const nostr = pool();
    const view = renderHome(nostr);
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 1500));
    const settled = summary(diagnostics.snapshot());
    view.unmount();
    await new Promise((r) => setTimeout(r, 600));
    const after = diagnostics.snapshot();
    await nostr.close();
    table.startup = { ...settled, openAfterUnmount: openSubscriptions(after).length, relaysClosedByPoolClose: new Set(diagnostics.snapshot().relaysClosed).size };
    expect(settled.relayObjects).toBe(settled.relays);
    expect(settled.relays).toBeLessThanOrEqual(4);
    expect(openSubscriptions(after)).toEqual([]);
  }, 20_000);

  it('two consumers of the same profile at once: one read', async () => {
    const nostr = pool();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NostrContext.Provider value={{ nostr }}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NostrContext.Provider>
    );
    const a = renderHook(() => useBlobbonautProfile(PUBKEY), { wrapper });
    const b = renderHook(() => useBlobbonautProfile(PUBKEY), { wrapper });
    await waitFor(() => expect(a.result.current.isPending || b.result.current.isPending).toBe(false), { timeout: 4000 });
    const s = diagnostics.snapshot();
    const profileQueries = s.queries.filter((q) => q.kinds.includes(11125)).length;
    table.sharedProfile = { profileQueries, subscriptions: s.totals.subscriptionsOpened };
    expect(profileQueries).toBe(1);
  });

  it('a silent essential relay: the read gives up within the relay timeout and every subscription is closed', async () => {
    for (const url of [PRIMARY, PRIMAL, EXTRA]) network.relay(url).events.push(brook());
    network.relay(DITTO).mode = 'hanging';
    const nostr = pool();
    const started = performance.now();
    const outcome = await nostr.query([{ kinds: [31124], authors: [PUBKEY] }]).then(
      (events) => `answered:${events.length}`,
      (error: Error) => error.name,
    );
    const ms = Math.round(performance.now() - started);
    await new Promise((r) => setTimeout(r, 500));
    const s = diagnostics.snapshot();
    const q = s.queries[0];
    // What the read was answered with: the essential relay still silent when the answer was given
    table.silentRelay = { outcome, ms, dittoWhenAnswered: q?.failed.includes(DITTO) ? 'failed' : q?.eose.includes(DITTO) ? 'eose' : 'still silent', openSubscriptions: openSubscriptions(s).length };
    expect(openSubscriptions(s)).toEqual([]);
  });

  it('a travel subscription on relays that end the stream after EOSE: how often it is reopened, and closed by its unsubscribe', async () => {
    vi.useFakeTimers();
    const nostr = pool();
    const relays = poolWorldTravelRelays(nostr, [PRIMARY, DITTO]);
    const stop = relays.subscribe!([{ kinds: [31126], authors: [PUBKEY] }], () => {});
    await vi.advanceTimersByTimeAsync(60_000);
    const reqsInAMinute = diagnostics.snapshot().totals.subscriptionsOpened;
    stop();
    await vi.advanceTimersByTimeAsync(10);
    table.travelSubscription = { relays: 2, reqsInAMinute, openAfterUnsubscribe: openSubscriptions(diagnostics.snapshot()).length };
    expect(openSubscriptions(diagnostics.snapshot())).toEqual([]);
  });

  it('a publication only a non-essential relay accepted: what the caller is told', async () => {
    for (const url of [PRIMARY, DITTO, PRIMAL]) network.relay(url).refuseWith = 'blocked: not today';
    const nostr = pool();
    const event = { ...brook(), id: 'e'.repeat(64) };
    const told = await nostr.event(event).then(
      () => 'resolved (saved)',
      (error: Error) => `rejected: ${error.name}`,
    );
    table.partialPublication = { told, verdicts: diagnostics.snapshot().publications.map((p) => `${p.relay.replace('wss://', '').replace('.test', '')}=${p.verdict}`).join(' ') };
  });

  it('a relay that never connects, over two hours: reconnection attempts and the longest wait', async () => {
    vi.useFakeTimers();
    const sockets: FailingSocket[] = [];
    class FailingSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readyState = 0;
      binaryType = 'blob';
      constructor(readonly url: string) {
        super();
        sockets.push(this);
        setTimeout(() => {
          this.readyState = 3;
          this.dispatchEvent(new Event('error'));
          this.dispatchEvent(new CloseEvent('close', { code: 1006 }));
        }, 10);
      }
      send() {}
      close() {
        this.readyState = 3;
      }
    }
    vi.stubGlobal('WebSocket', FailingSocket);
    const waits: number[] = [];
    const relay = new NRelay1('wss://down.test', {
      log: (entry) => {
        diagnostics.log({ ...(entry as object), url: 'wss://down.test' } as Parameters<RelayDiagnostics['log']>[0]);
        if (entry.ns === 'relay.ws.retry') waits.push((entry as unknown as { backoff: number }).backoff);
      },
    });
    const stop = new AbortController();
    const sub = (async () => {
      try {
        for await (const msg of relay.req([{ kinds: [31124] }], { signal: stop.signal })) void msg;
      } catch {
        /* aborted */
      }
    })();
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
    stop.abort();
    await relay.close().catch(() => {});
    vi.unstubAllGlobals();
    await vi.advanceTimersByTimeAsync(10);
    await sub;
    table.reconnection = { sockets: sockets.length, attemptsIn2h: waits.length, longestWaitS: Math.round(Math.max(...waits) / 1000), lastWaitS: Math.round(waits[waits.length - 1] / 1000) };
    expect(sockets.length).toBeGreaterThan(1);
  }, 30_000);
});
