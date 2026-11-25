/**
 * A kind 0 write that never replaces metadata it could not read.
 *
 * Kind 0 is the account's own profile across all of Nostr (name, picture,
 * nip05, lightning address, banner, website, and fields other clients add):
 * replaceable, so a write replaces it everywhere. Hence:
 *
 *   read      each relay that must answer (`PROFILE_REQUIRED_RELAYS`, the
 *             relays every Blobbi app writes to) is asked on its own and
 *             counts only when it answered to the end (EOSE): a timeout, a
 *             refused or dropped connection is NOT "no profile". The other
 *             application relays are asked too, and heard while in time.
 *             The newest kind 0 found (NIP-01 order) is the base.
 *   absence   no kind 0 on any relay that answered is believed only for a
 *             brand-new account (`allowCreate`: the key was made here);
 *             for an account that signed in, its profile may live on relays
 *             this app does not ask, so nothing is created from scratch
 *   merge     onto the base's RAW JSON object: every field is kept as it
 *             is, including fields this app does not know and values that do
 *             not fit nostrify's schema; only what the form touched changes
 *   malformed a base whose content is not a JSON object is never replaced
 *   stale     after signing, the required relays are asked again; a newer
 *             kind 0 meanwhile means nothing is sent
 *
 * `created_at` is always after the base's, and the base's tags are kept
 * (NIP-39 identities and the like), with this app's `client` tag.
 */
import type { NostrEvent, NostrFilter, NPool } from '@nostrify/nostrify';
import { BASE_RELAYS, PROFILE_REQUIRED_RELAYS } from '@/config/relays';
import type { ProfileFormInput } from './profile-plan';

export const METADATA_READ_TIMEOUT_MS = 6_000;

export type RawMetadata = Record<string, unknown>;

export interface MetadataCensus {
  /** Every required relay answered to the end. */
  complete: boolean;
  /** Required relays that did not answer. */
  missing: string[];
  /** The newest kind 0 of the account among the answers, or null. */
  newest: NostrEvent | null;
}

/** NIP-01: the newer `created_at`, then the lower id. */
export function newerMetadata(a: NostrEvent | null, b: NostrEvent | null): NostrEvent | null {
  if (!a) return b;
  if (!b) return a;
  if (b.created_at !== a.created_at) return b.created_at > a.created_at ? b : a;
  return b.id < a.id ? b : a;
}

export async function readMetadataCensus(
  nostr: NPool,
  pubkey: string,
  { required = PROFILE_REQUIRED_RELAYS, others = BASE_RELAYS, timeoutMs = METADATA_READ_TIMEOUT_MS }: { required?: readonly string[]; others?: readonly string[]; timeoutMs?: number } = {},
): Promise<MetadataCensus> {
  const urls = [...new Set([...required, ...others])];
  const answers = await Promise.all(
    urls.map(async (url) => {
      const answer = await readToEose(nostr, url, [{ kinds: [0], authors: [pubkey], limit: 1 }], timeoutMs);
      return { url, ok: answer !== null, events: answer ?? [] };
    }),
  );
  let newest: NostrEvent | null = null;
  for (const answer of answers) for (const event of answer.events) if (event.kind === 0 && event.pubkey === pubkey) newest = newerMetadata(newest, event);
  const missing = answers.filter((a) => !a.ok && required.includes(a.url)).map((a) => a.url);
  return { complete: missing.length === 0, missing, newest };
}

/**
 * One relay's answer, or null when it did not answer to the end: only an EOSE
 * makes it an answer; a timeout, a CLOSED, a refused connection or a stream
 * that ended without EOSE is no answer at all.
 */
export async function readToEose(nostr: NPool, url: string, filters: NostrFilter[], timeoutMs: number): Promise<NostrEvent[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: NostrEvent[] = [];
  try {
    for await (const msg of nostr.relay(url).req(filters, { signal: controller.signal })) {
      if (msg[0] === 'EVENT') events.push(msg[2]);
      else if (msg[0] === 'EOSE') return events;
      else if (msg[0] === 'CLOSED') return null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/** The base's content as a JSON object, or null when it is not one (never replaced, then). */
export function parseRawMetadata(event: NostrEvent): RawMetadata | null {
  try {
    const value: unknown = JSON.parse(event.content);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as RawMetadata) : null;
  } catch {
    return null;
  }
}

/**
 * The form applied to the raw metadata: every other field kept as it was.
 * `display_name` follows `name` when it was missing or equal to the old
 * name; an empty about removes it (the form shows the current one); an empty
 * picture keeps the current one.
 */
export function mergeRawMetadata(existing: RawMetadata | null, form: ProfileFormInput): RawMetadata {
  const next: RawMetadata = { ...(existing ?? {}) };
  if (form.name) {
    if (!existing?.display_name || existing.display_name === existing.name) next.display_name = form.name;
    next.name = form.name;
  }
  if (form.about) next.about = form.about;
  else delete next.about;
  if (form.picture) next.picture = form.picture;
  else if (!existing?.picture) delete next.picture;
  return next;
}

export type MetadataPlan =
  | { kind: 'ready'; content: string; tags: string[][]; createdAt: number; base: NostrEvent | null }
  | { kind: 'refused'; reason: 'incomplete' | 'malformed' | 'not-found' };

/** What to write, from a census: refused whenever the current metadata is not known well enough to keep it. */
export function planMetadataWrite(census: MetadataCensus, form: ProfileFormInput, { allowCreate, now, client }: { allowCreate: boolean; now: number; client: string }): MetadataPlan {
  if (!census.complete) return { kind: 'refused', reason: 'incomplete' };
  const base = census.newest;
  if (!base && !allowCreate) return { kind: 'refused', reason: 'not-found' };
  const raw = base ? parseRawMetadata(base) : null;
  if (base && raw === null) return { kind: 'refused', reason: 'malformed' };
  const tags = [...(base?.tags ?? []).filter(([name]) => name !== 'client').map((tag) => [...tag]), ['client', client]];
  return { kind: 'ready', content: JSON.stringify(mergeRawMetadata(raw, form)), tags, createdAt: Math.max(now, base ? base.created_at + 1 : now), base };
}

/** A newer kind 0 than the base appeared while signing (and it is not the one just signed). */
export function metadataChangedMeanwhile(census: MetadataCensus, base: NostrEvent | null, signed: NostrEvent): boolean {
  const newest = census.newest;
  if (!newest || newest.id === signed.id || newest.id === base?.id) return false;
  return newerMetadata(base, newest) === newest;
}
