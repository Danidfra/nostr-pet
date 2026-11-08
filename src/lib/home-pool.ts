/**
 * The home's one relay pool.
 *
 *   reads    → `routeReadFilters`: the primary relay for the kinds it holds,
 *              the application relays, plus the hinted relays for the
 *              filters a hint covers (inventory kinds, trusted issuers)
 *   writes   → the primary relay for the kinds it accepts, and the
 *              application relays; nothing else, ever
 *
 * The two routers share no code on purpose: a relay used as a read hint can
 * never become a publish target by accident.
 *
 * A BLOBBI READ (a filter the primary is asked for) is answered relay by
 * relay, and the answers are put together by the kit's rules
 * (`blobbi-relay-routing.ts`: `mergeRelayEvents`, `decideRead`):
 *
 *  - every relay is given its own answer; nothing is cut short because
 *    another relay was faster. An EMPTY answer is a fact only when every
 *    relay that must answer (`absenceRequired`) reached EOSE. A fast, empty
 *    primary therefore never reads as "you own no Blobbi", and a silent relay
 *    never reads as "empty": the read fails (`RelayReadUnknownError`), the
 *    home keeps what it had or offers Try again;
 *  - a replaceable or addressable event is the NIP-01 winner across the
 *    relays (newer `created_at`, then the lower id), wherever it came from;
 *    regular events are history and all are kept, once each;
 *  - with events in hand the read waits `eoseTimeout` after the first EOSE
 *    for the relays still silent (not at all for one that just failed), and
 *    a relay that says nothing for `relayTimeout` counts as failed (sooner,
 *    `SUSPECT_TIMEOUT_MS`, when it failed the read before);
 *  - an answer that not every relay took part in is never older than what
 *    this page already saw: the newest revision it has read or published
 *    stands in for a relay that did not answer.
 *
 * Every other read (profile metadata, themes, an `ids` lookup) is nostrify's
 * own `query`, as before. Two things nostrify leaves to the caller are still
 * decided here, so no read can hang the home forever:
 *
 *  - a page that cannot open a relay subscription at all (no
 *    `crypto.randomUUID`: plain HTTP on a LAN address, see
 *    `relay-transport.ts`) gets a `RelayTransportError` from every read and
 *    write at once, instead of the silent never-ending read `NPool` would
 *    give (it swallows each relay's error and waits for an EOSE that never
 *    comes);
 *  - a read in which no relay answers within `readTimeout` ends in a
 *    `RelayTimeoutError`, not in partial silence: an empty answer would read
 *    as "you own no Blobbi", which is not known.
 *
 * A WRITE goes to every destination at once and resolves when the first
 * accepts it, as before; what EACH destination said is handed to the
 * observer (`relay-sync.ts`), which is how a primary that refused or stayed
 * silent is noticed while the action stands on a secondary's word. So is
 * every finished Blobbi read, relay by relay: an own event one relay holds
 * and another certainly lacks is carried over there, as it was signed.
 */
import { NPool, NRelay1, type NostrEvent, type NostrFilter, type NRelay, type NRelay1Opts } from '@nostrify/nostrify';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, normalizeRelayUrl } from '@/config/relays';
import { ECOSYSTEM_READ_HINTS } from '@/features/inventory/relay-hints';
import { decideRead, eventAddress, matchesFilter, mergeRelayEvents, replacesEvent, type DeliveryResult, type RelayFilter } from './blobbi-relay-routing';
import { buildReadRoutingPolicy, routeReadFilters, type ReadHint, type ReadRoutingPolicy } from './relay-routing';
import { checkRelayTransport, RelayReadUnknownError, RelayTimeoutError, RelayTransportError, type TransportBlock } from './relay-transport';
import { verdictOf, type RelayReadReport } from './relay-sync';

/** How long a read may go without any relay answering before it fails. */
export const READ_TIMEOUT_MS = 15_000;
/** How long one relay may stay silent in a Blobbi read before it counts as failed. */
export const RELAY_TIMEOUT_MS = 8_000;
/** With events in hand: how long a Blobbi read still waits, after the first EOSE, for the relays not done yet. */
export const READ_GRACE_MS = 2_000;
/** A relay that failed a read this recently is not waited for once another has answered with events. */
export const SUSPECT_MS = 5 * 60_000;
/** A relay that just failed is given this long, not `RELAY_TIMEOUT_MS`: an answer that needs it is unknown sooner. */
export const SUSPECT_TIMEOUT_MS = 3_000;
/** How long the destinations of a write are given to answer when the caller set no limit. */
export const WRITE_SETTLE_MS = 15_000;

