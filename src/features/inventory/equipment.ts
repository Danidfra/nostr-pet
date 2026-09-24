/**
 * What a Blobbi wears, read from the Island's kind 31634 equipment document.
 *
 * The home never equips anything (that stays on the Island); it only draws
 * what the player already put on there, so a Blobbi looks the same in both
 * apps. Read-only, and every entry is gated before it reaches the renderer,
 * the way Island gates its own (`src/placement/policy.ts`):
 *
 *   author == owner          the document was queried by author
 *   mode == 'equip'          `place` is valid protocol, not equipment
 *   trusted official issuer  the FULL address, never the `d` alone
 *   definition known         from the same fetch that serves the sheet
 *   the issuer's slot        `content.visual.slot` must equal the entry's slot
 *   owned                    quantity ≥ 1 in the player's balances
 *   form                     `content.visual.forms` includes the stage
 *   last wins per slot       two hats never stack
 *
 * Visual-effect items (`visual.kind === 'blobbi-effect'`) become renderer
 * effects (`{ id }`) when their id is one the renderer implements and their
 * slot is the renderer's slot for it; wearables become accessory placements
 * whose artwork is the definition's images, allow-listed, chosen per facing.
 */
import type { BlobbiStage } from '@blobbi-kit/core';
import { EFFECT_SLOTS, isBlobbiVisualEffectId, type AccessoryPlacementInput, type AccessorySlot, type BlobbiVisualEffect } from '@blobbi-kit/renderer';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';
import { buildAddressableEventAddress, getItemImageByMarker, type GameItemDefinition, type GameItemPlacement, type GameItemPlacementEntry } from '@nostr-games/inventory';
import { isSafeImageUrl } from './item-model';
import { OFFICIAL_ITEM_ISSUER } from './issuers';

/** Slots the renderer can draw a wearable in. `unknown` is not equippable. */
export const EQUIPPABLE_SLOTS: readonly AccessorySlot[] = ['headwear', 'eyewear', 'back', 'neckwear', 'handheld', 'face-mark', 'aura', 'color-overlay'];

export type Facing = 'front' | 'back' | 'left' | 'right';

/** The `31124:<owner>:<d>` a placement targets. Naming-agnostic: any game's document that dresses this Blobbi. */
export function blobbiTargetAddress(ownerPubkey: string, blobbiD: string): string {
  return buildAddressableEventAddress(KIND_BLOBBI_STATE, ownerPubkey, blobbiD);
}

export interface WornItem {
  address: string;
  definition: GameItemDefinition;
  entry: GameItemPlacementEntry;
}

export interface WornEquipment {
  /** Wearables, one per slot, with the entry's transform. Artwork is chosen per facing at render time. */
  wearables: readonly (WornItem & { slot: AccessorySlot })[];
  /** Visual effects, as the renderer takes them. */
  effects: readonly BlobbiVisualEffect[];
  /** Addresses currently worn (wearables and effects), for the sheet. */
  wornAddresses: ReadonlySet<string>;
}

export const NO_EQUIPMENT: WornEquipment = { wearables: [], effects: [], wornAddresses: new Set() };

