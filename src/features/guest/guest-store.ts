/**
 * The guest's record on this device (M14: play first, save later).
 *
 * A newcomer plays with one Blobbi before any account exists. Everything of
 * that play lives in ONE versioned document in this origin's `localStorage`
 * (`blobbi:guest:v1`), apart from the device preferences the app already
 * keeps per Blobbi (rooms, toys, zoom), which are keyed by pubkey as before.
 *
 * What the document holds:
 *
 *   identity    the key RESERVED for this player. A V3 Blobbi is its address
 *               (`deriveBlobbiV3Seed(pubkey, d)`), so the only way the guest
 *               Blobbi can later be published with exactly the look and the
 *               `d` it has now is for its owner's key to exist before the egg
 *               does. The key is made here, used for nothing but the address
 *               while the player is a guest (no event is signed with it, none
 *               is sent anywhere, it never enters the login store, a log, a
 *               URL or a request), and is handed to the player, with the facts
 *               about it, only when they choose to save their Blobbi.
 *   events      the guest world: the Blobbi's kind 31124 state, the player's
 *               kind 11125 profile and the kind 1124 care receipts, in event
 *               shape so the kit's hooks run over them unchanged, but
 *               UNSIGNED (`sig` is empty; see `guest-signer.ts`): local
 *               records, not Nostr events.
 *   care        how many care actions landed, for the invitation to save.
 *   invite      when the invitation was last declined, how much ACTIVE play
 *               (a visible, focused tab) the guest has had, and whether the
 *               player asked never to be asked again (M15); it never nags.
 *   migration   where saving stands, so a refresh in the middle resumes.
 *   conflicts   login pubkeys that were told about this guest Blobbi.
 *
 * Reading is defensive: a document that does not parse, fails its checks or
 * whose key does not match its pubkey is QUARANTINED (moved aside under
 * another key, never deleted by this code) and read as "no guest". Writes
 * report whether they held; a browser whose storage refuses (private mode,
 * quota, blocked) keeps the document in memory for the session and the UI
 * says so (`storageAvailable`).
 *
 * Pure: every function takes its storage, so the rules are pinned by tests.
 */
import { getPublicKey, nip19 } from 'nostr-tools';
import type { NostrEvent } from '@blobbi-kit/core';

export const GUEST_STORAGE_KEY = 'blobbi:guest:v1';
/** Where an unreadable document is moved, so nothing of a player's is deleted by a bug. */
export const GUEST_QUARANTINE_KEY = 'blobbi:guest:v1:unreadable';
export const GUEST_DOCUMENT_VERSION = 1 as const;

/**
 * The identity as the app sees it: the public key only. The owner of the
 * guest Blobbi's address, safe anywhere.
 */
export interface GuestIdentity {
  /** The public key, hex: the owner of the guest Blobbi's address. */
  pubkey: string;
}

/**
 * The identity as it is STORED: the reserved secret key too. Only the store
 * (`guest-context.ts`) holds this shape, in a closure, and hands the secret
 * to exactly one caller (the save's key step) through `revealSecret`; the
 * document every component reads carries the pubkey alone (M14.1 audit,
 * `SECURITY.md` section 3).
 */
export interface GuestSecretIdentity extends GuestIdentity {
  /** The reserved secret key, bech32. Local to this device until the player saves. */
  nsec: string;
}

/** Where saving the Blobbi stands. `null`: never begun. */
export type GuestMigrationStage =
  /** The key is being given; nothing is signed in yet. */
  | 'key'
  /** Signed in with the reserved key; the optional profile step. */
  | 'profile'
  /** Publishing the Blobbi and the profile to the relays. */
  | 'publishing'
  /** Everything published; a read must still find it before the guest record is let go. */
  | 'verifying'
  /** Confirmed on the relays. The record is cleared right after. */
  | 'done';

export interface GuestMigration {
  stage: GuestMigrationStage;
  startedAt: number;
  /** Event ids the relays accepted (or already held), by what they are. */
  landed: { blobbi?: string; profile?: string };
  /** The player filled (or skipped) the profile step. */
  profileDone: boolean;
}

