/**
 * The care model of the home: four intents and what each offers.
 *
 * A verb is an interaction category, never an action by itself. Choosing
 * one shows the items that do it, and only items: the ones the player
 * OWNS (from the verified inventory read; using one spends it) and the
 * STARTER kit (free, unlimited, never owned; using one performs only the
 * care effect). There is no way to feed, play or clean without an item.
 * Rest is the exception: the bed is part of the room, so Rest brings it
 * out and the Blobbi goes to it; it has no options.
 *
 * Every choice ends in an existing path: an owned item in the M4 use flow
 * (spend + care), a starter in the spend-free care flow. Both reach the
 * same semantic care write by different economic paths, and the type says
 * which one a choice is, so the economy can close the starter seam later
 * without touching the care system.
 */
import type { CareAction, CareAvailability } from '@/features/care';
import type { HomeInventoryItem, ItemAction, StarterEntry } from '@/features/inventory';

export type CareVerb = CareAction;
export const CARE_VERBS: readonly CareVerb[] = ['feed', 'play', 'clean', 'rest'];

/** Which item actions answer a verb. */
export const VERB_ITEM_ACTIONS: Record<CareVerb, readonly ItemAction[]> = {
  feed: ['feed', 'boost'],
  play: ['play'],
  clean: ['clean', 'medicine'],
  rest: [],
};

/** An owned item (a real balance, spent on use) or a starter (free, unlimited, no balance). */
export type CareChoice = { source: 'owned'; entry: HomeInventoryItem } | { source: 'starter'; entry: StarterEntry };

export type CareOption = CareChoice & { key: string };

export function optionKey(choice: CareChoice): string {
  return choice.source === 'owned' ? `owned|${choice.entry.inventoryAddress}|${choice.entry.item.address}` : `starter|${choice.entry.item.address}`;
}

function answers(verb: CareVerb, action: ItemAction | undefined): boolean {
  return action !== undefined && VERB_ITEM_ACTIONS[verb].includes(action);
}

/** Owned items that answer a verb and that THIS Blobbi could use now. */
export function itemsForVerb(verb: CareVerb, items: readonly HomeInventoryItem[]): HomeInventoryItem[] {
  return items.filter((i) => i.usability.ok && !i.unverified && answers(verb, i.item.care?.action));
}

/** Starters that answer a verb and that THIS Blobbi could use now. */
export function startersForVerb(verb: CareVerb, starters: readonly StarterEntry[]): StarterEntry[] {
  return starters.filter((s) => s.usability.ok && answers(verb, s.item.care?.action));
}

/**
 * Everything the strip shows for a verb: owned items first (they are the
 * player's, and spending them is a choice), then the starter kit. When the
 * verb itself is unavailable (asleep, an egg for feed and play) there is
 * nothing to choose; the verb button already says why.
 */
export function careOptionsFor(verb: CareVerb, items: readonly HomeInventoryItem[], starters: readonly StarterEntry[], availability: readonly CareAvailability[]): CareOption[] {
  const available = availability.find((a) => a.action === verb)?.available ?? false;
  if (!available || verb === 'rest') return [];
  const owned: CareOption[] = itemsForVerb(verb, items).map((entry) => ({ source: 'owned', entry, key: optionKey({ source: 'owned', entry }) }));
  const free: CareOption[] = startersForVerb(verb, starters).map((entry) => ({ source: 'starter', entry, key: optionKey({ source: 'starter', entry }) }));
  return [...owned, ...free];
}

/** How the option is worded on the strip: an owned item by name and count; a starter by name, free. */
export function describeOption(option: CareOption): string {
  return option.source === 'owned' ? `${option.entry.item.name}, ${option.entry.quantity}` : `${option.entry.item.name}, free`;
}

/** Counts for the verb badges: how many OWNED items answer each verb (the starter kit is always there and is not counted). */
export function itemCountsByVerb(items: readonly HomeInventoryItem[]): Record<CareVerb, number> {
  return {
    feed: itemsForVerb('feed', items).length,
    play: itemsForVerb('play', items).length,
    clean: itemsForVerb('clean', items).length,
    rest: 0,
  };
}