/** What the pool tells whoever keeps track of deliveries and gaps (`relay-sync.ts`). */
export interface HomePoolObserver {
  /** One destination's verdict on a published event. */
  delivery?(event: NostrEvent, result: DeliveryResult): void;
  /** A Blobbi read that has finished everywhere (or been given up on), relay by relay. */
  read?(filters: readonly RelayFilter[], reports: readonly RelayReadReport[]): void;
}

export interface HomePoolOptions {
  /** Application relays: every read, and a publish target of every write. */
  relays?: readonly string[];
  /**
   * The primary relay and the kinds it is read and written for (`PRIMARY_RELAY`, `PRIMARY_READ_KINDS`,
   * `PRIMARY_KINDS`); none when omitted: every read and write is then the application relays', as before.
   */
  primary?: { url: string; readKinds: readonly number[]; writeKinds: readonly number[] } | null;
  /** The relays that must each reach EOSE before an empty Blobbi read is believed (`ABSENCE_REQUIRED_RELAYS`). */
  absenceRequired?: readonly string[];
  /** A relay silent for this long in a Blobbi read has failed (`RELAY_TIMEOUT_MS`). */
  relayTimeout?: number;
  observer?: HomePoolObserver;
  /** Read-only ecosystem hints (see `relay-hints.ts`); `[]` for none. */
  hints?: readonly ReadHint[];
  /** Connection factory; tests hand in fakes. */
  open?: (url: string) => NRelay;
  /** How long to wait for the other relays once the first has answered (pool default when omitted; `READ_GRACE_MS` for a Blobbi read). */
  eoseTimeout?: number;
  /** NRelay1's log, with the relay url on every entry (the health store listens to it). */
  log?: NonNullable<NRelay1Opts['log']>;
  /** A read with no answer at all for this long fails (`READ_TIMEOUT_MS`). */
  readTimeout?: number;
  /** Whether this page can reach relays at all; the browser is asked when omitted. */
  transport?: TransportBlock | null;
}

type QueryOpts = Parameters<NPool['query']>[1];
type ReqOpts = Parameters<NPool['req']>[1];
type EventOpts = Parameters<NPool['event']>[1];

interface HomePoolConfig {
  blocked: TransportBlock | null;
  readTimeout: number;
  relayTimeout: number;
  grace: number;
  policy: ReadRoutingPolicy;
  /** Normalized: the relays whose EOSE an empty Blobbi answer needs. */
  absenceRequired: readonly string[];
  observer?: HomePoolObserver;
  /** The write destinations of one event (also the pool's `eventRouter`). */
  eventRoutes: (event: NostrEvent) => string[];
  now: () => number;
}

interface RelayRead {
  relay: string;
  asked: NostrFilter[];
  status: 'pending' | 'eose' | 'failed';
  events: NostrEvent[];
  suspect: boolean;
  stop: AbortController;
}

const MAX_HEADS = 300;

class HomePool extends NPool {
  /** When each relay last failed a Blobbi read (ms). */
  private readonly failedAt = new Map<string, number>();
  /** The newest revision of each address this page has read or published, by address. */
  private readonly heads = new Map<string, NostrEvent>();

  constructor(
    opts: ConstructorParameters<typeof NPool>[0],
    private readonly cfg: HomePoolConfig,
  ) {
    super(opts);
  }

  private refuse(): void {
    if (this.cfg.blocked) throw new RelayTransportError(this.cfg.blocked);
  }

  override async *req(filters: NostrFilter[], opts?: ReqOpts) {
    this.refuse();
    yield* super.req(filters, opts);
  }

