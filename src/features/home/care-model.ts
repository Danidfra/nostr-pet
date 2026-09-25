/**
 * The care model of the home: four intents and what each offers.
 *
 * A verb is an interaction category, never an action by itself. Choosing
 * one shows the items that do it, from the STARTER kit: the official
 * catalog, always available, never owned (using one performs only the care
 * effect; nothing is spent). There is no way to feed, play or clean without
 * an item. Rest is the exception: the bed is part of the room, so Rest
 * brings it out and the Blobbi goes to it; it has no options.
 *
 * What the player OWNS (the verified inventory read) is not shown here
 * again: the chooser is "what I can use right now", the Inventory overlay
 * is "what my Nostr identity owns", with quantities, sources and the Use
 * button that spends. Both reach the same semantic care write by different
 * economic paths (`CareChoice` says which), so the economy can close the
 * starter seam later without touching the care system.
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

/** Starters that answer a verb and that THIS Blobbi could use now. */
export function startersForVerb(verb: CareVerb, starters: readonly StarterEntry[]): StarterEntry[] {
  return starters.filter((s) => s.usability.ok && answers(verb, s.item.care?.action));
}

/**
 * Everything the strip shows for a verb: the starter kit that answers it.
 * When the verb itself is unavailable (asleep, an egg for feed and play)
 * there is nothing to choose; the verb button already says why.
 */
export function careOptionsFor(verb: CareVerb, starters: readonly StarterEntry[], availability: readonly CareAvailability[]): CareOption[] {
  const available = availability.find((a) => a.action === verb)?.available ?? false;
  if (!available || verb === 'rest') return [];
  return startersForVerb(verb, starters).map((entry) => ({ source: 'starter', entry, key: optionKey({ source: 'starter', entry }) }));
}

/** How the option is worded on the strip: the item's name (an owned item, offered from the Inventory, adds its count). */
export function describeOption(option: CareOption): string {
  return option.source === 'owned' ? `${option.entry.item.name}, ${option.entry.quantity}` : option.entry.item.name;
}
