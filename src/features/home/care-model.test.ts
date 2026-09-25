import { describe, expect, it } from 'vitest';
import type { CareAvailability } from '@/features/care';
import type { HomeInventoryItem } from '@/features/inventory';
import { careOptionsFor, describeOption, itemCountsByVerb, itemsForVerb } from './care-model';

function entry(id: string, action: 'feed' | 'play' | 'clean' | 'medicine' | 'boost' | null, extra: Partial<HomeInventoryItem> = {}): HomeInventoryItem {
  return {
    inventoryAddress: `31633:pk:blobbi:island`,
    quantity: 2,
    unverified: false,
    usability: { ok: true },
    item: { address: `31632:issuer:${id}`, itemId: id, name: id, glyph: { kind: 'emoji', value: '·' }, care: action ? { action, effects: {} } : null },
    ...extra,
  } as unknown as HomeInventoryItem;
}
const all: CareAvailability[] = [
  { action: 'feed', label: 'Feed', available: true },
  { action: 'play', label: 'Play', available: true },
  { action: 'clean', label: 'Clean', available: true },
  { action: 'rest', label: 'Rest', available: true },
];
const items = [entry('apple', 'feed'), entry('tonic', 'boost'), entry('ball', 'play'), entry('soap', 'clean'), entry('pill', 'medicine'), entry('hat', null)];

describe('care model', () => {
  it('maps items to verbs by their care action: boosts feed, medicine cleans, cosmetics answer nothing', () => {
    expect(itemsForVerb('feed', items).map((i) => i.item.itemId)).toEqual(['apple', 'tonic']);
    expect(itemsForVerb('play', items).map((i) => i.item.itemId)).toEqual(['ball']);
    expect(itemsForVerb('clean', items).map((i) => i.item.itemId)).toEqual(['soap', 'pill']);
    expect(itemsForVerb('rest', items)).toEqual([]);
    expect(itemCountsByVerb(items)).toEqual({ feed: 2, play: 1, clean: 2, rest: 0 });
  });

  it('leaves out what this Blobbi cannot use now and what is unverified', () => {
    const list = [entry('apple', 'feed', { usability: { ok: false, reason: 'asleep' } } as Partial<HomeInventoryItem>), entry('pear', 'feed', { unverified: true }), entry('plum', 'feed')];
    expect(itemsForVerb('feed', list).map((i) => i.item.itemId)).toEqual(['plum']);
  });

  it('always ends with the plain way, so nothing owned is never no way to care', () => {
    const none = careOptionsFor('feed', [], all);
    expect(none).toEqual([expect.objectContaining({ kind: 'plain', verb: 'feed', label: 'A snack' })]);
    const some = careOptionsFor('feed', items, all);
    expect(some.map((o) => o.kind)).toEqual(['item', 'item', 'plain']);
  });

  it('offers nothing for a verb that is unavailable: the verb button already says why', () => {
    const asleep = all.map((a) => (a.action === 'rest' ? a : { ...a, available: false, reason: 'sleeping' }));
    expect(careOptionsFor('feed', items, asleep)).toEqual([]);
    expect(careOptionsFor('rest', items, asleep)).toHaveLength(1);
  });

  it('words an option by name and count, the plain way by its label, bed by the name', () => {
    expect(describeOption({ kind: 'item', key: 'k', entry: entry('apple', 'feed') }, { name: 'Brook' })).toBe('apple, 2');
    expect(describeOption(careOptionsFor('play', [], all)[0], { name: 'Brook' })).toBe('Play together');
    expect(describeOption(careOptionsFor('rest', [], all)[0], { name: 'Brook' })).toBe('Brook goes to bed');
  });
});
