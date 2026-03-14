/**
 * BLOBBI STATE BUILDER - Clean, deterministic tag generation for kind 31124 events
 *
 * @deprecated Consider using the canonical pipeline instead:
 * - `mergeBlobbiState()` from '@/lib/blobbi-canonical-pipeline'
 * - Provides safer merge logic with type checking
 * - Automatically handles timestamp normalization
 * - Built-in stage filtering
 * 
 * This file is kept for specific cases where building from scratch is needed,
 * but most state updates should use mergeBlobbiState() instead.
 *
 * REFACTORED TO PREVENT INFINITE LOOPS:
 * - No merge logic (always build from scratch)
 * - Source tracking to prevent cascading
 * - Explicit sleep tag removal
 * - Guard against reprocessing
 */

import { Blobbi } from '@/types/blobbi';
import { ensureBlobbiTagsWithDebug } from './blobbi-tags';

/**
 * MANAGED_BLOBBI_STATE_TAG_NAMES - per blobbi-event-spec.md
 * 
 * These are tags that the 31124 event creators explicitly manage/generate.
 * Any tag NOT in this set should be preserved from previous events
 * for forward compatibility with future spec versions.
 * 
 * IMPORTANT: This set must be kept in sync between:
 * - buildBlobbiStateTags() in this file
 * - createBlobbiStateEvent() in blobbi-events.ts
 */
export const MANAGED_BLOBBI_STATE_TAG_NAMES = new Set([
  // Identity (added by ensureBlobbiTagsWithDebug)
  'd', 'b', 't', 'client',
  
  // Core state
  'name', 'stage', 'state', 'seed',
  
  // Progression
  'visible_to_others', 'generation', 'breeding_ready',
  'experience', 'care_streak',
  
  // Stats
  'hunger', 'happiness', 'health', 'hygiene', 'energy',
  
  // Timestamps
  'last_interaction',
  // Action timestamps (written by createBlobbiStateEvent)
  'last_meal', 'last_clean', 'last_warm', 'last_talk', 
  'last_check', 'last_sing', 'last_medicine',
  
  // Egg-specific
  'incubation_time', 'start_incubation', 'incubation_progress',
  'egg_temperature', 'egg_status', 'shell_integrity',
  
  // Sleep state
  'is_sleeping', 'sleep_started_at', 'last_sleep_update',
  
  // Status effects
  'is_dirty', 'has_buff', 'has_debuff',
  
  // Visual traits (legacy compatibility)
  'base_color', 'secondary_color', 'eye_color', 'pattern', 'special_mark', 'size',
  
  // Personality & traits
  'personality', 'trait', 'mood', 'favorite_food', 'voice_type', 'title', 'skill',
  
  // Evolution
  'adult_type', 'evolution_time', 'start_evolution', 'hatch_time',
  
  // Divine/Theme
  'theme', 'crossover_app', 'manifestation', 'blessing',
  
  // Social
  'adopted_by', 'adopted_from', 'current_location', 'in_party',
  
  // Adoption
  'fees',
  
  // Internal (used by buildBlobbiStateTags only)
  'source',
]);

/**
 * Check if a tag is managed by this builder.
 * Unmanaged tags should be preserved for forward compatibility.
 */
function isManagedTag(tagName: string): boolean {
  return MANAGED_BLOBBI_STATE_TAG_NAMES.has(tagName);
}

/**
 * Build complete tag array for a kind 31124 state event
 *
 * CRITICAL: This function ALWAYS builds tags from scratch based on Blobbi object.
 * It does NOT merge or patch previous tags. Sleep tags are EXPLICITLY set or omitted.
 *
 * @param blobbi - The current Blobbi object (source of truth)
 * @param previousTags - Tags from previous state event (optional, only for preservation)
 * @param source - Source of this update ('user', 'auto', 'system') - prevents cascading
 * @returns Complete array of tags for new state event
 */
