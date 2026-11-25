/**
 * Relay diagnostics: what the pool's connections are doing, for the dev
 * panel and for reproducible measurements in tests. Development only:
 * `NostrProvider` creates a store only when `import.meta.env.DEV` is true, so
 * the bundler drops this module from a production build (search `dist/` for
 * `eose-abort` after `npm run build`: nothing).
 *
 * What is recorded is the shape of the traffic, never its substance: relay
 * URLs, kinds, event ids (to count duplicates), counts, durations and
 * verdict words. No event content, no tags, no authors, no signatures, no
 * keys, no AUTH material. History is bounded (`MAX_RECORDS` per list).
 *
 * Three sources feed it:
 *
 *   socket    NRelay1's own log (`relay.ws.state`, `relay.ws.retry`,
 *             `relay.ws.error`): open sockets and reconnection attempts
 *   relay     `instrumentRelay` wraps each relay the pool opens: every
 *             subscription (a REQ, whoever made it: the pool, a kit hook,
 *             a travel subscription) from open to close, its EOSE, its
 *             events and duplicates within it, and every publication's
 *             verdict per relay
 *   query     the pool's probe (`QueryProbe`): one record per `query()`,
 *             with its duration, outcome, and per-relay EOSE and timeouts
 */
import type { NRelay, NostrEvent, NostrFilter, NostrRelayCLOSED, NostrRelayEOSE, NostrRelayEVENT } from '@nostrify/nostrify';

export const MAX_RECORDS = 200;

export interface SubscriptionRecord {
  id: number;
  relay: string;
  /** The kinds asked for (no authors, no tags). */
  kinds: number[];
  openedAt: number;
  closedAt: number | null;
  eoseAt: number | null;
  events: number;
  /** Events this subscription delivered more than once (the same id). */
  duplicates: number;
  /** How it ended: `eose-abort` (closed by its owner after EOSE), `abort`, `closed` (relay CLOSED), `error`, `ended`. */
  end: string | null;
}

export interface QueryRecord {
  id: number;
  path: 'blobbi' | 'plain';
  kinds: number[];
  relays: string[];
  startedAt: number;
  finishedAt: number | null;
  outcome: 'answered' | 'empty' | 'unknown' | 'timeout' | 'aborted' | 'error' | null;
  /** Events received from all relays, and how many distinct ids they were. */
  received: number;
  unique: number;
  eose: string[];
  failed: string[];
}

export interface PublicationRecord {
  at: number;
  eventId: string;
  kind: number;
  relay: string;
  verdict: string;
}

export interface SocketState {
  relay: string;
  state: 'open' | 'closed' | 'retrying' | 'error';
  opens: number;
  retries: number;
  errors: number;
  lastBackoffMs: number | null;
  changedAt: number;
}

export interface DiagnosticsSnapshot {
  sockets: SocketState[];
  /** Relay objects the pool created (one per URL; a second for the same URL would be a bug). */
  relaysOpened: string[];
  relaysClosed: string[];
  subscriptions: SubscriptionRecord[];
  queries: QueryRecord[];
  publications: PublicationRecord[];
  totals: { subscriptionsOpened: number; subscriptionsClosed: number; queries: number; publications: number; retries: number; duplicates: number };
}

/** What the pool calls around each `query()`. */
export interface QueryProbe {
  started(path: QueryRecord['path'], filters: readonly NostrFilter[], relays: readonly string[]): number;
  finished(id: number, result: { outcome: NonNullable<QueryRecord['outcome']>; received?: number; unique?: number; eose?: readonly string[]; failed?: readonly string[] }): void;
}

export interface RelayDiagnostics extends QueryProbe {
  /** NRelay1's log entry, with the relay URL. */
  log(entry: { url?: string; ns: string; state?: string; backoff?: number }): void;
  /** Wrap a relay the pool opens. */
  instrument(relay: NRelay, url: string): NRelay;
  snapshot(): DiagnosticsSnapshot;
  subscribe(listener: () => void): () => void;
  reset(): void;
}

function kindsOf(filters: readonly NostrFilter[]): number[] {
  return [...new Set(filters.flatMap((f) => f.kinds ?? []))].sort((a, b) => a - b);
}

function push<T>(list: T[], item: T): void {
  list.push(item);
  if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
}

