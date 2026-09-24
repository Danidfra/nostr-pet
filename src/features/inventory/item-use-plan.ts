/**
 * What using an item changes on the Blobbi, composed from kit primitives.
 *
 * The shape is `planCareInteraction` (care-plan.ts) with two differences:
 *
 *  - the interaction carries the item (`itemId` = the full 31632 address),
 *    and the kit's consolidation is given a resolver that answers with the
 *    definition's effects, so the item's numbers are applied by the SAME code
 *    that applies any other host's item interaction;
 *  - the republish carries `['blobbi_op', <spend id>]`: the idempotency
 *    marker Island introduced, so a retry can see the effect already landed
 *    and never apply it twice. Exactly one marker rides on the event (the
 *    previous one is dropped); the kit keeps it as an unmanaged tag.
 *
 * XP comes from the kit's inventory-action table, so an apple gives what an
 * apple gives everywhere.
 */
import {
  KIND_BLOBBI_INTERACTION,
  KIND_BLOBBI_STATE,
  INTERNAL_TO_INTERACTION_ACTION,
  applyBlobbiDecay,
  buildInteractionEventTemplate,
  consolidateSocialInteractions,
  parseInteractionEvent,
  serializeEvolutionContent,
  statsToTagUpdates,
  updateBlobbiTags,
  type BlobbiCompanion,
  type BlobbiStats,
  type InteractionEventParams,
  type Mission,
  type NostrEvent,
} from '@blobbi-kit/core';
import { applyXPGain, calculateInventoryActionXP, getStreakTagUpdates, type PublishEventTemplate } from '@blobbi-kit/react';
import { CARE_SOURCE } from '@/features/care/care-plan';
import type { HomeItem } from './item-model';

/** The idempotency marker tag on a kind 31124 written for a spend. */
export const PET_OP_TAG = 'blobbi_op';

/** The marker on the kind 1124 receipt's `e` tag pointing at the spend. */
export const INTERACTION_SPEND_MARKER = 'inventory-spend';

export interface ItemUsePlan {
  event: PublishEventTemplate & { tags: string[][]; content: string; prev: NostrEvent };
  /** The kind 1124 receipt, with the spend referenced. */
  interaction: PublishEventTemplate & { tags: string[][] };
  statsChanged: Partial<BlobbiStats>;
  xpGained: number;
}

export interface ItemUsePlanOptions {
  evolution?: Mission[];
}

/** The `blobbi_op` value on a companion's event, if any. */
export function appliedSpendId(tags: readonly string[][]): string | undefined {
  return tags.find(([name]) => name === PET_OP_TAG)?.[1];
}

export function planItemUse(companion: BlobbiCompanion, item: HomeItem, spendId: string, now: number, options: ItemUsePlanOptions = {}): ItemUsePlan {
  if (!item.care) throw new Error(`${item.name} cannot be used on a Blobbi.`);
  const interactionAction = INTERNAL_TO_INTERACTION_ACTION[item.care.action];
  if (!interactionAction) throw new Error(`No interaction for ${item.care.action}`);

  const params: InteractionEventParams = {
    ownerPubkey: companion.event.pubkey,
    blobbiDTag: companion.d,
    action: interactionAction,
    source: CARE_SOURCE,
    itemId: item.address,
  };
  const template = buildInteractionEventTemplate(params);
  const parsed = parseInteractionEvent({ ...template, kind: KIND_BLOBBI_INTERACTION, id: '', sig: '', pubkey: companion.event.pubkey, created_at: now });
  if (!parsed) throw new Error('The kit refused this interaction');

  const decayed = applyBlobbiDecay({ stage: companion.stage, state: companion.state, stats: companion.stats, lastDecayAt: companion.lastDecayAt, now });
  const effects = item.care.effects;
  const { stats } = consolidateSocialInteractions(decayed.stats, [parsed], undefined, (itemId) => (itemId === item.address ? effects : undefined));

  const xpGained = calculateInventoryActionXP(item.care.action, 1);
  const experience = applyXPGain(companion.experience, xpGained);
  const streak = getStreakTagUpdates(companion, new Date(now * 1000)) ?? {};

  const withoutOldMarker = companion.allTags.filter(([name]) => name !== PET_OP_TAG);
  const tags = [...updateBlobbiTags(withoutOldMarker, { ...statsToTagUpdates(stats, now), experience: String(experience), ...streak }), [PET_OP_TAG, spendId]];

  const content = options.evolution ? serializeEvolutionContent(companion.event.content, options.evolution) : companion.event.content;

  return {
    event: { kind: KIND_BLOBBI_STATE, content, tags, prev: companion.event },
    interaction: { ...template, tags: [...template.tags, ['e', spendId, '', INTERACTION_SPEND_MARKER]] },
    statsChanged: diffStats(decayed.stats, stats),
    xpGained,
  };
}

function diffStats(before: BlobbiStats, after: BlobbiStats): Partial<BlobbiStats> {
  const out: Partial<BlobbiStats> = {};
  for (const key of Object.keys(after) as (keyof BlobbiStats)[]) {
    const delta = after[key] - before[key];
    if (delta !== 0) out[key] = delta;
  }
  return out;
}
