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
 */
import { NPool, NRelay1, type NostrFilter, type NRelay, type NRelay1Opts } from '@nostrify/nostrify';
import { BASE_RELAYS } from '@/config/relays';
import { ECOSYSTEM_READ_HINTS } from '@/features/inventory/relay-hints';
import { buildReadRoutingPolicy, routeReadFilters, type ReadHint } from './relay-routing';

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
}

export function createHomePool({ relays = BASE_RELAYS, hints = ECOSYSTEM_READ_HINTS, open, eoseTimeout, log }: HomePoolOptions = {}): NPool {
  const openRelay = open ?? ((url: string) => new NRelay1(url, log ? { log } : {}));
  const policy = buildReadRoutingPolicy({ appRelays: relays, hints });
  const writeRelays = [...policy.appRelays];
  return new NPool({
    open: openRelay,
    reqRouter(filters: NostrFilter[]) {
      return routeReadFilters(filters, policy);
    },
    eventRouter() {
      return writeRelays;
    },
    ...(eoseTimeout !== undefined ? { eoseTimeout } : {}),
  });
}
