/**
 * WRITING THE COMPANION CHOICE INTO THE PLAYER'S PROFILE (kind 11125), safely.
 *
 * The profile is a replaceable event: whatever is published REPLACES the
 * player's profile everywhere, `has` (every Blobbi the other apps listed),
 * xp, onboarding, unknown tags and the content included. So a replacement is
 * only ever built from a profile known to be the newest, and never claimed
 * saved without seeing it on the relays:
 *
 *   read      every relay separately; the read is COMPLETE only when each of
 *             `required` (the relays every Blobbi app writes profiles to)
 *             answered to the end. Incomplete: nothing is built (`unsafe`).
 *   base      the newest valid profile by the owner (a valid 11125 before any
 *             legacy 31125; NIP-01 order: newer created_at, then lower id).
 *             None at all: `no-profile`; a profile is created here only for
 *             an adoption whose own profile write never landed (`create`),
 *             and only on that COMPLETE read: an incomplete one never counts
 *             as "none".
 *   order     a choice made clearly later elsewhere is never overwritten:
 *             unless this is the share right after the choice
 *             (`CHOICE_FRESH_MS`), the rules of `choice-order.ts` decide
 *             (`superseded`, or `ambiguous`: the player is asked).
 *   build     the base's tags with `current_companion` replaced (the kit's
 *             `updateBlobbonautTags`), the chosen Blobbi added to `has` when
 *             missing (never removed), its content as it is, `created_at`
 *             after the base's. `preservesProfile` checks that every other
 *             tag survived; if not, nothing is signed.
 *   sign      by the account itself (the caller's signer); a signature for
 *             another key is refused. The signed event is handed to
 *             `onSigned` BEFORE anything is sent: a retry sends the very same
 *             event, never a second one.
 *   re-check  just before sending, a second complete read: a profile written
 *             meanwhile by another app is built over (once), never replaced.
 *   send      only while the account is still the one signed in (checked
 *             again right before, after the reads); to every relay; then
 *             READ BACK: saved once `quorum` relays (one, by default) hold
 *             it (or a newer profile naming the same Blobbi), so one relay
 *             down never holds the choice back; the relays still missing it
 *             are sent that very event later (`profile-delivery.ts`). Read
 *             back nowhere: `partial` if a relay accepted it (the same event
 *             is resent on retry), else `failed`.
 *
 * A pending write found superseded by a newer profile is dropped, never sent:
 * the caller decides again with the ordering rules (`choice-order.ts`).
 */
import { KIND_BLOBBONAUT_PROFILE, KIND_BLOBBONAUT_PROFILE_LEGACY, getBlobbonautQueryDValues, getCanonicalBlobbonautD, isValidBlobbonautEvent, parseBlobbonautEvent, updateBlobbonautTags, type NostrEvent } from '@blobbi-kit/core';
import { verifyEvent } from 'nostr-tools/pure';
import { CHOICE_FRESH_MS, orderChoices, replaces, type ProfileStamp, type SeenProfile } from './choice-order';
import { profileTemplate } from '@/features/adoption/adoption-plan';
import type { PendingWrite } from './choice-store';

export interface ProfileFilter {
  kinds: number[];
  authors: string[];
  '#d': string[];
  limit: number;
}

/** The relays, one at a time (the caller wraps the app's pool; tests pass fakes). */
export interface ProfileRelays {
  /** Every relay asked and written to. */
  urls: readonly string[];
  /** A read is complete only when each of these answered. */
  required: readonly string[];
  /** How many relays must hold a write (read back) for it to count as saved; at least one. */
  quorum: number;
  /** Resolves with the relay's stored events once it says it has sent them all (EOSE); rejects otherwise. */
  query(url: string, filter: ProfileFilter, signal: AbortSignal): Promise<NostrEvent[]>;
  /** Resolves when the relay accepted the event (OK true, or it already had it); rejects otherwise. */
  publish(url: string, event: NostrEvent, signal: AbortSignal): Promise<void>;
}

