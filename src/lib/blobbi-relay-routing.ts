// Vendored verbatim from `@blobbi-kit/core` `relay-routing.ts`; replace with an import once the kit release that contains it is installed.
/**
 * Relay routing shared by every Blobbi app: which relay is the primary one,
 * how answers from several relays become one result, and which events may be
 * carried from one relay to another.
 *
 * `wss://relay.blobbi.pet` is the primary relay for the events it accepts.
 * Every app keeps the relays it already used as secondaries. That gives three
 * jobs, all of them pure and all of them here:
 *
 *   1. MERGE. Events are deduplicated by id. For replaceable and addressable
 *      kinds the NIP-01 winner is kept (higher `created_at`, then the lower
 *      id), wherever it came from. Regular events are history: all are kept.
 *
 *   2. DECIDE. A read over several relays is one of:
 *        answered            every relay reached EOSE
 *        answered, degraded  some relay failed, another returned events
 *        unknown             nobody answered, or the only answers were EMPTY
 *                            while a relay was still silent
 *      An empty result is a fact only when EVERY relay said so. A primary
 *      relay that is new and empty must never read as "this account has
 *      nothing", and a silent relay must never read as "empty".
 *
 *   3. SYNC. When a relay that finished its answer lacks an event another
 *      relay returned, the ORIGINAL signed event (same id, same signature)
 *      may be offered to it. Only when its absence is certain (EOSE, and the
 *      filter was not truncated), only for events the flow allows, and never
 *      for private, ephemeral, expiring, deleted or relay-bound events.
 *      And only once the account has said so (`SyncConsent`): until then a
 *      read sends nothing, whoever is signed in.
 *
 * This module opens no socket and signs nothing. It depends on nothing, so a
 * host that cannot yet take this kit version can carry the file as it is.
 */

/** The Blobbi ecosystem's own relay. */
export const BLOBBI_RELAY_URL = 'wss://relay.blobbi.pet';

/**
 * The kinds `relay.blobbi.pet` has a write rule for (blobbi-relay
 * `policy/rules.js`). Anything else is answered `blocked:`, so a flow for
 * another kind should not list the Blobbi relay as a destination.
 * Kind 31125 is accepted only from the operator's migration, never live.
 */
export const BLOBBI_RELAY_KINDS: readonly number[] = [
  0, 5, 1124, 1416, 1417, 11125, 21124, 21201, 21951, 31124, 31126, 31415, 31416, 31417, 31632, 31633, 31634, 31950,
  31951,
];

/** Whether the Blobbi relay has a write rule for this kind. */
export const blobbiRelayAcceptsKind = (kind: number): boolean => BLOBBI_RELAY_KINDS.includes(kind);

/** The fields of a Nostr event this module reads. */
export interface RelayEvent {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  tags: string[][];
}

