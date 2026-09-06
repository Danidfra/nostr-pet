import type { BlobbiStats } from '@blobbi-kit/core';
import type { CareResult } from '@/features/care';

export const STAT_WORD: Record<keyof BlobbiStats, string> = {
  hunger: 'food',
  happiness: 'joy',
  hygiene: 'clean',
  energy: 'energy',
  health: 'health',
};

/** What a care result did, as words, for the live region. */
export function describeCareResult(result: CareResult): string {
  if (result.action === 'rest') {
    return result.nextState === 'sleeping' ? `${result.name} is resting now.` : `${result.name} woke up.`;
  }
  const verbs = { feed: 'Fed', play: 'Played with', clean: 'Cleaned' } as const;
  const changes = Object.entries(result.statsChanged)
    .map(([stat, delta]) => `${delta > 0 ? '+' : ''}${delta} ${STAT_WORD[stat as keyof BlobbiStats]}`)
    .join(', ');
  const xp = result.xpGained > 0 ? `+${result.xpGained} XP` : '';
  return [`${verbs[result.action]} ${result.name}.`, changes, xp].filter(Boolean).join(' ');
}