export interface UnsignedProfile {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export type ProfileWriteOutcome =
  | { kind: 'saved'; event: NostrEvent }
  /** The profile already names this Blobbi: nothing was (or needs to be) written. */
  | { kind: 'unchanged'; profile: ProfileStamp }
  /** A newer profile names another Blobbi: this choice's write was dropped; decide again. */
  | { kind: 'superseded'; profile: ProfileStamp & { d: string | null } }
  | { kind: 'no-profile' }
  /** A profile made since the choice, too close in time to order: nothing was written; the player is asked. */
  | { kind: 'ambiguous'; profile: ProfileStamp & { d: string | null } }
  /** Not every relay that must answer did: nothing was built or sent. */
  | { kind: 'unsafe' }
  | { kind: 'offline' }
  | { kind: 'sign-failed'; message: string }
  /** The account changed, or the signer answered for another key. */
  | { kind: 'wrong-account' }
  /** A new signature is needed and this attempt may not ask for one (an automatic retry): nothing signed or sent. */
  | { kind: 'needs-signature' }
  /** Sent, but not yet seen on enough relays: kept pending, the same event goes out again on retry. */
  | { kind: 'partial'; event: NostrEvent; holders: string[] }
  | { kind: 'failed'; event: NostrEvent | null };

export interface ProfileWriteDeps {
  relays: ProfileRelays;
  /** Signs as the account (the caller checks who is signed in at that very moment). */
  sign: (template: UnsignedProfile) => Promise<NostrEvent>;
  /** Called with the signed event before it is sent (persist it). */
  onSigned: (pending: PendingWrite) => void;
  /** The account is still the one this write is for. */
  stillAccount: () => boolean;
  online: () => boolean;
  /**
   * Whether this attempt may ask the signer (default yes). An automatic retry may not: an extension or a remote
   * signer would ask the player out of the blue. It may still resend a write already signed.
   */
  maySign?: boolean;
  now: () => number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  verify?: (event: NostrEvent) => boolean;
}

export interface ProfileWriteRequest {
  owner: string;
  d: string;
  /** When the player made the choice (ms, this device's clock), and the profile they were shown then. */
  at: number;
  over: SeenProfile | null;
  /** A write already signed for this choice (resent as it is), or null. */
  pending: PendingWrite | null;
  /** An adoption's choice whose profile was never written: with no profile at all, create one with this name. */
  create?: { name: string } | null;
}

/** The base of a write that created the profile (there was none before it). */
export const NO_BASE: ProfileStamp = { id: '0'.repeat(64), createdAt: 0 };

export const profileFilter = (owner: string): ProfileFilter => ({ kinds: [KIND_BLOBBONAUT_PROFILE, KIND_BLOBBONAUT_PROFILE_LEGACY], authors: [owner], '#d': getBlobbonautQueryDValues(owner), limit: 20 });

const stamp = (e: NostrEvent): ProfileStamp => ({ id: e.id, createdAt: e.created_at });
const companionOf = (e: NostrEvent | null): string | null => (e ? (parseBlobbonautEvent(e)?.currentCompanion ?? null) : null);

/** The owner's newest valid profile among `events`: an 11125 before any 31125; NIP-01 order within a kind. */
export function newestProfile(events: readonly NostrEvent[], owner: string, verify: (e: NostrEvent) => boolean = verifyEvent): NostrEvent | null {
  const ok = events.filter((e) => e.pubkey === owner && (e.kind === KIND_BLOBBONAUT_PROFILE || e.kind === KIND_BLOBBONAUT_PROFILE_LEGACY) && isValidBlobbonautEvent(e) && safeVerify(verify, e));
  const pick = (kind: number) => ok.filter((e) => e.kind === kind).sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0] ?? null;
  return pick(KIND_BLOBBONAUT_PROFILE) ?? pick(KIND_BLOBBONAUT_PROFILE_LEGACY);
}

function safeVerify(verify: (e: NostrEvent) => boolean, e: NostrEvent): boolean {
  try {
    return verify(e);
  } catch {
    return false;
  }
}

/** The replacement profile: the base as it is, `current_companion` = `d`, `d` listed in `has`. */
export function buildCompanionProfile(base: NostrEvent, owner: string, d: string, nowSeconds: number): UnsignedProfile {
  // A legacy 31125 is carried over into the 11125 with the kit's canonical d (as Blobbi Pixel does)
  const tags = base.tags.filter((t) => t[0] !== 'current_companion').map((t) => (t[0] === 'd' && base.kind === KIND_BLOBBONAUT_PROFILE_LEGACY ? ['d', getCanonicalBlobbonautD(owner)] : [...t]));
  const has = tags.filter((t) => t[0] === 'has' && t[1]).map((t) => t[1]);
  const updates: Record<string, string | string[]> = { current_companion: d };
  if (!has.includes(d)) updates.has = [...has, d];
  return { kind: KIND_BLOBBONAUT_PROFILE, created_at: Math.max(nowSeconds, base.created_at + 1), tags: updateBlobbonautTags(tags, updates), content: base.content };
}

/**
 * Whether `next` keeps everything of `base` but the companion: every tag (as a multiset, order aside) except
 * `current_companion`, a legacy `d` carried over, `client` and `published_at`; every `has`; the content.
 */
