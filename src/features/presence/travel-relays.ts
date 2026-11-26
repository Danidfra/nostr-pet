/**
 * WORLD TRAVEL'S RELAYS in the home: the primary relay, then the two every
 * Blobbi world reads and writes World Locations on (the kit's
 * `BLOBBI_WORLD_TRAVEL_RELAYS`, kept as they are: "a host may add relays; it
 * should keep these").
 *
 * The kit's session takes a look as confirmed once ONE relay answered, and a
 * Blobbi with no World Location at all is at home, where it may then be
 * moved FROM with a first location that names no previous one. The primary
 * is new and may hold nothing yet: answering alone, fast and empty, on a
 * device with nothing cached, it would be taken for "this Blobbi never
 * travelled" while relay.ditto.pub and relay.primal.net, a moment slower or
 * briefly unreachable, hold where it really is.
 *
 * So the primary's EMPTY answer counts only once one of the other relays has
 * answered the same question (with anything, or with nothing): until then it
 * is held back, and if none does it ends as silence (the look is
 * `unreachable`, and nothing is signed over an unknown location). An answer
 * WITH events is passed on at once, as is everything the other relays say.
 * The live stream is untouched, and a move the player makes is offered to the
 * primary like to the rest.
 *
 * REPAIR IS NOT A MOVE. The kit's session also re-sends the CURRENT location,
 * signed some earlier day, to a relay that answered without it, and re-sends
 * a move kept from an earlier visit. Those are existing events: copying them
 * is off until the account turns it on (`lib/sync-consent.ts`), so opening
 * the home never sends one. The kit cannot be told that, so the adapter
 * answers for the relay (`gateExistingEvents`): an event signed in this visit
 * goes through; any other is refused with `blocked:`, which the session takes
 * as final for that relay and stops retrying. With copying on, the repair
 * runs as the kit means it, to the relays the account agreed to.
 */
import { BLOBBI_WORLD_TRAVEL_RELAYS, type NostrEvent, type WorldTravelRelays } from '@blobbi-kit/core';
import { PRIMARY_RELAY, normalizeRelayUrl } from '@/config/relays';
import { carryGate, type CarryGate } from '@/lib/sync-consent';

/** The primary first, then the kit's list, each once. */
export const HOME_WORLD_TRAVEL_RELAYS: readonly string[] = [PRIMARY_RELAY, ...BLOBBI_WORLD_TRAVEL_RELAYS.filter((url) => normalizeRelayUrl(url) !== PRIMARY_RELAY)];

/** How long another relay's answer to the same question vouches for the primary's empty one. */
export const CORROBORATION_MS = 30_000;

export class UncorroboratedEmptyError extends Error {
  constructor() {
    super('The primary relay answered empty and no other relay answered.');
    this.name = 'UncorroboratedEmptyError';
  }
}

/** `relays`, with the primary's empty answer held until another relay has answered the same filter. */
export function guardEmptyPrimary(relays: WorldTravelRelays, primary: string = PRIMARY_RELAY, now: () => number = Date.now): WorldTravelRelays {
  const isPrimary = (url: string) => (normalizeRelayUrl(url) ?? url) === primary;
  // With no other relay to ask, there is nothing to hold the primary's answer for
  if (!relays.urls.some(isPrimary) || relays.urls.every(isPrimary)) return relays;

  /** When another relay last answered each question (ms). */
  const answeredAt = new Map<string, number>();
  const waiting = new Map<string, Set<() => void>>();

  const vouched = (key: string) => now() - (answeredAt.get(key) ?? -Infinity) <= CORROBORATION_MS;
  const untilVouched = (key: string, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (vouched(key)) return resolve();
      const waiters = waiting.get(key) ?? new Set<() => void>();
      waiting.set(key, waiters);
      const done = () => {
        signal.removeEventListener('abort', gone);
        resolve();
      };
      const gone = () => {
        waiters.delete(done);
        reject(new UncorroboratedEmptyError());
      };
      if (signal.aborted) return gone();
      waiters.add(done);
      signal.addEventListener('abort', gone, { once: true });
    });

  return {
    ...relays,
    async query(url, filter, signal): Promise<NostrEvent[]> {
      const key = JSON.stringify(filter);
      const events = await relays.query(url, filter, signal);
      if (!isPrimary(url)) {
        answeredAt.set(key, now());
        const waiters = waiting.get(key);
        if (waiters) {
          waiting.delete(key);
          for (const wake of waiters) wake();
        }
        return events;
      }
      if (events.length === 0) await untilVouched(key, signal);
      return events;
    },
  };
}

/** What the adapter answers, in a relay's own form, for an existing event it will not copy. */
export const COPY_OFF_MESSAGE = 'blocked: copying existing events to this relay is off for this account';

/** `relays`, where an event not signed in this visit is published only to a relay its author agreed to. */
export function gateExistingEvents(relays: WorldTravelRelays, gate: Pick<CarryGate, 'mayCarry'> = carryGate): WorldTravelRelays {
  return {
    ...relays,
    async publish(url, event, signal) {
      if (!gate.mayCarry(event, url)) throw new Error(COPY_OFF_MESSAGE);
      return relays.publish(url, event, signal);
    },
  };
}
