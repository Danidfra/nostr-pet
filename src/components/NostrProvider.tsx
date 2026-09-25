import { NostrContext } from '@nostrify/react';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { BASE_RELAYS } from '@/config/relays';
import { createHomePool } from '@/lib/home-pool';
import { createRelayHealthStore, type RelayHealth, type RelayHealthStore } from '@/lib/relay-health';

interface NostrProviderProps {
  children: ReactNode;
  relays?: readonly string[];
}

const HEALTHY: RelayHealth = { level: 'healthy', online: true, relays: {} };
const noopStore: RelayHealthStore = { snapshot: () => HEALTHY, subscribe: () => () => {}, log: () => {}, setOnline: () => {}, reset: () => {} };

/** The connection health store, for `useRelayHealth`. Defaults to a silent, healthy store (tests, fixtures). */
export const RelayHealthContext = createContext<RelayHealthStore>(noopStore);

/**
 * One relay pool for the app (`createHomePool`): reads go to the application
 * relays plus the ecosystem's read hints, publishes go to the application
 * relays only. Closed when the provider goes away. The relays' connection
 * log feeds the health store (`relay-health.ts`), as do the browser's
 * online/offline events.
 */
export function NostrProvider({ children, relays = BASE_RELAYS }: NostrProviderProps) {
  const health = useMemo(() => createRelayHealthStore(relays, typeof navigator === 'undefined' ? true : navigator.onLine !== false), [relays]);
  const pool = useMemo(() => createHomePool({ relays, log: (entry) => health.log(entry as unknown as Parameters<RelayHealthStore['log']>[0]) }), [relays, health]);

  useEffect(() => {
    const on = () => health.setOnline(true);
    const off = () => health.setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [health]);

  useEffect(() => {
    return () => {
      pool.close().catch(() => {
        /* closing a pool that never opened is fine */
      });
    };
  }, [pool]);

  return (
    <RelayHealthContext.Provider value={health}>
      <NostrContext.Provider value={{ nostr: pool }}>{children}</NostrContext.Provider>
    </RelayHealthContext.Provider>
  );
}

/** The current connection health, re-rendering on change; `reset` forgets past failures before a retry. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook and the provider share the context
export function useRelayHealth(): { health: RelayHealth; reset: () => void } {
  const store = useContext(RelayHealthContext);
  const health = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return { health, reset: store.reset };
}

export default NostrProvider;
