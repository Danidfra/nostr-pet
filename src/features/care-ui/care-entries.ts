/**
 * The items a care carousel offers, one model for every screen that offers
 * them (the 3D room's dock, the classic home's options): what each is, how
 * many the player owns (a starter is free, unlimited and never owned), and
 * whether it can be used on this Blobbi now. Pure; what an item is and what
 * using it writes stay the inventory feature's.
 */
import { optionKey, VERB_ITEM_ACTIONS, type CareChoice, type CareVerb } from '@/features/home/care-model';
import type { HomeInventory, HomeInventoryItem, ItemAction, ItemGlyphModel, StarterEntry } from '@/features/inventory';

/** One item a carousel offers. */
export interface CareEntry {
  /** Stable across renders and refetches (`optionKey`). */
  key: string;
  choice: CareChoice;
  name: string;
  glyph: ItemGlyphModel;
  action: ItemAction;
  /** How many the player owns; null for a starter (free, unlimited). */
  quantity: number | null;
  /** Whether it can be used on this Blobbi now; when not, why. */
  usable: boolean;
  reason: string | null;
}

export function starterEntry(entry: StarterEntry): CareEntry {
  const choice: CareChoice = { source: 'starter', entry };
  return { key: optionKey(choice), choice, name: entry.item.name, glyph: entry.item.glyph, action: entry.item.care!.action, quantity: null, usable: entry.usability.ok, reason: entry.usability.ok ? null : entry.usability.reason ?? 'Not right now.' };
}

export function ownedEntry(entry: HomeInventoryItem): CareEntry {
  const choice: CareChoice = { source: 'owned', entry };
  const reason = entry.unverified ? "This inventory's balance can't be verified right now." : !entry.usability.ok ? entry.usability.reason ?? 'Not right now.' : null;
  return { key: optionKey(choice), choice, name: entry.item.name, glyph: entry.item.glyph, action: entry.item.care!.action, quantity: entry.quantity, usable: reason === null, reason };
}

/** Food and drink are handed to the Blobbi; everything else is set down for it to come to. */
export function isHandFed(action: ItemAction): boolean {
  return action === 'feed' || action === 'boost';
}


/**
 * What the classic home offers for a care verb: the starter kit's items
 * that answer it (each with whether this Blobbi can use it now), then the
 * player's owned ones that do (a balance above zero), by name. Rest has
 * none: it acts at once.
 */
export function verbEntries(verb: CareVerb, inventory: Pick<HomeInventory, 'starters' | 'items'>): CareEntry[] {
  const answers = (action: ItemAction | undefined) => action !== undefined && VERB_ITEM_ACTIONS[verb].includes(action);
  const starters = inventory.starters.filter((s) => answers(s.item.care?.action)).map((entry) => starterEntry(entry));
  const owned = inventory.items
    .filter((i) => answers(i.item.care?.action) && i.quantity > 0)
    .map((entry) => ownedEntry(entry))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...starters, ...owned];
}

/**
 * The classic home's carousel for a verb: nothing when the verb itself is
 * unavailable (the verb button says why) or acts at once (rest); else the
 * starter items this Blobbi can use now and every owned item that answers
 * it with some left (one that cannot be used now stays, dimmed, and says
 * why when tapped).
 */
export function homeCareEntries(verb: CareVerb, inventory: Pick<HomeInventory, 'starters' | 'items'>, availability: readonly { action: string; available: boolean }[]): CareEntry[] {
  const available = availability.find((a) => a.action === verb)?.available ?? false;
  if (!available || verb === 'rest') return [];
  return verbEntries(verb, inventory).filter((e) => e.choice.source === 'owned' || e.usable);
}
