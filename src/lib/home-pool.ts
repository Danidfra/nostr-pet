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
 * A WRITE goes to every destination at once. For the kinds whose success
 * the next read depends on (`confirmationRelaysFor`: state, profiles,
 * spends, metadata) it resolves when one of the relays that count accepts
 * it; acceptance by another relay alone ends in `PublishUnconfirmedError`
 * (it may be there, it is not saved for the next read), and a refusal
 * everywhere in the AggregateError it always was. Every other kind resolves
 * at the first acceptance anywhere, as before. Only a counted acceptance
 * makes the event this page's newest known revision. What EACH destination
 * said is handed to the observer (`relay-sync.ts`), which is how a primary
 * that refused or stayed silent is noticed while the action stands on a
 * secondary's word, and the write's outcome once all have answered
 * (`confirmed`, `partial`, `unconfirmed`, `rejected`). So is
 * every finished Blobbi read, relay by relay: an own event one relay holds
 * and another certainly lacks is carried over there, as it was signed.
 */
import { NPool, NRelay1, type NostrEvent, type NostrFilter, type NRelay, type NRelay1Opts } from '@nostrify/nostrify';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, PROFILE_REQUIRED_RELAYS, confirmationRelaysFor, normalizeRelayUrl } from '@/config/relays';
import { ECOSYSTEM_READ_HINTS } from '@/features/inventory/relay-hints';
import { decideRead, eventAddress, matchesFilter, mergeRelayEvents, replacesEvent, type DeliveryResult, type RelayFilter } from './blobbi-relay-routing';
import { buildReadRoutingPolicy, routeReadFilters, type ReadHint, type ReadRoutingPolicy } from './relay-routing';
import { checkRelayTransport, PublishUnconfirmedError, RelayReadUnknownError, RelayTimeoutError, RelayTransportError, type TransportBlock } from './relay-transport';
import { verdictOf, type RelayReadReport } from './relay-sync';
import type { QueryProbe } from './relay-diagnostics';
import { JitteredBackoff } from './relay-backoff';

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
  /** A write once every destination answered (or the write's time ran out). */
  outcome?(event: NostrEvent, outcome: PublishOutcome): void;
}

/**
 * How a write ended, once every destination answered:
 *
 *   confirmed     every relay that counts accepted it (or, for a plain kind, every destination)
 *   partial       one that counts did, another that counts did not: saved, and owed to the rest (`relay-sync.ts`)
 *   unconfirmed   none that counts did, another did: not saved for the next read
 *   rejected      nobody did
 */
export type PublishOutcome = 'confirmed' | 'partial' | 'unconfirmed' | 'rejected';

/** The outcome of a write from each destination's answer, given the relays that count (all of them for a plain kind). */
export function classifyPublication(answers: readonly { relay: string; accepted: boolean }[], counted: readonly string[] | null): PublishOutcome {
  const counts = (relay: string) => !counted || counted.includes(relay);
  const countedAnswers = answers.filter((a) => counts(a.relay));
  const countedAccepted = countedAnswers.filter((a) => a.accepted).length;
  if (countedAccepted > 0) return countedAccepted === countedAnswers.length ? 'confirmed' : 'partial';
  return answers.some((a) => a.accepted) ? 'unconfirmed' : 'rejected';
}

export interface HomePoolOptions {
  /** Application relays: every read, and a publish target of every write. */
  relays?: readonly string[];
  /**
   * The primary relay and the kinds it is read and written for (`PRIMARY_RELAY`, `PRIMARY_READ_KINDS`,
   * `PRIMARY_KINDS`); none when omitted: every read and write is then the application relays', as before.
   */
  primary?: { url: string; readKinds: readonly number[]; writeKinds: readonly number[] } | null;
  /** The relays that must each reach EOSE before an empty Blobbi read is believed (`ABSENCE_REQUIRED_RELAYS`); one of them must accept a Blobbi write for it to be saved. */
  absenceRequired?: readonly string[];
  /** The relays one of which must accept a kind 0 for it to be saved (`PROFILE_REQUIRED_RELAYS`). */
  profileRequired?: readonly string[];
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
  /** Development diagnostics (`relay-diagnostics.ts`): each relay the pool opens is wrapped, each query recorded. */
  diagnostics?: { wrap: (relay: NRelay, url: string) => NRelay; probe: QueryProbe } | null;
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
  /** Normalized: the relays whose acceptance saves a write of this kind, or null for the first acceptance anywhere. */
  confirmWith: (kind: number) => readonly string[] | null;
  /** Each connection's reconnection schedule (`relay-backoff.ts`), by relay. */
  backoffs: ReadonlyMap<string, JitteredBackoff>;
  now: () => number;
  probe?: QueryProbe;
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