  override async query(filters: NostrFilter[], opts?: QueryOpts): Promise<NostrEvent[]> {
    this.refuse();
    const { policy, readTimeout } = this.cfg;
    const routes = routeReadFilters(filters, policy);
    // A Blobbi read: each relay answers for itself, and the answers are weighed (see the header)
    if (policy.primary && routes.has(policy.primary.url)) return this.readEach(filters, routes, opts?.signal);

    const outer = opts?.signal;
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    if (outer?.aborted) controller.abort();
    else outer?.addEventListener('abort', onOuterAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, readTimeout);
    try {
      const events = await super.query(filters, { ...opts, signal: controller.signal });
      // The pool answers what it has when aborted; a deadline reached with the caller still waiting is a failure.
      if (timedOut && !outer?.aborted) throw new RelayTimeoutError(readTimeout);
      return events;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  }

  /** A write made relay by relay, outside `event()` (the profile's census): one destination's verdict. */
  noteDelivery(event: NostrEvent, result: DeliveryResult): void {
    try {
      this.cfg.observer?.delivery?.(event, result);
    } catch {
      /* the observer's trouble is never the write's */
    }
    if (result.verdict === 'accepted') this.remember(event);
  }

  private remember(event: NostrEvent): void {
    const address = eventAddress(event);
    if (address === null) return;
    const held = this.heads.get(address);
    if (held && (held.id === event.id || !replacesEvent(event, held))) return;
    this.heads.delete(address);
    this.heads.set(address, event);
    while (this.heads.size > MAX_HEADS) {
      const oldest = this.heads.keys().next().value;
      if (oldest === undefined) break;
      this.heads.delete(oldest);
    }
  }

  /** One REQ per relay, each to its own end; resolves as soon as `decideRead` can answer. */
  private readEach(filters: NostrFilter[], routes: ReadonlyMap<string, NostrFilter[]>, outer: AbortSignal | undefined): Promise<NostrEvent[]> {
    const { absenceRequired, grace, relayTimeout, readTimeout, observer, now } = this.cfg;
    const started = now();
    const reads: RelayRead[] = [...routes].map(([relay, asked]) => ({
      relay,
      asked,
      status: 'pending',
      events: [],
      suspect: started - (this.failedAt.get(relay) ?? -Infinity) < SUSPECT_MS,
      stop: new AbortController(),
    }));
    // Never an empty requirement: when none of the relays that must answer is asked, every relay asked must
    const named = reads.filter((r) => absenceRequired.includes(r.relay)).map((r) => r.relay);
    const required = new Set(named.length > 0 ? named : reads.map((r) => r.relay));
    const asRelayFilters = filters as unknown as RelayFilter[];

    return new Promise<NostrEvent[]>((resolve, reject) => {
      let answered = false;
      let reported = false;
      let graceOver = false;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;
      const timers: ReturnType<typeof setTimeout>[] = [];

      const report = () => {
        if (reported || reads.some((r) => r.status === 'pending')) return;
        reported = true;
        for (const timer of timers) clearTimeout(timer);
        clearTimeout(graceTimer);
        outer?.removeEventListener('abort', onOuterAbort);
        try {
          observer?.read?.(asRelayFilters, reads.map((r) => ({ relay: r.relay, status: r.status, events: r.events, asked: r.asked as unknown as RelayFilter[] })) as RelayReadReport[]);
        } catch {
          /* the observer's trouble is never the read's */
        }
      };

      const decide = () => {
        if (!answered) {
          // A relay that need not answer is heard while it is in time, and never waited for past the grace (not at
          // all when it just failed: relay.nostr.band did not answer at all on 2026-11-11)
          const view = reads.filter((r) => required.has(r.relay) || r.status === 'eose' || (r.status === 'pending' && !graceOver && !r.suspect));
          const decision = decideRead({ states: view, filters: asRelayFilters, deadlinePassed: graceOver });
          if (decision.status === 'answered') {
            answered = true;
            let events = decision.events;
            if (!decision.complete || view.length !== reads.length) {
              // Not every relay took part: never older than what this page already saw
              const known = [...this.heads.values()].filter((head) => asRelayFilters.some((filter) => matchesFilter(head, filter)));
              if (known.length > 0) events = mergeRelayEvents([...events, ...known]);
            }
            for (const event of events) this.remember(event);
            resolve(events);
          } else if (decision.status === 'unknown') {
            answered = true;
            reject(decision.reason === 'no-relay-answered' ? new RelayTimeoutError(Math.min(relayTimeout, readTimeout)) : new RelayReadUnknownError(reads.filter((r) => required.has(r.relay) && r.status !== 'eose').map((r) => r.relay)));
          }
        }
        report();
      };

      const settle = (read: RelayRead, status: 'eose' | 'failed', fault = status === 'failed') => {
        if (read.status !== 'pending') return;
        read.status = status;
        if (fault) this.failedAt.set(read.relay, now());
        else if (status === 'eose') this.failedAt.delete(read.relay);
        read.stop.abort();
        // The grace runs from the first answer with events, or from the moment every relay that must answer has
        if (graceTimer === undefined && !graceOver && (reads.some((r) => r.status === 'eose' && r.events.length > 0) || reads.every((r) => r.status !== 'pending' || !required.has(r.relay)))) {
          graceTimer = setTimeout(() => {
            graceOver = true;
            decide();
          }, grace);
        }
        decide();
      };

      // The caller gave up: what is known now is the answer, and a relay cut off this way did not fail
      const onOuterAbort = () => {
        for (const read of reads) settle(read, 'failed', false);
      };

      for (const read of reads) {
        timers.push(setTimeout(() => settle(read, 'failed'), Math.min(read.suspect ? SUSPECT_TIMEOUT_MS : relayTimeout, relayTimeout, readTimeout)));
        void (async () => {
          try {
            for await (const msg of this.relay(read.relay).req(read.asked, { signal: read.stop.signal })) {
              if (read.status !== 'pending') break;
              if (msg[0] === 'EVENT') read.events.push(msg[2]);
              else if (msg[0] === 'EOSE') settle(read, 'eose');
              else if (msg[0] === 'CLOSED') settle(read, 'failed');
            }
          } catch {
            /* the same as silence, below */
          }
          // A stream that ended without EOSE (refused, dropped) said nothing
          settle(read, 'failed');
        })();
      }
      if (outer?.aborted) onOuterAbort();
      else outer?.addEventListener('abort', onOuterAbort, { once: true });
    });
  }

  override async event(event: NostrEvent, opts?: EventOpts): Promise<void> {
    this.refuse();
    const urls = opts?.relays ?? this.cfg.eventRoutes(event);
    if (!urls.length) return;
    const options = opts?.signal ? opts : { ...opts, signal: AbortSignal.timeout(WRITE_SETTLE_MS) };
    const note = (result: DeliveryResult) => this.noteDelivery(event, result);
    // Every destination at once; the first acceptance is the write's (as `NPool.event`), and each verdict is noted
    await Promise.any(
      urls.map(async (relay) => {
        try {
          await this.relay(relay).event(event, options);
        } catch (error) {
          const { verdict, message } = verdictOf(error);
          note({ relay, verdict, message });
          // NIP-01: the relay already holds this very event
          if (verdict === 'accepted') return;
          throw error;
        }
        note({ relay, verdict: 'accepted' });
      }),
    );
  }
}

export function createHomePool({ relays = BASE_RELAYS, hints = ECOSYSTEM_READ_HINTS, primary = null, absenceRequired = ABSENCE_REQUIRED_RELAYS, open, eoseTimeout, log, readTimeout = READ_TIMEOUT_MS, relayTimeout = RELAY_TIMEOUT_MS, transport, observer }: HomePoolOptions = {}): NPool {
  const openRelay = open ?? ((url: string) => new NRelay1(url, log ? { log } : {}));
  const policy = buildReadRoutingPolicy({ appRelays: relays, hints, primary: primary ? { url: primary.url, kinds: primary.readKinds } : null });
  const writeRelays = [...policy.appRelays];
  // The primary first, for the kinds it accepts; a kind it would refuse is never sent to it
  const primaryWrites = policy.primary && primary ? { url: policy.primary.url, kinds: primary.writeKinds } : null;
  const eventRoutes = (event: NostrEvent) => (primaryWrites && primaryWrites.kinds.includes(event.kind) ? [primaryWrites.url, ...writeRelays] : writeRelays);
  const blocked = transport === undefined ? checkRelayTransport() : transport;
  return new HomePool(
    {
      open: openRelay,
      reqRouter(filters: NostrFilter[]) {
        return routeReadFilters(filters, policy);
      },
      eventRouter: eventRoutes,
      ...(eoseTimeout !== undefined ? { eoseTimeout } : {}),
    },
    {
      blocked,
      readTimeout,
      relayTimeout,
      grace: eoseTimeout ?? READ_GRACE_MS,
      policy,
      absenceRequired: absenceRequired.map((url) => normalizeRelayUrl(url)).filter((url): url is string => url !== null),
      observer,
      eventRoutes,
      now: () => Date.now(),
    },
  );
}
