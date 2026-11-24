import { getStatsNeedingAttention, type BlobbiCompanion, type BlobbiStats } from '@blobbi-kit/core';
import { t } from '@/i18n';

/**
 * One line about how the Blobbi is doing right now, from the kit's own
 * thresholds: the most pressing stat needing attention wins, sleep and
 * hibernation come first. Copy only; no threshold lives here.
 */
export function describeMood(companion: BlobbiCompanion, stats: BlobbiStats | undefined): string {
  if (companion.state === 'sleeping') return t('home.mood.sleeping');
  if (companion.state === 'hibernating') return t('home.mood.hibernating');
  if (companion.progressionState === 'incubating') return t('home.mood.incubating');
  if (companion.progressionState === 'evolving') return t('home.mood.evolving');
  if (!stats) return t('home.mood.here');

  const attention = getStatsNeedingAttention(companion.stage, stats);
  if (attention.length === 0) {
    return companion.stage === 'egg' ? t('home.mood.snug') : t('home.mood.great');
  }
  const worst = [...attention].sort(
    (a, b) => Number(b.status === 'critical') - Number(a.status === 'critical') || a.value - b.value,
  )[0];
  return worst.status === 'critical' ? t(`home.mood.urgent.${worst.stat}`) : t(`home.mood.need.${worst.stat}`);
}
