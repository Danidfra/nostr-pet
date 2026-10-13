import { describe, expect, it } from 'vitest';
import { getStatStatus, getTagValue, updateBlobbiTags, STAT_MAX, STAT_MIN } from '@blobbi-kit/core';
import { eggTemplate, newEggPreview } from '@/features/adoption/adoption-plan';
import { NEWBORN_STATS, withNewbornStats } from './newborn';

const PUBKEY = 'a'.repeat(64);
const egg = eggTemplate(newEggPreview(PUBKEY, 'Pip', 1_700_000_000));
const hatched = { ...egg, tags: updateBlobbiTags(egg.tags, { stage: 'baby', state: 'active', hunger: '100', happiness: '100', health: '100', hygiene: '100', energy: '100' }) };

describe("a newborn's first needs", () => {
  it('are healthy but not full: within the schema, above every baby warning line, health whole', () => {
    for (const [stat, value] of Object.entries(NEWBORN_STATS)) {
      expect(value).toBeGreaterThanOrEqual(STAT_MIN);
      expect(value).toBeLessThanOrEqual(STAT_MAX);
      expect(getStatStatus('baby', stat as keyof typeof NEWBORN_STATS, value)).toBe('normal');
    }
    expect(NEWBORN_STATS.health).toBe(STAT_MAX);
    for (const stat of ['hunger', 'happiness', 'hygiene', 'energy'] as const) {
      expect(NEWBORN_STATS[stat]).toBeGreaterThanOrEqual(75);
      expect(NEWBORN_STATS[stat]).toBeLessThanOrEqual(90);
    }
  });

  it('replace the full stats on a hatch template and nothing else; an egg template is left alone', () => {
    const out = withNewbornStats(hatched);
    expect(getTagValue(out.tags, 'hunger')).toBe(String(NEWBORN_STATS.hunger));
    expect(getTagValue(out.tags, 'energy')).toBe(String(NEWBORN_STATS.energy));
    expect(getTagValue(out.tags, 'health')).toBe('100');
    expect(getTagValue(out.tags, 'stage')).toBe('baby');
    expect(getTagValue(out.tags, 'd')).toBe(getTagValue(hatched.tags, 'd'));
    expect(getTagValue(out.tags, 'care_streak')).toBe(getTagValue(hatched.tags, 'care_streak'));
    // The same tags, in name: nothing added, nothing dropped
    expect(out.tags.map((t) => t[0]).sort()).toEqual(hatched.tags.map((t) => t[0]).sort());
    expect(withNewbornStats(egg)).toBe(egg);
  });
});
