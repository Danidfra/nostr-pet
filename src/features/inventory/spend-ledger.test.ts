import { describe, expect, it } from 'vitest';
import { APPLIED_RETENTION_MS, knownSpendEvents, ledgerKey, openRecordFor, readLedger, removeRecord, updateStatus, upsertRecord, mintSpendNonce, type LedgerStorage, type SpendRecord } from './spend-ledger';
import { ISLAND_INVENTORY, OFFICIAL_APPLE, spendEvent } from '@/test/inventory-fixtures';
import { PUBKEY } from '@/test/fixtures';

function memoryStorage(): LedgerStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const record = (over: Partial<SpendRecord> = {}): SpendRecord => {
  const event = spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE, { id: over.spendId ?? 'a'.repeat(64) });
  return { spendId: event.id, inventoryAddress: ISLAND_INVENTORY, itemAddress: OFFICIAL_APPLE, blobbiD: 'blobbi-aaaaaaaaaaaa-0000000001', status: 'signed', event, createdAt: 1000, updatedAt: 1000, ...over };
};

describe('spend ledger', () => {
  it('records before publish, updates status, removes, per player', () => {
    const storage = memoryStorage();
    expect(upsertRecord(PUBKEY, record(), storage)).toBe(true);
    expect(readLedger(PUBKEY, storage)).toHaveLength(1);
    expect(readLedger('c'.repeat(64), storage)).toHaveLength(0);
    expect(storage.map.has(ledgerKey(PUBKEY))).toBe(true);

    updateStatus(PUBKEY, 'a'.repeat(64), 'established', storage, 2000);
    expect(readLedger(PUBKEY, storage)[0]).toMatchObject({ status: 'established', updatedAt: 2000 });

    removeRecord(PUBKEY, 'a'.repeat(64), storage);
    expect(readLedger(PUBKEY, storage)).toHaveLength(0);
  });

  it('the open record for a Blobbi is the one that must finish first; applied ones do not count', () => {
    const storage = memoryStorage();
    upsertRecord(PUBKEY, record({ spendId: 'a'.repeat(64), status: 'applied' }), storage);
    expect(openRecordFor(PUBKEY, 'blobbi-aaaaaaaaaaaa-0000000001', storage)).toBeUndefined();
    upsertRecord(PUBKEY, record({ spendId: 'b'.repeat(64), status: 'effect-pending' }), storage);
    expect(openRecordFor(PUBKEY, 'blobbi-aaaaaaaaaaaa-0000000001', storage)?.spendId).toBe('b'.repeat(64));
    expect(openRecordFor(PUBKEY, 'blobbi-aaaaaaaaaaaa-0000000002', storage)).toBeUndefined();
  });

  it('only spends the relays may not have served yet are merged into balances; signed ones are not', () => {
    const storage = memoryStorage();
    upsertRecord(PUBKEY, record({ spendId: 'a'.repeat(64), status: 'signed' }), storage);
    upsertRecord(PUBKEY, record({ spendId: 'b'.repeat(64), status: 'unconfirmed' }), storage);
    upsertRecord(PUBKEY, record({ spendId: 'c'.repeat(64), status: 'established' }), storage);
    upsertRecord(PUBKEY, record({ spendId: 'd'.repeat(64), status: 'applied', updatedAt: Date.now() }), storage);
    expect(knownSpendEvents(PUBKEY, storage).map((e) => e.id)).toEqual(['c'.repeat(64), 'd'.repeat(64)]);
  });

  it('applied records expire; open ones never do', () => {
    const storage = memoryStorage();
    upsertRecord(PUBKEY, record({ spendId: 'a'.repeat(64), status: 'applied', updatedAt: 0 }), storage);
    upsertRecord(PUBKEY, record({ spendId: 'b'.repeat(64), status: 'effect-pending', updatedAt: 0 }), storage);
    const later = readLedger(PUBKEY, storage, APPLIED_RETENTION_MS + 1);
    expect(later.map((r) => r.spendId)).toEqual(['b'.repeat(64)]);
  });

  it('survives garbage in storage and a storage that throws', () => {
    const storage = memoryStorage();
    storage.map.set(ledgerKey(PUBKEY), '{not json');
    expect(readLedger(PUBKEY, storage)).toEqual([]);
    storage.map.set(ledgerKey(PUBKEY), JSON.stringify([{ nope: true }, record()]));
    expect(readLedger(PUBKEY, storage)).toHaveLength(1);
    const broken: LedgerStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    };
    expect(readLedger(PUBKEY, broken)).toEqual([]);
    expect(upsertRecord(PUBKEY, record(), broken)).toBe(false);
    expect(readLedger(PUBKEY, null)).toEqual([]);
  });

  it('mints distinct nonces', () => {
    expect(mintSpendNonce()).not.toBe(mintSpendNonce());
  });
});
