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
  const cleanupInProgress = useRef(false);

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
    // Prevent multiple simultaneous cleanup operations
    if (cleanupInProgress.current) {
      return;
    }

    // Cleanup old pool if it exists
    const oldPool = pool.current;
    if (oldPool) {
      cleanupInProgress.current = true;

      oldPool.close().then(() => {

        cleanupInProgress.current = false;
      }).catch((error) => {
        console.warn('⚠️ Error during pool cleanup:', error);
        cleanupInProgress.current = false;
      });
    }

    if (relays.length > 0) {
      pool.current = new NPool(poolConfig);

    } else {
      pool.current = undefined;
    }

    // Cleanup function for when component unmounts or relays change
    return () => {
      if (pool.current && !cleanupInProgress.current) {
        cleanupInProgress.current = true;

        pool.current.close().then(() => {
          cleanupInProgress.current = false;
        }).catch((error) => {
          console.warn('⚠️ Error during effect cleanup:', error);
          cleanupInProgress.current = false;
        });
      }
    };
  }, [poolConfig, relays]);

  return (
    <NostrContext.Provider value={{ nostr: pool.current! }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;