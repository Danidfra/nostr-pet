/**
 * The device-local ledger of item uses in flight.
 *
 * Using an item is two independent Nostr writes (a kind 1416 spend, then the
 * kind 31124 effect) that cannot be made atomic. What CAN be guaranteed is
 * that a spend is signed exactly once and that its effect is applied at most
 * once. This ledger is how: a record is written BEFORE the spend is offered
 * to any relay, and it stays until the effect has landed. On the next attempt
 * (a retry, a reload, a different item) an open record is resumed with the
 * SAME signed bytes, never re-signed, so no path mints a second spend for one
 * tap, and no "spent but never applied" is left silently behind.
 *
 * Statuses, in order:
 *   signed           recorded, not yet offered to a relay
 *   unconfirmed      offered, every relay silent, not found by id (offer again)
 *   established      at least one relay has it (or it was found by id)
 *   effect-pending   established, the 31124 write failed (apply again)
 *   applied          the 31124 carries `blobbi_op = spendId`; kept briefly so
 *                    the balance does not bounce before the relays serve the spend
 *
 * Only `applied` records expire on their own. Anything else waits for the
 * next attempt or the player's explicit "put away", which is allowed only
 * while the spend is provably unpublished (`signed`) or rejected.
 */
import type { NostrEvent } from '@blobbi-kit/core';

export type SpendStatus = 'signed' | 'unconfirmed' | 'established' | 'effect-pending' | 'applied';

export interface SpendRecord {
  spendId: string;
  inventoryAddress: string;
  itemAddress: string;
  /** The Blobbi (kind 31124 `d`) this use is for. */
  blobbiD: string;
  status: SpendStatus;
  /** The signed kind 1416, kept whole so a retry offers identical bytes. */
  event: NostrEvent;
  createdAt: number;
  updatedAt: number;
}

export const SPEND_LEDGER_PREFIX = 'blobbi:home:item-spends:v1:';

/** How long an `applied` record stays to cover relay propagation. */
export const APPLIED_RETENTION_MS = 24 * 60 * 60 * 1000;

export const OPEN_STATUSES: readonly SpendStatus[] = ['signed', 'unconfirmed', 'established', 'effect-pending'];

export interface LedgerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): LedgerStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is SpendRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.spendId === 'string' &&
    typeof r.inventoryAddress === 'string' &&
    typeof r.itemAddress === 'string' &&
    typeof r.blobbiD === 'string' &&
    typeof r.status === 'string' &&
    !!r.event &&
    typeof r.event === 'object'
  );
}

export function ledgerKey(pubkey: string): string {
  return `${SPEND_LEDGER_PREFIX}${pubkey}`;
}

export function readLedger(pubkey: string, storage: LedgerStorage | null = defaultStorage(), now = Date.now()): SpendRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(ledgerKey(pubkey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).filter((r) => r.status !== 'applied' || now - r.updatedAt < APPLIED_RETENTION_MS);
  } catch {
    return [];
  }
}

function writeLedger(pubkey: string, records: readonly SpendRecord[], storage: LedgerStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ledgerKey(pubkey), JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/** Insert or replace by spend id. Returns whether the write reached storage. */
export function upsertRecord(pubkey: string, record: SpendRecord, storage: LedgerStorage | null = defaultStorage()): boolean {
  const rest = readLedger(pubkey, storage).filter((r) => r.spendId !== record.spendId);
  return writeLedger(pubkey, [...rest, record], storage);
}

export function updateStatus(pubkey: string, spendId: string, status: SpendStatus, storage: LedgerStorage | null = defaultStorage(), now = Date.now()): boolean {
  const records = readLedger(pubkey, storage, now).map((r) => (r.spendId === spendId ? { ...r, status, updatedAt: now } : r));
  return writeLedger(pubkey, records, storage);
}

export function removeRecord(pubkey: string, spendId: string, storage: LedgerStorage | null = defaultStorage()): boolean {
  return writeLedger(
    pubkey,
    readLedger(pubkey, storage).filter((r) => r.spendId !== spendId),
    storage,
  );
}

/** The one open use for this Blobbi, if any: it must finish before another starts. */
export function openRecordFor(pubkey: string, blobbiD: string, storage: LedgerStorage | null = defaultStorage()): SpendRecord | undefined {
  return readLedger(pubkey, storage).find((r) => r.blobbiD === blobbiD && OPEN_STATUSES.includes(r.status));
}

/** Spend events this device knows exist, to merge into balance derivation. */
export function knownSpendEvents(pubkey: string, storage: LedgerStorage | null = defaultStorage()): NostrEvent[] {
  return readLedger(pubkey, storage)
    .filter((r) => r.status === 'established' || r.status === 'effect-pending' || r.status === 'applied')
    .map((r) => r.event);
}

/** A distinct value per player action, so two identical spends in one second stay two events. */
export function mintSpendNonce(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
