/**
 * The starter kit: every official Blobbi care item, provided by the
 * standalone for free and without limit, so a Blobbi can be cared for on
 * day one.
 *
 * THIS IS A GAMEPLAY AFFORDANCE, NOT OWNERSHIP. A starter item has no
 * inventory balance, mints no kind 31633, records no kind 1416 spend and
 * never appears in the player's inventory. Using one performs only the
 * semantic care write (a kind 31124 with the item's effects and a kind 1124
 * naming the item), exactly what using an owned copy would perform after
 * its spend. It is an MVP decision, not the economy: `useStarterUse` and
 * `resolveStarterEntries` are the seam to close when real inventory is
 * required.
 *
 * Identity and semantics are the ecosystem's, discovered, never curated:
 *
 *   live      every kind 31632 signed by the official item issuer
 *             (`OFFICIAL_ITEM_ISSUER`, the one issuer Blobbi Island trusts),
 *             read through the same trusted-issuer pipeline as owned items
 *             (`useHomeInventory`: `kinds: [31632], authors: [issuer]`, the
 *             read hints routing it to the issuer's relays), validated by
 *             `resolveHomeItem` (the event's author must BE the issuer named
 *             in the address; anything else is dropped before it is drawn);
 *             every consumable with a care action is offered
 *             (`definitionSource: 'nostr'`)
 *   snapshot  when that read fails or has not answered, the built-in
 *             snapshot of the same definitions (`official-catalog-snapshot.ts`)
 *             stands in (`definitionSource: 'builtin'`), and the UI says so.
 *             A valid fetched definition always replaces its snapshot row;
 *             a snapshot row never replaces a valid fetched one; an event
 *             from another author can never reach either (its address names
 *             its own author, and it fails the trust check anyway).
 *
 * Which verb offers an item comes from the definition's care action
 * (`VERB_ITEM_ACTIONS` in care-model.ts), never from its name.
 */
import { buildGameItemAddress, type GameItemDefinition } from '@nostr-games/inventory';
import { OFFICIAL_ITEM_ISSUER, trustedIssuer } from './issuers';
import { resolveHomeItem, itemUsability, type HomeItem, type ItemUsability } from './item-model';
import { OFFICIAL_CATALOG_SNAPSHOT, type OfficialCatalogRow } from './official-catalog-snapshot';

/** A starter item, resolved: the trusted definition when fetched, the snapshot row otherwise. */
export interface StarterEntry {
  source: 'starter';
  item: HomeItem;
  usability: ItemUsability;
}

/** The snapshot's addresses, for tests and for the definition read's ceiling. */
export const SNAPSHOT_ADDRESSES: readonly string[] = OFFICIAL_CATALOG_SNAPSHOT.map((row) => buildGameItemAddress(OFFICIAL_ITEM_ISSUER, row.d));

/** The built-in minimum for one snapshot row: enough to draw it and apply it, honest about not being fetched. */
export function builtinStarterItem(row: OfficialCatalogRow): HomeItem {
  const address = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, row.d);
  return {
    address,
    itemId: row.d,
    issuer: trustedIssuer(OFFICIAL_ITEM_ISSUER) ?? null,
    definition: null,
    definitionSource: 'builtin',
    name: row.name,
    description: null,
    kind: 'care',
    glyph: { type: 'emoji', text: row.emoji },
    care: { action: row.action, effects: { ...row.effects }, stages: [...row.stages] },
    consumable: true,
    equippable: false,
    rarity: null,
  };
}

const CATEGORY_ORDER: Record<string, number> = { food: 0, energy: 1, toy: 2, hygiene: 3, medicine: 4 };

/**
 * The starter kit against the fetched official catalog: every fetched
 * official consumable with a care action, plus every snapshot row no
 * fetched definition covered. Fetched wins by address; usability is this
 * Blobbi's. Ordered by category, then name, so the strip is stable.
 */
export function resolveStarterEntries(catalog: ReadonlyMap<string, GameItemDefinition> | undefined, blobbi: Parameters<typeof itemUsability>[1] | undefined): StarterEntry[] {
  const items = new Map<string, HomeItem>();
  for (const row of OFFICIAL_CATALOG_SNAPSHOT) {
    const item = builtinStarterItem(row);
    items.set(item.address, item);
  }
  if (catalog) {
    for (const [address, definition] of catalog) {
      // The trust gate: the address's issuer must be the official one, and the
      // definition's author must be that issuer, or resolveHomeItem draws an
      // unknown item with no care, which is then not a starter at all.
      if (definition.issuer !== OFFICIAL_ITEM_ISSUER) continue;
      const item = resolveHomeItem(address, definition);
      if (item.care && item.definitionSource === 'nostr') items.set(address, item);
    }
  }
  const usability = (item: HomeItem): ItemUsability => (blobbi ? itemUsability(item, blobbi) : { ok: false, reason: 'No Blobbi to use it on.' });
  return [...items.values()]
    .filter((item) => item.care !== null)
    .sort((a, b) => (CATEGORY_ORDER[a.definition?.category ?? categoryOf(a)] ?? 9) - (CATEGORY_ORDER[b.definition?.category ?? categoryOf(b)] ?? 9) || a.name.localeCompare(b.name))
    .map((item) => ({ source: 'starter' as const, item, usability: usability(item) }));
}

function categoryOf(item: HomeItem): string {
  return OFFICIAL_CATALOG_SNAPSHOT.find((row) => row.d === item.itemId)?.category ?? '';
}
