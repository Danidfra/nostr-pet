/**
 * The guest store: the document in memory, mirrored to storage on every
 * change, read through `useSyncExternalStore`. One per app (the provider
 * makes it); tests make their own over a fake storage.
 */
import { createContext } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import type { NostrEvent } from '@blobbi-kit/core';
import { KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION } from '@blobbi-kit/core';
import { clearGuestDocument, readGuestDocument, storageAvailable, withSecret, withoutSecret, writeGuestDocument, type GuestDocument, type GuestMigration, type GuestMigrationStage, type GuestStorage, type StoredGuestDocument } from './guest-store';
import type { MigrationStep } from './guest-migration';

export interface GuestSnapshot {
  /** The record, without its secret: the identity here is the pubkey alone. */
  doc: GuestDocument | null;
  /** Storage takes writes right now. */
  storageOk: boolean;
  /** The last write held (false: the document lives in memory only until it does). */
  persisted: boolean;
  /** A stored record could not be read and was moved aside; the reason, for the dev console only. */
  unreadable: string | null;
}

export interface GuestStore {
  snapshot: () => GuestSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Begin a guest: the record around this identity; the store takes the secret out of it and keeps it apart. */
  begin: (doc: StoredGuestDocument) => void;
  /**
   * The reserved secret key, for the one moment it is given to the player (the save's key step) and the sign-in
   * that follows. Null when there is no guest. Never part of the snapshot, never in a document the app reads.
   */
  revealSecret: () => string | null;
  /** Change the record; every change is persisted. */
  update: (change: (doc: GuestDocument) => GuestDocument) => void;
  /** Let the record go: saved and confirmed, or discarded by the player. */
  clear: () => void;
  /** Read storage again (another tab, a test). */
  reload: () => void;
}

export function createGuestStore(storage: GuestStorage | null): GuestStore {
  const listeners = new Set<() => void>();
  // The secret, apart from the state every component reads: this closure is the only place it lives in memory
  let secret: string | null = null;
  const read = (): GuestSnapshot => {
    const found = readGuestDocument(storage);
    secret = found.kind === 'guest' ? found.doc.identity.nsec : null;
    return {
      doc: found.kind === 'guest' ? withoutSecret(found.doc) : null,
      storageOk: storageAvailable(storage),
      persisted: found.kind === 'guest',
      unreadable: found.kind === 'unreadable' ? found.reason : null,
    };
  };
  let state = read();
  const emit = () => listeners.forEach((l) => l());
  const set = (doc: GuestDocument | null) => {
    // Nothing to nothing is not a change: no write, no word to the listeners (a clear after a clear, a loop's worth)
    if (doc === null && state.doc === null) return;
    // The record is written with its secret put back; the state never holds it
    const persisted = doc && secret !== null ? writeGuestDocument(withSecret(doc, secret), storage) : doc ? false : clearGuestDocument(storage);
    if (doc === null) secret = null;
    state = { ...state, doc, persisted: doc ? persisted : false };
    emit();
  };
  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    begin: (doc) => {
      secret = doc.identity.nsec;
      set(withoutSecret(doc));
    },
    revealSecret: () => secret,
    update: (change) => {
      if (!state.doc) return;
      set(change(state.doc));
    },
    clear: () => set(null),
    reload: () => {
      state = read();
      emit();
    },
  };
}

/* ─── Changes to the record, as pure functions ─────────────────────────── */

const dOf = (event: NostrEvent) => event.tags.find(([n]) => n === 'd')?.[1] ?? null;

/** The world after a record was written: the Blobbi's `d` noted on its first state, a care receipt counted. */
export function withEvents<T extends GuestDocument>(doc: T, events: NostrEvent[], written: NostrEvent | null, now: number = Date.now()): T {
  let next: T = { ...doc, events };
  if (written?.kind === KIND_BLOBBI_STATE && !doc.blobbiD) next = { ...next, blobbiD: dOf(written) };
  if (written?.kind === KIND_BLOBBI_INTERACTION) next = { ...next, care: { count: doc.care.count + 1, lastAt: now } };
  return next;
}

export function withInviteDismissed<T extends GuestDocument>(doc: T, now: number = Date.now()): T {
  return { ...doc, invite: { dismissedAt: now, shownCount: doc.invite.shownCount + 1 } };
}

export function withMigrationStage<T extends GuestDocument>(doc: T, stage: GuestMigrationStage, now: number = Date.now()): T {
  const current: GuestMigration = doc.migration ?? { stage, startedAt: now, landed: {}, profileDone: false };
  return { ...doc, migration: { ...current, stage } };
}

/** Saving was backed out of before any sign-in: nothing happened, nothing is remembered of it. */
export function withMigrationCleared<T extends GuestDocument>(doc: T): T {
  return { ...doc, migration: null };
}

export function withLanded<T extends GuestDocument>(doc: T, step: MigrationStep, id: string): T {
  if (!doc.migration) return doc;
  return { ...doc, migration: { ...doc.migration, landed: { ...doc.migration.landed, [step]: id } } };
}

export function withProfileDone<T extends GuestDocument>(doc: T): T {
  if (!doc.migration) return doc;
  return { ...doc, migration: { ...doc.migration, profileDone: true } };
}

export function withConflictSeen<T extends GuestDocument>(doc: T, loginPubkey: string): T {
  return doc.conflicts.includes(loginPubkey) ? doc : { ...doc, conflicts: [...doc.conflicts, loginPubkey] };
}

/* ─── Contexts ─────────────────────────────────────────────────────────── */

export const GuestStoreContext = createContext<GuestStore | null>(null);

/** The guest as the signed-in user, while a guest plays: read by `useCurrentUser` after the dev fixture, before the login store. */
export interface GuestUser {
  pubkey: string;
  signer: NostrSigner;
}
export const GuestUserContext = createContext<GuestUser | null>(null);

/** What a menu asked the page to show for the guest: the save flow, or signing into an account they have. */
export type GuestUiRequest = 'save' | 'sign-in' | null;
export interface GuestUi {
  request: GuestUiRequest;
  requestSave: () => void;
  requestSignIn: () => void;
  clearRequest: () => void;
}
const NO_UI: GuestUi = { request: null, requestSave: () => {}, requestSignIn: () => {}, clearRequest: () => {} };
export const GuestUiContext = createContext<GuestUi>(NO_UI);