export interface ResolveWornInput {
  placement: GameItemPlacement | null | undefined;
  ownerPubkey: string;
  blobbiD: string;
  stage: BlobbiStage;
  definitionsByAddress: ReadonlyMap<string, GameItemDefinition>;
  quantityByAddress: ReadonlyMap<string, number>;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function visualOf(definition: GameItemDefinition): Record<string, unknown> | null {
  return readRecord(readRecord(definition.contentJson)?.visual);
}

/** `visual.forms`, when declared: the stages that may wear it. Absent means any. */
function formsAllow(visual: Record<string, unknown> | null, stage: BlobbiStage): boolean {
  const forms = visual?.forms;
  if (forms === undefined) return true;
  if (!Array.isArray(forms) || !forms.every((f) => typeof f === 'string')) return false;
  return forms.includes(stage);
}

/** The reference frame must be absent or 2D percent; anything else is not something the renderer can place. */
function referenceOk(placement: GameItemPlacement): boolean {
  const ref = placement.reference as { space?: unknown; unit?: unknown } | undefined;
  if (!ref) return true;
  return ref.space === '2d' && ref.unit === 'percent';
}

function isOfficial(address: string): boolean {
  return address.startsWith(`31632:${OFFICIAL_ITEM_ISSUER}:`);
}

/** Every gate above, applied to one document. Pure. */
export function resolveWornEquipment({ placement, ownerPubkey, blobbiD, stage, definitionsByAddress, quantityByAddress }: ResolveWornInput): WornEquipment {
  if (!placement || placement.author !== ownerPubkey || !referenceOk(placement)) return NO_EQUIPMENT;
  const target = blobbiTargetAddress(ownerPubkey, blobbiD);
  const declared = placement.target as { type?: unknown; address?: unknown } | undefined;
  if (declared && !(declared.type === 'address' && declared.address === target)) return NO_EQUIPMENT;

  const wearables = new Map<AccessorySlot, WornItem & { slot: AccessorySlot }>();
  const effects = new Map<string, { address: string; effect: BlobbiVisualEffect }>();

  for (const entry of placement.placements) {
    if (entry.mode !== 'equip') continue;
    if (!isOfficial(entry.item)) continue;
    const definition = definitionsByAddress.get(entry.item);
    if (!definition || definition.issuer !== OFFICIAL_ITEM_ISSUER) continue;
    if ((quantityByAddress.get(entry.item) ?? 0) <= 0) continue;
    const visual = visualOf(definition);
    if (!formsAllow(visual, stage)) continue;

    if (visual?.kind === 'blobbi-effect') {
      const id = visual.effect;
      if (typeof id !== 'string' || !isBlobbiVisualEffectId(id)) continue;
      if (entry.slot !== EFFECT_SLOTS[id]) continue;
      effects.set(entry.slot, { address: entry.item, effect: { id } });
      continue;
    }

    const slot = visual?.slot;
    if (typeof slot !== 'string' || !EQUIPPABLE_SLOTS.includes(slot as AccessorySlot) || slot !== entry.slot) continue;
    if (entry.position && (entry.position as { z?: unknown }).z !== undefined) continue;
    if (entry.rotation && !(entry.rotation.type === 'euler' && entry.rotation.unit === 'degrees')) continue;
    wearables.set(slot as AccessorySlot, { address: entry.item, definition, entry, slot: slot as AccessorySlot });
  }

  const worn = new Set<string>();
  for (const w of wearables.values()) worn.add(w.address);
  for (const e of effects.values()) worn.add(e.address);
  return { wearables: [...wearables.values()], effects: [...effects.values()].map((e) => e.effect), wornAddresses: worn };
}

/** Candidate artwork for a view, in order, allow-listed; empty means "draw nothing". */
export function artworkSourcesFor(definition: GameItemDefinition, facing: Facing): string[] {
  const marked = (marker: 'front' | 'back' | 'side-left' | 'side-right') => getItemImageByMarker(definition, marker)?.url;
  const primary = definition.image ?? definition.images.find((i) => !i.marker)?.url;
  const first = definition.images[0]?.url;
  const ordered =
    facing === 'back' ? [marked('back'), primary, marked('front'), first] : facing === 'left' ? [marked('side-left'), marked('front'), primary, first] : facing === 'right' ? [marked('side-right'), marked('front'), primary, first] : [marked('front'), primary, first];
  const out: string[] = [];
  for (const url of ordered) {
    if (isSafeImageUrl(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

/** The renderer's placement input for a worn wearable, facing-aware. Defaults match Island's. */
export function toAccessoryInput(item: WornItem & { slot: AccessorySlot }, facing: Facing): AccessoryPlacementInput | null {
  const sources = artworkSourcesFor(item.definition, facing);
  if (sources.length === 0) return null;
  const { entry } = item;
  const rot = entry.rotation && entry.rotation.type === 'euler' ? (typeof entry.rotation.z === 'number' ? entry.rotation.z : 0) : 0;
  return {
    code: item.address,
    slot: item.slot,
    x: entry.position?.x ?? 50,
    y: entry.position?.y ?? 50,
    scale: entry.scale?.x ?? 1,
    rot,
    flipX: entry.flip?.x ?? false,
    url: sources[0],
  };
}
