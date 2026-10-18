/**
 * THE PROFILE DELIVERIES STILL OWED. A profile write (the companion choice, adoption's profile, the daily award or
 * progress) counts as saved once ONE application relay reads it back (`PROFILE_WRITE_QUORUM`), so a relay that is
 * down never holds the player back. The relays that missed it are still owed it: this module keeps the signed event
 * and sends THAT event (same id, same signature: nothing is signed here, there is no signer) to each relay that
 * answers without it, then reads it back.
 *
 * It never overwrites a newer profile: a relay holding a newer profile of the owner (NIP-01 order) is never sent the
 * older one, and once any relay shows a newer profile the owed event is dropped (its writer delivers that one). A
 * relay that refused for good (`blocked:`, `invalid:`...) is no longer owed it. Each event gets `DELIVERY_MAX_TRIES`
 * rounds. Only the newest owed profile per account is kept (an older one is replaced, never sent after it).
 *
 * Record `blobbi:profile-delivery:v1` (public data only: signed events and relay urls). The page runs the rounds a
 * few seconds after it starts (only when something is owed), after a write, when the connection returns, then less
 * and less often (`profileDelivery`).
 */
import { KIND_BLOBBONAUT_PROFILE, type NostrEvent } from '@blobbi-kit/core';
import { verifyEvent } from 'nostr-tools/pure';
import { profileFilter, type ProfileRelays } from './profile-write';

export const PROFILE_DELIVERY_KEY = 'blobbi:profile-delivery:v1';
export const DELIVERY_MAX_TRIES = 8;

export interface OwedProfile {
  event: NostrEvent;
  /** Rounds tried so far. */
  tries: number;
  /** Relays that refused it for good. */
  refused: string[];
}

export interface DeliveryStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** NIP-01 replaceable order: `a` replaces `b` (newer created_at; on a tie, the lower id). */
const newer = (a: NostrEvent, b: NostrEvent) => a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);
const PERMANENT = /^(blocked|invalid|restricted|pow|auth-required|mute):/i;

export function readOwed(store: DeliveryStore): Record<string, OwedProfile> {
  try {
    const v = JSON.parse(store.get(PROFILE_DELIVERY_KEY) ?? 'null') as { version?: unknown; owed?: unknown } | null;
    return v?.version === 1 && v.owed && typeof v.owed === 'object' ? (v.owed as Record<string, OwedProfile>) : {};
  } catch {
    return {};
  }
}
function writeOwed(store: DeliveryStore, owed: Record<string, OwedProfile>): void {
  try {
    store.set(PROFILE_DELIVERY_KEY, JSON.stringify({ version: 1, owed }));
  } catch {
    /* not kept: this visit's rounds still run from memory */
  }
}

/** Keep a written profile for delivery to the relays that missed it (the newest one per account only). */
export function oweProfile(store: DeliveryStore, event: NostrEvent): void {
  if (event.kind !== KIND_BLOBBONAUT_PROFILE) return;
  const owed = readOwed(store);
  const known = owed[event.pubkey]?.event;
  if (known && (known.id === event.id || newer(known, event))) return;
  owed[event.pubkey] = { event, tries: 0, refused: [] };
  writeOwed(store, owed);
}

/** The owner's newest valid profile in one relay's answer. */
function topOf(events: readonly NostrEvent[], owner: string, verify: (e: NostrEvent) => boolean): NostrEvent | null {
  let top: NostrEvent | null = null;
  for (const e of events) {
    if (e.kind !== KIND_BLOBBONAUT_PROFILE || e.pubkey !== owner) continue;
    let ok = false;
    try {
      ok = verify(e);
    } catch {
      ok = false;
    }
    if (ok && (!top || newer(e, top))) top = e;
  }
  return top;
}

/**
 * One round for every owed profile: ask each relay, send the very same event where a relay answered without it (and
 * holds nothing newer), read back. Returns how many profiles are still owed somewhere (with tries left).
 */
