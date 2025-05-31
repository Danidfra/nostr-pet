import { NostrEvent, NPool, NRelay1, NostrFilter } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import React, { useRef, useMemo, useEffect } from 'react';

interface NostrProviderProps {
  children: React.ReactNode;
  relays: string[];
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children, relays } = props;

  // Create NPool instance and update it when relays change
  const pool = useRef<NPool | undefined>(undefined);
  
  // Memoize the pool configuration to prevent unnecessary recreations
  const poolConfig = useMemo(() => ({
    open(url: string) {
      return new NRelay1(url);
    },
    reqRouter(filters: NostrFilter[]) {
      return new Map(relays.map((url) => [url, filters]));
    },
    eventRouter(_event: NostrEvent) {
      return relays;
    },
  }), [relays]);

  // Create or recreate pool when configuration changes
  useEffect(() => {
    if (relays.length > 0) {
      pool.current = new NPool(poolConfig);
      console.log('🔗 Nostr pool updated with relays:', relays);
    }
  }, [poolConfig, relays]);

  // Initialize pool if not created yet
  if (!pool.current && relays.length > 0) {
    pool.current = new NPool(poolConfig);
    console.log('🔗 Nostr pool initialized with relays:', relays);
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current! }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;