/**
 * What an item IS to the home, derived from its kind 31632 definition.
 *
 * The library (`@nostr-games/inventory`) parses tags and hands the content
 * back verbatim; it deliberately interprets nothing inside it. This module is
 * the home's interpretation, and it is policy, not protocol:
 *
 *  - an OFFICIAL definition says what it does in `content.effects["game:blobbi"]`
 *    and `content.metadata.{action,stages,emoji}` (the same shape Island reads);
 *  - a PARTNER definition is trusted for display only: its raw produce
 *    (consumable, food, edible) is food, and the effect is decided here;
 *  - anything from an untrusted issuer, or without a definition, is unknown:
 *    shown by its address, never used, never fetched for artwork.
 *
 * Artwork is never trusted blindly. An image URL is used only when it is
 * `https:` on an allow-listed host; otherwise the definition's emoji (a short,
 * markup-free string) or a category glyph stands in. No remote markup, ever.
 */
import type { BlobbiStage, BlobbiStats, CareItemEffect } from '@blobbi-kit/core';
import type { InventoryAction } from '@blobbi-kit/react';
import { getPrimaryItemImage, parseGameItemAddress, type GameItemDefinition } from '@nostr-games/inventory';
import { trustedIssuer, type TrustedIssuer } from './issuers';

export type ItemAction = InventoryAction;

const ITEM_ACTIONS: readonly ItemAction[] = ['feed', 'play', 'clean', 'medicine', 'boost'];
const STAGES: readonly BlobbiStage[] = ['egg', 'baby', 'adult'];
const STAT_KEYS: readonly (keyof BlobbiStats)[] = ['hunger', 'happiness', 'energy', 'hygiene', 'health'];

/** What a care item does when used: the kit's own effect shape plus the gates. */
export interface ItemCare {
  action: ItemAction;
  effects: CareItemEffect;
  /** Stages that may use it. Absent means every stage (never the case for official items). */
  stages: readonly BlobbiStage[];
}

export type ItemKind = 'care' | 'currency' | 'cosmetic' | 'unknown';

export type ItemGlyph = { type: 'image'; url: string } | { type: 'emoji'; text: string } | { type: 'category'; category: string };

export interface HomeItem {
  /** The full `31632:<issuer>:<d>` address, the one identity across issuers. */
  address: string;
  /** The `d` part, for display when nothing better is known. */
  itemId: string;
  issuer: TrustedIssuer | null;
  definition: GameItemDefinition | null;
  name: string;
  description: string | null;
  kind: ItemKind;
  glyph: ItemGlyph;
  /** Present for care consumables only. */
  care: ItemCare | null;
  /** Whether using it consumes one. All care items are consumables. */
  consumable: boolean;
  /** A wearable or visual effect: equipped elsewhere (the Island), shown here. */
  equippable: boolean;
  rarity: string | null;
}

/** Hosts an item image may be loaded from. Extending this is a policy change. */
export const IMAGE_HOST_ALLOW_LIST: readonly string[] = ['assets.blobbi.pet', 'blossom.primal.net'];

/** `https:` on an allow-listed host, a plain path, nothing else. */
export function isSafeImageUrl(candidate: string | undefined): candidate is string {
  if (!candidate) return false;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (!IMAGE_HOST_ALLOW_LIST.includes(url.hostname)) return false;
  // Not markup: an SVG in an <img> cannot script, but the home only shows raster art it can size.
  if (/\.svgz?$/i.test(url.pathname)) return false;
  return true;
}

