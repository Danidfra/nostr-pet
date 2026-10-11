import { NostrContext } from '@nostrify/react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { BASE_RELAYS } from '@/config/relays';
import { createHomePool } from '@/lib/home-pool';
import { createRelayHealthStore, type RelayHealthStore } from '@/lib/relay-health';
import { RelayHealthContext } from '@/hooks/useRelayHealth';
import { checkRelayTransport } from '@/lib/relay-transport';

interface NostrProviderProps {
  children: ReactNode;
  relays?: readonly string[];
}

/**
 * One relay pool for the app (`createHomePool`): reads go to the application
 * relays plus the ecosystem's read hints, publishes go to the application
 * relays only. Closed when the provider goes away. The relays' connection
 * log feeds the health store (`relay-health.ts`), as do the browser's
 * online/offline events. Whether this page can reach a relay at all is
 * decided once, before any socket (`relay-transport.ts`): a plain-HTTP LAN
 * address has no `crypto.randomUUID`, and the pool refuses every read and
 * write with the reason instead of waiting forever; the health store
 * carries the same words for the home to show.
 */
export function NostrProvider({ children, relays = BASE_RELAYS }: NostrProviderProps) {
  const transport = useMemo(() => checkRelayTransport(), []);
  const health = useMemo(() => createRelayHealthStore(relays, typeof navigator === 'undefined' ? true : navigator.onLine !== false, transport), [relays, transport]);
  const pool = useMemo(() => createHomePool({ relays, transport, log: (entry) => health.log(entry as unknown as Parameters<RelayHealthStore['log']>[0]) }), [relays, health, transport]);

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

export default NostrProvider;
