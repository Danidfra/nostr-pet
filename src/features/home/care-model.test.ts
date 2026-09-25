import { describe, expect, it } from 'vitest';
import type { CareAvailability } from '@/features/care';
import type { HomeInventoryItem, StarterEntry } from '@/features/inventory';
import { careOptionsFor, describeOption, itemCountsByVerb, itemsForVerb, startersForVerb } from './care-model';

function entry(id: string, action: 'feed' | 'play' | 'clean' | 'medicine' | 'boost' | null, extra: Partial<HomeInventoryItem> = {}): HomeInventoryItem {
  return {
    inventoryAddress: `31633:pk:blobbi:island`,
    quantity: 2,
    unverified: false,
    usability: { ok: true },
    item: { address: `31632:issuer:${id}`, itemId: id, name: id, glyph: { type: 'emoji', text: '·' }, definitionSource: 'nostr', care: action ? { action, effects: {}, stages: ['baby'] } : null },
    ...extra,
  } as unknown as HomeInventoryItem;
}
function starter(id: string, action: 'feed' | 'play' | 'clean' | 'boost', ok = true): StarterEntry {
  return { source: 'starter', usability: { ok }, item: { address: `31632:official:${id}`, itemId: id, name: id, glyph: { type: 'emoji', text: '·' }, definitionSource: 'builtin', care: { action, effects: {}, stages: ['baby'] } } } as unknown as StarterEntry;
}
const all: CareAvailability[] = [
  { action: 'feed', label: 'Feed', available: true },
  { action: 'play', label: 'Play', available: true },
  { action: 'clean', label: 'Clean', available: true },
  { action: 'rest', label: 'Rest', available: true },
];
const items = [entry('apple', 'feed'), entry('tonic', 'boost'), entry('ball', 'play'), entry('soap', 'clean'), entry('pill', 'medicine'), entry('hat', null)];
const kit = [starter('s-apple', 'feed'), starter('s-drink', 'boost'), starter('s-ball', 'play'), starter('s-soap', 'clean')];

describe('care model', () => {
  it('maps items to verbs by their care action: boosts feed, medicine cleans, cosmetics answer nothing', () => {
    expect(itemsForVerb('feed', items).map((i) => i.item.itemId)).toEqual(['apple', 'tonic']);
    expect(itemsForVerb('play', items).map((i) => i.item.itemId)).toEqual(['ball']);
    expect(itemsForVerb('clean', items).map((i) => i.item.itemId)).toEqual(['soap', 'pill']);
    expect(itemsForVerb('rest', items)).toEqual([]);
    expect(itemCountsByVerb(items)).toEqual({ feed: 2, play: 1, clean: 2, rest: 0 });
    expect(startersForVerb('feed', kit).map((s) => s.item.itemId)).toEqual(['s-apple', 's-drink']);
  });

  it('leaves out what this Blobbi cannot use now and what is unverified, owned or starter', () => {
    const list = [entry('apple', 'feed', { usability: { ok: false, reason: 'asleep' } } as Partial<HomeInventoryItem>), entry('pear', 'feed', { unverified: true }), entry('plum', 'feed')];
    expect(itemsForVerb('feed', list).map((i) => i.item.itemId)).toEqual(['plum']);
    expect(startersForVerb('feed', [starter('x', 'feed', false)])).toEqual([]);
  });

  it('offers items only: the owned ones first, then the starter kit; never a way to care without one', () => {
    const none = careOptionsFor('feed', [], [], all);
    expect(none).toEqual([]);
    const free = careOptionsFor('feed', [], kit, all);
    expect(free.map((o) => o.source)).toEqual(['starter', 'starter']);
    const some = careOptionsFor('feed', items, kit, all);
    expect(some.map((o) => `${o.source}:${o.entry.item.itemId}`)).toEqual(['owned:apple', 'owned:tonic', 'starter:s-apple', 'starter:s-drink']);
    expect(new Set(some.map((o) => o.key)).size).toBe(4);
  });

  it("rest has no options (the bed is the room's), and an unavailable verb offers nothing", () => {
    expect(careOptionsFor('rest', items, kit, all)).toEqual([]);
    const asleep = all.map((a) => (a.action === 'rest' ? a : { ...a, available: false, reason: 'sleeping' }));
    expect(careOptionsFor('feed', items, kit, asleep)).toEqual([]);
  });

  it('words an owned option by name and count and a starter by name, free', () => {
    expect(describeOption({ source: 'owned', entry: entry('apple', 'feed'), key: 'k' })).toBe('apple, 2');
    expect(describeOption(careOptionsFor('play', [], kit, all)[0])).toBe('s-ball, free');
  });
});
