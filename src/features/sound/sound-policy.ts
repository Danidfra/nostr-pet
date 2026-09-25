/**
 * Which sound a gameplay moment asks for. Gameplay code calls these with
 * what happened; it never names a pitch. Pure, so the mapping is the whole
 * policy and is pinned by tests.
 */
import type { BlobbiCompanion } from '@blobbi-kit/core';
import type { CareAction } from '@/features/care';
import type { ItemAction } from '@/features/inventory/item-model';
import type { PokeReaction } from '@/features/home/personality';
import type { CeremonyKind } from '@/features/lifecycle';
import type { BlobbiSoundId } from './sounds';

/** A care action or an item use landed. Falling asleep is quiet; waking is a small glad sound. */
export function soundForCare(action: CareAction | ItemAction, nextState: BlobbiCompanion['state']): BlobbiSoundId | null {
  switch (action) {
    case 'feed':
      return 'eat';
    case 'clean':
      return 'clean';
    case 'play':
    case 'boost':
      return 'excited';
    case 'medicine':
      return 'happy';
    case 'rest':
      return nextState === 'sleeping' ? 'sleepy' : 'happy';
    default:
      return null;
  }
}

/** A poke reaction, by its mood. An egg or a sleeper makes a quiet noise; a glad one a curious boop. */
export function soundForPoke(mood: PokeReaction['mood']): BlobbiSoundId | null {
  switch (mood) {
    case 'egg':
    case 'glad':
      return 'poke';
    case 'asleep':
    case 'sleepy':
      return 'sleepy';
    case 'grumpy':
    case 'annoyed':
      return 'upset';
    default:
      return null;
  }
}

/** A lifecycle moment revealed. */
export function soundForReveal(kind: CeremonyKind): BlobbiSoundId {
  return kind === 'hatch' ? 'hatch' : 'evolve';
}
