/**
 * What each room offers and what a drop or a Use means, decided without
 * React or Nostr: the registry's activities choose the items, starters and
 * owned items keep their own economics (free and unlimited, or a real
 * balance), and a drop resolves to handing over, setting down or nothing.
 */
import { describe, expect, it } from 'vitest';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';

import { resolveStarterEntries } from '@/features/inventory/starter-catalog';
import { resolveHomeItem, itemUsability } from '@/features/inventory/item-model';
import { indexDefinitions, type HomeInventoryItem } from '@/features/inventory/useHomeInventory';
import { blobbiEvent } from '@/test/fixtures';
import { ISLAND_INVENTORY, OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_SOAP, officialCareDefinition } from '@/test/inventory-fixtures';
import type { RoomId } from '@/features/home/rooms/rooms';
import { ROOM_GRID } from './room-geometry';
import { isHandFed, planDrop, planUse, setDownNear, shelfEntries, shelfKey, type CareShelf } from './room-care';

function blobbi(state: 'active' | 'sleeping' = 'active', stage: 'egg' | 'baby' | 'adult' = 'adult'): BlobbiCompanion {
  return parseModernBlobbiEvent(blobbiEvent('0000000003', { name: 'Moss', stage, state, visualGeneration: 'v3' }))!;
}

const DEFS = indexDefinitions([
  officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }),
  officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }),
  officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 30 }),
]);

function owned(address: string, quantity: number, b = blobbi(), unverified = false): HomeInventoryItem {
  const item = resolveHomeItem(address, DEFS.get(address));
  return { item, quantity, inventoryAddress: ISLAND_INVENTORY, source: 'blobbi:island' as never, usability: itemUsability(item, b), unverified };
}

const room = (roomId: RoomId): CareShelf => ({ kind: 'room', roomId });

describe('what a room offers', () => {
  const b = blobbi();
  const inventory = { starters: resolveStarterEntries(undefined, b), items: [owned(OFFICIAL_APPLE, 3), owned(OFFICIAL_BALL, 1), owned(OFFICIAL_SOAP, 2)] };

  it('each room shows the activities the registry gives it: food and drink in the kitchen, soap and medicine in the care room, toys in the living room', () => {
    const actions = (shelf: CareShelf) => new Set(shelfEntries(shelf, inventory).map((e) => e.action));
    expect([...actions(room('kitchen'))].sort()).toEqual(['boost', 'feed']);
    expect([...actions(room('care'))].sort()).toEqual(['clean', 'medicine']);
    expect([...actions(room('home'))]).toEqual(['play']);
    expect(shelfEntries(room('rest'), inventory)).toEqual([]);
    expect(shelfEntries(room('closet'), inventory)).toEqual([]);
  });

  it('starters come first, free and unlimited; owned items after, with their counts, and only while some are left', () => {
    const kitchen = shelfEntries(room('kitchen'), inventory);
    const starters = kitchen.filter((e) => e.choice.source === 'starter');
    const ownedRows = kitchen.filter((e) => e.choice.source === 'owned');
    expect(starters.length).toBeGreaterThan(0);
    expect(starters.every((e) => e.quantity === null)).toBe(true);
    expect(kitchen.indexOf(starters[starters.length - 1])).toBeLessThan(kitchen.indexOf(ownedRows[0]));
    expect(ownedRows.map((e) => [e.name, e.quantity])).toEqual([['Apple', 3]]);
    // The same item as a starter and as owned is two entries, two economies, two keys
    const apples = kitchen.filter((e) => e.name === 'Apple');
    expect(apples.map((e) => e.choice.source).sort()).toEqual(['owned', 'starter']);
    expect(new Set(apples.map((e) => e.key)).size).toBe(2);
    const none = shelfEntries(room('kitchen'), { ...inventory, items: [owned(OFFICIAL_APPLE, 0)] });
    expect(none.some((e) => e.choice.source === 'owned')).toBe(false);
  });

  it('an item that cannot be used now stays in the strip, unusable, saying why: asleep, or a balance that cannot be verified', () => {
    const asleep = blobbi('sleeping');
    const sleeping = shelfEntries(room('kitchen'), { starters: resolveStarterEntries(undefined, asleep), items: [owned(OFFICIAL_APPLE, 3, asleep)] });
    expect(sleeping.length).toBeGreaterThan(0);
    expect(sleeping.every((e) => !e.usable && e.reason)).toBe(true);
    const unverified = shelfEntries(room('kitchen'), { starters: [], items: [owned(OFFICIAL_APPLE, 3, b, true)] });
    expect(unverified[0]).toMatchObject({ usable: false, quantity: 3 });
    expect(unverified[0].reason).toMatch(/verified/);
  });

  it('a piece of furniture opens its own shelf (the toy box in any room), remembered apart from the room\'s', () => {
    const toybox: CareShelf = { kind: 'furniture', label: 'From the toy box', activities: ['play'] };
    expect(shelfEntries(toybox, inventory).every((e) => e.action === 'play')).toBe(true);
    expect(shelfKey(toybox)).not.toBe(shelfKey(room('kitchen')));
    expect(shelfKey(room('kitchen'))).toBe('room:kitchen');
  });
});

describe('what a drop or a Use means', () => {
  const at = { x: 4, z: 4 };

  it('food and drink on the Blobbi are handed over; anything else on it is set down at its feet', () => {
    expect(isHandFed('feed') && isHandFed('boost')).toBe(true);
    expect(planDrop('feed', { kind: 'blobbi' }, at)).toEqual({ kind: 'hand' });
    expect(planDrop('boost', { kind: 'blobbi' }, at)).toEqual({ kind: 'hand' });
    expect(planDrop('play', { kind: 'blobbi' }, at)).toEqual({ kind: 'set-down', ...setDownNear(at) });
    expect(planDrop('clean', { kind: 'blobbi' }, at)).toEqual({ kind: 'set-down', ...setDownNear(at) });
  });

  it('anything on the floor is set down there for the Blobbi to walk to; off the floor nothing happens', () => {
    expect(planDrop('feed', { kind: 'floor', x: 2, z: 6 }, at)).toEqual({ kind: 'set-down', x: 2, z: 6 });
    expect(planDrop('play', { kind: 'floor', x: -1, z: 99 }, at)).toEqual({ kind: 'set-down', x: 0.6, z: ROOM_GRID - 0.6 });
    expect(planDrop('play', { kind: 'nowhere' }, at)).toEqual({ kind: 'cancel' });
  });

  it('Use without a drag: food handed over, anything else set down just in front of the Blobbi, always inside the room', () => {
    expect(planUse('feed', at)).toEqual({ kind: 'hand' });
    const set = planUse('play', at);
    expect(set.kind).toBe('set-down');
    // No 3D room to walk in: everything is handed over, as the home does without walking
    expect(planUse('clean', null)).toEqual({ kind: 'hand' });
    for (const p of [{ x: 7.6, z: 7.6 }, { x: 0.2, z: 7.9 }, { x: 4, z: 4 }]) {
      const s = setDownNear(p);
      expect(s.x).toBeGreaterThanOrEqual(0.6);
      expect(s.x).toBeLessThanOrEqual(ROOM_GRID - 0.6);
      expect(s.z).toBeGreaterThanOrEqual(0.6);
      expect(s.z).toBeLessThanOrEqual(ROOM_GRID - 0.6);
      expect(Math.hypot(s.x - p.x, s.z - p.z)).toBeGreaterThan(0.5);
    }
  });
});
