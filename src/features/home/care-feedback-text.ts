import type { BlobbiState, BlobbiStats } from '@blobbi-kit/core';
import type { CareAction } from '@/features/care';
import type { ItemAction } from '@/features/inventory/item-model';

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

export const STAT_WORD: Record<keyof BlobbiStats, string> = {
  hunger: 'food',
  happiness: 'joy',
  hygiene: 'clean',
  energy: 'energy',
  health: 'health',
};

/** What a care result did, as words, for the live region. */
export function describeCareResult(result: FeedbackResult): string {
  if (result.action === 'rest') {
    return result.nextState === 'sleeping' ? `${result.name} is resting now.` : `${result.name} woke up.`;
  }
  const verbs: Record<Exclude<FeedbackResult['action'], 'rest'>, string> = { feed: 'Fed', play: 'Played with', clean: 'Cleaned', medicine: 'Treated', boost: 'Boosted' };
  const changes = Object.entries(result.statsChanged)
    .map(([stat, delta]) => `${delta > 0 ? '+' : ''}${delta} ${STAT_WORD[stat as keyof BlobbiStats]}`)
    .join(', ');
  const xp = result.xpGained > 0 ? `+${result.xpGained} XP` : '';
  const what = result.itemName ? `${verbs[result.action]} ${result.name} with ${result.itemName}.` : `${verbs[result.action]} ${result.name}.`;
  return [what, changes, xp].filter(Boolean).join(' ');
}

