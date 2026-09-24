/**
 * Where an inventory comes from, in the player's words.
 *
 * A kind 31633's `d` is an opaque identity chosen by the game that writes it.
 * The home never writes one: every inventory it shows belongs to another
 * game, and the only thing the home does to it is spend (kind 1416). So a
 * source is a label and a note, nothing more.
 */

export interface InventorySource {
  /** The 31633 `d`. */
  id: string;
  /** "Blobbi Island", "Nostr Farm", or a fallback built from the id. */
  label: string;
  /** Whether the home recognises this game. */
  known: boolean;
}

const KNOWN_SOURCES: Record<string, string> = {
  'blobbi:island': 'Blobbi Island',
  'farm:main': 'Nostr Farm',
};

export function describeInventorySource(id: string): InventorySource {
  const label = KNOWN_SOURCES[id];
  if (label) return { id, label, known: true };
  return { id, label: `Inventory “${id}”`, known: false };
}

/** Sources in a stable order: known games first, then the rest by id. */
export function compareSources(a: InventorySource, b: InventorySource): number {
  if (a.known !== b.known) return a.known ? -1 : 1;
  return a.id.localeCompare(b.id);
}
