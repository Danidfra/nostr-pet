/**
 * Connection health, as the home can honestly know it.
 *
 * What nostrify already does (NRelay1 over websocket-ts): opens a socket
 * per relay on first use, reconnects with exponential backoff (1 s base)
 * when a socket drops, re-sends open subscriptions on reconnect, and
 * closes an idle socket after 30 s with no subscription. That last point
 * matters: this app only ever `query`s, so a CLOSED socket after a read
 * is the normal resting state, not a failure. The pool's `query` returns
 * what the relays that answered served, once the first has answered and
 * the grace period has passed; a relay that is down contributes nothing
 * and throws nothing at the app.
 *
 * What the standalone adds: it listens to NRelay1's log (`relay.ws.state`
 * open, `relay.ws.retry`, `relay.ws.error`) for the APPLICATION relays
 * only (hinted read relays are best-effort transport and never count
 * against health), and to the browser's online/offline events, and folds
 * them into one level:
 *
 *   healthy    no application relay has failed since it last opened
 *   degraded   some have, at least one is fine: reads and writes still go
 *              through what is up, but not everything is being reached
 *   offline    the browser says offline, or every application relay has
 *              failed since it last opened
 *
 * A retry from the user resets the marks to unknown (so a stale "failing"
 * never outlives a real reconnect) and re-runs the reads; the sockets
 * reconnect on their own when the reads open them.
 */
import type { TransportBlock } from './relay-transport';

export type RelayMark = 'unknown' | 'ok' | 'failing';
export type HealthLevel = 'healthy' | 'degraded' | 'offline';

export interface RelayHealth {
  level: HealthLevel;
  online: boolean;
  relays: Record<string, RelayMark>;
  /** The player's extra relays (the relay settings), followed apart: they never change `level`. */
  extras: Record<string, RelayMark>;
  /**
   * Why no relay can be reached from this page at all, or null: decided
   * once from the browser's APIs (`relay-transport.ts`), before any socket;
   * no retry changes it. The home shows it instead of waiting.
   */
  blocked: TransportBlock | null;
}

/** The shape of an NRelay1 log entry the store cares about. */
export interface RelayLogEntry {
  ns: string;
  url?: string;
  state?: string;
  [k: string]: unknown;
}

export interface RelayHealthStore {
  snapshot: () => RelayHealth;
  subscribe: (listener: () => void) => () => void;
  /** Feed an NRelay1 log entry (any relay; only application relays are counted). */
  log: (entry: RelayLogEntry) => void;
  /** The browser's own word. */
  setOnline: (online: boolean) => void;
  /** The user asked to try again: forget past failures. */
  reset: () => void;
  /** Follow these extra relays (the relay settings); marks of relays no longer listed are dropped. */
  trackExtras?: (urls: readonly string[]) => void;
}

export function resolveHealthLevel(online: boolean, relays: Record<string, RelayMark>): HealthLevel {
  if (!online) return 'offline';
  const marks = Object.values(relays);
  if (marks.length === 0) return 'healthy';
  const failing = marks.filter((m) => m === 'failing').length;
  if (failing === 0) return 'healthy';
  return failing === marks.length ? 'offline' : 'degraded';
}

export function createRelayHealthStore(appRelays: readonly string[], initialOnline = true, blocked: TransportBlock | null = null): RelayHealthStore {
  const relays: Record<string, RelayMark> = Object.fromEntries(appRelays.map((u) => [u, 'unknown' as RelayMark]));
  let extras: Record<string, RelayMark> = {};
  let online = initialOnline;
  let snapshot: RelayHealth = { level: resolveHealthLevel(online, relays), online, relays: { ...relays }, extras: {}, blocked };
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { level: resolveHealthLevel(online, relays), online, relays: { ...relays }, extras: { ...extras }, blocked };
    for (const l of listeners) l();
  };
  return {
    snapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    log: (entry) => {
      const url = entry.url;
      const marks = url && url in relays ? relays : url && url in extras ? extras : null;
      if (!url || !marks) return;
      let next: RelayMark | null = null;
      if (entry.ns === 'relay.ws.state' && entry.state === 'open') next = 'ok';
      else if (entry.ns === 'relay.ws.retry' || entry.ns === 'relay.ws.error') next = 'failing';
      if (next === null || marks[url] === next) return;
      marks[url] = next;
      publish();
    },
    trackExtras: (urls) => {
      extras = Object.fromEntries(urls.filter((u) => !(u in relays)).map((u) => [u, extras[u] ?? 'unknown']));
      publish();
    },
    setOnline: (value) => {
      if (online === value) return;
      online = value;
      publish();
    },
    reset: () => {
      for (const url of Object.keys(relays)) relays[url] = 'unknown';
      for (const url of Object.keys(extras)) extras[url] = 'unknown';
      publish();
    },
  };
}
