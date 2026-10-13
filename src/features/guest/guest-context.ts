/**
 * The guest store: the document in memory, mirrored to storage on every
 * change, read through `useSyncExternalStore`. One per app (the provider
 * makes it); tests make their own over a fake storage.
 */
import { createContext } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import type { NostrEvent } from '@blobbi-kit/core';
import { KIND_BLOBBI_STATE, KIND_BLOBBI_INTERACTION } from '@blobbi-kit/core';
import { clearGuestDocument, readGuestDocument, storageAvailable, writeGuestDocument, type GuestDocument, type GuestMigration, type GuestMigrationStage, type GuestStorage } from './guest-store';
import type { MigrationStep } from './guest-migration';

export interface GuestSnapshot {
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
  /** Begin a guest: the record around this identity. */
  begin: (doc: GuestDocument) => void;
  /** Change the record; every change is persisted. */
  update: (change: (doc: GuestDocument) => GuestDocument) => void;
  /** Let the record go: saved and confirmed, or discarded by the player. */
  clear: () => void;
  /** Read storage again (another tab, a test). */
  reload: () => void;
}

export function createGuestStore(storage: GuestStorage | null): GuestStore {
  const listeners = new Set<() => void>();
  const read = (): GuestSnapshot => {
    const found = readGuestDocument(storage);
    return {
      doc: found.kind === 'guest' ? found.doc : null,
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
    const persisted = doc ? writeGuestDocument(doc, storage) : clearGuestDocument(storage);
    state = { ...state, doc, persisted: doc ? persisted : false };
    emit();
  };
  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    begin: (doc) => set(doc),
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
export function withEvents(doc: GuestDocument, events: NostrEvent[], written: NostrEvent | null, now: number = Date.now()): GuestDocument {
  let next: GuestDocument = { ...doc, events };
  if (written?.kind === KIND_BLOBBI_STATE && !doc.blobbiD) next = { ...next, blobbiD: dOf(written) };
  if (written?.kind === KIND_BLOBBI_INTERACTION) next = { ...next, care: { count: doc.care.count + 1, lastAt: now } };
  return next;
}

export function withInviteDismissed(doc: GuestDocument, now: number = Date.now()): GuestDocument {
  return { ...doc, invite: { dismissedAt: now, shownCount: doc.invite.shownCount + 1 } };
}

export function withMigrationStage(doc: GuestDocument, stage: GuestMigrationStage, now: number = Date.now()): GuestDocument {
  const current: GuestMigration = doc.migration ?? { stage, startedAt: now, landed: {}, profileDone: false };
  return { ...doc, migration: { ...current, stage } };
}

/** Saving was backed out of before any sign-in: nothing happened, nothing is remembered of it. */
export function withMigrationCleared(doc: GuestDocument): GuestDocument {
  return { ...doc, migration: null };
}

export function withLanded(doc: GuestDocument, step: MigrationStep, id: string): GuestDocument {
  if (!doc.migration) return doc;
  return { ...doc, migration: { ...doc.migration, landed: { ...doc.migration.landed, [step]: id } } };
}

export function withProfileDone(doc: GuestDocument): GuestDocument {
  if (!doc.migration) return doc;
  return { ...doc, migration: { ...doc.migration, profileDone: true } };
}

export function withConflictSeen(doc: GuestDocument, loginPubkey: string): GuestDocument {
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
