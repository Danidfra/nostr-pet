/**
 * Adopting a first egg: the two events, planned from kit primitives.
 *
 * The canonical path is what Ditto and Island already do, in the order
 * Island chose (the egg first, then exactly one profile write, so a profile
 * never names a Blobbi that does not exist):
 *
 *   kind 31124   `buildEggTags(pubkey, petId, createdAt, name)`: the canonical
 *                `d` (`blobbi-<pubkey12>-<petId10>`), the seed derived from
 *                (pubkey, d, createdAt), the visual traits mirrored from it,
 *                default egg stats. The egg starts INCUBATING at once, as in
 *                Ditto: `progression_state`, `progression_started_at`, and
 *                the kit's hatch missions in the content, so the home's
 *                lifecycle panel has something to show on the first screen.
 *                `created_at` is pinned to the preview's `createdAt`: the seed
 *                depends on it, and a preview is the source of truth.
 *   kind 11125   created with `buildBlobbonautTags` + a name when the player
 *                has none; otherwise the FRESH profile's full tag list through
 *                `updateBlobbonautTags` (unknown tags, `xp`, onboarding flags
 *                and the content all survive), `has` merged with
 *                `mergeHasForAdoption`, `current_companion` set.
 *
 * A Blobbi adopted HERE is born V3 (`ADOPTION_VISUAL_GENERATION`): the kit's
 * own creation default is still V2, and V3 is opt-in per application. A V3
 * Blobbi IS its address: its seed is derived from (owner, d) by the kit,
 * and its colours, anatomy, pattern, mark, belly and freckles are
 * Algorithm 1's function of that seed (V3 is Algorithm 1). The egg states
 * none of it, only `visual_generation`, so the preview (same owner,
 * same d) is the published egg and every later stage of it, and no later
 * event can repaint or reshape it. Existing Blobbis are untouched: nothing
 * here rewrites one.
 *
 * Nothing here signs or sends; `useAdoptEgg` does, after a fresh ownership
 * check, so a second "first" Blobbi is never minted.
 */
import {
  KIND_BLOBBI_STATE,
  KIND_BLOBBONAUT_PROFILE,
  buildBlobbonautTags,
  buildEggTags,
  deriveBlobbiSeedV1,
  deriveBlobbiV3Seed,
  generatePetId10,
  getCanonicalBlobbiD,
  mergeHasForAdoption,
  parseModernBlobbiEvent,
  serializeEvolutionContent,
  updateBlobbiTags,
  updateBlobbonautTags,
  type BlobbiCompanion,
  type BlobbiVisualGeneration,
  type BlobbonautProfile,
  type BuildEggTagsOptions,
  type NostrEvent,
} from '@blobbi-kit/core';
import { createHatchMissions, type PublishEventTemplate } from '@blobbi-kit/react';

/**
 * THE CREATION RULE OF THIS APP: which visual generation a Blobbi adopted
 * here is born into. One constant, read in one place (`eggTemplate`).
 *
 * `'v3'` is the procedural generation, and the development default of this
 * branch. Whether production adoption mints V3 is still to be decided: every
 * client that republishes a V3 Blobbi must understand it first (one that
 * does not rewrites its three colour tags from the seed). Setting this back
 * to `'v2'` restores the previous birth exactly; it never affects a Blobbi
 * that already exists.
 */
export const ADOPTION_VISUAL_GENERATION: BlobbiVisualGeneration = 'v3';

/** What `buildEggTags` is asked for: the generation. A V3 egg needs nothing else; its address is its identity. */
export function adoptionEggOptions(generation: BlobbiVisualGeneration = ADOPTION_VISUAL_GENERATION): BuildEggTagsOptions {
  return { visualGeneration: generation };
}

/** The name the egg carries until the player picks one. */
export const DEFAULT_EGG_NAME = 'Egg';
export const NAME_MAX_LENGTH = 24;

/** A name a Blobbi may carry: trimmed, printable, short. Empty means the default. */
export function normalizeBlobbiName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: true, name: DEFAULT_EGG_NAME };
  if (name.length > NAME_MAX_LENGTH) return { ok: false, reason: `Keep it under ${NAME_MAX_LENGTH} characters.` };
  return { ok: true, name };
}

