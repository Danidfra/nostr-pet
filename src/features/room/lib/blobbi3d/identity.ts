/**
 * Which 3D Blobbi a Blobbi is: the same mapping the 2D drawing uses.
 *
 * The kit resolves a V3 Blobbi's identity (its seed, derived from the
 * address `(pubkey, d)` in core; its explicit colours and trait kinds) into a
 * genome, and the genome into a morphology for a life stage. The 3D model is
 * built from that morphology and nothing else, so the same Blobbi is the
 * same model, in 2D and in 3D, on every machine. Nothing here rolls dice.
 */
import { normalizeBlobbiV3Visual, type BlobbiVisual } from '@blobbi-kit/renderer';
import { deriveMorphology, generateGenome, type BlobbiGenome, type BlobbiMorphology } from '@blobbi-kit/renderer/procedural';
import { buildEggTags, parseBlobbiEvent, KIND_BLOBBI_STATE, type BlobbiCompanion, type NostrEvent } from '@blobbi-kit/core';

/** The life stages the 3D prototype draws. An egg stays the kit's 2D shell. */
export type Blobbi3dStage = 'baby' | 'adult';

export function stage3dOf(stage: string | undefined): Blobbi3dStage | null {
  return stage === 'baby' || stage === 'adult' ? stage : null;
}

/**
 * The genome the kit draws this visual from, or null for a V1/V2 Blobbi
 * (those stay 2D) or a V3 one without an identity. The identity is resolved
 * by the kit (`normalizeBlobbiV3Visual`: the seed, and the colours and trait
 * kinds the event states or the seed implies); the genome is generated from
 * it the way the kit's own `blobbiV3Genome` does (the colours, each trait
 * kind, the special mark as `mark`), which `identity.test.ts` pins against
 * the kit's drawing path for path.
 */
export function genomeOf(visual: BlobbiVisual): BlobbiGenome | null {
  if (visual.visualGeneration !== 'v3') return null;
  const identity = normalizeBlobbiV3Visual(visual.v3);
  if (!identity) return null;
  const { specialMark, ...traits } = identity.traits;
  return generateGenome({ seed: identity.seed, colors: { ...identity.colors }, ...traits, mark: specialMark });
}

export function morphologyOf(genome: BlobbiGenome, stage: Blobbi3dStage): BlobbiMorphology {
  return deriveMorphology(genome, stage);
}

/**
 * A Blobbi as its canonical state event would state it, for the lab's fixed
 * identities: the kit's own egg tags for the address (so the seed is the one
 * core derives from `(pubkey, d)`), parsed by the kit's own parser. Never
 * published; it exists only in memory.
 */
export function labBlobbi(pubkey: string, petId: string, name: string, stage: Blobbi3dStage, createdAt = 1_757_000_000): BlobbiCompanion {
  const tags = buildEggTags(pubkey, petId, createdAt, name, { visualGeneration: 'v3' }).map((t) => (t[0] === 'stage' ? ['stage', stage] : t[0] === 'state' ? ['state', 'active'] : t));
  const event: NostrEvent = { id: petId.padEnd(64, '0'), pubkey, created_at: createdAt, kind: KIND_BLOBBI_STATE, tags, content: '', sig: '0'.repeat(128) };
  const blobbi = parseBlobbiEvent(event);
  if (!blobbi) throw new Error('The lab Blobbi did not parse');
  return blobbi;
}
