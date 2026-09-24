import { NostrContext } from '@nostrify/react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { BASE_RELAYS } from '@/config/relays';
import { createHomePool } from '@/lib/home-pool';

interface NostrProviderProps {
  children: ReactNode;
  relays?: readonly string[];
}

/**
 * One relay pool for the app (`createHomePool`): reads go to the application
 * relays plus the ecosystem's read hints, publishes go to the application
 * relays only. Closed when the provider goes away.
 */
export function NostrProvider({ children, relays = BASE_RELAYS }: NostrProviderProps) {
  const pool = useMemo(() => createHomePool({ relays }), [relays]);

  useEffect(() => {
    return () => {
      pool.close().catch(() => {
        /* closing a pool that never opened is fine */
      });
    };
  }, [pool]);

  return <NostrContext.Provider value={{ nostr: pool }}>{children}</NostrContext.Provider>;
}

export default NostrProvider;
