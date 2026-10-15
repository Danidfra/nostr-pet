/**
 * THIS DEVICE'S CHOICE OF COMPANION, per account, and the profile write that
 * carries it out to the other Blobbi apps while it is on its way.
 *
 * Record `blobbi:companion:v1:<pubkey>` (localStorage, public data only: a
 * Blobbi's d, times, and at most one signed public event):
 *
 *   d        the Blobbi this device shows
 *   at, by   when and by whom the choice was made: `player` (a choice made
 *            here, `at` from this device's clock), `remote` (adopted from the
 *            player's profile, `at` = that profile's created_at in ms),
 *            `legacy` (the device pick kept before choices were stamped)
 *   synced   the profile event that carries this choice on the network (the
 *            one published here, or the one adopted), or null
 *   pending  a profile event signed here for this choice and not yet
 *            confirmed: every retry sends this very event (same id), so a
 *            retry never publishes twice
 *   over     for a choice made here: the profile the player was shown when
 *            they chose (that profile never overrides this choice)
 *   note     `no-profile`: the player has no profile to carry the choice
 *            (it stays on this device; nothing is ever created to hold it)
 *
 * One account's record is never read for another account: switching accounts
 * can never apply an old account's choice or pending write to a new one.
 *
 * Before this record existed the home kept a bare d under the kit's
 * `getSelectedBlobbiKey(pubkey)`; it is read once as a `legacy` choice (that
 * app published every change, so the profile is at least as new) and left in
 * place untouched.
 */
import { KIND_BLOBBONAUT_PROFILE, getSelectedBlobbiKey, type NostrEvent } from '@blobbi-kit/core';
import type { ChoiceOrigin, LocalChoiceFacts, ProfileStamp, SeenProfile } from './choice-order';

export const CHOICE_VERSION = 1;
export const choiceKey = (pubkey: string) => `blobbi:companion:v1:${pubkey}`;

export interface PendingWrite {
  /** The signed kind 11125 (public). */
  event: NostrEvent;
  /** The profile it was built on (its replacement must not be stale). */
  base: ProfileStamp;
}

export interface CompanionChoice {
  version: typeof CHOICE_VERSION;
  account: string;
  d: string;
  at: number | null;
  by: ChoiceOrigin;
  synced: ProfileStamp | null;
  pending: PendingWrite | null;
  over?: SeenProfile | null;
  note?: 'no-profile' | null;
}

export interface ChoiceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const HEX64 = /^[0-9a-f]{64}$/;

function storageOrNull(): ChoiceStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function stampOf(raw: unknown): ProfileStamp | null {
  const s = raw as Partial<ProfileStamp> | null;
  return s && typeof s.id === 'string' && HEX64.test(s.id) && typeof s.createdAt === 'number' && Number.isFinite(s.createdAt) ? { id: s.id, createdAt: s.createdAt } : null;
}

function seenOf(raw: unknown): SeenProfile | null {
  const s = stampOf(raw);
  const d = (raw as { d?: unknown } | null)?.d;
  return s ? { ...s, d: typeof d === 'string' && d ? d : null } : null;
}

function pendingOf(raw: unknown, account: string, d: string): PendingWrite | null {
  const p = raw as Partial<PendingWrite> | null;
  const e = p?.event as NostrEvent | undefined;
  const base = stampOf(p?.base);
  if (!e || !base || e.kind !== KIND_BLOBBONAUT_PROFILE || e.pubkey !== account || typeof e.id !== 'string' || typeof e.sig !== 'string' || !Array.isArray(e.tags)) return null;
  // The event must say this very choice; anything else is not this record's write
  if (!e.tags.some((t) => t[0] === 'current_companion' && t[1] === d)) return null;
  return { event: e, base };
}

/** The stored choice of this account (the legacy device pick as a `legacy` choice), or null. Never another account's. */
export function readChoice(account: string, storage: ChoiceStorage | null = storageOrNull()): CompanionChoice | null {
  if (!storage || !HEX64.test(account)) return null;
  try {
    const raw = storage.getItem(choiceKey(account));
    if (raw) {
      const v = JSON.parse(raw) as Partial<CompanionChoice>;
      if (v.version !== CHOICE_VERSION || v.account !== account || typeof v.d !== 'string' || !v.d) return null;
      const by: ChoiceOrigin = v.by === 'player' || v.by === 'remote' || v.by === 'legacy' ? v.by : 'legacy';
      const at = typeof v.at === 'number' && Number.isFinite(v.at) && v.at > 0 ? v.at : null;
      return { version: CHOICE_VERSION, account, d: v.d, at, by, synced: stampOf(v.synced), pending: pendingOf(v.pending, account, v.d), over: seenOf(v.over), note: v.note === 'no-profile' ? 'no-profile' : null };
    }
    const legacy = storage.getItem(getSelectedBlobbiKey(account));
    return legacy ? { version: CHOICE_VERSION, account, d: legacy, at: null, by: 'legacy', synced: null, pending: null } : null;
  } catch {
    return null;
  }
}

export function writeChoice(choice: CompanionChoice, storage: ChoiceStorage | null = storageOrNull()): void {
  if (!storage) return;
  try {
    storage.setItem(choiceKey(choice.account), JSON.stringify(choice));
  } catch {
    /* kept for this visit only */
  }
}

/** What the ordering rules need from a stored choice: a pending signed write counts as known to the network. */
export function choiceFacts(choice: CompanionChoice | null): LocalChoiceFacts | null {
  if (!choice) return null;
  const synced = choice.synced ?? (choice.pending ? { id: choice.pending.event.id, createdAt: choice.pending.event.created_at } : null);
  return { d: choice.d, at: choice.at, by: choice.by, synced, over: choice.over ?? null };
}

/** Whether the choice still has to reach the other apps (made here, not confirmed). */
export function needsSync(choice: CompanionChoice | null): boolean {
  return !!choice && choice.by === 'player' && !choice.synced;
}

// ─── One store for the page: every hook instance sees the same choice at once ───

type Listener = () => void;
const listeners = new Set<Listener>();
const memory = new Map<string, CompanionChoice | null>();

export const companionChoices = {
  get(account: string | undefined): CompanionChoice | null {
    if (!account) return null;
    if (!memory.has(account)) memory.set(account, readChoice(account));
    return memory.get(account) ?? null;
  },
  set(choice: CompanionChoice): void {
    memory.set(choice.account, choice);
    writeChoice(choice);
    for (const l of [...listeners]) l();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Tests: forget what was read (the storage itself is the test's). */
  reset(): void {
    memory.clear();
    for (const l of [...listeners]) l();
  },
};