export function buildBlobbiStateTags(
  blobbi: Blobbi,
  previousTags?: string[][],
  source: 'user' | 'auto' | 'system' = 'auto'
): Array<[string, string]> {
  console.log('[STATE BUILDER] Building new 31124 tags for:', blobbi.id, 'source:', source);

  const tags: Array<[string, string]> = [];

  // 0. SOURCE TRACKING (prevents infinite loops)
  tags.push(['source', source]);

  // 1. CORE REQUIRED TAGS
  tags.push(['d', blobbi.id]);
  tags.push(['stage', blobbi.lifeStage]);
  tags.push(['generation', blobbi.generation.toString()]);
  tags.push(['breeding_ready', blobbi.breedingReady.toString()]);
  
  // STRONGLY RECOMMENDED TAGS (per blobbi-event-spec.md)
  if (blobbi.name) tags.push(['name', blobbi.name]);
  // CRITICAL: seed must be preserved, never recomputed
  if (blobbi.seed) tags.push(['seed', blobbi.seed]);

  // 2. STATS (always from current Blobbi object)
  tags.push(['hunger', Math.round(blobbi.stats.hunger).toString()]);
  tags.push(['happiness', Math.round(blobbi.stats.happiness).toString()]);
  tags.push(['health', Math.round(blobbi.stats.health).toString()]);
  tags.push(['hygiene', Math.round(blobbi.stats.hygiene).toString()]);
  tags.push(['energy', Math.round(blobbi.stats.energy).toString()]);

  // 3. PROGRESSION
  tags.push(['experience', Math.round(blobbi.experience).toString()]);
  tags.push(['care_streak', Math.round(blobbi.careStreak).toString()]);
  tags.push(['last_interaction', Math.floor(blobbi.lastInteraction).toString()]);

  // 4. SLEEP/WAKE STATE (CRITICAL - EXPLICIT LOGIC)
  // ALWAYS set is_sleeping (even when false)
  tags.push(['is_sleeping', blobbi.isSleeping ? 'true' : 'false']);
  tags.push(['state', blobbi.state || (blobbi.isSleeping ? 'sleeping' : 'active')]);

  // ONLY add sleep timestamps when actually sleeping
  // When NOT sleeping, these tags are OMITTED (not set to empty/null)
  if (blobbi.isSleeping) {
    if (blobbi.sleepStartedAt !== undefined) {
      tags.push(['sleep_started_at', Math.floor(blobbi.sleepStartedAt).toString()]);
    }
    if (blobbi.lastSleepUpdate !== undefined) {
      tags.push(['last_sleep_update', Math.floor(blobbi.lastSleepUpdate).toString()]);
    }
  }
  // When blobbi.isSleeping === false, sleep_started_at and last_sleep_update are NOT added

  console.log('[STATE BUILDER] Sleep state:', {
    isSleeping: blobbi.isSleeping,
    sleepStartedAt: blobbi.sleepStartedAt,
    lastSleepUpdate: blobbi.lastSleepUpdate,
    willAddSleepStartedAt: blobbi.isSleeping && blobbi.sleepStartedAt !== undefined,
    willAddLastSleepUpdate: blobbi.isSleeping && blobbi.lastSleepUpdate !== undefined,
  });

  // 4b. STATUS EFFECTS
  if (blobbi.isDirty !== undefined) tags.push(['is_dirty', blobbi.isDirty.toString()]);
  if (blobbi.hasBuff) tags.push(['has_buff', blobbi.hasBuff]);
  if (blobbi.hasDebuff) tags.push(['has_debuff', blobbi.hasDebuff]);

  // 4c. ACTION TIMESTAMPS (in seconds)
  if (blobbi.lastMeal !== undefined) tags.push(['last_meal', Math.floor(blobbi.lastMeal).toString()]);
  if (blobbi.lastClean !== undefined) tags.push(['last_clean', Math.floor(blobbi.lastClean).toString()]);
  if (blobbi.lastWarm !== undefined) tags.push(['last_warm', Math.floor(blobbi.lastWarm).toString()]);
  if (blobbi.lastTalk !== undefined) tags.push(['last_talk', Math.floor(blobbi.lastTalk).toString()]);
  if (blobbi.lastCheck !== undefined) tags.push(['last_check', Math.floor(blobbi.lastCheck).toString()]);
  if (blobbi.lastSing !== undefined) tags.push(['last_sing', Math.floor(blobbi.lastSing).toString()]);
  if (blobbi.lastMedicine !== undefined) tags.push(['last_medicine', Math.floor(blobbi.lastMedicine).toString()]);

  // 5. APPEARANCE
  if (blobbi.baseColor) tags.push(['base_color', blobbi.baseColor]);
  if (blobbi.secondaryColor) tags.push(['secondary_color', blobbi.secondaryColor]);
  if (blobbi.pattern) tags.push(['pattern', blobbi.pattern]);
  if (blobbi.eyeColor) tags.push(['eye_color', blobbi.eyeColor]);
  if (blobbi.specialMark) tags.push(['special_mark', blobbi.specialMark]);

  // 6. PERSONALITY & TRAITS (multi-value tags)
  if (blobbi.personality) {
    blobbi.personality.forEach(trait => {
      tags.push(['personality', trait]);
    });
  }
  if (blobbi.traits) {
    blobbi.traits.forEach(trait => {
      tags.push(['trait', trait]);
    });
  }
  if (blobbi.mood) tags.push(['mood', blobbi.mood]);
  if (blobbi.favoriteFood) tags.push(['favorite_food', blobbi.favoriteFood]);
  if (blobbi.voiceType) tags.push(['voice_type', blobbi.voiceType]);
  if (blobbi.size) tags.push(['size', blobbi.size]);
  if (blobbi.title) tags.push(['title', blobbi.title]);
  if (blobbi.skill) tags.push(['skill', blobbi.skill]);

  // 7. EGG-SPECIFIC (only when lifeStage === 'egg')
  if (blobbi.lifeStage === 'egg') {
    if (blobbi.incubationTime !== undefined) {
      tags.push(['incubation_time', Math.floor(blobbi.incubationTime).toString()]);
    }
    if (blobbi.incubationProgress !== undefined) {
      tags.push(['incubation_progress', Math.round(blobbi.incubationProgress).toString()]);
    }
    if (blobbi.eggTemperature !== undefined) {
      tags.push(['egg_temperature', Math.round(blobbi.eggTemperature).toString()]);
    }
    if (blobbi.eggStatus) tags.push(['egg_status', blobbi.eggStatus]);
    if (blobbi.shellIntegrity !== undefined) {
      tags.push(['shell_integrity', Math.round(blobbi.shellIntegrity).toString()]);
    }
  }

  // 8. EVOLUTION-SPECIFIC (only when evolved)
  if (blobbi.evolutionForm) {
    tags.push(['adult_type', blobbi.evolutionForm]);
  }
  // Use !== undefined for numeric fields to allow 0 values
  if (blobbi.evolutionTime !== undefined) {
    tags.push(['evolution_time', Math.floor(blobbi.evolutionTime).toString()]);
  }

  // 9. DIVINE THEME (only for divine Blobbis)
  if (blobbi.themeVariant) {
    tags.push(['theme', blobbi.themeVariant]);
  }
  if (blobbi.crossoverApp) {
    tags.push(['crossover_app', blobbi.crossoverApp]);
  }
  if (blobbi.manifestation) {
    tags.push(['manifestation', blobbi.manifestation]);
  }
  if (blobbi.blessing) {
    tags.push(['blessing', blobbi.blessing]);
  }

  // 10. SOCIAL
  if (blobbi.adoptedBy) tags.push(['adopted_by', blobbi.adoptedBy]);
  if (blobbi.adoptedFrom) tags.push(['adopted_from', blobbi.adoptedFrom]);
  if (blobbi.currentLocation) tags.push(['current_location', blobbi.currentLocation]);
  if (blobbi.inParty !== undefined) tags.push(['in_party', blobbi.inParty.toString()]);
  if (blobbi.visibleToOthers !== undefined) tags.push(['visible_to_others', blobbi.visibleToOthers.toString()]);

  // 11. UNKNOWN TAG PRESERVATION (forward compatibility)
  // Preserve ALL tags that are NOT managed by this builder.
  // This ensures forward compatibility with future spec versions.
  if (previousTags) {
    const unknownTags = previousTags
      .filter(([name]) => name && !isManagedTag(name))
      .map(([name, value]) => [name, value] as [string, string]);

    if (unknownTags.length > 0) {
      console.log('[STATE BUILDER] Preserving unknown tags for forward compatibility:', 
        unknownTags.map(([name]) => name));
    }
    tags.push(...unknownTags);
  }

  console.log('[STATE BUILDER] Final tag count:', tags.length);

  // 12. ENSURE BLOBBI ECOSYSTEM TAGS
  return ensureBlobbiTagsWithDebug(tags as Array<[string, string]>, 'buildBlobbiStateTags', 31124) as Array<[string, string]>;
}