/** A NIP-01 filter, as far as this module reads it. */
export interface RelayFilter {
  ids?: readonly string[];
  authors?: readonly string[];
  kinds?: readonly number[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  [tag: `#${string}`]: readonly string[] | undefined;
}

// ── URLs ────────────────────────────────────────────────────────────────────

/** A relay URL in one spelling (`wss://host/path`, no trailing slash), or null when it is not a websocket URL. */
export function normalizeRelayUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!/^wss?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') return null;
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

/** Relay URLs normalized, in order, without repeats; anything that is not a websocket URL is dropped. */
export function dedupeRelayUrls(urls: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    const normalized = normalizeRelayUrl(url);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

/** `primary` first, then the relays the app already had, in their order. */
export function withPrimaryRelay(existing: readonly (string | null | undefined)[], primary: string = BLOBBI_RELAY_URL): string[] {
  return dedupeRelayUrls([primary, ...existing]);
}

// ── Kind classes (NIP-01) ───────────────────────────────────────────────────

export const isReplaceableKind = (kind: number): boolean => kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
export const isAddressableKind = (kind: number): boolean => kind >= 30000 && kind < 40000;
export const isEphemeralKind = (kind: number): boolean => kind >= 20000 && kind < 30000;

const firstTag = (event: RelayEvent, name: string): string | undefined => event.tags.find((t) => t[0] === name)?.[1];

/** `kind:pubkey:d` for an addressable event, `kind:pubkey:` for a replaceable one, null for the rest. */
export function eventAddress(event: RelayEvent): string | null {
  if (isAddressableKind(event.kind)) return `${event.kind}:${event.pubkey}:${firstTag(event, 'd') ?? ''}`;
  if (isReplaceableKind(event.kind)) return `${event.kind}:${event.pubkey}:`;
  return null;
}

/** NIP-01: whether `a` replaces `b` at the same address (newer, or as new with the lower id). */
export function replacesEvent(a: Pick<RelayEvent, 'id' | 'created_at'>, b: Pick<RelayEvent, 'id' | 'created_at'>): boolean {
  return a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);
}

/** Newest first, then the lower id: one order for every app. */
export function compareNewestFirst(a: RelayEvent, b: RelayEvent): number {
  return b.created_at - a.created_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Whether an event matches a filter (NIP-01, without `search`). */
export function matchesFilter(event: RelayEvent, filter: RelayFilter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  for (const key of Object.keys(filter)) {
    if (!key.startsWith('#')) continue;
    const wanted = filter[key as `#${string}`];
    if (!wanted) continue;
    const name = key.slice(1);
    if (!event.tags.some((t) => t[0] === name && wanted.includes(t[1]))) return false;
  }
  return true;
}

// ── 1. Merge ────────────────────────────────────────────────────────────────

/**
 * One result from many relays: no id twice, one event per replaceable or
 * addressable address (the NIP-01 winner), every regular event kept. Newest
 * first.
 */
export function mergeRelayEvents<E extends RelayEvent>(events: Iterable<E>): E[] {
  const byId = new Map<string, E>();
  const byAddress = new Map<string, E>();
  for (const event of events) {
    if (byId.has(event.id)) continue;
    const address = eventAddress(event);
    if (address === null) {
      byId.set(event.id, event);
      continue;
    }
    const held = byAddress.get(address);
    if (held && !replacesEvent(event, held)) continue;
    if (held) byId.delete(held.id);
    byAddress.set(address, event);
    byId.set(event.id, event);
  }
  return [...byId.values()].sort(compareNewestFirst);
}

// ── 2. Decide ───────────────────────────────────────────────────────────────

/** What one relay has said so far for one REQ. */
export interface RelayReadState<E extends RelayEvent = RelayEvent> {
  relay: string;
  /** `eose`: finished its stored events. `failed`: CLOSED, error or unreachable. `pending`: neither yet. */
  status: 'pending' | 'eose' | 'failed';
  /** The events it sent before EOSE. */
  events: readonly E[];
  /** It failed recently: do not hold a non-empty answer back for it. */
  suspect?: boolean;
}

/** The newest version of an address this device has itself seen accepted or read. */
export interface KnownHead {
  address: string;
  created_at: number;
  id: string;
}

export type ReadDecision<E extends RelayEvent = RelayEvent> =
  /** Not enough is known yet; ask again when a relay settles or the deadline passes. */
  | { status: 'wait' }
  /** Usable. `complete` is false when some relay did not answer. */
  | { status: 'answered'; complete: boolean; events: E[] }
  /** The state could not be established. Never treat as empty. */
  | { status: 'unknown'; reason: 'no-relay-answered' | 'empty-with-failures' | 'stale' };

export interface ReadDecisionInput<E extends RelayEvent = RelayEvent> {
  states: readonly RelayReadState<E>[];
  filters: readonly RelayFilter[];
  /** The per-read grace has elapsed: stop holding a non-empty answer back for slow relays. */
  deadlinePassed: boolean;
  /** Heads this device knows of. A degraded answer older than one of them is stale, not usable. */
  knownHeads?: readonly KnownHead[];
}

function parseAddress(address: string): { kind: number; pubkey: string; d: string } | null {
  const first = address.indexOf(':');
  const second = address.indexOf(':', first + 1);
  if (first < 0 || second < 0) return null;
  const kind = Number(address.slice(0, first));
  if (!Number.isInteger(kind)) return null;
  return { kind, pubkey: address.slice(first + 1, second), d: address.slice(second + 1) };
}

/**
 * Whether a known head falls inside a filter, as far as an address can tell:
 * `kinds`, `authors` and `#d` only. A filter that narrows by anything else
 * (ids, time, other tags, search) cannot be judged from an address and never
 * claims the head.
 */
function filterClaimsAddress(filter: RelayFilter, address: string): boolean {
  const parsed = parseAddress(address);
  if (!parsed) return false;
  if (!filter.kinds?.includes(parsed.kind)) return false;
  if (!filter.authors?.includes(parsed.pubkey)) return false;
  for (const key of Object.keys(filter)) {
    if (key === 'kinds' || key === 'authors' || key === 'limit') continue;
    if (key === '#d') {
      if (isAddressableKind(parsed.kind) && !filter['#d']?.includes(parsed.d)) return false;
      continue;
    }
    if (filter[key as keyof RelayFilter] !== undefined) return false;
  }
  return true;
}

/**
 * Whether a merged, DEGRADED answer is older than what this device already
 * knows: a known head the filters ask for is missing, or present in an older
 * version. Building a write over such an answer would undo the newer state.
 */
export function isStaleAgainstKnownHeads(
  filters: readonly RelayFilter[],
  merged: readonly RelayEvent[],
  heads: readonly KnownHead[],
): boolean {
  if (heads.length === 0) return false;
  const byAddress = new Map<string, RelayEvent>();
  for (const event of merged) {
    const address = eventAddress(event);
    if (address) byAddress.set(address, event);
  }
  for (const head of heads) {
    const found = byAddress.get(head.address);
    if (found) {
      if (found.id !== head.id && replacesEvent(head, found)) return true;
      continue;
    }
    for (const filter of filters) {
      if (!filterClaimsAddress(filter, head.address)) continue;
      // A filled `limit` may simply have cut the head off.
      const returned = merged.filter((e) => matchesFilter(e, filter)).length;
      if (filter.limit !== undefined && returned >= filter.limit) continue;
      return true;
    }
  }
  return false;
}

/**
 * Decide what a multi-relay read knows right now.
 *
 *   all EOSE                              → answered, complete (empty is a confirmed empty)
 *   all settled, some failed, events seen → answered, degraded
 *   all settled, some failed, no events   → unknown (`empty-with-failures`)
 *   all settled, none EOSE                → unknown (`no-relay-answered`)
 *   some pending, events seen, and the deadline passed or only suspect relays
 *   are still pending                     → answered, degraded
 *   otherwise                             → wait
 *
 * A degraded answer that is older than a known head is `unknown` (`stale`).
 */
export function decideRead<E extends RelayEvent>(input: ReadDecisionInput<E>): ReadDecision<E> {
  const { states, filters, deadlinePassed, knownHeads = [] } = input;
  const answeredStates = states.filter((s) => s.status === 'eose');
  const pending = states.filter((s) => s.status === 'pending');
  const merged = mergeRelayEvents(answeredStates.flatMap((s) => s.events));

  const degraded = (): ReadDecision<E> =>
    isStaleAgainstKnownHeads(filters, merged, knownHeads)
      ? { status: 'unknown', reason: 'stale' }
      : { status: 'answered', complete: false, events: merged };

  if (pending.length === 0) {
    if (answeredStates.length === 0) return { status: 'unknown', reason: 'no-relay-answered' };
    if (answeredStates.length === states.length) return { status: 'answered', complete: true, events: merged };
    return merged.length > 0 ? degraded() : { status: 'unknown', reason: 'empty-with-failures' };
  }
  if (merged.length > 0 && (deadlinePassed || pending.every((s) => s.suspect))) {
    const decision = degraded();
    // Stale while a relay is still pending: that relay may hold the newer version, so keep waiting.
    return decision.status === 'unknown' ? { status: 'wait' } : decision;
  }
  return { status: 'wait' };
}

// ── 3. Sync ─────────────────────────────────────────────────────────────────

/**
 * Kinds that are never carried to another relay, whatever a flow says:
 * deletions (5: a request made to the relays it was sent to), private
 * messages and their wrappers (4, 13, 14, 1059, 1060), relay- or server-bound
 * proofs (22242, 24242, 27235), remote signing (24133), inbox lists (10050)
 * and the legacy Blobbonaut profile (31125: read-only everywhere).
 */
export const NEVER_SYNC_KINDS: readonly number[] = [4, 5, 13, 14, 1059, 1060, 10050, 22242, 24133, 24242, 27235, 31125];

/**
 * Whether an event may be offered to a relay that did not have it, before any
 * flow rule: persistent, not private, not bound to one relay (NIP-70 `-`),
 * and not expiring (NIP-40: an expiring event's reach is its author's choice,
 * and an expired one must not come back).
 */
export function isSyncableEvent(event: RelayEvent): boolean {
  if (isEphemeralKind(event.kind)) return false;
  if (NEVER_SYNC_KINDS.includes(event.kind)) return false;
  for (const tag of event.tags) {
    if (tag[0] === '-' || tag[0] === 'expiration') return false;
  }
  return true;
}

/** The ids and addresses a set of NIP-09 deletions asks to remove, per author. */
function deletedTargets(events: readonly RelayEvent[]): Set<string> {
  const out = new Set<string>();
  for (const event of events) {
    if (event.kind !== 5) continue;
    for (const tag of event.tags) {
      if (tag[0] === 'e' && tag[1]) out.add(`${event.pubkey}|e|${tag[1]}`);
    }
  }
  return out;
}

function isDeleted(event: RelayEvent, deleted: Set<string>, deletions: readonly RelayEvent[]): boolean {
  if (deleted.has(`${event.pubkey}|e|${event.id}`)) return true;
  const address = eventAddress(event);
  if (!address) return false;
  // NIP-09 writes a replaceable address as `kind:pubkey:` too.
  return deletions.some(
    (d) => d.pubkey === event.pubkey && d.created_at >= event.created_at && d.tags.some((t) => t[0] === 'a' && t[1] === address),
  );
}

/** What a flow allows to be carried between its relays. */
export interface SyncPolicy<E extends RelayEvent = RelayEvent> {
  /** Whether this flow allows carrying this event at all (kind, author, ...). */
  allows(event: E): boolean;
  /** The relays this event belongs on. Only those that were asked and answered are ever written to. */
  destinations(event: E): readonly string[];
}

/** One event one relay is missing. */
export interface SyncTask<E extends RelayEvent = RelayEvent> {
  event: E;
  relay: string;
  /** `older-version`: the relay returned an older revision of the same address. `missing`: it returned none. */
  reason: 'older-version' | 'missing';
}

/**
 * A filter without `limit` is cut by the relay's own cap, which a client
 * cannot see. An answer this long, without a limit, may have been cut.
 */
export const UNLIMITED_FILTER_TRUST = 100;

/**
 * The events to carry after a read, from the relays that have them to the
 * relays that certainly do not.
 *
 * A relay's lack of an event is certain only when it reached EOSE and
 *   - it returned an older revision of the same address, or
 *   - for a filter the event matches, it returned fewer events than the
 *     filter's limit (so nothing was cut off).
 * A relay that failed, is still pending, or whose answer may have been
 * truncated is left alone: there, the event's presence is unknown.
 *
 * Only the winning revision of a replaceable or addressable event is carried.
 */
export function planSync<E extends RelayEvent>(input: {
  states: readonly RelayReadState<E>[];
  filters: readonly RelayFilter[];
  policy: SyncPolicy<E>;
}): SyncTask<E>[] {
  const { states, filters, policy } = input;
  const answered = states.filter((s) => s.status === 'eose');
  if (answered.length < 2) return [];
  const everything = answered.flatMap((s) => s.events);
  const deletions = everything.filter((e) => e.kind === 5);
  const deleted = deletedTargets(deletions);
  const tasks: SyncTask<E>[] = [];

  for (const winner of mergeRelayEvents(everything)) {
    if (!isSyncableEvent(winner) || !policy.allows(winner)) continue;
    if (isDeleted(winner, deleted, deletions)) continue;
    const address = eventAddress(winner);
    const destinations = dedupeRelayUrls(policy.destinations(winner));
    for (const state of answered) {
      if (!destinations.includes(normalizeRelayUrl(state.relay) ?? state.relay)) continue;
      if (state.events.some((e) => e.id === winner.id)) continue;
      if (address !== null && state.events.some((e) => eventAddress(e) === address)) {
        tasks.push({ event: winner, relay: state.relay, reason: 'older-version' });
        continue;
      }
      const certain = filters.some((filter) => {
        if (filter.search !== undefined || !matchesFilter(winner, filter)) return false;
        const returned = state.events.filter((e) => matchesFilter(e, filter)).length;
        return returned < (filter.limit ?? UNLIMITED_FILTER_TRUST);
      });
      if (certain) tasks.push({ event: winner, relay: state.relay, reason: 'missing' });
    }
  }
  return tasks;
}

// ── Deliveries: verdicts, and a ledger that stops loops ─────────────────────

/**
 * What one relay did with one event.
 *   accepted    OK true, or `duplicate:` (it already had it)
 *   superseded  `replaced:` (it holds a newer revision; nothing to do)
 *   rejected    a policy refusal; sending the same event again changes nothing
 *   retry       no verdict, or a transient one (timeout, `rate-limited:`, `error:`)
 */
export type DeliveryVerdict = 'accepted' | 'superseded' | 'rejected' | 'retry';

const PERMANENT_PREFIXES = ['blocked', 'invalid', 'restricted', 'pow', 'auth-required', 'mute'];

/** Classify a relay's `OK false` message (or a thrown error's message). */
export function classifyRejection(message: string | null | undefined): DeliveryVerdict {
  const text = (message ?? '').trim().toLowerCase();
  if (text.startsWith('duplicate')) return 'accepted';
  if (text.startsWith('replaced')) return 'superseded';
  for (const prefix of PERMANENT_PREFIXES) {
    if (text.startsWith(`${prefix}:`) || text === prefix) return 'rejected';
  }
  return 'retry';
}

/** One relay's part in publishing one event. */
export interface DeliveryResult {
  relay: string;
  verdict: DeliveryVerdict;
  message?: string;
}

/** What a publication to several relays amounts to. */
export interface DeliverySummary {
  /** At least one relay holds the event (or a newer revision). */
  delivered: boolean;
  /** The primary relay holds it. */
  primaryDelivered: boolean;
  /** Delivered elsewhere, and the primary gave no verdict: it will be retried. */
  primaryPending: boolean;
  /** Delivered elsewhere, and the primary refused it (for instance, a write list). */
  primaryRejected: boolean;
  /** The primary's message, when it refused or failed. */
  primaryMessage?: string;
}

export function summarizeDelivery(results: readonly DeliveryResult[], primary: string): DeliverySummary {
  const held = (r: DeliveryResult) => r.verdict === 'accepted' || r.verdict === 'superseded';
  const mine = results.find((r) => normalizeRelayUrl(r.relay) === normalizeRelayUrl(primary));
  const delivered = results.some(held);
  return {
    delivered,
    primaryDelivered: !!mine && held(mine),
    primaryPending: delivered && !!mine && mine.verdict === 'retry',
    primaryRejected: delivered && !!mine && mine.verdict === 'rejected',
    primaryMessage: mine && !held(mine) ? mine.message : undefined,
  };
}

/** One (event, relay) pair's delivery history. Times in milliseconds. */
export interface SyncLedgerEntry {
  /** `ok`: the relay holds it. `rejected`: it refused. `retry`: no verdict yet. */
  s: 'ok' | 'rejected' | 'retry';
  /** Attempts made. */
  n: number;
  /** When the last attempt ended. */
  t: number;
  /** The relay's last message, when it was not an acceptance. */
  m?: string;
}

export interface SyncLedgerOptions {
  now?: () => number;
  /** Persisted entries from an earlier session. */
  initial?: Record<string, SyncLedgerEntry>;
  /** Called after every change with the entries to persist. */
  onChange?: (entries: Record<string, SyncLedgerEntry>) => void;
  /** Attempts per (event, relay) before giving up for good. */
  maxAttempts?: number;
  /** Wait before attempt 2, 3, ... (ms). The last value repeats. */
  backoffMs?: readonly number[];
  /** How long a refusal stands before the pair may be tried again (ms). */
  rejectedTtlMs?: number;
  /** Entries kept; the oldest go first. */
  maxEntries?: number;
}

/**
 * Remembers what was already offered to which relay, so that a read repeated
 * every few seconds does not offer the same event every few seconds:
 *
 *   accepted  → never again
 *   rejected  → not again until `rejectedTtlMs` has passed (a write list may change)
 *   retry     → again after a growing wait, `maxAttempts` times in all
 */
export class SyncLedger {
  private readonly entries = new Map<string, SyncLedgerEntry>();
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly backoffMs: readonly number[];
  private readonly rejectedTtlMs: number;
  private readonly maxEntries: number;
  private readonly onChange?: (entries: Record<string, SyncLedgerEntry>) => void;

  constructor(options: SyncLedgerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.backoffMs = options.backoffMs ?? [30_000, 60_000, 120_000];
    this.rejectedTtlMs = options.rejectedTtlMs ?? 6 * 60 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 400;
    this.onChange = options.onChange;
    for (const [key, entry] of Object.entries(options.initial ?? {})) {
      if (entry && (entry.s === 'ok' || entry.s === 'rejected' || entry.s === 'retry') && Number.isFinite(entry.t)) {
        this.entries.set(key, { s: entry.s, n: Number(entry.n) || 1, t: entry.t, m: entry.m });
      }
    }
  }

  static key(eventId: string, relay: string): string {
    return `${eventId}@${normalizeRelayUrl(relay) ?? relay}`;
  }

  get(eventId: string, relay: string): SyncLedgerEntry | undefined {
    return this.entries.get(SyncLedger.key(eventId, relay));
  }

  /** When this pair may next be attempted (ms); 0 = now; null = never. */
  nextAttemptAt(eventId: string, relay: string): number | null {
    const entry = this.get(eventId, relay);
    if (!entry) return 0;
    if (entry.s === 'ok') return null;
    if (entry.s === 'rejected') return entry.t + this.rejectedTtlMs;
    if (entry.n >= this.maxAttempts) return null;
    const wait = this.backoffMs[Math.min(entry.n - 1, this.backoffMs.length - 1)] ?? 0;
    return entry.t + wait;
  }

  /** Whether this pair may be attempted right now. */
  canAttempt(eventId: string, relay: string): boolean {
    const at = this.nextAttemptAt(eventId, relay);
    return at !== null && at <= this.now();
  }

  /** Record how an attempt ended. */
  record(eventId: string, relay: string, verdict: DeliveryVerdict, message?: string): SyncLedgerEntry {
    const key = SyncLedger.key(eventId, relay);
    const previous = this.entries.get(key);
    // A refusal that outlived its TTL starts a new count.
    const attempts = previous && previous.s === 'retry' ? previous.n + 1 : 1;
    const entry: SyncLedgerEntry =
      verdict === 'accepted' || verdict === 'superseded'
        ? { s: 'ok', n: attempts, t: this.now() }
        : { s: verdict === 'rejected' ? 'rejected' : 'retry', n: attempts, t: this.now(), m: message?.slice(0, 160) };
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.onChange?.(this.snapshot());
    return entry;
  }

  /** Pairs still owed a retry, for one relay or for all. */
  pending(relay?: string): { eventId: string; relay: string; entry: SyncLedgerEntry }[] {
    const wanted = relay ? (normalizeRelayUrl(relay) ?? relay) : null;
    const out: { eventId: string; relay: string; entry: SyncLedgerEntry }[] = [];
    for (const [key, entry] of this.entries) {
      if (entry.s !== 'retry' || entry.n >= this.maxAttempts) continue;
      const at = key.indexOf('@');
      const entryRelay = key.slice(at + 1);
      if (wanted && entryRelay !== wanted) continue;
      out.push({ eventId: key.slice(0, at), relay: entryRelay, entry });
    }
    return out;
  }

  snapshot(): Record<string, SyncLedgerEntry> {
    return Object.fromEntries(this.entries);
  }
}

// ── Consent: carrying existing events is the account's choice ───────────────

/** One account's answer to "may this app copy my existing events to these relays?". */
export interface SyncConsentRecord {
  enabled: boolean;
  /** When the account answered (ms). */
  at: number;
  /** The relays the account was shown and agreed to. Nothing is carried anywhere else. */
  destinations: string[];
}

export interface SyncConsentOptions {
  now?: () => number;
  /** Persisted answers from an earlier session, by pubkey. */
  initial?: Record<string, SyncConsentRecord>;
  /** Called after every change with the answers to persist. */
  onChange?: (records: Record<string, SyncConsentRecord>) => void;
}

/**
 * Whether existing events may be carried between relays, per account.
 *
 * OFF until the account says otherwise. Opening the app, restoring a saved
 * login, or receiving the answer to a query sends nothing: a read stays a
 * read. Publishing a NEW event the player just caused (an adoption, a care
 * action) is not carrying and does not pass through here.
 *
 * The answer is tied to the exact relays the account was shown. A relay added
 * later is not covered until the account is asked again: `allows` is false
 * for it, and `uncovered` lists it.
 */
export class SyncConsent {
  private readonly records = new Map<string, SyncConsentRecord>();
  private readonly now: () => number;
  private readonly onChange?: (records: Record<string, SyncConsentRecord>) => void;

  constructor(options: SyncConsentOptions = {}) {
    this.now = options.now ?? Date.now;
    this.onChange = options.onChange;
    for (const [pubkey, record] of Object.entries(options.initial ?? {})) {
      if (record && typeof record.enabled === 'boolean' && Array.isArray(record.destinations)) {
        this.records.set(pubkey, {
          enabled: record.enabled,
          at: Number(record.at) || 0,
          destinations: dedupeRelayUrls(record.destinations),
        });
      }
    }
  }

  get(pubkey: string | null | undefined): SyncConsentRecord | undefined {
    return pubkey ? this.records.get(pubkey) : undefined;
  }

  /** Whether this account turned carrying on. Signed out: never. */
  isEnabled(pubkey: string | null | undefined): boolean {
    return this.get(pubkey)?.enabled === true;
  }

  /** Whether this account agreed to existing events being carried to this relay. */
  allows(pubkey: string | null | undefined, relay: string): boolean {
    const record = this.get(pubkey);
    if (!record?.enabled) return false;
    return record.destinations.includes(normalizeRelayUrl(relay) ?? relay);
  }

  /** The relays of `candidates` this account has not agreed to (all of them while off). */
  uncovered(pubkey: string | null | undefined, candidates: readonly string[]): string[] {
    return dedupeRelayUrls(candidates).filter((relay) => !this.allows(pubkey, relay));
  }

  /** The account chose to carry its existing events to exactly these relays. */
  enable(pubkey: string, destinations: readonly string[]): void {
    this.records.set(pubkey, { enabled: true, at: this.now(), destinations: dedupeRelayUrls(destinations) });
    this.onChange?.(this.snapshot());
  }

  /** The account turned carrying off. */
  disable(pubkey: string): void {
    this.records.set(pubkey, { enabled: false, at: this.now(), destinations: [] });
    this.onChange?.(this.snapshot());
  }

  snapshot(): Record<string, SyncConsentRecord> {
    return Object.fromEntries(this.records);
  }
}

/** A sync policy narrowed by consent: nothing without it, and only to the relays it names. */
export function withSyncConsent<E extends RelayEvent>(
  policy: SyncPolicy<E>,
  consent: SyncConsent,
  pubkey: string | null | undefined,
): SyncPolicy<E> {
  return {
    allows: (event) => consent.isEnabled(pubkey) && event.pubkey === pubkey && policy.allows(event),
    destinations: (event) => policy.destinations(event).filter((relay) => consent.allows(pubkey, relay)),
  };
}
