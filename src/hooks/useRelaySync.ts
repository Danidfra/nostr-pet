import { createContext, useContext, useSyncExternalStore } from 'react';
import { NO_RELAY_SYNC, type PrimarySyncStatus, type RelaySync } from '@/lib/relay-sync';
import { carryGate } from '@/lib/sync-consent';
import { COPY_DESTINATIONS } from '@/config/relays';

/**
 * What each relay did with the player's events (`relay-sync.ts`), provided by
 * `NostrProvider`. Defaults to a sync that records and carries nothing, so
 * tests and fixtures that mount no provider read "synced".
 */
export const RelaySyncContext = createContext<RelaySync>(NO_RELAY_SYNC);

export function useRelaySync(): RelaySync {
  return useContext(RelaySyncContext);
}

/** Whether the primary relay has what the player's other relays have, re-rendering on change. */
export function usePrimarySync(): PrimarySyncStatus {
  const { status } = useContext(RelaySyncContext);
  return useSyncExternalStore(status.subscribe, status.snapshot, status.snapshot);
}

/**
 * The account's choice about copying its EXISTING events to the relays that lack them (`sync-consent.ts`): off until
 * it turns it on, for exactly the relays listed. `stale`: it said yes before a relay joined the list, so that relay
 * is not covered until it says yes again.
 */
export function useCopyChoice(pubkey: string | undefined): { on: boolean; stale: boolean; destinations: readonly string[]; set: (on: boolean) => void } {
  useSyncExternalStore(carryGate.subscribe, carryGate.version, carryGate.version);
  const on = carryGate.isEnabled(pubkey);
  return {
    on,
    stale: on && carryGate.uncovered(pubkey, COPY_DESTINATIONS).length > 0,
    destinations: COPY_DESTINATIONS,
    set: (next) => {
      if (!pubkey) return;
      if (next) carryGate.enable(pubkey, COPY_DESTINATIONS);
      else carryGate.disable(pubkey);
    },
  };
}
