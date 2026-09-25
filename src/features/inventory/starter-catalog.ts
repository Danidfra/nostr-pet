/**
 * The starter kit: a few established Blobbi items the standalone provides
 * for free, without limit, so a Blobbi can be cared for on day one.
 *
 * THIS IS A GAMEPLAY AFFORDANCE, NOT OWNERSHIP. A starter item has no
 * inventory balance, mints no kind 31633, records no kind 1416 spend and
 * never appears in the player's inventory. Using one performs only the
 * semantic care write (a kind 31124 with the item's effects and a kind 1124
 * naming the item), exactly what using an owned copy would perform after
 * its spend. It is an MVP decision, not the economy: `useStarterCatalog`
 * is the one seam to close when real inventory is required.
 *
 * Identity and semantics are the ecosystem's, never invented here. Each
 * entry names an OFFICIAL kind 31632 definition by its address
 * (`31632:<official issuer>:<d>`), as published by the Blobbi item issuer
 * and mirrored in Blobbi Island's protocol registry
 * (`src/protocol/event-registry.ts`) and Ditto's shop catalog. At runtime
 * the home fetches those definitions through the trusted-issuer read like
 * any other item (`definitionSource: 'nostr'`); when the definition relays
 * do not answer, the immutable minimum below stands in
 * (`definitionSource: 'builtin'`) and the UI says so. The fallback never
 * pretends to be a fetched event: it has no event, no created_at, no
 * signature, and carries only what is needed to draw and apply the item.
 *
 * Mirror of the published definitions as of 2026-09 (Island registry
 * `OFFICIAL_ITEM_DEFINITIONS`, status `active`).
 */
import { buildGameItemAddress, type GameItemDefinition } from '@nostr-games/inventory';
import type { BlobbiStage, CareItemEffect } from '@blobbi-kit/core';
import { OFFICIAL_ITEM_ISSUER, trustedIssuer } from './issuers';
import { resolveHomeItem, itemUsability, type HomeItem, type ItemAction, type ItemUsability } from './item-model';

export interface StarterItemSpec {
  /** The `d` of the official definition. */
  d: string;
  name: string;
  category: 'food' | 'toy' | 'hygiene' | 'energy';
  emoji: string;
  action: ItemAction;
  stages: readonly BlobbiStage[];
  effects: CareItemEffect;
}

export const STARTER_ITEMS: readonly StarterItemSpec[] = [
  { d: 'blobbi:food:apple', name: 'Apple', category: 'food', emoji: '🍎', action: 'feed', stages: ['baby', 'adult'], effects: { hunger: 25, hygiene: -2, energy: 5 } },
  { d: 'blobbi:energy:drink', name: 'Energy Drink', category: 'energy', emoji: '🧃', action: 'boost', stages: ['baby', 'adult'], effects: { energy: 35, happiness: 5 } },
  { d: 'blobbi:toy:ball', name: 'Ball', category: 'toy', emoji: '⚽', action: 'play', stages: ['baby', 'adult'], effects: { happiness: 25, energy: -10, hygiene: -5 } },
  { d: 'blobbi:hygiene:soap', name: 'Soap', category: 'hygiene', emoji: '🧼', action: 'clean', stages: ['egg', 'baby', 'adult'], effects: { hygiene: 25 } },
];

/** The official addresses the starter kit names; these are fetched with the owned items' definitions. */
export const STARTER_ADDRESSES: readonly string[] = STARTER_ITEMS.map((s) => buildGameItemAddress(OFFICIAL_ITEM_ISSUER, s.d));

/** A starter item, resolved: the trusted definition when fetched, the built-in minimum otherwise. */
export interface StarterEntry {
  source: 'starter';
  item: HomeItem;
  usability: ItemUsability;
}

/** The built-in minimum for one spec: enough to draw it and apply it, honest about not being fetched. */
export function builtinStarterItem(spec: StarterItemSpec): HomeItem {
  const address = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, spec.d);
  return {
    address,
    itemId: spec.d,
    issuer: trustedIssuer(OFFICIAL_ITEM_ISSUER) ?? null,
    definition: null,
    definitionSource: 'builtin',
    name: spec.name,
    description: null,
    kind: 'care',
    glyph: { type: 'emoji', text: spec.emoji },
    care: { action: spec.action, effects: { ...spec.effects }, stages: [...spec.stages] },
    consumable: true,
    equippable: false,
    rarity: null,
  };
}

/**
 * Resolve the kit against fetched definitions. A fetched definition from
 * the official issuer wins (it is the truth, and may have changed); a
 * fetched definition that turned out unusable (parsed, but no care) or a
 * missing one falls back to the built-in minimum.
 */
export function resolveStarterEntries(definitions: ReadonlyMap<string, GameItemDefinition> | undefined, blobbi: Parameters<typeof itemUsability>[1] | undefined): StarterEntry[] {
  return STARTER_ITEMS.map((spec) => {
    const address = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, spec.d);
    const fetched = definitions?.get(address);
    const resolved = fetched ? resolveHomeItem(address, fetched) : null;
    const item = resolved && resolved.care ? resolved : builtinStarterItem(spec);
    return { source: 'starter', item, usability: blobbi ? itemUsability(item, blobbi) : { ok: false, reason: 'No Blobbi to use it on.' } };
  });
}
