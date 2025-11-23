/**
 * BLOBBI STATE BUILDER - Clean, deterministic tag generation for kind 31124 events
 * 
 * REFACTORED TO PREVENT INFINITE LOOPS:
 * - No merge logic (always build from scratch)
 * - Source tracking to prevent cascading
 * - Explicit sleep tag removal
 * - Guard against reprocessing
 */

import { Blobbi } from '@/types/blobbi';
import { ensureBlobbiTags } from './blobbi-tags';

/**
 * Tags that should be preserved from previous state events
 * These represent long-running processes or milestones
 */
const PRESERVED_TAG_NAMES = new Set([
  'start_incubation',
  'start_evolution',
  'hatch_time',
]);

/**
 * Check if a tag should be preserved based on patterns
 */
function shouldPreserveTag(tagName: string): boolean {
  // Preserve specific named tags
  if (PRESERVED_TAG_NAMES.has(tagName)) {
    return true;
  }
  
  // Preserve task progress and confirmation tags
  if (tagName.endsWith('_progress') || tagName.endsWith('_confirmed')) {
    return true;
  }
  
  // Preserve quest/task/incubation tags
  if (tagName.startsWith('quest_') || tagName.startsWith('task_') || tagName.startsWith('incubation_')) {
    return true;
  }
  
  return false;
}

