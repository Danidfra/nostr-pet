/**
 * The Blobbi's 3D model in the room, when the player has chosen to see it.
 *
 * One Blobbi, two drawings: the model is built from the same canonical
 * identity the kit's 2D drawing comes from (`genomeOf`, pinned path for
 * path against the kit), for the stage the Blobbi is at, and handed to the
 * room's one scene in the 2D drawing's place. The room's walk, facing and
 * care are the same either way; only this changes.
 *
 * Built the first time 3D is wanted, then KEPT while the player flips back
 * to 2D (flipping again is instant, with no rebuild and no new shaders),
 * and disposed when the Blobbi it was built for changes (another identity,
 * or a stage reached). The key is the genome itself, so a Blobbi whose care
 * state changes (a new event, the same identity) keeps its model.
 */
import { useEffect, useMemo, useState } from 'react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import { buildBlobbiModel } from '../lib/blobbi3d/model';
import { createBlobbiActor, type ActorModel } from '../lib/blobbi3d/actor';
import { genomeOf, morphologyOf, stage3dOf } from '../lib/blobbi3d/identity';
import { prefersReducedMotion } from '../lib/blobbi3d/stage';
import { walkCycleSecondsFor } from '../lib/room-pace';

export interface RoomActorModel {
  /** The model to stand in the room, or null to draw the 2D Blobbi. */
  model: ActorModel | null;
  /** Why this Blobbi has no 3D model (the room draws it in 2D whatever is chosen); null when it has one. */
  unavailable3d: string | null;
}

/** Why a Blobbi has no 3D model, or null when it has one. */
export function unavailable3dReason(blobbi: Pick<BlobbiCompanion, 'stage' | 'visualGeneration'>, hasGenome: boolean): string | null {
  if (blobbi.stage === 'egg') return 'An egg is always drawn in 2D. 3D comes once it hatches.';
  if (blobbi.visualGeneration !== 'v3' || !hasGenome) return 'The 3D model is only for the newest Blobbi art (V3).';
  return null;
}

export function useRoomActorModel(blobbi: BlobbiCompanion, appearance: BlobbiAppearance): RoomActorModel {
  const stage = stage3dOf(blobbi.stage);
  const genome = useMemo(() => genomeOf(toBlobbiVisual(blobbi)), [blobbi]);
  // The identity as a value: the same Blobbi in a newer event keeps its model
  const key = genome && stage ? `${stage}|${JSON.stringify(genome)}` : null;
  const unavailable3d = unavailable3dReason(blobbi, genome !== null);
  const wanted = appearance === '3d' && key !== null;

  // Built on first wanting it, kept afterwards (for this key)
  const [builtFor, setBuiltFor] = useState<string | null>(() => (wanted ? key : null));
  useEffect(() => {
    if (wanted && builtFor !== key) setBuiltFor(key);
  }, [wanted, key, builtFor]);
  const buildKey = wanted ? key : builtFor === key ? key : null;

  const actor = useMemo(() => {
    if (!buildKey || !genome || !stage) return null;
    return createBlobbiActor(buildBlobbiModel(morphologyOf(genome, stage), genome.seed), { walkCycle: walkCycleSecondsFor('v3', stage), reducedMotion: prefersReducedMotion });
    // The key carries genome and stage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey]);
  useEffect(() => () => actor?.dispose(), [actor]);

  return { model: wanted ? actor : null, unavailable3d };
}