export interface GuestDocument {
  v: typeof GUEST_DOCUMENT_VERSION;
  createdAt: number;
  /** The public key only; the stored record (`StoredGuestDocument`) carries the secret as well. */
  identity: GuestIdentity;
  /** The guest Blobbi's `d`, once adopted. */
  blobbiD: string | null;
  events: NostrEvent[];
  care: { count: number; lastAt: number | null };
  invite: GuestInviteState;
  migration: GuestMigration | null;
  conflicts: string[];
}

/**
 * Where the invitation to save stands (M15). `activeMs` counts play with the
 * tab visible and the window focused, never time in the background;
 * `optOut` is "Don't ask again" for this browser. Both are additive: a v1
 * record written before M15 reads as zero time and no opt-out.
 */
export interface GuestInviteState {
  dismissedAt: number | null;
  shownCount: number;
  activeMs: number;
  optOut: boolean;
}

/** The document as the storage holds it: the same, with the secret in its identity. */
export type StoredGuestDocument = Omit<GuestDocument, 'identity'> & { identity: GuestSecretIdentity };

/** The document without its secret: what the app reads. */
export function withoutSecret(doc: StoredGuestDocument | GuestDocument): GuestDocument {
  return { ...doc, identity: { pubkey: doc.identity.pubkey } };
}

/** The document with its secret put back, for the storage. */
export function withSecret(doc: GuestDocument, nsec: string): StoredGuestDocument {
  return { ...doc, identity: { pubkey: doc.identity.pubkey, nsec } };
}

/** What the store needs of a storage; `length` and `key` only for the sweep that removes a guest's other keys. */
export type GuestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'length' | 'key'>>;

const HEX64 = /^[0-9a-f]{64}$/;

/** A fresh document around a reserved identity (the stored shape: the secret is in it until the store takes it). */
export function createGuestDocument(identity: GuestSecretIdentity, now: number = Date.now()): StoredGuestDocument {
  return {
    v: GUEST_DOCUMENT_VERSION,
    createdAt: now,
    identity,
    blobbiD: null,
    events: [],
    care: { count: 0, lastAt: null },
    invite: { dismissedAt: null, shownCount: 0, activeMs: 0, optOut: false },
    migration: null,
    conflicts: [],
  };
}

/** True when `nsec` decodes and its public key is `pubkey`: the one check that a document is about the key it names. */
export function identityConsistent(identity: GuestSecretIdentity): boolean {
  try {
    const decoded = nip19.decode(identity.nsec);
    return decoded.type === 'nsec' && HEX64.test(identity.pubkey) && getPublicKey(decoded.data) === identity.pubkey;
  } catch {
    return false;
  }
}

function isEventShaped(value: unknown): value is NostrEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.pubkey === 'string' &&
    typeof e.kind === 'number' &&
    typeof e.created_at === 'number' &&
    typeof e.content === 'string' &&
    typeof e.sig === 'string' &&
    Array.isArray(e.tags) &&
    e.tags.every((t) => Array.isArray(t) && t.every((v) => typeof v === 'string'))
  );
}

const STAGES: readonly GuestMigrationStage[] = ['key', 'profile', 'publishing', 'verifying', 'done'];

/**
 * A document, or the reason it is not one. Lenient about what does not
 * matter (unknown fields are dropped), strict about what does: the version,
 * the identity's consistency, and that every stored record is event-shaped
 * and belongs to the guest.
 */
