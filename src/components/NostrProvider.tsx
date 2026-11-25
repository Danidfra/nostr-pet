import { NostrContext } from '@nostrify/react';
import type { NPool } from '@nostrify/nostrify';
import { useEffect, useMemo, type ReactNode } from 'react';
import { verifyEvent } from 'nostr-tools/pure';
import { BASE_RELAYS, OWN_SYNC_KINDS, PRIMARY_KINDS, PRIMARY_READ_KINDS, PRIMARY_RELAY, syncDestinations } from '@/config/relays';
import { createHomePool } from '@/lib/home-pool';
import { createRelaySync, type SyncStore } from '@/lib/relay-sync';
import { RelaySyncContext } from '@/hooks/useRelaySync';
import { carryGate } from '@/lib/sync-consent';
import { createRelayHealthStore, type RelayHealthStore } from '@/lib/relay-health';
import { RelayHealthContext } from '@/hooks/useRelayHealth';
import { checkRelayTransport } from '@/lib/relay-transport';
import { createRelayDiagnostics } from '@/lib/relay-diagnostics';
import { RelayDiagnosticsContext } from '@/hooks/useRelayDiagnostics';
import { extrasForPool, readRelaySettings, subscribeRelaySettings } from '@/features/relays/relay-settings';

interface NostrProviderProps {
  children: ReactNode;
  /** The application relays: the secondaries of a Blobbi flow, the only relays of every other. */
  relays?: readonly string[];
  /**
   * The primary relay for the Blobbi kinds; null for none. Left out, it is `PRIMARY_RELAY` with the application
   * relays the home ships with, and none with any other list: whoever names their own relays names their own primary.
   */
  primary?: string | null;
}

function browserStore(): SyncStore | null {
  try {
    const ls = globalThis.localStorage;
    return ls ? { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) } : null;
  } catch {
    return null;
  }
}

/**
 * One relay pool for the app (`createHomePool`): a Blobbi read goes to the
 * primary relay and the application relays (plus the ecosystem's read
 * hints), a Blobbi write to the primary and the application relays; every
 * other flow (profile metadata, NIP-46 sign-in, themes) stays on the
 * application relays alone. What each relay did with the player's events is
 * kept by `relay-sync.ts`, which also carries an own event to a relay of its
 * flow that certainly lacks it. Closed when the provider goes away. The relays' connection
 * log feeds the health store (`relay-health.ts`), as do the browser's
 * online/offline events. Whether this page can reach a relay at all is
 * decided once, before any socket (`relay-transport.ts`): a plain-HTTP LAN
 * address has no `crypto.randomUUID`, and the pool refuses every read and
 * write with the reason instead of waiting forever; the health store
 * carries the same words for the home to show.
 */
export function NostrProvider({ children, relays = BASE_RELAYS, primary = relays === BASE_RELAYS ? PRIMARY_RELAY : null }: NostrProviderProps) {
  const transport = useMemo(() => checkRelayTransport(), []);
  // Development only: the relay diagnostics panel's store (`relay-diagnostics.ts`); production builds never create it
  const diagnostics = useMemo(() => (import.meta.env.DEV ? createRelayDiagnostics() : null), []);
  // The primary is an application relay to the health store: when it fails, the home is degraded, never offline for it
  const health = useMemo(() => createRelayHealthStore(primary ? [primary, ...relays.filter((url) => url !== primary)] : relays, typeof navigator === 'undefined' ? true : navigator.onLine !== false, transport), [relays, primary, transport]);
  const { pool, sync } = useMemo(() => {
    const ref: { pool: NPool | null } = { pool: null };
    const sync = createRelaySync({
      primary: primary ?? '',
      kinds: primary ? OWN_SYNC_KINDS : [],
      destinations: (kind) => (primary ? syncDestinations(kind).filter((url) => url === primary || relays.includes(url)) : []),
      // The very event a relay returned, to one relay; never through the pool's fan-out
      send: (relay, event, signal) => (ref.pool ? ref.pool.relay(relay).event(event, { signal }) : Promise.reject(new Error('The relays are closed.'))),
      verify: verifyEvent,
      // Off until the account turns copying on (`sync-consent.ts`): opening the home sends nothing
      gate: carryGate,
      store: browserStore(),
    });
    const pool = createHomePool({
      relays,
      primary: primary ? { url: primary, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS } : null,
      transport,
      log: (entry) => {
        health.log(entry as unknown as Parameters<RelayHealthStore['log']>[0]);
        diagnostics?.log(entry as unknown as Parameters<NonNullable<typeof diagnostics>['log']>[0]);
      },
      diagnostics: diagnostics ? { wrap: diagnostics.instrument, probe: diagnostics } : null,
      observer: {
        delivery: (event, result) => sync.noteResult(event, result),
        read: (filters, reports) => void sync.noteRead(filters, reports).catch(() => 0),
      },
    });
    ref.pool = pool;
    // The player's extra relays (the relay settings), in the routes before the first read
    const extras = extrasForPool(readRelaySettings());
    pool.setExtraRelays(extras);
    health.trackExtras?.(extras.filter((e) => e.read || e.write).map((e) => e.url));
    return { pool, sync };
  }, [relays, primary, health, transport, diagnostics]);

  useEffect(() => {
    const on = () => {
      health.setOnline(true);
      // Back online: every connection's next retry is a short one (`relay-backoff.ts`)
      pool.connectivityRestored();
    };
    const off = () => health.setOnline(false);
    // The page visible again (a phone unlocked, the tab chosen): the same fast recovery as coming back online
    const visible = () => {
      if (!document.hidden) pool.connectivityRestored();
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [health, pool]);

  // A change in the relay settings: the same pool, new routes; a relay taken out closes once its writes are done
  useEffect(
    () =>
      subscribeRelaySettings(() => {
        const extras = extrasForPool(readRelaySettings());
        pool.setExtraRelays(extras);
        health.trackExtras?.(extras.filter((e) => e.read || e.write).map((e) => e.url));
      }),
    [pool, health],
  );

  useEffect(() => {
    return () => {
      pool.close().catch(() => {
        /* closing a pool that never opened is fine */
      });
    };
  }, [pool]);

  return (
    <RelayDiagnosticsContext.Provider value={diagnostics}>
      <RelayHealthContext.Provider value={health}>
        <RelaySyncContext.Provider value={sync}>
          <NostrContext.Provider value={{ nostr: pool }}>{children}</NostrContext.Provider>
        </RelaySyncContext.Provider>
      </RelayHealthContext.Provider>
    </RelayDiagnosticsContext.Provider>
  );
}

export default NostrProvider;
