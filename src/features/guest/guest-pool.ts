/**
 * The guest's transport: the guest world for everything about the guest, the
 * real pool for everything else.
 *
 * Every hook in the app and the kit talks to ONE `NPool`-shaped object
 * (`useNostr().nostr`). While a guest plays, that object is this one:
 *
 *   query    a filter whose authors are all the guest is answered from the
 *            guest world (the Blobbi, the profile, the receipts; the kit's
 *            mission reads, which find nothing, as they should). Any other
 *            filter (an item catalogue by its issuer, a relay's own data)
 *            goes upstream; if upstream cannot answer, the guest gets an
 *            empty answer, never an error: nothing of a guest's depends on a
 *            relay.
 *   event    a record of the guest's goes into the guest world and is
 *            persisted; it NEVER goes upstream (`guest-signer.ts`: it is not
 *            signed). An event of anyone else (a NIP-46 handshake while the
 *            guest signs into an account they have) goes upstream as before.
 *   req      upstream only (signers' subscriptions); the guest world has no
 *            live subscriptions.
 *
 * Nothing about the guest reaches a relay: not a query by their pubkey, not a
 * record. `upstream` may be null (no network at all): the guest still plays.
 */
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { applyGuestEvent, isAboutGuest, queryGuestEvents } from './guest-world';
import { isUnsignedRecord } from './guest-signer';

export interface GuestWorldHandle {
  /** The records right now. */
  events: () => readonly NostrEvent[];
  /** Replace the records (after `applyGuestEvent`), persisting them. */
  replace: (events: NostrEvent[]) => void;
}

export interface GuestPoolOptions {
  guestPubkey: string;
  world: GuestWorldHandle;
  upstream: NPool | null;
  /** The guest world answers after a tick, as a relay would; 0 in tests. */
  latencyMs?: number;
  /** Dev only: a note when an upstream read failed and was answered empty. */
  log?: (message: string) => void;
}

const settle = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

async function* nothing(): AsyncIterable<never> {
  /* a subscription nobody answers */
}

export function createGuestPool({ guestPubkey, world, upstream, latencyMs = 15, log }: GuestPoolOptions): NPool {
  type QueryOpts = Parameters<NPool['query']>[1];
  type EventOpts = Parameters<NPool['event']>[1];
  type ReqOpts = Parameters<NPool['req']>[1];

  const pool = {
    async query(filters: NostrFilter[], opts?: QueryOpts): Promise<NostrEvent[]> {
      const local = filters.filter((f) => isAboutGuest(f, guestPubkey));
      const remote = filters.filter((f) => !isAboutGuest(f, guestPubkey));
      const answers: NostrEvent[] = [];
      if (local.length > 0) {
        await settle(latencyMs);
        answers.push(...queryGuestEvents(world.events(), local));
      }
      if (remote.length > 0 && upstream) {
        try {
          answers.push(...(await upstream.query(remote, opts)));
        } catch (error) {
          log?.(`[guest-pool] upstream read answered empty: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return answers;
    },
    async event(event: NostrEvent, opts?: EventOpts): Promise<void> {
      if (event.pubkey === guestPubkey) {
        if (!isUnsignedRecord(event)) throw new Error('A guest record must not carry a signature.');
        await settle(latencyMs);
        world.replace(applyGuestEvent(world.events(), event));
        return;
      }
      if (isUnsignedRecord(event)) throw new Error('An unsigned record never leaves this device.');
      if (!upstream) throw new Error('No relay can be reached from here.');
      await upstream.event(event, opts);
    },
    req(filters: NostrFilter[], opts?: ReqOpts) {
      return upstream ? upstream.req(filters, opts) : nothing();
    },
    group() {
      return pool;
    },
    async close() {
      /* the upstream pool belongs to its provider */
    },
  };
  return pool as unknown as NPool;
}
