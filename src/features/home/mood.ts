import { getStatsNeedingAttention, type BlobbiCompanion, type BlobbiStats } from '@blobbi-kit/core';

/**
 * One line about how the Blobbi is doing right now, from the kit's own
 * thresholds: the most pressing stat needing attention wins, sleep and
 * hibernation come first. Copy only; no threshold lives here.
 */
const NEEDS: Record<keyof BlobbiStats, string> = {
  hunger: 'is getting hungry',
  happiness: 'could use some fun',
  hygiene: 'needs a bath',
  energy: 'is running low on energy',
  health: "isn't feeling well",
};

const URGENT: Record<keyof BlobbiStats, string> = {
  hunger: 'is very hungry',
  happiness: 'is feeling down',
  hygiene: 'really needs a bath',
  energy: 'is exhausted',
  health: 'is feeling sick',
};

export function describeMood(companion: BlobbiCompanion, stats: BlobbiStats | undefined): string {
  if (companion.state === 'sleeping') return 'is sleeping soundly';
  if (companion.state === 'hibernating') return 'is hibernating';
  if (companion.progressionState === 'incubating') return 'is warm and incubating';
  if (companion.progressionState === 'evolving') return 'is evolving';
  if (!stats) return 'is here';

  const attention = getStatsNeedingAttention(companion.stage, stats);
  if (attention.length === 0) {
    return companion.stage === 'egg' ? 'is snug in its shell' : 'is doing great';
  }
  const worst = [...attention].sort(
    (a, b) => Number(b.status === 'critical') - Number(a.status === 'critical') || a.value - b.value,
  )[0];
  return worst.status === 'critical' ? URGENT[worst.stat] : NEEDS[worst.stat];
}
