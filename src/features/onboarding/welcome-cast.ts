/**
 * The Blobbis on the welcome screen: an egg, a baby and an adult, drawn by
 * the canonical renderer from the same egg template adoption uses
 * (`eggTemplate`, V3), so what a visitor sees first is what a Blobbi really
 * looks like, not an illustration.
 *
 * They are pictures and nothing else. The owners below are fixed, made-up
 * public keys with no secret behind them; the events are built in memory,
 * never signed, never published, never stored, and never offered to the
 * login store or the collection. A visitor's own Blobbi is made later, from
 * their own key, by adoption.
 */
import { deriveBlobbiV3Seed, getCanonicalBlobbiD, parseModernBlobbiEvent, updateBlobbiTags, type BlobbiCompanion, type NostrEvent } from '@blobbi-kit/core';
import { eggTemplate } from '@/features/adoption/adoption-plan';

/** When the cast was "born": fixed, so the cast never changes between visits. */
const CAST_BORN_AT = 1_780_000_000;

/** Made-up owners (no secret key is known for any of them) and pet ids, picked so the three are three different colours. */
const CAST = [
  { owner: '01b10bb101b10bb101b10bb101b10bb101b10bb101b10bb101b10bb101b10bb1', petId: 'a177777777', stage: 'baby', name: 'Pip' },
  { owner: '14b10bb114b10bb114b10bb114b10bb114b10bb114b10bb114b10bb114b10bb1', petId: 'a147777777', stage: 'egg', name: 'Egg' },
  { owner: '0db10bb10db10bb10db10bb10db10bb10db10bb10db10bb10db10bb10db10bb1', petId: 'ad77777777', stage: 'adult', name: 'Mochi' },
] as const;

export type CastStage = 'egg' | 'baby' | 'adult';

function castMember(owner: string, petId: string, stage: CastStage, name: string): BlobbiCompanion | null {
  const d = getCanonicalBlobbiD(owner, petId);
  const template = eggTemplate({ petId, d, createdAt: CAST_BORN_AT, seed: deriveBlobbiV3Seed(owner, d), name, ownerPubkey: owner });
  const tags = stage === 'egg' ? template.tags : updateBlobbiTags(template.tags, { stage, state: 'active', progression_state: 'none' });
  const event: NostrEvent = { ...template, tags, id: '0'.repeat(64), pubkey: owner, sig: '0'.repeat(128) };
  return parseModernBlobbiEvent(event) ?? null;
}

let cast: BlobbiCompanion[] | null = null;

/** The welcome's three Blobbis, built once. */
export function welcomeCast(): readonly BlobbiCompanion[] {
  if (!cast) cast = CAST.map((c) => castMember(c.owner, c.petId, c.stage, c.name)).filter((c): c is BlobbiCompanion => c !== null);
  return cast;
}
