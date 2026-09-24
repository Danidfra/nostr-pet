/**
 * Using an item is care planning with the item's own effect and the spend
 * marker. These tests pin that the numbers come from the definition through
 * the kit's consolidation, that exactly one `blobbi_op` rides on the event,
 * that the receipt names the item and the spend, and that unmanaged tags
 * survive.
 */
import { describe, expect, it } from 'vitest';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, applyBlobbiDecay, getTagValue, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { parseGameItemAddress, parseGameItemDefinition } from '@nostr-games/inventory';
import { calculateInventoryActionXP } from '@blobbi-kit/react';
import { blobbiEvent } from '@/test/fixtures';
import { OFFICIAL_APPLE, OFFICIAL_SOAP, officialCareDefinition } from '@/test/inventory-fixtures';
import { resolveHomeItem } from './item-model';
import { INTERACTION_SPEND_MARKER, PET_OP_TAG, appliedSpendId, planItemUse } from './item-use-plan';
import { CARE_SOURCE } from '@/features/care/care-plan';

const NOW = 1_800_000_000;
const SPEND = 's'.repeat(64);

function companion(options: Parameters<typeof blobbiEvent>[1] = {}): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', createdAt: NOW - 600, extra: [['custom_host_tag', 'keep-me']], ...options }));
  if (!parsed) throw new Error('fixture must be modern');
  return parsed;
}

const apple = resolveHomeItem(OFFICIAL_APPLE, parseGameItemDefinition(officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25, hygiene: -2, energy: 5 }), { mode: 'permissive' }));
const soap = resolveHomeItem(OFFICIAL_SOAP, parseGameItemDefinition(officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'] }), { mode: 'permissive' }));

describe('planItemUse', () => {
  it('applies the definition effects on top of the kit decay, through the kit consolidation', () => {
    const c = companion({ set: { hunger: '40', hygiene: '50', energy: '60' } });
    const plan = planItemUse(c, apple, SPEND, NOW);
    const decayed = applyBlobbiDecay({ stage: c.stage, state: c.state, stats: c.stats, lastDecayAt: c.lastDecayAt, now: NOW });
    expect(plan.event.kind).toBe(KIND_BLOBBI_STATE);
    expect(Number(getTagValue(plan.event.tags, 'hunger'))).toBe(decayed.stats.hunger + 25);
    expect(Number(getTagValue(plan.event.tags, 'hygiene'))).toBe(decayed.stats.hygiene - 2);
    expect(Number(getTagValue(plan.event.tags, 'energy'))).toBe(decayed.stats.energy + 5);
    expect(plan.statsChanged).toEqual({ hunger: 25, hygiene: -2, energy: 5 });
    expect(plan.xpGained).toBe(calculateInventoryActionXP('feed', 1));
  });

  it('clamps at the kit maximum', () => {
    const plan = planItemUse(companion({ set: { hunger: '95' } }), apple, SPEND, NOW);
    expect(Number(getTagValue(plan.event.tags, 'hunger'))).toBe(100);
  });

  it('puts exactly one blobbi_op on the event, replacing an older one, and keeps unmanaged tags', () => {
    const c = companion({ extra: [[PET_OP_TAG, 'o'.repeat(64)], ['custom_host_tag', 'keep-me']] });
    expect(appliedSpendId(c.allTags)).toBe('o'.repeat(64));
    const plan = planItemUse(c, apple, SPEND, NOW);
    const markers = plan.event.tags.filter(([n]) => n === PET_OP_TAG);
    expect(markers).toEqual([[PET_OP_TAG, SPEND]]);
    expect(appliedSpendId(plan.event.tags)).toBe(SPEND);
    expect(getTagValue(plan.event.tags, 'custom_host_tag')).toBe('keep-me');
    expect(plan.event.prev).toBe(c.event);
  });

  it('the receipt is a kind 1124 naming the item by full address, the source, and the spend', () => {
    const c = companion();
    const plan = planItemUse(c, apple, SPEND, NOW);
    expect(plan.interaction.kind).toBe(KIND_BLOBBI_INTERACTION);
    expect(getTagValue(plan.interaction.tags, 'action')).toBe('feed');
    expect(getTagValue(plan.interaction.tags, 'source')).toBe(CARE_SOURCE);
    expect(getTagValue(plan.interaction.tags, 'item')).toBe(OFFICIAL_APPLE);
    expect(parseGameItemAddress(getTagValue(plan.interaction.tags, 'item')!)?.itemId).toBe('blobbi:food:apple');
    expect(plan.interaction.tags).toContainEqual(['e', SPEND, '', INTERACTION_SPEND_MARKER]);
  });

  it('a clean item on an egg maps to the clean interaction and its own effect', () => {
    const c = companion({ stage: 'egg', set: { hygiene: '30' } });
    const plan = planItemUse(c, soap, SPEND, NOW);
    expect(getTagValue(plan.interaction.tags, 'action')).toBe('clean');
    expect(plan.statsChanged.hygiene).toBe(25);
  });

  it('refuses an item without a care action', () => {
    const coin = resolveHomeItem(OFFICIAL_APPLE, undefined);
    expect(() => planItemUse(companion(), coin, SPEND, NOW)).toThrow(/cannot be used/);
  });
});