/**
 * Build complete tag array for a kind 31124 state event
 * 
 * CRITICAL: This function ALWAYS builds tags from scratch based on the Blobbi object.
 * It does NOT merge or patch previous tags. Sleep tags are EXPLICITLY set or omitted.
 * 
 * @param blobbi - The current Blobbi object (source of truth)
 * @param previousTags - Tags from the previous state event (optional, only for preservation)
 * @param source - Source of this update ('user', 'auto', 'system') - prevents cascading
 * @returns Complete array of tags for the new state event
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
  
  // 5. APPEARANCE
  if (blobbi.baseColor) tags.push(['base_color', blobbi.baseColor]);
  if (blobbi.secondaryColor) tags.push(['secondary_color', blobbi.secondaryColor]);
  if (blobbi.pattern) tags.push(['pattern', blobbi.pattern]);
  if (blobbi.eyeColor) tags.push(['eye_color', blobbi.eyeColor]);
  if (blobbi.specialMark) tags.push(['special_mark', blobbi.specialMark]);
  
  // 6. PERSONALITY & TRAITS (multi-value tags)
  if (blobbi.personality) {
    blobbi.personality.forEach(trait => tags.push(['personality', trait]));
  }
  if (blobbi.traits) {
    blobbi.traits.forEach(trait => tags.push(['trait', trait]));
  }
  
  // 7. OPTIONAL ATTRIBUTES
  if (blobbi.mood) tags.push(['mood', blobbi.mood]);
  if (blobbi.size) tags.push(['size', blobbi.size]);
  if (blobbi.title) tags.push(['title', blobbi.title]);
  if (blobbi.skill) tags.push(['skill', blobbi.skill]);
  if (blobbi.favoriteFood) tags.push(['favorite_food', blobbi.favoriteFood]);
  if (blobbi.voiceType) tags.push(['voice_type', blobbi.voiceType]);
  
  // 8. THEME & CROSSOVER
  if (blobbi.themeVariant) tags.push(['theme', blobbi.themeVariant]);
  if (blobbi.crossoverApp) tags.push(['crossover_app', blobbi.crossoverApp]);
  
  // 9. ADULT EVOLUTION FORM
  if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi') {
    tags.push(['adult_type', blobbi.evolutionForm]);
  }
  
  // 10. EGG-SPECIFIC TAGS (only for eggs)
  if (blobbi.lifeStage === 'egg') {
    if (blobbi.eggTemperature !== undefined) {
      tags.push(['egg_temperature', Math.round(blobbi.eggTemperature).toString()]);
    }
    if (blobbi.shellIntegrity !== undefined) {
      tags.push(['shell_integrity', Math.round(blobbi.shellIntegrity).toString()]);
    }
    if (blobbi.eggStatus) {
      tags.push(['egg_status', blobbi.eggStatus]);
    }
    if (blobbi.incubationTime !== undefined) {
      tags.push(['incubation_time', Math.round(blobbi.incubationTime).toString()]);
    }
    if (blobbi.incubationProgress !== undefined) {
      tags.push(['incubation_progress', Math.round(blobbi.incubationProgress).toString()]);
    }
  }
  
  // 11. BEHAVIOR FLAGS
  if (blobbi.isDirty) tags.push(['is_dirty', blobbi.isDirty.toString()]);
  if (blobbi.hasBuff) tags.push(['has_buff', blobbi.hasBuff]);
  if (blobbi.hasDebuff) tags.push(['has_debuff', blobbi.hasDebuff]);
  
  // 12. LAST ACTION TIMESTAMPS (only if they exist)
  if (blobbi.lastMeal) tags.push(['last_meal', Math.floor(blobbi.lastMeal).toString()]);
  if (blobbi.lastClean) tags.push(['last_clean', Math.floor(blobbi.lastClean).toString()]);
  if (blobbi.lastWarm) tags.push(['last_warm', Math.floor(blobbi.lastWarm).toString()]);
  if (blobbi.lastTalk) tags.push(['last_talk', Math.floor(blobbi.lastTalk).toString()]);
  if (blobbi.lastCheck) tags.push(['last_check', Math.floor(blobbi.lastCheck).toString()]);
  if (blobbi.lastSing) tags.push(['last_sing', Math.floor(blobbi.lastSing).toString()]);
  if (blobbi.lastMedicine) tags.push(['last_medicine', Math.floor(blobbi.lastMedicine).toString()]);
  
  // 13. SOCIAL TAGS
  if (blobbi.adoptedBy) tags.push(['adopted_by', blobbi.adoptedBy]);
  if (blobbi.adoptedFrom) tags.push(['adopted_from', blobbi.adoptedFrom]);
  if (blobbi.currentLocation) tags.push(['current_location', blobbi.currentLocation]);
  if (blobbi.inParty !== undefined) tags.push(['in_party', blobbi.inParty.toString()]);
  if (blobbi.visibleToOthers !== undefined) tags.push(['visible_to_others', blobbi.visibleToOthers.toString()]);
  
  // 14. PRESERVE SPECIFIC TAGS FROM PREVIOUS STATE
  if (previousTags && previousTags.length > 0) {
    const preservedTags = previousTags.filter(([name]) => shouldPreserveTag(name));
    
    // Only add preserved tags that don't already exist
    const existingTagNames = new Set(tags.map(([name]) => name));
    preservedTags.forEach(([name, value]) => {
      if (!existingTagNames.has(name)) {
        tags.push([name, value]);
        console.log('[STATE BUILDER] Preserved tag:', name, '=', value);
      }
    });
  }
  
  // 15. ENSURE BLOBBI ECOSYSTEM TAGS
  const finalTags = ensureBlobbiTags(tags);
  
  console.log('[STATE BUILDER] Final tag count:', finalTags.length);
  console.log('[STATE BUILDER] Has sleep tags:', {
    is_sleeping: finalTags.find(([n]) => n === 'is_sleeping')?.[1],
    sleep_started_at: finalTags.find(([n]) => n === 'sleep_started_at')?.[1],
    last_sleep_update: finalTags.find(([n]) => n === 'last_sleep_update')?.[1],
  });
  
  return finalTags as Array<[string, string]>;
}

/**
 * Extract preserved tags from a previous state event
 * Used when you need to see what will be preserved before building
 */
export function extractPreservedTags(previousTags: string[][]): Array<[string, string]> {
  return previousTags
    .filter(([name]) => shouldPreserveTag(name))
    .map(([name, value]) => [name, value] as [string, string]);
}

/**
 * Check if an event should be processed based on source and authorship
 * CRITICAL: Prevents infinite loops by ignoring auto-generated events from same user
 */
export function shouldProcessStateEvent(
  event: { pubkey: string; tags: string[][] },
  currentUserPubkey?: string
): boolean {
  // Ignore events from the same user (prevents self-reaction loops)
  if (currentUserPubkey && event.pubkey === currentUserPubkey) {
    console.log('[STATE BUILDER] Ignoring own event');
    return false;
  }
  
  // Ignore auto-generated events (prevents cascading)
  const sourceTag = event.tags.find(([name]) => name === 'source');
  if (sourceTag && sourceTag[1] === 'auto') {
    console.log('[STATE BUILDER] Ignoring auto-generated event');
    return false;
  }
  
  return true;
}
