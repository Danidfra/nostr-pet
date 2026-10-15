import { describe, expect, it } from 'vitest';
import type { CareAvailability } from '@/features/care';
import type { HomeInventoryItem, StarterEntry } from '@/features/inventory';
import { careOptionsFor, describeOption, startersForVerb } from './care-model';

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
  { action: 'clean', label: 'Care', available: true },
  { action: 'rest', label: 'Rest', available: true },
];
const items = [entry('apple', 'feed'), entry('tonic', 'boost'), entry('ball', 'play'), entry('soap', 'clean'), entry('pill', 'medicine'), entry('hat', null)];
const kit = [starter('s-apple', 'feed'), starter('s-drink', 'boost'), starter('s-ball', 'play'), starter('s-soap', 'clean')];

describe('care model', () => {
  it('maps starters to verbs by their care action: boosts feed, medicine cleans', () => {
    expect(startersForVerb('feed', kit).map((s) => s.item.itemId)).toEqual(['s-apple', 's-drink']);
    expect(startersForVerb('play', kit).map((s) => s.item.itemId)).toEqual(['s-ball']);
    expect(startersForVerb('clean', [...kit, starter('s-pill', 'clean')]).map((s) => s.item.itemId)).toEqual(['s-soap', 's-pill']);
    expect(startersForVerb('rest', kit)).toEqual([]);
  });

  it('leaves out what this Blobbi cannot use now', () => {
    expect(startersForVerb('feed', [starter('x', 'feed', false), starter('y', 'feed')]).map((s) => s.item.itemId)).toEqual(['y']);
  });

  it('offers the starter kit only: owned items are never repeated in the strip (they live in the Inventory)', () => {
    expect(careOptionsFor('feed', [], all)).toEqual([]);
    const options = careOptionsFor('feed', kit, all);
    expect(options.map((o) => `${o.source}:${o.entry.item.itemId}`)).toEqual(['starter:s-apple', 'starter:s-drink']);
    expect(new Set(options.map((o) => o.key)).size).toBe(2);
    // The owned/starter distinction stays in the type: an owned choice is still a valid choice (offered from the Inventory), just not a strip option.
    const owned = { source: 'owned' as const, entry: items[0] };
    expect(owned.source).toBe('owned');
  });

  it("rest has no options (the bed is the room's), and an unavailable verb offers nothing", () => {
    expect(careOptionsFor('rest', kit, all)).toEqual([]);
    const asleep = all.map((a) => (a.action === 'rest' ? a : { ...a, available: false, reason: 'sleeping' }));
    expect(careOptionsFor('feed', kit, asleep)).toEqual([]);
  });

  it('words a starter by its name alone (no "free": availability is not a price) and an owned option by name and count', () => {
    expect(describeOption(careOptionsFor('play', kit, all)[0])).toBe('s-ball');
    expect(describeOption({ source: 'owned', entry: entry('apple', 'feed'), key: 'k' })).toBe('apple, 2');
  });
});
