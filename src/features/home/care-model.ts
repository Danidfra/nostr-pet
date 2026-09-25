/**
 * The care model of the home: four intents and what each offers.
 *
 * A verb is an intent, not an action. Choosing one shows the ways the
 * player can act on it: the items they own that do it (from the verified
 * inventory read, never anything else) and one plain way that needs
 * nothing owned, so a Blobbi with an empty inventory is always cared for.
 * Every option ends in an existing path: an item option in the M4 use flow
 * (spend + care), a plain option in the kit's own care effect.
 */
import type { BlobbiCompanion } from '@blobbi-kit/core';
import type { CareAction, CareAvailability } from '@/features/care';
import type { HomeInventoryItem, ItemAction } from '@/features/inventory';

export type CareVerb = CareAction;
export const CARE_VERBS: readonly CareVerb[] = ['feed', 'play', 'clean', 'rest'];

/** Which item actions answer a verb. */
export const VERB_ITEM_ACTIONS: Record<CareVerb, readonly ItemAction[]> = {
  feed: ['feed', 'boost'],
  play: ['play'],
  clean: ['clean', 'medicine'],
  rest: [],
};

export type CareOption =
  | { kind: 'item'; key: string; entry: HomeInventoryItem }
  | { kind: 'plain'; key: string; verb: CareVerb; label: string; hint: string };

/** The plain way, in the player's words. */
export const PLAIN_OPTION: Record<CareVerb, { label: string; hint: string }> = {
  feed: { label: 'A snack', hint: 'A little something from the kitchen.' },
  play: { label: 'Play together', hint: 'No toy needed.' },
  clean: { label: 'A bath', hint: 'The tub comes out.' },
  rest: { label: 'Go to bed', hint: 'The bed comes out; sleep on arrival.' },
};

export function optionKey(entry: HomeInventoryItem): string {
  return `${entry.inventoryAddress}|${entry.item.address}`;
}

/** Items the player owns that answer a verb and that THIS Blobbi could use now. */
export function itemsForVerb(verb: CareVerb, items: readonly HomeInventoryItem[]): HomeInventoryItem[] {
  const actions = VERB_ITEM_ACTIONS[verb];
  return items.filter((i) => i.usability.ok && !i.unverified && i.item.care !== null && actions.includes(i.item.care.action));
}

/**
 * Everything the strip shows for a verb: owned items first, then the plain
 * way. When the verb itself is unavailable (asleep, an egg, hibernating)
 * there is nothing to choose; the verb button already says why.
 */
export function careOptionsFor(verb: CareVerb, items: readonly HomeInventoryItem[], availability: readonly CareAvailability[]): CareOption[] {
  const available = availability.find((a) => a.action === verb)?.available ?? false;
  if (!available) return [];
  const own: CareOption[] = itemsForVerb(verb, items).map((entry) => ({ kind: 'item', key: optionKey(entry), entry }));
  const plain: CareOption = { kind: 'plain', key: `plain:${verb}`, verb, ...PLAIN_OPTION[verb] };
  return [...own, plain];
}

/** How the option is worded on the strip: an item by name and count; the plain way by its label. */
export function describeOption(option: CareOption, blobbi: Pick<BlobbiCompanion, 'name'>): string {
  if (option.kind === 'item') return `${option.entry.item.name}, ${option.entry.quantity}`;
  return option.verb === 'rest' ? `${blobbi.name} goes to bed` : option.label;
}

/** Counts for the verb badges: how many owned items answer each verb. */
export function itemCountsByVerb(items: readonly HomeInventoryItem[]): Record<CareVerb, number> {
  return {
    feed: itemsForVerb('feed', items).length,
    play: itemsForVerb('play', items).length,
    clean: itemsForVerb('clean', items).length,
    rest: 0,
  };
}
