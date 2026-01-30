import { NostrEvent, NPool, NRelay1, NostrFilter } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import React, { useRef, useMemo, useEffect } from 'react';
import { BASE_RELAYS } from '@/hooks/useRelayManager';

interface NostrProviderProps {
  children: React.ReactNode;
  relays: string[];
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children, relays } = props;

  // Use a ref to store the pool instance to avoid React state updates
  const poolRef = useRef<NPool | undefined>(undefined);
  const relaysRef = useRef<string>('');

  // Memoize the pool configuration
  const pool = useMemo(() => {
    // Use BASE_RELAYS as fallback to ensure we always have a working pool
    const effectiveRelays = relays.length > 0 ? relays : BASE_RELAYS;
    const relayString = effectiveRelays.join(',');

    // Only recreate pool if relays actually changed
    if (relayString === relaysRef.current && poolRef.current) {
      return poolRef.current;
    }

    // Close old pool if it exists
    if (poolRef.current) {
      poolRef.current.close().catch((error) => {
        console.warn('⚠️ Error closing old pool:', error);
      });
    }

    // Create new pool instance
    const newPool = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters: NostrFilter[]) {
        return new Map(effectiveRelays.map((url) => [url, filters]));
      },
      eventRouter(_event: NostrEvent) {
        return effectiveRelays;
      },
    });

    poolRef.current = newPool;
    relaysRef.current = relayString;

    return newPool;
  }, [relays]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (poolRef.current) {
        poolRef.current.close().catch((error) => {
          console.warn('⚠️ Error during unmount cleanup:', error);
        });
      }
    };
  }, []);

  return (
    <NostrContext.Provider value={{ nostr: pool }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;