export function createRelayDiagnostics(now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())): RelayDiagnostics {
  let sockets = new Map<string, SocketState>();
  let subscriptions: SubscriptionRecord[] = [];
  let queries: QueryRecord[] = [];
  let publications: PublicationRecord[] = [];
  let relaysOpened: string[] = [];
  let relaysClosed: string[] = [];
  let totals = { subscriptionsOpened: 0, subscriptionsClosed: 0, queries: 0, publications: 0, retries: 0, duplicates: 0 };
  let nextId = 1;
  const listeners = new Set<() => void>();
  // Batched: a burst of events is one notification
  let pending = false;
  const changed = () => {
    if (pending || listeners.size === 0) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      for (const l of listeners) l();
    });
  };

  const socket = (relay: string): SocketState => {
    let s = sockets.get(relay);
    if (!s) {
      s = { relay, state: 'closed', opens: 0, retries: 0, errors: 0, lastBackoffMs: null, changedAt: now() };
      sockets.set(relay, s);
    }
    return s;
  };

  const instrument = (relay: NRelay, url: string): NRelay => {
    push(relaysOpened, url);
    changed();
    const open = (filters: NostrFilter[]): SubscriptionRecord => {
      const record: SubscriptionRecord = { id: nextId++, relay: url, kinds: kindsOf(filters), openedAt: now(), closedAt: null, eoseAt: null, events: 0, duplicates: 0, end: null };
      push(subscriptions, record);
      totals.subscriptionsOpened++;
      changed();
      return record;
    };
    const close = (record: SubscriptionRecord, end: string) => {
      if (record.closedAt !== null) return;
      record.closedAt = now();
      record.end = end;
      totals.subscriptionsClosed++;
      changed();
    };
    return {
      async *req(filters: NostrFilter[], opts?: { signal?: AbortSignal }): AsyncIterable<NostrRelayEVENT | NostrRelayEOSE | NostrRelayCLOSED> {
        const record = open(filters);
        const seen = new Set<string>();
        let end = 'ended';
        try {
          for await (const msg of relay.req(filters, opts)) {
            if (msg[0] === 'EVENT') {
              record.events++;
              if (seen.has(msg[2].id)) {
                record.duplicates++;
                totals.duplicates++;
              } else seen.add(msg[2].id);
            } else if (msg[0] === 'EOSE' && record.eoseAt === null) record.eoseAt = now();
            else if (msg[0] === 'CLOSED') end = 'closed';
            yield msg;
          }
        } catch (error) {
          end = 'error';
          throw error;
        } finally {
          if (opts?.signal?.aborted) end = record.eoseAt !== null ? 'eose-abort' : 'abort';
          close(record, end);
        }
      },
      async query(filters: NostrFilter[], opts?: { signal?: AbortSignal }): Promise<NostrEvent[]> {
        const record = open(filters);
        try {
          const events = await relay.query(filters, opts);
          record.events = events.length;
          record.eoseAt = now();
          close(record, 'ended');
          return events;
        } catch (error) {
          close(record, opts?.signal?.aborted ? 'abort' : 'error');
          throw error;
        }
      },
      async event(event: NostrEvent, opts?: { signal?: AbortSignal }): Promise<void> {
        const note = (verdict: string) => {
          push(publications, { at: now(), eventId: event.id, kind: event.kind, relay: url, verdict });
          totals.publications++;
          changed();
        };
        try {
          await relay.event(event, opts);
          note('accepted');
        } catch (error) {
          // The relay's machine-readable prefix only ("blocked:", "rate-limited:", "duplicate:"), never its free text
          const message = error instanceof Error ? error.message : String(error);
          const prefix = /^([a-z-]+):/.exec(message)?.[1];
          note(opts?.signal?.aborted ? 'timeout' : prefix ? `refused:${prefix}` : 'failed');
          throw error;
        }
      },
      async close(): Promise<void> {
        push(relaysClosed, url);
        changed();
        await relay.close();
      },
    };
  };

  return {
    log(entry) {
      if (!entry.url) return;
      const s = socket(entry.url);
      if (entry.ns === 'relay.ws.state') {
        if (entry.state === 'open') {
          s.state = 'open';
          s.opens++;
        } else if (entry.state === 'close') s.state = 'closed';
      } else if (entry.ns === 'relay.ws.retry') {
        s.state = 'retrying';
        s.retries++;
        totals.retries++;
        s.lastBackoffMs = typeof entry.backoff === 'number' ? entry.backoff : null;
      } else if (entry.ns === 'relay.ws.error') {
        s.state = 'error';
        s.errors++;
      } else return;
      s.changedAt = now();
      changed();
    },
    instrument,
    started(path, filters, relays) {
      const record: QueryRecord = { id: nextId++, path, kinds: kindsOf(filters), relays: [...relays], startedAt: now(), finishedAt: null, outcome: null, received: 0, unique: 0, eose: [], failed: [] };
      push(queries, record);
      totals.queries++;
      changed();
      return record.id;
    },
    finished(id, result) {
      const record = queries.find((q) => q.id === id);
      if (!record || record.finishedAt !== null) return;
      record.finishedAt = now();
      record.outcome = result.outcome;
      record.received = result.received ?? 0;
      record.unique = result.unique ?? 0;
      record.eose = [...(result.eose ?? [])];
      record.failed = [...(result.failed ?? [])];
      changed();
    },
    snapshot() {
      return {
        sockets: [...sockets.values()].map((s) => ({ ...s })),
        relaysOpened: [...relaysOpened],
        relaysClosed: [...relaysClosed],
        subscriptions: subscriptions.map((s) => ({ ...s, kinds: [...s.kinds] })),
        queries: queries.map((q) => ({ ...q, kinds: [...q.kinds], relays: [...q.relays], eose: [...q.eose], failed: [...q.failed] })),
        publications: publications.map((p) => ({ ...p })),
        totals: { ...totals },
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      sockets = new Map();
      subscriptions = [];
      queries = [];
      publications = [];
      relaysOpened = [];
      relaysClosed = [];
      totals = { subscriptionsOpened: 0, subscriptionsClosed: 0, queries: 0, publications: 0, retries: 0, duplicates: 0 };
      changed();
    },
  };
}

/** Subscriptions still open in a snapshot. */
export function openSubscriptions(snapshot: DiagnosticsSnapshot): SubscriptionRecord[] {
  return snapshot.subscriptions.filter((s) => s.closedAt === null);
}
