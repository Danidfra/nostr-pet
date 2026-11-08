/**
 * WHAT EACH RELAY DID WITH THE PLAYER'S EVENTS, and carrying an event to a
 * relay of its flow that certainly lacks it.
 *
 * The home writes a Blobbi event to the primary relay and to its secondaries
 * at once and goes on as soon as ONE accepts it (`home-pool.ts`). This module
 * is told every destination's verdict, so the rest is not lost:
 *
 *   primary accepted          → nothing to say
 *   primary silent or failing → the action stands on the secondary's word;
 *                               the status is `pending` until the primary has
 *                               the event
 *   primary refused by policy → `refused` (its pilot write list, for
 *                               instance): nothing is offered to it again for
 *                               that account and kind until the refusal has
 *                               aged out (`REFUSAL_TTL_MS`)
 *
 * And it is shown every finished read, relay by relay. When a relay that
 * answered TO THE END lacks an event another relay returned, the ORIGINAL
 * signed event (same id, same signature; nothing is signed here, there is no
 * signer) is offered to it. The rules are the kit's (`planSync`):
 *
 *   - only the signed-in player's own events, of the kinds in
 *     `OWN_SYNC_KINDS`, to the relays of that kind's flow;
 *   - only where absence is certain: a relay that failed, never reached EOSE
 *     or may have cut its answer at a `limit` is left alone;
 *   - only the winning revision of a replaceable or addressable event;
 *   - never an ephemeral, private, expiring, relay-bound or deleted event.
 *
 * AND ONLY WHEN THE ACCOUNT SAID SO (`sync-consent.ts`). Copying existing
 * events is OFF until the player turns it on, for the relays they were shown:
 * until then a read sends nothing at all. The one thing carried without that
 * choice is an event signed in this very visit (the player's new act) that a
 * relay was silent for when it was published: finishing that publication.
 *
 * No loops: every (event, relay) pair is remembered (`SyncLedger`, kept in
 * `blobbi:relay-sync:v1`: public data only, ids and relay urls). Accepted is
 * never offered again; refused not until the refusal has aged out; a failure
 * is retried after a growing wait, a few times in all. One event at a time,
 * a bounded number per read, and a relay that fails or asks for a pause
 * (`rate-limited:`) is offered nothing more until the next read.
 *
 * Profile writes (kind 11125) keep their own, stricter redelivery
 * (`features/companion/profile-delivery.ts`); the primary is simply one more
 * relay there. What is carried here for 11125 is the same event that module
 * would send, and a relay holding a newer profile refuses the older one.
 */
import { SyncLedger, classifyRejection, eventAddress, matchesFilter, normalizeRelayUrl, planSync, summarizeDelivery, type DeliveryResult, type DeliveryVerdict, type RelayFilter, type RelayReadState, type SyncLedgerEntry } from './blobbi-relay-routing';
import type { CarryGate } from './sync-consent';

