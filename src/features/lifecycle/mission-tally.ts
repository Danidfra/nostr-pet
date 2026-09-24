/**
 * The "care for your Blobbi N times" mission tally.
 *
 * The canonical hatch and evolve missions count interactions in the kind
 * 31124 content (`evolution[].count`), and the kit keeps a per-Blobbi session
 * store of that array. Nothing in the kit increments the tally on a care
 * action; the host does, exactly as Ditto does, and serializes the store
 * into the SAME republish the care action already makes. One publish per
 * action, no background persistence.
 */
import type { BlobbiCompanion, Mission } from '@blobbi-kit/core';
import { hydrateEvolutionFromPersisted, readEvolutionFromStorage, trackEvolutionMissionTally } from '@blobbi-kit/react';

export const INTERACTIONS_MISSION_ID = 'interactions';

/**
 * Count one care interaction towards the active hatch or evolve missions
 * and return the missions to write into the content. `undefined` when the
 * Blobbi is not in a progression, so the caller leaves the content alone.
 *
 * Hydrates the session store from the fresh event first (a no-op when the
 * store already has this Blobbi), so a care action on a freshly loaded page
 * counts from the persisted number, never from zero.
 */
export function tallyCareInteraction(companion: BlobbiCompanion, pubkey: string): Mission[] | undefined {
  if (companion.progressionState === 'none') return undefined;
  hydrateEvolutionFromPersisted(companion.evolution, pubkey, companion.d);
  trackEvolutionMissionTally(INTERACTIONS_MISSION_ID, 1, pubkey, companion.d);
  return readEvolutionFromStorage(pubkey, companion.d) ?? companion.evolution;
}
