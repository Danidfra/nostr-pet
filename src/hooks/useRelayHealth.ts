import { createContext, useContext, useSyncExternalStore } from 'react';
import type { RelayHealth, RelayHealthStore } from '@/lib/relay-health';

const HEALTHY: RelayHealth = { level: 'healthy', online: true, relays: {}, blocked: null };
const noopStore: RelayHealthStore = { snapshot: () => HEALTHY, subscribe: () => () => {}, log: () => {}, setOnline: () => {}, reset: () => {} };

/**
 * The connection health store, provided by `NostrProvider`. Defaults to a
 * silent, healthy store, so tests and fixtures that mount no provider read
 * "healthy" and nothing else changes.
 */
export const RelayHealthContext = createContext<RelayHealthStore>(noopStore);

/** The current connection health, re-rendering on change; `reset` forgets past failures before a retry. */
export function useRelayHealth(): { health: RelayHealth; reset: () => void } {
  const store = useContext(RelayHealthContext);
  const health = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return { health, reset: store.reset };
}