export function preservesProfile(base: NostrEvent, next: UnsignedProfile, d: string): boolean {
  if (next.content !== base.content) return false;
  if (next.tags.filter((t) => t[0] === 'current_companion').length !== 1 || !next.tags.some((t) => t[0] === 'current_companion' && t[1] === d)) return false;
  const ignored = new Set(['current_companion', 'client', 'published_at', ...(base.kind === KIND_BLOBBONAUT_PROFILE_LEGACY ? ['d'] : [])]);
  const count = (tags: readonly string[][]) => {
    const m = new Map<string, number>();
    for (const t of tags) if (!ignored.has(t[0]) && !(t[0] === 'has' && t[1] === d)) m.set(JSON.stringify(t), (m.get(JSON.stringify(t)) ?? 0) + 1);
    return m;
  };
  const before = count(base.tags);
  const after = count(next.tags);
  // A repeated `has` is one Blobbi (the kit de-duplicates it); every other tag keeps its count
  for (const [t, n] of before) if ((after.get(t) ?? 0) < (JSON.parse(t)[0] === 'has' ? 1 : n)) return false;
  return true;
}

interface Census {
  complete: boolean;
  byRelay: Map<string, NostrEvent[] | null>;
  newest: NostrEvent | null;
}

async function census(relays: ProfileRelays, owner: string, timeoutMs: number, verify: (e: NostrEvent) => boolean): Promise<Census> {
  const filter = profileFilter(owner);
  const byRelay = new Map<string, NostrEvent[] | null>();
  await Promise.all(
    relays.urls.map(async (url) => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, timeoutMs);
      });
      try {
        const got = await Promise.race([relays.query(url, filter, controller.signal), late]);
        byRelay.set(url, got);
      } catch {
        byRelay.set(url, null);
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  const complete = relays.required.every((url) => byRelay.get(url) != null);
  const all = [...byRelay.values()].flatMap((evs) => evs ?? []);
  return { complete, byRelay, newest: newestProfile(all, owner, verify) };
}

/**
 * A complete read of the owner's profile (every required relay answered), for other writers of the profile
 * (adoption): `complete` false means the newest profile out there is not known, and nothing may replace it.
 */
export async function readProfileCensus(relays: ProfileRelays, owner: string, timeoutMs = 8_000, verify: (e: NostrEvent) => boolean = verifyEvent): Promise<{ complete: boolean; newest: NostrEvent | null }> {
  const c = await census(relays, owner, timeoutMs, verify);
  return { complete: c.complete, newest: c.newest };
}

/** The relays whose newest profile is `ours`, or a newer one that names the same Blobbi. */
function holders(c: Census, ours: NostrEvent, owner: string, d: string, verify: (e: NostrEvent) => boolean): string[] {
  const out: string[] = [];
  for (const [url, evs] of c.byRelay) {
    const top = evs ? newestProfile(evs, owner, verify) : null;
    if (top && (top.id === ours.id || (replaces(stamp(top), stamp(ours)) && companionOf(top) === d))) out.push(url);
  }
  return out;
}

function confirmedBy(relays: ProfileRelays, held: readonly string[]): boolean {
  const mine = held.filter((h) => relays.urls.includes(h));
  return mine.length >= Math.max(1, Math.min(relays.quorum, relays.urls.length));
}

