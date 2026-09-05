import { NPool, NRelay1, type NostrFilter } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { BASE_RELAYS } from '@/config/relays';

interface NostrProviderProps {
  children: ReactNode;
  relays?: readonly string[];
}

/**
 * One relay pool for the app. Reads fan out to every configured relay and
 * events publish to all of them. Recovered from the pre-nuke provider, minus
 * the NIP-65 relay manager (deferred).
 */
export function NostrProvider({ children, relays = BASE_RELAYS }: NostrProviderProps) {
  const pool = useMemo(() => {
    const urls = [...relays];
    return new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters: NostrFilter[]) {
        return new Map(urls.map((url) => [url, filters]));
      },
      eventRouter() {
        return urls;
      },
    });
  }, [relays]);

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
