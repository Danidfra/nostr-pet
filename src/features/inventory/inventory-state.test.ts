import { describe, expect, it } from 'vitest';
import { deriveBalances, effectiveQuantity, itemAddressesOf, latestInventories, uniqueEvents } from './inventory-state';
import { FARM_CARROT, FARM_INVENTORY, ISLAND_INVENTORY, OFFICIAL_APPLE, OFFICIAL_COIN, foldEvent, inventoryEvent, spendEvent } from '@/test/inventory-fixtures';
import { CREATED_AT } from '@/test/fixtures';

describe('deriveBalances', () => {
  it('a snapshot with no spends resolves to its own quantities, known games first', () => {
    const balances = deriveBalances({
      inventories: [inventoryEvent('zzz:other', { [OFFICIAL_COIN]: 1 }), inventoryEvent('farm:main', { [FARM_CARROT]: 3 }), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2, [OFFICIAL_COIN]: 200 })],
      spends: [],
      folds: [],
    });
    expect(balances.map((b) => b.source.label)).toEqual(['Blobbi Island', 'Nostr Farm', 'Inventory “zzz:other”']);
    expect(balances[0].resolution).toBe('resolved');
    expect(effectiveQuantity(balances[0], OFFICIAL_APPLE)).toBe(2);
    expect(itemAddressesOf(balances).sort()).toEqual([OFFICIAL_APPLE, OFFICIAL_COIN, FARM_CARROT].sort());
  });

  it('a pending spend debits the balance; an overdraw is rejected in full, never clamped', () => {
    const [island] = deriveBalances({
      inventories: [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 })],
      spends: [spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE), spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE, { quantity: 5, createdAt: CREATED_AT + 11 })],
      folds: [],
    });
    expect(effectiveQuantity(island, OFFICIAL_APPLE)).toBe(1);
    expect(island.derived?.applied).toHaveLength(1);
    expect(island.derived?.rejected).toHaveLength(1);
  });

  it('a spend against another inventory is ignored here', () => {
    const [island] = deriveBalances({
      inventories: [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 })],
      spends: [spendEvent(FARM_INVENTORY, FARM_CARROT)],
      folds: [],
    });
    expect(effectiveQuantity(island, OFFICIAL_APPLE)).toBe(2);
  });

  it('a spend the fold chain already incorporated does not debit twice', () => {
    const spend = spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE, { id: 'a'.repeat(64) });
    const fold = foldEvent(ISLAND_INVENTORY, [spend.id], { id: 'c'.repeat(64) });
    const [island] = deriveBalances({
      inventories: [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 1 }, { fold: fold.id, createdAt: CREATED_AT + 30 })],
      spends: [spend],
      folds: [fold],
    });
    expect(island.resolution).toBe('resolved');
    expect(effectiveQuantity(island, OFFICIAL_APPLE)).toBe(1);
  });

  it('a snapshot pointing at a fold the relays did not return is unresolved: no balance at all', () => {
    const [island] = deriveBalances({
      inventories: [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 4 }, { fold: 'e'.repeat(64) })],
      spends: [],
      folds: [],
    });
    expect(island.resolution).toBe('unresolved');
    expect(island.items).toEqual([{ address: OFFICIAL_APPLE, quantity: 4 }]);
    expect(effectiveQuantity(island, OFFICIAL_APPLE)).toBe(0);
  });
});

describe('latestInventories / uniqueEvents', () => {
  it('keeps only the newest snapshot per d', () => {
    const older = inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 9 }, { createdAt: CREATED_AT });
    const newer = inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 1 }, { createdAt: CREATED_AT + 5 });
    const [only] = latestInventories([older, newer]);
    expect(only.items[0].quantity).toBe(1);
  });

  it('merges relay spends with the device ledger without double counting', () => {
    const spend = spendEvent(ISLAND_INVENTORY, OFFICIAL_APPLE, { id: 'a'.repeat(64) });
    const merged = uniqueEvents([spend], [{ ...spend }]);
    expect(merged).toHaveLength(1);
    const [island] = deriveBalances({ inventories: [inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 })], spends: merged, folds: [] });
    expect(effectiveQuantity(island, OFFICIAL_APPLE)).toBe(1);
  });
});