  /**
   * The browser is online again: every connection's next retry is a short one. Sockets are not reopened here
   * (each reconnects on its own schedule, or when a read needs it), so nothing is opened twice.
   */
  connectivityRestored(): void {
    for (const backoff of this.cfg.backoffs.values()) backoff.reset();
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

    const probe = this.cfg.probe;
    const probeId = probe?.started('plain', filters, [...routes.keys()]);
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
      if (probeId !== undefined) probe!.finished(probeId, { outcome: outer?.aborted ? 'aborted' : events.length ? 'answered' : 'empty', received: events.length, unique: events.length });
      return events;
    } catch (error) {
      if (probeId !== undefined) probe!.finished(probeId, { outcome: error instanceof RelayTimeoutError ? 'timeout' : 'error' });
      throw error;
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
    // Only an acceptance that saves the write makes it this page's newest known revision: a revision only another
    // relay took is not what the next read builds on, and a later write supersedes it
    const counted = this.cfg.confirmWith(event.kind);
    if (result.verdict === 'accepted' && (!counted || counted.includes(result.relay))) this.remember(event);
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
    const probe = this.cfg.probe;
    const probeId = probe?.started('blobbi', filters, reads.map((r) => r.relay));
    const probeEnd = (outcome: 'answered' | 'empty' | 'unknown' | 'timeout', unique: number) => {
      if (probeId === undefined) return;
      probe!.finished(probeId, {
        outcome,
        received: reads.reduce((n, r) => n + r.events.length, 0),
        unique,
        eose: reads.filter((r) => r.status === 'eose').map((r) => r.relay),
        failed: reads.filter((r) => r.status === 'failed').map((r) => r.relay),
      });
    };

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
            probeEnd(events.length ? 'answered' : 'empty', events.length);
            resolve(events);
          } else if (decision.status === 'unknown') {
            answered = true;
            probeEnd(decision.reason === 'no-relay-answered' ? 'timeout' : 'unknown', 0);
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
    // The relays that count for this kind among the destinations; none of them asked means every destination counts
    const confirm = this.cfg.confirmWith(event.kind);
    const counted = confirm ? urls.filter((url) => confirm.includes(url)) : null;
    const counts = (relay: string) => !counted || counted.length === 0 || counted.includes(relay);
    const answers: { relay: string; accepted: boolean }[] = [];
    const errors: unknown[] = [];

    await new Promise<void>((resolve, reject) => {
      let saved = false;
      const settle = () => {
        if (answers.length < urls.length) return;
        try {
          this.cfg.observer?.outcome?.(event, classifyPublication(answers, counted && counted.length ? counted : null));
        } catch {
          /* the observer's trouble is never the write's */
        }
        if (saved) return;
        const acceptedBy = answers.filter((a) => a.accepted).map((a) => a.relay);
        // Nobody took it: the refusals, as they always were. Only another relay did: it may be there, it is not saved
        reject(acceptedBy.length === 0 ? new AggregateError(errors, 'All promises were rejected') : new PublishUnconfirmedError(acceptedBy));
      };
      // Every destination at once; each verdict is noted
      for (const relay of urls) {
        void (async () => {
          let accepted = false;
          try {
            await this.relay(relay).event(event, options);
            accepted = true;
            note({ relay, verdict: 'accepted' });
          } catch (error) {
            const { verdict, message } = verdictOf(error);
            note({ relay, verdict, message });
            // NIP-01: the relay already holds this very event
            if (verdict === 'accepted') accepted = true;
            else errors.push(error);
          }
          answers.push({ relay, accepted });
          if (accepted && counts(relay) && !saved) {
            saved = true;
            resolve();
          }
          settle();
        })();
      }
    });
  }
}

export function createHomePool({ relays = BASE_RELAYS, hints = ECOSYSTEM_READ_HINTS, primary = null, absenceRequired = ABSENCE_REQUIRED_RELAYS, profileRequired = PROFILE_REQUIRED_RELAYS, open, eoseTimeout, log, readTimeout = READ_TIMEOUT_MS, relayTimeout = RELAY_TIMEOUT_MS, transport, observer, diagnostics }: HomePoolOptions = {}): NPool {
  const backoffs = new Map<string, JitteredBackoff>();
  const baseOpen =
    open ??
    ((url: string) => {
      // One schedule per connection, bounded and jittered (`relay-backoff.ts`), instead of NRelay1's unbounded default
      const backoff = new JitteredBackoff();
      backoffs.set(url, backoff);
      return new NRelay1(url, { ...(log ? { log } : {}), backoff });
    });
  const openRelay = diagnostics ? (url: string) => diagnostics.wrap(baseOpen(url), url) : baseOpen;
  const policy = buildReadRoutingPolicy({ appRelays: relays, hints, primary: primary ? { url: primary.url, kinds: primary.readKinds } : null });
  const writeRelays = [...policy.appRelays];
  // The primary first, for the kinds it accepts; a kind it would refuse is never sent to it
  const primaryWrites = policy.primary && primary ? { url: policy.primary.url, kinds: primary.writeKinds } : null;
  const eventRoutes = (event: NostrEvent) => (primaryWrites && primaryWrites.kinds.includes(event.kind) ? [primaryWrites.url, ...writeRelays] : writeRelays);
  const blocked = transport === undefined ? checkRelayTransport() : transport;
  const normalized = (urls: readonly string[]) => urls.map((url) => normalizeRelayUrl(url)).filter((url): url is string => url !== null);
  const counted = { absence: normalized(absenceRequired), profile: normalized(profileRequired) };
  const confirmWith = (kind: number) => {
    const set = confirmationRelaysFor(kind);
    return set ? counted[set] : null;
  };
  const pool: HomePool = new HomePool(
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
      absenceRequired: counted.absence,
      observer,
      eventRoutes,
      confirmWith,
      backoffs,
      now: () => Date.now(),
      probe: diagnostics?.probe,
    },
  );
  return pool;
}