/** A signed event, as far as this module needs it (it is passed on untouched). */
export interface SyncEvent {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** One relay's part of a finished read: what it was asked, and what it said. */
export interface RelayReadReport extends RelayReadState<SyncEvent> {
  /** The filters THIS relay was sent (a hinted relay gets fewer than the read's). */
  asked: readonly RelayFilter[];
}

export type PrimarySyncState = 'synced' | 'pending' | 'refused';

export interface PrimarySyncStatus {
  state: PrimarySyncState;
  /** The player's events known to be elsewhere and not yet on the primary. */
  pending: number;
  /** The primary's own words, when it refused. */
  message?: string;
}

export interface SyncStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface RelaySyncOptions {
  primary: string;
  /** The kinds this flow may carry (the player's own events only). */
  kinds: readonly number[];
  /** The relays an own event of this kind belongs on. */
  destinations: (kind: number) => readonly string[];
  /** Offer one signed event to one relay; resolves when it accepted it, rejects with the relay's message otherwise. */
  send: (relay: string, event: SyncEvent, signal: AbortSignal) => Promise<unknown>;
  /** Checks an event's id and signature before it is offered anywhere. */
  verify: (event: SyncEvent) => boolean;
  /** Whether an event may be offered to a relay at all: signed in this visit, or the account turned copying on. */
  gate: Pick<CarryGate, 'mayCarry'>;
  store?: SyncStore | null;
  now?: () => number;
  /** Events offered per read, at most. */
  maxPerRead?: number;
  sendTimeoutMs?: number;
}

export interface RelaySync {
  /** Whose events may be carried: the signed-in player, or null (a guest, signed out: nothing is carried). */
  setAccount(pubkey: string | null): void;
  /** One destination's verdict on an event the home published. */
  noteResult(event: SyncEvent, result: DeliveryResult): void;
  /** A finished read, relay by relay. Resolves with how many events were offered. */
  noteRead(filters: readonly RelayFilter[], reports: readonly RelayReadReport[]): Promise<number>;
  status: { snapshot(): PrimarySyncStatus; subscribe(listener: () => void): () => void };
  /** The delivery history of one (event, relay) pair, for tests and the journal. */
  entry(eventId: string, relay: string): SyncLedgerEntry | undefined;
}

export const RELAY_SYNC_KEY = 'blobbi:relay-sync:v1';
/** How long a policy refusal stands before the relay is offered that account's events of that kind again. */
export const REFUSAL_TTL_MS = 6 * 60 * 60 * 1000;
export const SYNC_MAX_PER_READ = 100;

/** Refusals that are about WHO writes or WHAT kind, not about one event: one is enough to stop offering the rest. */
const POLICY_REFUSAL = /^(blocked|restricted|auth-required)\b/i;
const SYNCED: PrimarySyncStatus = { state: 'synced', pending: 0 };

interface Persisted {
  version: 1;
  ledger: Record<string, SyncLedgerEntry>;
  /** `relay|author|kind` → until when (ms), and the relay's message. */
  refusals: Record<string, { until: number; message?: string }>;
}

function readPersisted(store: SyncStore | null | undefined): Persisted {
  const empty: Persisted = { version: 1, ledger: {}, refusals: {} };
  if (!store) return empty;
  try {
    const v = JSON.parse(store.get(RELAY_SYNC_KEY) ?? 'null') as Partial<Persisted> | null;
    if (v?.version !== 1) return empty;
    return { version: 1, ledger: v.ledger && typeof v.ledger === 'object' ? v.ledger : {}, refusals: v.refusals && typeof v.refusals === 'object' ? v.refusals : {} };
  } catch {
    return empty;
  }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : typeof error === 'string' ? error : '');

/** What a relay's answer to `event()` amounts to: resolved is accepted, a rejection is read by its NIP-01 prefix. */
export function verdictOf(error: unknown): { verdict: DeliveryVerdict; message: string } {
  const message = messageOf(error);
  return { verdict: classifyRejection(message), message };
}

export function createRelaySync(options: RelaySyncOptions): RelaySync {
  const now = options.now ?? Date.now;
  const store = options.store;
  const primary = normalizeRelayUrl(options.primary) ?? options.primary;
  const maxPerRead = options.maxPerRead ?? SYNC_MAX_PER_READ;
  const sendTimeoutMs = options.sendTimeoutMs ?? 8_000;
  const persisted = readPersisted(store);
  const refusals = new Map(Object.entries(persisted.refusals));

  let ledgerEntries = persisted.ledger;
  const persist = () => {
    if (!store) return;
    try {
      store.set(RELAY_SYNC_KEY, JSON.stringify({ version: 1, ledger: ledgerEntries, refusals: Object.fromEntries(refusals) } satisfies Persisted));
    } catch {
      /* not kept: this visit still remembers */
    }
  };
  const ledger = new SyncLedger({
    now,
    initial: persisted.ledger,
    rejectedTtlMs: REFUSAL_TTL_MS,
    onChange: (entries) => {
      ledgerEntries = entries;
      persist();
    },
  });

  let account: string | null = null;
  /** Own events held elsewhere and owed to the primary: id → address (null for a regular event). */
  const pending = new Map<string, string | null>();
  /** Every destination's verdict on the events published this visit (the newest few). */
  const deliveries = new Map<string, DeliveryResult[]>();
  const inFlight = new Set<string>();
  let queue: Promise<unknown> = Promise.resolve();

  let snapshot: PrimarySyncStatus = SYNCED;
  const listeners = new Set<() => void>();
  const refusalKey = (relay: string, author: string, kind: number) => `${normalizeRelayUrl(relay) ?? relay}|${author}|${kind}`;
  const refusal = (relay: string, author: string, kind: number) => {
    const key = refusalKey(relay, author, kind);
    const found = refusals.get(key);
    if (!found) return null;
    if (found.until > now()) return found;
    refusals.delete(key);
    return null;
  };
  const publish = () => {
    let next: PrimarySyncStatus = pending.size > 0 ? { state: 'pending', pending: pending.size } : SYNCED;
    if (account) {
      for (const kind of options.kinds) {
        const refused = refusal(primary, account, kind);
        if (refused) {
          next = { state: 'refused', pending: pending.size, message: refused.message };
          break;
        }
      }
    }
    if (next.state === snapshot.state && next.pending === snapshot.pending && next.message === snapshot.message) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const isPrimary = (relay: string) => (normalizeRelayUrl(relay) ?? relay) === primary;

  /** Record one verdict; returns it. */
  const record = (event: SyncEvent, relay: string, verdict: DeliveryVerdict, message?: string) => {
    ledger.record(event.id, relay, verdict, message);
    const key = refusalKey(relay, event.pubkey, event.kind);
    if (verdict === 'rejected' && POLICY_REFUSAL.test(message ?? '')) {
      refusals.set(key, { until: now() + REFUSAL_TTL_MS, message: message?.slice(0, 160) });
      persist();
    } else if ((verdict === 'accepted' || verdict === 'superseded') && refusals.delete(key)) {
      // It takes this account's events of this kind now (a write list that opened)
      persist();
    }
    if (isPrimary(relay)) {
      if (verdict === 'accepted' || verdict === 'superseded' || verdict === 'rejected') pending.delete(event.id);
    }
  };

  /** Owed to the primary: known to be on another relay, and not on it. Only the newest revision of an address. */
  const owe = (event: SyncEvent) => {
    const address = eventAddress(event);
    if (address !== null) {
      for (const [id, held] of pending) if (held === address && id !== event.id) pending.delete(id);
    }
    pending.set(event.id, address);
    while (pending.size > 200) {
      const oldest = pending.keys().next().value;
      if (oldest === undefined) break;
      pending.delete(oldest);
    }
  };

  return {
    setAccount(pubkey) {
      if (account === pubkey) return;
      account = pubkey;
      pending.clear();
      deliveries.clear();
      publish();
    },

    noteResult(event, result) {
      record(event, result.relay, result.verdict, result.message);
      const results = [...(deliveries.get(event.id) ?? []).filter((r) => normalizeRelayUrl(r.relay) !== normalizeRelayUrl(result.relay)), result];
      deliveries.delete(event.id);
      deliveries.set(event.id, results);
      while (deliveries.size > 50) {
        const oldest = deliveries.keys().next().value;
        if (oldest === undefined) break;
        deliveries.delete(oldest);
      }
      // Pending only for the signed-in player's own event that some relay holds while the primary gave no verdict
      if (event.pubkey === account && summarizeDelivery(results, primary).primaryPending) owe(event);
      publish();
    },

    noteRead(filters, reports) {
      const owner = account;
      if (!owner) return Promise.resolve(0);
      const tasks = planSync<SyncEvent>({
        states: reports,
        filters,
        policy: {
          allows: (event) => event.pubkey === owner && options.kinds.includes(event.kind),
          // Nowhere without the account's word (or the event being this visit's own): a read stays a read
          destinations: (event) => options.destinations(event.kind).filter((relay) => options.gate.mayCarry(event, relay)),
        },
      }).filter((task) => {
        // A relay is only missing what it was actually asked for
        const report = reports.find((r) => r.relay === task.relay);
        return !!report && report.asked.some((filter) => matchesFilter(task.event, filter));
      });
      // The primary answered without these: they are owed to it, whether or not they can be offered right now
      for (const task of tasks) {
        if (isPrimary(task.relay) && !refusal(task.relay, owner, task.event.kind) && ledger.nextAttemptAt(task.event.id, task.relay) !== null && ledger.get(task.event.id, task.relay)?.s !== 'rejected') owe(task.event);
      }
      publish();
      if (tasks.length === 0) return Promise.resolve(0);

      const run = async (): Promise<number> => {
        let sent = 0;
        /** Relays that failed or asked for a pause in this run: not offered anything more until the next read. */
        const resting = new Set<string>();
        for (const task of tasks) {
          if (sent >= maxPerRead || account !== owner) break;
          const { event, relay } = task;
          const key = SyncLedger.key(event.id, relay);
          // Asked again at the moment of sending: the player may have turned copying off since the read
          if (!options.gate.mayCarry(event, relay)) continue;
          if (resting.has(relay) || inFlight.has(key) || refusal(relay, owner, event.kind) || !ledger.canAttempt(event.id, relay)) continue;
          let valid = false;
          try {
            valid = options.verify(event);
          } catch {
            valid = false;
          }
          if (!valid) continue;
          inFlight.add(key);
          sent += 1;
          try {
            await options.send(relay, event, AbortSignal.timeout(sendTimeoutMs));
            record(event, relay, 'accepted');
          } catch (error) {
            const { verdict, message } = verdictOf(error);
            record(event, relay, verdict, message);
            // A timeout, `rate-limited:` or `error:`: the relay is in no state to take the rest right now
            if (verdict === 'retry') resting.add(relay);
          } finally {
            inFlight.delete(key);
          }
          publish();
        }
        return sent;
      };
      // One read's offers at a time: two reads that found the same gap never send the same event twice at once
      const result = queue.then(run, run);
      queue = result.catch(() => 0);
      return result;
    },

    status: {
      snapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    entry: (eventId, relay) => ledger.get(eventId, relay),
  };
}

/** A sync that records nothing and carries nothing: tests and fixtures that mount no provider. */
export const NO_RELAY_SYNC: RelaySync = {
  setAccount: () => {},
  noteResult: () => {},
  noteRead: () => Promise.resolve(0),
  status: { snapshot: () => SYNCED, subscribe: () => () => {} },
  entry: () => undefined,
};