/** A short emoji-like string: no whitespace, no markup characters, at most a few code points. */
export function safeEmoji(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim();
  if (!text || text.length > 16) return null;
  if (/[\s<>&"'`\\/]/.test(text)) return null;
  if (/[\p{L}\p{N}]/u.test(text)) return null;
  const points = Array.from(text);
  if (points.length > 6) return null;
  return text;
}

/** How much a partner's raw produce feeds a Blobbi: Island's one food segment. */
export const PARTNER_PRODUCE_HUNGER = 25;

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The official content shape, read defensively; unknown keys are ignored. */
function officialCare(definition: GameItemDefinition): ItemCare | null {
  if (definition.type !== 'consumable') return null;
  const content = readRecord(definition.contentJson);
  if (!content) return null;
  const effectsContainer = readRecord(content.effects);
  const bag = readRecord(effectsContainer?.['game:blobbi']) ?? effectsContainer;
  const effects: CareItemEffect = {};
  if (bag) {
    for (const key of STAT_KEYS) {
      const v = bag[key];
      if (typeof v === 'number' && Number.isFinite(v)) effects[key] = v;
    }
  }
  const metadata = readRecord(content.metadata) ?? content;
  const action = metadata.action;
  if (typeof action !== 'string' || !ITEM_ACTIONS.includes(action as ItemAction)) return null;
  const rawStages = Array.isArray(metadata.stages) ? metadata.stages : null;
  const stages = rawStages ? (rawStages.filter((s): s is BlobbiStage => STAGES.includes(s as BlobbiStage)) as BlobbiStage[]) : [...STAGES];
  if (stages.length === 0) return null;
  return { action: action as ItemAction, effects, stages };
}

/** Partner policy: raw produce is food for a hatched Blobbi. Nothing else from a partner is usable. */
function partnerCare(definition: GameItemDefinition): ItemCare | null {
  const isProduce = definition.type === 'consumable' && definition.category === 'food' && definition.topics.includes('edible');
  if (!isProduce) return null;
  return { action: 'feed', effects: { hunger: PARTNER_PRODUCE_HUNGER }, stages: ['baby', 'adult'] };
}

function glyphFor(definition: GameItemDefinition | null, kind: ItemKind): ItemGlyph {
  if (definition) {
    const image = getPrimaryItemImage(definition);
    if (isSafeImageUrl(image)) return { type: 'image', url: image };
    const content = readRecord(definition.contentJson);
    const metadata = readRecord(content?.metadata);
    const emoji = safeEmoji(metadata?.emoji) ?? safeEmoji(definition.symbol);
    if (emoji) return { type: 'emoji', text: emoji };
    return { type: 'category', category: definition.category ?? kind };
  }
  return { type: 'category', category: 'unknown' };
}

/** Turn an address and (maybe) its definition into what the home can say about it. */
export function resolveHomeItem(address: string, definition: GameItemDefinition | null | undefined): HomeItem {
  const parsed = parseGameItemAddress(address);
  const itemId = parsed?.itemId ?? address;
  const issuer = parsed ? (trustedIssuer(parsed.pubkey) ?? null) : null;

  // A definition is only believed when it comes from the trusted issuer named in the address.
  const trusted = definition && issuer && definition.issuer === issuer.pubkey ? definition : null;
  if (!issuer || !trusted) {
    return {
      address,
      itemId,
      issuer,
      definition: null,
      name: issuer ? `Unknown ${issuer.label} item` : 'Unknown item',
      description: null,
      kind: 'unknown',
      glyph: { type: 'category', category: 'unknown' },
      care: null,
      consumable: false,
      equippable: false,
      rarity: null,
    };
  }

  const care = issuer.role === 'blobbi' ? officialCare(trusted) : partnerCare(trusted);
  const equippable = trusted.type === 'cosmetic' || trusted.topics.includes('equipable');
  const kind: ItemKind = care ? 'care' : trusted.type === 'currency' ? 'currency' : equippable ? 'cosmetic' : 'unknown';
  const content = readRecord(trusted.contentJson);
  const description = typeof content?.description === 'string' ? content.description.slice(0, 280) : null;

  return {
    address,
    itemId,
    issuer,
    definition: trusted,
    name: trusted.name,
    description,
    kind,
    glyph: glyphFor(trusted, kind),
    care,
    consumable: care !== null,
    equippable,
    rarity: trusted.rarity ?? null,
  };
}

export interface ItemUsability {
  ok: boolean;
  /** Why not, in the player's words. */
  reason?: string;
}

const ACTION_WORD: Record<ItemAction, string> = { feed: 'eat', play: 'play with', clean: 'use', medicine: 'take', boost: 'drink' };

/** Whether THIS Blobbi could use the item now, before any inventory question. */
export function itemUsability(item: HomeItem, companion: { stage: BlobbiStage; state: string; name: string }): ItemUsability {
  if (!item.care) {
    if (item.kind === 'currency') return { ok: false, reason: 'Spent on the Island, not here.' };
    if (item.equippable) return { ok: false, reason: 'Equip it on the Island.' };
    return { ok: false, reason: 'Nothing to do with this at home.' };
  }
  if (!item.care.stages.includes(companion.stage)) {
    return { ok: false, reason: companion.stage === 'egg' ? 'Not until it hatches.' : 'Not at this stage.' };
  }
  if (companion.state === 'sleeping') return { ok: false, reason: 'Sleeping right now. Wake up first.' };
  if (companion.state === 'hibernating') return { ok: false, reason: 'Hibernating. Nothing to do here for now.' };
  return { ok: true };
}

/** "Brook will eat it", for the sheet. */
export function describeItemUse(item: HomeItem, name: string): string {
  if (!item.care) return '';
  return `${name} will ${ACTION_WORD[item.care.action]} it.`;
}

/**
 * The shelf an item sits on in the inventory screen, derived from what the
 * definition really says: the care action for consumables (the same
 * mapping the care verbs use), the `category` tag for a drink, the
 * equippable flag for cosmetics. Nothing is guessed from a name.
 */
export type ItemShelf = 'food' | 'drinks' | 'toys' | 'care' | 'cosmetics' | 'other';

export const SHELF_ORDER: readonly ItemShelf[] = ['food', 'drinks', 'toys', 'care', 'cosmetics', 'other'];
export const SHELF_LABEL: Record<ItemShelf, string> = { food: 'Food', drinks: 'Drinks', toys: 'Toys', care: 'Care', cosmetics: 'Cosmetics', other: 'Other' };

export function shelfFor(item: Pick<HomeItem, 'care' | 'equippable' | 'definition' | 'kind'>): ItemShelf {
  const category = item.definition?.category?.toLowerCase();
  if (item.care) {
    if (category === 'drink' || category === 'drinks') return 'drinks';
    switch (item.care.action) {
      case 'feed':
        return 'food';
      case 'play':
        return 'toys';
      case 'clean':
      case 'medicine':
      case 'boost':
        return 'care';
    }
  }
  if (item.equippable || item.kind === 'cosmetic') return 'cosmetics';
  return 'other';
}
