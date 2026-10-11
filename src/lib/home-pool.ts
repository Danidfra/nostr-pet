/**
 * The home's one relay pool.
 *
 *   reads    → `routeReadFilters`: application relays, plus the hinted relays
 *              for the filters a hint covers (inventory kinds, trusted issuers)
 *   writes   → application relays, and nothing else, ever
 *
 * The two routers share no code on purpose: a relay used as a read hint can
 * never become a publish target by accident. Failure is the pool's: a
 * hinted relay that is down, slow or silent contributes nothing and the read
 * returns what the others served (`NPool.query` returns partial results
 * once the first relay finishes and the grace period elapses).
 *
 * Two things nostrify leaves to the caller are decided here, so no read can
 * hang the home forever:
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
 */
import { NPool, NRelay1, type NostrEvent, type NostrFilter, type NRelay, type NRelay1Opts } from '@nostrify/nostrify';
import { BASE_RELAYS } from '@/config/relays';
import { ECOSYSTEM_READ_HINTS } from '@/features/inventory/relay-hints';
import { buildReadRoutingPolicy, routeReadFilters, type ReadHint } from './relay-routing';
import { checkRelayTransport, RelayTimeoutError, RelayTransportError, type TransportBlock } from './relay-transport';

/** How long a read may go without any relay answering before it fails. */
export const READ_TIMEOUT_MS = 15_000;

export interface HomePoolOptions {
  /** Application relays: every read, and the only publish targets. */
  relays?: readonly string[];
  /** Read-only ecosystem hints (see `relay-hints.ts`); `[]` for none. */
  hints?: readonly ReadHint[];
  /** Connection factory; tests hand in fakes. */
  open?: (url: string) => NRelay;
  /** How long to wait for the other relays once the first has answered (pool default when omitted). */
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

class HomePool extends NPool {
  constructor(
    opts: ConstructorParameters<typeof NPool>[0],
    private readonly blocked: TransportBlock | null,
    private readonly readTimeout: number,
  ) {
    super(opts);
  }

  private refuse(): void {
    if (this.blocked) throw new RelayTransportError(this.blocked);
  }

  override async *req(filters: NostrFilter[], opts?: ReqOpts) {
    this.refuse();
    yield* super.req(filters, opts);
  }

  override async query(filters: NostrFilter[], opts?: QueryOpts): Promise<NostrEvent[]> {
    this.refuse();
    const outer = opts?.signal;
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    if (outer?.aborted) controller.abort();
    else outer?.addEventListener('abort', onOuterAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.readTimeout);
    try {
      const events = await super.query(filters, { ...opts, signal: controller.signal });
      // The pool answers what it has when aborted; a deadline reached with the caller still waiting is a failure.
      if (timedOut && !outer?.aborted) throw new RelayTimeoutError(this.readTimeout);
      return events;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  }

  override async event(event: NostrEvent, opts?: EventOpts): Promise<void> {
    this.refuse();
    return super.event(event, opts);
  }
}

export function createHomePool({ relays = BASE_RELAYS, hints = ECOSYSTEM_READ_HINTS, open, eoseTimeout, log, readTimeout = READ_TIMEOUT_MS, transport }: HomePoolOptions = {}): NPool {
  const openRelay = open ?? ((url: string) => new NRelay1(url, log ? { log } : {}));
  const policy = buildReadRoutingPolicy({ appRelays: relays, hints });
  const writeRelays = [...policy.appRelays];
  const blocked = transport === undefined ? checkRelayTransport() : transport;
  return new HomePool(
    {
      open: openRelay,
      reqRouter(filters: NostrFilter[]) {
        return routeReadFilters(filters, policy);
      },
      eventRouter() {
        return writeRelays;
      },
      ...(eoseTimeout !== undefined ? { eoseTimeout } : {}),
    },
    blocked,
    readTimeout,
  );
}
