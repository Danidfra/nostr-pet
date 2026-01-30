/**
 * NIP-65 Bootstrap Hook
 * Handles the boot sequence: base relays -> cache -> fetch NIP-65 -> merge
 */

import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRelayContext } from '@/contexts/RelayContext';
import { useNip65Sync } from '@/hooks/useNip65Sync';

export function useNip65Bootstrap() {
  const { user } = useCurrentUser();
  const { relays, importFromNip65Cache } = useRelayContext();
  const { fetchNip65 } = useNip65Sync();
  const hasBootstrapped = useRef(false);
  const hasFetchedRemote = useRef(false);

  // Boot sequence
  useEffect(() => {
    // Only run once when user is available and we have relays
    if (!user?.pubkey || relays.length === 0 || hasBootstrapped.current) {
      return;
    }

    hasBootstrapped.current = true;

    console.debug('[NIP-65 Bootstrap] Starting for user', user.pubkey);

    // Step 1: Try to import from cache immediately (synchronous, fast)
    const cacheResult = importFromNip65Cache(user.pubkey);

    if (cacheResult.imported) {
      console.debug('[NIP-65 Bootstrap] Loaded', cacheResult.count, 'relays from cache');
    }

    // Step 2: Fetch from remote in parallel (non-blocking)
    // Use cached relays if available, otherwise use current relays
    const queryRelays = relays.filter(r => r.enabled).map(r => r.url);

    if (queryRelays.length > 0 && !hasFetchedRemote.current) {
      hasFetchedRemote.current = true;

      // Fetch in background without blocking
      fetchNip65(user.pubkey, queryRelays)
        .then((result) => {
          if (result.found) {
            console.debug('[NIP-65 Bootstrap] Updated from remote:', result.newCount, 'new,', result.updatedCount, 'updated');
          } else {
            console.debug('[NIP-65 Bootstrap] No remote relay list found');
          }
        })
        .catch((error) => {
          console.error('[NIP-65 Bootstrap] Failed to fetch from remote:', error);
        });
    }
  }, [user?.pubkey, relays.length, importFromNip65Cache, fetchNip65, relays]);
}
