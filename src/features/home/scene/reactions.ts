/**
 * Reaction policy: which face a Blobbi makes, and for how long. This is
 * application policy over the renderer's closed expression vocabulary. The
 * renderer draws whatever emotion it is handed on a V2 face and ignores it
 * on V1 artwork, so nothing here checks the visual generation.
 */
import { getStatsNeedingAttention, type BlobbiCompanion, type BlobbiStats } from '@blobbi-kit/core';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import type { CareAction } from '@/features/care';
import type { ItemAction } from '@/features/inventory/item-model';

/** A care result or an item use: what happened, and the state after it. */
export interface CareReaction {
  action: CareAction | ItemAction;
  nextState: BlobbiCompanion['state'];
}

/** How long a care reaction stays on the face before the baseline returns. */
export const REACTION_DURATION_MS = 2_400;

/** A short, cheerful reaction to being poked. */
export const POKE_DURATION_MS = 1_200;

/**
 * The reaction to a care action that succeeded. Falling asleep gets no
 * reaction (sleeping wins over every expression anyway); waking gets a
 * small happy moment.
 */
export function reactionForCare(action: CareAction | ItemAction, nextState: BlobbiCompanion['state']): BlobbiEmotion | null {
  switch (action) {
    case 'feed':
      return 'happy';
    case 'play':
      return 'excited';
    case 'clean':
      return 'happy';
    case 'medicine':
      return 'happy';
    case 'boost':
      return 'excited';
    case 'rest':
      return nextState === 'sleeping' ? null : 'happy';
    default:
      return null;
  }
}

/**
 * The face a Blobbi wears when nothing is happening, from the kit's own
 * thresholds: restrained, so it never nags. Only a critical stat changes the
 * baseline; low energy reads as sleepy, anything else as sad.
 */
export function baselineExpression(companion: Pick<BlobbiCompanion, 'stage' | 'state'>, stats: BlobbiStats | undefined): BlobbiEmotion {
  if (companion.state !== 'active' || !stats) return 'neutral';
  const critical = getStatsNeedingAttention(companion.stage, stats).filter((s) => s.status === 'critical');
  if (critical.length === 0) return 'neutral';
  if (critical.some((s) => s.stat === 'energy') && critical.length === 1) return 'sleepy';
  return 'sad';
}
