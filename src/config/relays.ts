/**
 * Relays the standalone reads from and publishes to. Recovered from the
 * pre-nuke relay manager's BASE_RELAYS; the per-user NIP-65 relay manager is
 * deferred (see ARCHITECTURE.md).
 */
export const BASE_RELAYS: readonly string[] = [
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
];