export interface EggPreview {
  petId: string;
  d: string;
  createdAt: number;
  seed: string;
  name: string;
  ownerPubkey: string;
}

/**
 * A fresh identity. Called once per adoption attempt; never regenerated between preview and publish.
 * The seed is the one the egg will have: on V3 its address (author, d), on V1 and V2 the stated
 * seed, which also hashes the birth time.
 */
export function newEggPreview(ownerPubkey: string, name: string = DEFAULT_EGG_NAME, now: number = Math.floor(Date.now() / 1000)): EggPreview {
  const petId = generatePetId10();
  const d = getCanonicalBlobbiD(ownerPubkey, petId);
  const seed = ADOPTION_VISUAL_GENERATION === 'v3' ? deriveBlobbiV3Seed(ownerPubkey, d) : deriveBlobbiSeedV1(ownerPubkey, d, now);
  return { petId, d, createdAt: now, seed, name, ownerPubkey };
}

export function renamePreview(preview: EggPreview, name: string): EggPreview {
  return { ...preview, name };
}

/** The kind 31124 for a preview: the kit's egg, incubating, with the hatch missions. */
export function eggTemplate(preview: EggPreview): PublishEventTemplate & { tags: string[][]; content: string; created_at: number } {
  const base = buildEggTags(preview.ownerPubkey, preview.petId, preview.createdAt, preview.name, adoptionEggOptions());
  const tags = updateBlobbiTags(base, { progression_state: 'incubating', progression_started_at: String(preview.createdAt) });
  const content = serializeEvolutionContent('', createHatchMissions());
  return { kind: KIND_BLOBBI_STATE, tags, content, created_at: preview.createdAt };
}

/** The preview as a companion, for the renderer and the copy. Same parser as the real thing. */
export function previewCompanion(preview: EggPreview): BlobbiCompanion | null {
  const template = eggTemplate(preview);
  const event: NostrEvent = { ...template, id: '0'.repeat(64), pubkey: preview.ownerPubkey, sig: '0'.repeat(128) };
  return parseModernBlobbiEvent(event) ?? null;
}

export interface ProfilePlanInput {
  ownerPubkey: string;
  /** The FRESH profile, or null when the player has none. */
  profile: BlobbonautProfile | null;
  /** The egg's `d`. */
  d: string;
  /** For a new profile: the player's name from their kind 0, or a default. */
  suggestedName: string;
}

/** The one kind 11125 write. */
export function profileTemplate({ ownerPubkey, profile, d, suggestedName, now }: ProfilePlanInput & { now?: number }): PublishEventTemplate & { tags: string[][]; content: string } {
  if (!profile) {
    const tags = updateBlobbonautTags([...buildBlobbonautTags(ownerPubkey), ['name', suggestedName]], { has: [d], current_companion: d });
    return { kind: KIND_BLOBBONAUT_PROFILE, tags, content: '' };
  }
  const has = mergeHasForAdoption(profile.has, profile.has, d);
  const withoutCurrent = profile.allTags.filter(([name]) => name !== 'current_companion');
  const tags = updateBlobbonautTags(withoutCurrent, { has, current_companion: d });
  // After the profile it replaces, even when this device's clock is behind (an older one would lose on every relay)
  const created_at = now !== undefined ? Math.max(now, profile.event.created_at + 1) : undefined;
  return { kind: KIND_BLOBBONAUT_PROFILE, tags, content: profile.content, prev: profile.event, ...(created_at !== undefined ? { created_at } : {}) };
}

/** A lenient "already owns a Blobbi" read: any 31124 with a `d` and a stage counts, namespace or not. */
export function isOwnedBlobbiEvent(event: NostrEvent): boolean {
  if (event.kind !== KIND_BLOBBI_STATE) return false;
  const d = event.tags.find(([n]) => n === 'd')?.[1];
  const stage = event.tags.find(([n]) => n === 'stage')?.[1];
  return !!d && (stage === 'egg' || stage === 'baby' || stage === 'adult');
}