export async function writeCompanionProfile(req: ProfileWriteRequest, deps: ProfileWriteDeps): Promise<ProfileWriteOutcome> {
  const { relays } = deps;
  const timeoutMs = deps.timeoutMs ?? 8_000;
  const verify = deps.verify ?? verifyEvent;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { owner, d } = req;
  if (!deps.online()) return { kind: 'offline' };

  let first = await census(relays, owner, timeoutMs, verify);
  if (!first.complete) return { kind: 'unsafe' };

  let pending = req.pending;
  if (pending) {
    const top = first.newest;
    const mine = stamp(pending.event);
    if (top && top.id !== pending.event.id) {
      if (replaces(stamp(top), mine)) {
        // A newer profile out there: this write is over (it may still say the same Blobbi)
        return companionOf(top) === d ? { kind: 'unchanged', profile: stamp(top) } : { kind: 'superseded', profile: { ...stamp(top), d: companionOf(top) } };
      }
      // Older than ours but not what ours was built on: ours would drop what it added. Rebuild.
      if (top.id !== pending.base.id && replaces(stamp(top), pending.base)) pending = null;
    }
  }

  if (!pending) {
    let built: NostrEvent | null = null;
    // Build over the newest; if another app writes meanwhile, build once more over theirs
    for (let round = 0; round < 2 && !built; round++) {
      const base = first.newest;
      if (!base) {
        if (!req.create) return { kind: 'no-profile' };
        // No profile on a complete read: the adoption's own profile, created now (`has` and `current_companion` = d)
        const fresh = profileTemplate({ ownerPubkey: owner, profile: null, d, suggestedName: req.create.name });
        const template: UnsignedProfile = { kind: fresh.kind, created_at: Math.floor(deps.now() / 1000), tags: fresh.tags, content: fresh.content };
        if (!deps.stillAccount()) return { kind: 'wrong-account' };
        if (deps.maySign === false) return { kind: 'needs-signature' };
        let created: NostrEvent;
        try {
          created = await deps.sign(template);
        } catch (error) {
          return { kind: 'sign-failed', message: error instanceof Error ? error.message : String(error) };
        }
        if (created.pubkey !== owner || !safeVerify(verify, created) || !deps.stillAccount()) return { kind: 'wrong-account' };
        const again = await census(relays, owner, timeoutMs, verify);
        if (!again.complete) {
          deps.onSigned({ event: created, base: NO_BASE });
          return { kind: 'unsafe' };
        }
        // A profile made meanwhile (another app): built over, never replaced
        if (again.newest) {
          first = again;
          continue;
        }
        built = created;
        pending = { event: created, base: NO_BASE };
        deps.onSigned(pending);
        continue;
      }
      const named = companionOf(base);
      if (named === d) return { kind: 'unchanged', profile: stamp(base) };
      // A choice made elsewhere after this one is never overwritten (`choice-order.ts`, the same rules as the screen);
      // a choice shared right after it was made is the latest act there is (`CHOICE_FRESH_MS`)
      if (named && deps.now() - req.at > CHOICE_FRESH_MS) {
        const order = orderChoices({ d, at: req.at, by: 'player', synced: null, over: req.over }, { d: named, ...stamp(base) }, deps.now());
        if (order.winner === 'global') return { kind: 'superseded', profile: { ...stamp(base), d: named } };
        if (order.winner === 'ambiguous') return { kind: 'ambiguous', profile: { ...stamp(base), d: named } };
      }
      const template = buildCompanionProfile(base, owner, d, Math.floor(deps.now() / 1000));
      if (!preservesProfile(base, template, d)) return { kind: 'failed', event: null };
      if (!deps.stillAccount()) return { kind: 'wrong-account' };
      if (deps.maySign === false) return { kind: 'needs-signature' };
      let signed: NostrEvent;
      try {
        signed = await deps.sign(template);
      } catch (error) {
        return { kind: 'sign-failed', message: error instanceof Error ? error.message : String(error) };
      }
      if (signed.pubkey !== owner || !safeVerify(verify, signed) || !deps.stillAccount()) return { kind: 'wrong-account' };
      const again = await census(relays, owner, timeoutMs, verify);
      if (!again.complete) {
        // Not sent: kept as this choice's write, checked against the relays again before it ever goes out
        deps.onSigned({ event: signed, base: stamp(base) });
        return { kind: 'unsafe' };
      }
      if (again.newest && again.newest.id !== base.id && replaces(stamp(again.newest), stamp(base))) {
        first = again;
        continue;
      }
      built = signed;
      pending = { event: signed, base: stamp(base) };
      deps.onSigned(pending);
    }
    if (!pending) return { kind: 'unsafe' };
  }

  // The account may have gone while the relays were read (a sign-out, a switch): nothing goes out for it then; the
  // signed event stays this choice's write, for when that account is back
  if (!deps.stillAccount()) return { kind: 'wrong-account' };
  // Send the one signed event to every relay that does not hold it yet; then read it back
  const event = pending.event;
  let held = holders(first, event, owner, d, verify);
  const accepted = new Set<string>();
  await Promise.all(
    relays.urls
      .filter((url) => !held.includes(url))
      .map(async (url) => {
        try {
          await relays.publish(url, event, AbortSignal.timeout(timeoutMs));
          accepted.add(url);
        } catch {
          /* not accepted there */
        }
      }),
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(1_500);
    const back = await census(relays, owner, timeoutMs, verify);
    held = [...new Set([...held, ...holders(back, event, owner, d, verify)])];
    if (confirmedBy(relays, held)) return { kind: 'saved', event };
    const top = back.newest;
    if (top && top.id !== event.id && replaces(stamp(top), stamp(event)) && companionOf(top) !== d) return { kind: 'superseded', profile: { ...stamp(top), d: companionOf(top) } };
  }
  return accepted.size > 0 || held.length > 0 ? { kind: 'partial', event, holders: held } : { kind: 'failed', event };
}
