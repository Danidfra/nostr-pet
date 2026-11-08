/**
 * MAY AN EXISTING EVENT BE COPIED TO ANOTHER RELAY? Only when the account
 * said so, or when the event is not an existing one at all.
 *
 * Opening the home, restoring a saved sign-in or receiving the answer to a
 * read sends NOTHING. Every path that could offer a relay an event signed
 * before this visit asks this one gate first:
 *
 *   - the carry after a read (`relay-sync.ts`);
 *   - the redelivery of a profile written earlier (`profile-delivery.ts`);
 *   - world travel's repair of a relay that lacks the current location
 *     (`features/presence/travel-relays.ts`).
 *
 * The gate lets an event through to a relay when
 *
 *   - it was SIGNED IN THIS VISIT (`markSigned`, called by the one signing
 *     adapter, `usePublishAdapter`): that is the player's own new act, and
 *     offering it again to a relay that was silent is part of publishing it;
 *   - or its author turned copying on, and that relay is one of the relays
 *     they were shown when they did (`SyncConsent`, the kit's). A relay added
 *     to a flow later is not covered until they are asked again.
 *
 * The answer is per account, kept in `blobbi:relay-sync-consent:v1` (public
 * data only: pubkeys, relay urls, a time). Signed out, or a guest: never.
 */
import { SyncConsent, type SyncConsentRecord } from './blobbi-relay-routing';

export const SYNC_CONSENT_KEY = 'blobbi:relay-sync-consent:v1';

export interface ConsentStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface CarryGate {
  /** An event signed in this visit, as the player's own act. */
  markSigned(eventId: string): void;
  signedHere(eventId: string): boolean;
  /** Whether this event may be offered to this relay without a new act of the player. */
  mayCarry(event: { id: string; pubkey: string }, relay: string): boolean;
  /** The account's answer, or undefined when it never gave one. */
  record(pubkey: string | null | undefined): SyncConsentRecord | undefined;
  isEnabled(pubkey: string | null | undefined): boolean;
  /** The relays of `candidates` the account has not agreed to. */
  uncovered(pubkey: string | null | undefined, candidates: readonly string[]): string[];
  /** The account turned copying on, for exactly the relays it was shown. */
  enable(pubkey: string, destinations: readonly string[]): void;
  disable(pubkey: string): void;
  subscribe(listener: () => void): () => void;
  /** Changes on every enable/disable (for `useSyncExternalStore`). */
  version(): number;
}

const MAX_SIGNED = 2_000;

export function createCarryGate(store?: ConsentStore | null, now: () => number = Date.now): CarryGate {
  let initial: Record<string, SyncConsentRecord> = {};
  try {
    const v = JSON.parse(store?.get(SYNC_CONSENT_KEY) ?? 'null') as { version?: unknown; accounts?: unknown } | null;
    if (v?.version === 1 && v.accounts && typeof v.accounts === 'object') initial = v.accounts as Record<string, SyncConsentRecord>;
  } catch {
    initial = {};
  }
  const listeners = new Set<() => void>();
  let version = 0;
  const consent = new SyncConsent({
    now,
    initial,
    onChange: (accounts) => {
      try {
        store?.set(SYNC_CONSENT_KEY, JSON.stringify({ version: 1, accounts }));
      } catch {
        /* not kept: the answer stands for this visit */
      }
      version += 1;
      for (const listener of listeners) listener();
    },
  });
  const signed = new Set<string>();
  return {
    markSigned(eventId) {
      signed.add(eventId);
      if (signed.size > MAX_SIGNED) {
        const oldest = signed.values().next().value;
        if (oldest !== undefined) signed.delete(oldest);
      }
    },
    signedHere: (eventId) => signed.has(eventId),
    mayCarry: (event, relay) => signed.has(event.id) || consent.allows(event.pubkey, relay),
    record: (pubkey) => consent.get(pubkey),
    isEnabled: (pubkey) => consent.isEnabled(pubkey),
    uncovered: (pubkey, candidates) => consent.uncovered(pubkey, candidates),
    enable: (pubkey, destinations) => consent.enable(pubkey, destinations),
    disable: (pubkey) => consent.disable(pubkey),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

function browserStore(): ConsentStore | null {
  try {
    const ls = globalThis.localStorage;
    return ls ? { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) } : null;
  } catch {
    return null;
  }
}

/** The page's gate. */
export const carryGate: CarryGate = createCarryGate(browserStore());