export function parseGuestDocument(raw: unknown): { ok: true; doc: StoredGuestDocument } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' };
  const r = raw as Record<string, unknown>;
  if (r.v !== GUEST_DOCUMENT_VERSION) return { ok: false, reason: `unknown version ${String(r.v)}` };
  const identity = r.identity as Partial<GuestSecretIdentity> | undefined;
  if (!identity || typeof identity.nsec !== 'string' || typeof identity.pubkey !== 'string') return { ok: false, reason: 'no identity' };
  if (!identityConsistent({ nsec: identity.nsec, pubkey: identity.pubkey })) return { ok: false, reason: 'identity does not match its key' };
  const events = Array.isArray(r.events) ? r.events : null;
  if (!events || !events.every(isEventShaped)) return { ok: false, reason: 'records are not event-shaped' };
  if (events.some((e) => e.pubkey !== identity.pubkey)) return { ok: false, reason: 'a record belongs to another key' };
  const care = (r.care ?? {}) as Partial<GuestDocument['care']>;
  const invite = (r.invite ?? {}) as Partial<GuestDocument['invite']>;
  let migration: GuestMigration | null = null;
  if (r.migration && typeof r.migration === 'object') {
    const m = r.migration as Partial<GuestMigration>;
    if (!m.stage || !STAGES.includes(m.stage)) return { ok: false, reason: 'unknown migration stage' };
    const landed = (m.landed ?? {}) as Partial<GuestMigration['landed']>;
    migration = {
      stage: m.stage,
      startedAt: typeof m.startedAt === 'number' ? m.startedAt : 0,
      landed: { ...(typeof landed.blobbi === 'string' ? { blobbi: landed.blobbi } : {}), ...(typeof landed.profile === 'string' ? { profile: landed.profile } : {}) },
      profileDone: m.profileDone === true,
    };
  }
  return {
    ok: true,
    doc: {
      v: GUEST_DOCUMENT_VERSION,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
      identity: { nsec: identity.nsec, pubkey: identity.pubkey },
      blobbiD: typeof r.blobbiD === 'string' ? r.blobbiD : null,
      events: events as NostrEvent[],
      care: { count: typeof care.count === 'number' && care.count >= 0 ? Math.floor(care.count) : 0, lastAt: typeof care.lastAt === 'number' ? care.lastAt : null },
      invite: {
        dismissedAt: typeof invite.dismissedAt === 'number' ? invite.dismissedAt : null,
        shownCount: typeof invite.shownCount === 'number' ? invite.shownCount : 0,
        activeMs: typeof invite.activeMs === 'number' && Number.isFinite(invite.activeMs) && invite.activeMs >= 0 ? invite.activeMs : 0,
        optOut: invite.optOut === true,
      },
      migration,
      conflicts: Array.isArray(r.conflicts) ? r.conflicts.filter((c): c is string => typeof c === 'string' && HEX64.test(c)) : [],
    },
  };
}

export type GuestRead = { kind: 'none' } | { kind: 'guest'; doc: StoredGuestDocument } | { kind: 'unreadable'; reason: string };

/**
 * The stored document. One that cannot be read is moved to the quarantine
 * key (the previous quarantine, if any, is kept under a dated suffix: this
 * code never deletes a player's data), and the answer says so.
 */
export function readGuestDocument(storage: GuestStorage | null = storageOrNull()): GuestRead {
  if (!storage) return { kind: 'none' };
  let raw: string | null;
  try {
    raw = storage.getItem(GUEST_STORAGE_KEY);
  } catch {
    return { kind: 'none' };
  }
  if (raw === null) return { kind: 'none' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(storage, raw);
    return { kind: 'unreadable', reason: 'not JSON' };
  }
  const result = parseGuestDocument(parsed);
  if (!result.ok) {
    quarantine(storage, raw);
    return { kind: 'unreadable', reason: result.reason };
  }
  return { kind: 'guest', doc: result.doc };
}

function quarantine(storage: GuestStorage, raw: string): void {
  try {
    const previous = storage.getItem(GUEST_QUARANTINE_KEY);
    if (previous !== null) storage.setItem(`${GUEST_QUARANTINE_KEY}:${Date.now()}`, previous);
    storage.setItem(GUEST_QUARANTINE_KEY, raw);
    storage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    /* the unreadable document stays where it is; it is still read as "no guest" */
  }
}

/** Write the document. False when storage refused (quota, private mode, blocked): the caller keeps it in memory. */
export function writeGuestDocument(doc: StoredGuestDocument, storage: GuestStorage | null = storageOrNull()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/** Remove the document (saved to an account and confirmed, or discarded by the player's explicit choice). */
export function clearGuestDocument(storage: GuestStorage | null = storageOrNull()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(GUEST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether this browser's storage takes a write right now. Private windows,
 * blocked site data and a full quota all say no; the guest then plays in
 * memory and is told the Blobbi will not be remembered.
 */
export function storageAvailable(storage: GuestStorage | null = storageOrNull()): boolean {
  if (!storage) return false;
  const probe = `${GUEST_STORAGE_KEY}:probe`;
  try {
    storage.setItem(probe, '1');
    const ok = storage.getItem(probe) === '1';
    storage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

export function storageOrNull(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