export async function deliverOwed(store: DeliveryStore, relays: ProfileRelays, opts: { timeoutMs?: number; sleep?: (ms: number) => Promise<void>; verify?: (e: NostrEvent) => boolean } = {}): Promise<number> {
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const verify = opts.verify ?? verifyEvent;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let left = 0;
  for (const [owner, rec] of Object.entries(readOwed(store))) {
    if (rec.event?.pubkey !== owner || rec.tries >= DELIVERY_MAX_TRIES) continue;
    const ours = rec.event;
    const ask = async () => {
      const byRelay = new Map<string, NostrEvent | null | undefined>(); // undefined: did not answer
      await Promise.all(
        relays.urls.map(async (url) => {
          try {
            byRelay.set(url, topOf(await relays.query(url, profileFilter(owner), AbortSignal.timeout(timeoutMs)), owner, verify));
          } catch {
            byRelay.set(url, undefined);
          }
        }),
      );
      return byRelay;
    };
    let seen = await ask();
    const superseded = () => [...seen.values()].some((top) => !!top && top.id !== ours.id && newer(top, ours));
    let refused = rec.refused ?? [];
    const keep = (next: OwedProfile | null) => {
      const owed = readOwed(store);
      if (owed[owner]?.event.id !== ours.id) return; // a newer write took its place meanwhile
      if (next) owed[owner] = next;
      else delete owed[owner];
      writeOwed(store, owed);
    };
    if (superseded()) {
      keep(null);
      continue;
    }
    const holds = (url: string) => seen.get(url)?.id === ours.id;
    // Only relays that answered without it: an unanswered relay is not sent blindly (it is tried next round)
    const to = relays.urls.filter((url) => seen.get(url) !== undefined && !holds(url) && !refused.includes(url));
    if (to.length) {
      await Promise.all(
        to.map(async (url) => {
          try {
            await relays.publish(url, ours, AbortSignal.timeout(timeoutMs));
          } catch (error) {
            if (error instanceof Error && PERMANENT.test(error.message)) refused = [...refused, url];
          }
        }),
      );
      await sleep(1_500);
      seen = await ask();
      if (superseded()) {
        keep(null);
        continue;
      }
    }
    const owedTo = relays.urls.filter((url) => !holds(url) && !refused.includes(url));
    const tries = rec.tries + 1;
    keep(owedTo.length ? { event: ours, tries, refused } : null);
    if (owedTo.length && tries < DELIVERY_MAX_TRIES) left++;
  }
  return left;
}

// ─── The page's rounds ───

const DELAYS_MS = [10_000, 60_000, 300_000, 900_000];
let relaysNow: ProfileRelays | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let step = 0;
let running = false;
let listening = false;

function browserStore(): DeliveryStore | null {
  try {
    const ls = globalThis.localStorage;
    return ls ? { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) } : null;
  } catch {
    return null;
  }
}

function schedule(restart: boolean): void {
  const store = browserStore();
  if (!store || !relaysNow) return;
  if (restart) step = 0;
  if (timer) clearTimeout(timer);
  timer = null;
  if (step >= DELAYS_MS.length || !Object.keys(readOwed(store)).length) return;
  timer = setTimeout(() => {
    timer = null;
    if (running || !relaysNow) return;
    running = true;
    void deliverOwed(store, relaysNow)
      .catch(() => 1)
      .then((left) => {
        running = false;
        if (left > 0) schedule(false);
      });
  }, DELAYS_MS[step++]);
}

export const profileDelivery = {
  /** The page's relays (the pool, relay by relay): rounds start if something is owed. */
  start(relays: ProfileRelays): void {
    relaysNow = relays;
    if (!listening && typeof window !== 'undefined') {
      listening = true;
      window.addEventListener('online', () => schedule(true));
    }
    schedule(true);
  },
  /** A profile was written (read back on at least one relay, or accepted): owed to the relays that missed it. */
  owe(event: NostrEvent, relays: ProfileRelays): void {
    const store = browserStore();
    if (!store) return;
    oweProfile(store, event);
    profileDelivery.start(relays);
  },
};
