import type { BlobbiState, BlobbiStats } from '@blobbi-kit/core';
import type { CareAction } from '@/features/care';
import type { ItemAction } from '@/features/inventory/item-model';
import { t } from '@/i18n';
import { statWord } from './labels';

/** What the feedback layer needs from a care result or an item use. */
export interface FeedbackResult {
  action: CareAction | ItemAction;
  name: string;
  statsChanged: Partial<BlobbiStats>;
  xpGained: number;
  nextState: BlobbiState;
  /** The item used, when one was. */
  itemName?: string;
}

/** What a care result did, as words, for the live region. */
export function describeCareResult(result: FeedbackResult): string {
  const { name, itemName } = result;
  if (result.action === 'rest') {
    return result.nextState === 'sleeping' ? t('home.feedback.resting', { name }) : t('home.feedback.wokeUp', { name });
  }
  const changes = Object.entries(result.statsChanged)
    .map(([stat, delta]) => t('home.feedback.change', { delta: `${delta > 0 ? '+' : ''}${delta}`, stat: statWord(stat as keyof BlobbiStats) }))
    .join(', ');
  const xp = result.xpGained > 0 ? t('home.feedback.xp', { xp: result.xpGained }) : '';
  const what = itemName ? t(`home.feedback.didWith.${result.action}`, { name, item: itemName }) : t(`home.feedback.did.${result.action}`, { name });
  return [what, changes, xp].filter(Boolean).join(' ');
}
