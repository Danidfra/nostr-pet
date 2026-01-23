import { NostrEvent } from '@nostrify/nostrify';
import {
  Blobbi,
  BlobbiStateEvent,
  BlobbiInteractionEvent,
  BlobbiRecordEvent,
  BlobbiBreedingEvent,
  BlobbonautProfileEvent,
  BlobbonautProfile,
  BlobbonautStorageItem,
  BlobbiRecordType,
  BlobbiInteractionType,
  BlobbiInteractionData,
  BlobbiRecordData,
  BlobbiStats,
  BlobbiLifeStage,
  BlobbiMood,
  BlobbiEvolutionForm
} from '@/types/blobbi';
import { ensureBlobbiTagsWithDebug } from './blobbi-tags';
import { normalizeTags, detectDuplicateTags, type NostrTag } from './nostr/tags';
import { toSecondsTimestamp, toMillisecondsTimestamp, nowInSeconds, parseTimestampTag } from './nostr/time';
import { filterEggTagsForBaby } from './blobbi-evolution';
import {
  isDivineBlobbi,
  ensureDivineTags,
  syncDivineModelFields,
  validateDivineConsistency,
  DIVINE_THEME,
  DIVINE_CROSSOVER_APP
} from './blobbi-divine-utils';

// ============================================================================
// TAG NORMALIZATION HELPER - CANONICAL ENTRY POINT
// ============================================================================

/**
 * CANONICAL ENTRY POINT for all Blobbi event tag processing
 * 
 * Ensures Blobbi ecosystem tags are present, normalizes and deduplicates tags.
 * This is the ONLY function that should be used for ALL Blobbi event creation.
 * 
 * Process:
 * 1. Ensure Blobbi ecosystem tags exist
 * 2. Detect duplicates in DEV mode
 * 3. Normalize + dedupe
 * 4. Return canonical tags
 *
 * @param tags - Input tags (may be incomplete, duplicated, or unordered)
 * @param functionName - Name of calling function (for debug logging)
 * @param kind - Event kind (for debug logging)
 * @returns Canonical, deduplicated, ordered NostrTag array
 */
function ensureBlobbiTagsAndNormalize(
  tags: NostrTag[],
  functionName?: string,
  kind?: number
): NostrTag[] {
  // First ensure ecosystem tags are present
  const withBlobbiTags = ensureBlobbiTagsWithDebug(tags, functionName, kind);
  
  // Detect duplicates in DEV mode (before normalization)
  if (import.meta.env.DEV) {
    detectDuplicateTags(
      withBlobbiTags,
      functionName ? `${functionName} (kind ${kind})` : undefined
    );
  }
  
  // Normalize and deduplicate
  const normalized = normalizeTags(withBlobbiTags);
  
  return normalized;
}

// ============================================================================
// AUTO-REPAIR CALLBACK REGISTRY
// ============================================================================

type PublishEventCallback = (event: Omit<NostrEvent, 'id' | 'sig'>) => Promise<void>;

let autoRepairPublishCallback: PublishEventCallback | null = null;
const repairedEventIds = new Set<string>(); // Track by event ID to prevent loops
const repairedBlobbis = new Set<string>(); // Track by Blobbi ID for session deduplication

export function registerAutoRepairCallback(callback: PublishEventCallback | null): void {
  autoRepairPublishCallback = callback;
}

export function clearRepairedBlobbisCache(): void {
  repairedEventIds.clear();
  repairedBlobbis.clear();
}

// Check if an event needs repair (missing required stat tags)
export function eventNeedsRepair(event: NostrEvent): boolean {
  const tags = event.tags;
  const hungerStr = getTagValue(tags, 'hunger');
  const happinessStr = getTagValue(tags, 'happiness');
  const healthStr = getTagValue(tags, 'health');
  const hygieneStr = getTagValue(tags, 'hygiene');
  const energyStr = getTagValue(tags, 'energy');

  return !(hungerStr && happinessStr && healthStr && hygieneStr && energyStr);
}

// Check if a Blobbi object needs repair based on its tags
export function blobbiNeedsRepair(blobbi: Blobbi): boolean {
  if (!blobbi.tags || blobbi.tags.length === 0) return true;

  const hungerTag = blobbi.tags.find(([name]) => name === 'hunger');
  const happinessTag = blobbi.tags.find(([name]) => name === 'happiness');
  const healthTag = blobbi.tags.find(([name]) => name === 'health');
  const hygieneTag = blobbi.tags.find(([name]) => name === 'hygiene');
  const energyTag = blobbi.tags.find(([name]) => name === 'energy');

  return !(hungerTag && happinessTag && healthTag && hygieneTag && energyTag);
}

// Repair a specific event if needed
export async function repairEventIfNeeded(event: NostrEvent): Promise<void> {
  // Skip if already repaired this specific event
  if (repairedEventIds.has(event.id)) {
    return;
  }

  // Skip if event doesn't need repair
  if (!eventNeedsRepair(event)) {
    return;
  }

  const blobbiId = getTagValue(event.tags, 'd');
  if (!blobbiId) return;

  // Skip if we already repaired this Blobbi in this session
  if (repairedBlobbis.has(blobbiId)) {
    return;
  }

  // Parse the event to get a Blobbi object
  const blobbi = parseBlobbiFromStateEvent(event);
  if (!blobbi) return;

  // Mark as being repaired
  repairedEventIds.add(event.id);
  repairedBlobbis.add(blobbiId);

  // Publish the corrected event
  await publishCorrectedStateEvent(blobbiId, blobbi, event);
}

// ============================================================================
// EVENT KIND CONSTANTS
// ============================================================================

export const BLOBBI_EVENT_KINDS = {
  STATE: 31124,              // Addressable - current state
  INTERACTION: 14919,        // Regular - individual interactions
  BREEDING: 14920,           // Regular - breeding events
  RECORD: 14921,             // Regular - immutable records
  BLOBBONAUT_PROFILE: 31125, // Addressable - Blobbonaut (owner) profile
} as const;

// ============================================================================
// VALIDATION MODES
// ============================================================================

/**
 * Validation mode for STATE events:
 * - 'strict': Require all stat tags (hunger/happiness/health/hygiene/energy)
 * - 'lenient': Allow missing stats, they can be recovered from timestamps
 */
export type ValidationMode = 'strict' | 'lenient';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const REQUIRED_STATE_TAGS = ['d', 'stage', 'breeding_ready', 'generation', 'experience', 'care_streak'];
const OPTIONAL_STAT_TAGS = ['hunger', 'happiness', 'health', 'hygiene', 'energy'];
const REQUIRED_INTERACTION_TAGS = ['blobbi_id', 'action', 'action_category', 'stat_change'];
const REQUIRED_RECORD_TAGS = ['blobbi_id', 'record_type'];
const REQUIRED_BREEDING_TAGS = ['parent_a', 'parent_b', 'owner_a', 'owner_b', 'breed_time', 'success'];
const REQUIRED_BLOBBONAUT_TAGS = ['d'];

const VALID_ACTIONS = ['feed', 'play', 'clean', 'rest', 'warm', 'check', 'sing', 'talk', 'medicine', 'cruzar'] as const;
const VALID_STAGES: BlobbiLifeStage[] = ['egg', 'baby', 'adult'];
const VALID_STAT_NAMES = ['hunger', 'happiness', 'health', 'hygiene', 'energy', 'egg_temperature', 'shell_integrity'] as const;

const EGG_ONLY_TAGS = new Set([
  'egg_temperature', 'egg_status', 'shell_integrity', 'hatch_time',
  'start_incubation', 'incubation_time', 'start_evolution',
  'last_warm', 'last_check', 'last_talk', 'last_medicine', 'last_sing'
]);

const TASK_TAG_PATTERNS = ['_progress', '_confirmed', 'quest_', 'task_', 'incubation_'];

// ============================================================================
// TAG HELPER FUNCTIONS
// ============================================================================

function getTagValue(tags: NostrTag[], tagName: string): string | undefined {
  const tag = tags.find(t => t?.[0] === tagName);
  return tag?.[1] ?? undefined;
}

function getTagValues(tags: NostrTag[], tagName: string): string[] {
  return tags
    .filter(t => t?.[0] === tagName && typeof t?.[1] === 'string')
    .map(t => t[1] as string)
    .filter(v => v.length > 0);
}

function validateRequiredTags(tags: NostrTag[], requiredTags: string[]): boolean {
  const tagNames = tags.map(t => t?.[0]).filter(Boolean);
  return requiredTags.every(required => tagNames.includes(required));
}

// ============================================================================
// STAT VALIDATION AND SAFETY HELPERS
// ============================================================================

function validateStat(value: number, statName: string): number {
  const cleanValue = Math.max(0, Math.min(100, Math.round(value || 0)));
  if (cleanValue !== value) {
    console.warn(`⚠️ [StateEvent] Corrected invalid ${statName}: ${value} → ${cleanValue}`);
  }
  return cleanValue;
}

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function validateBlobbiStats(blobbi: Blobbi, context: string): void {
  const stats = blobbi.stats;
  const issues: string[] = [];

  Object.entries(stats).forEach(([statName, value]) => {
    if (typeof value !== 'number' || isNaN(value)) {
      issues.push(`${statName} is not a number: ${value}`);
    } else if (value < 0 || value > 100) {
      issues.push(`${statName} out of range: ${value}`);
    }
  });

  if (!blobbi.id) issues.push('Missing Blobbi ID');
  if (!blobbi.name) issues.push('Missing Blobbi name');
  if (!blobbi.lifeStage) issues.push('Missing life stage');

  if (issues.length > 0) {
    console.error(`🚨 [StatValidation] Issues detected in ${context}:`, issues);
    console.error(`🚨 [StatValidation] Blobbi data:`, {
      id: blobbi.id,
      name: blobbi.name,
      lifeStage: blobbi.lifeStage,
      stats: blobbi.stats,
      lastInteraction: blobbi.lastInteraction
    });
  }
}

// ============================================================================
// STAT RECOVERY FROM TIMESTAMPS
// ============================================================================

/**
 * Recovers missing stats from timestamp tags using degradation calculation.
 * 
 * TIME UNITS:
 * - Tags store timestamps in SECONDS (Nostr standard)
 * - currentTime parameter is in MILLISECONDS (default: Date.now())
 * - Converts currentTime to seconds once at the start
 * - All comparisons are SECONDS vs SECONDS
 * 
 * @param blobbiId - Blobbi identifier
 * @param tags - Event tags (timestamps in SECONDS)
 * @param currentTime - Current time in MILLISECONDS (default: Date.now())
 * @returns Stats recovery result
 */
function recoverMissingStatsFromTimestamps(
  blobbiId: string,
  tags: NostrTag[],
  currentTime: number = Date.now()
): { stats: BlobbiStats; usedRecovery: boolean; warningMessage: string } {
  const hungerStr = getTagValue(tags, 'hunger');
  const happinessStr = getTagValue(tags, 'happiness');
  const healthStr = getTagValue(tags, 'health');
  const hygieneStr = getTagValue(tags, 'hygiene');
  const energyStr = getTagValue(tags, 'energy');

  if (hungerStr && happinessStr && healthStr && hygieneStr && energyStr) {
    return {
      stats: {
        hunger: clampStat(parseInt(hungerStr)),
        happiness: clampStat(parseInt(happinessStr)),
        health: clampStat(parseInt(healthStr)),
        hygiene: clampStat(parseInt(hygieneStr)),
        energy: clampStat(parseInt(energyStr)),
      },
      usedRecovery: false,
      warningMessage: ''
    };
  }

  // Extract timestamps from tags (all in SECONDS - Nostr standard)
  const lastMeal = getTagValue(tags, 'last_meal') ? parseInt(getTagValue(tags, 'last_meal')!) : undefined;
  const lastClean = getTagValue(tags, 'last_clean') ? parseInt(getTagValue(tags, 'last_clean')!) : undefined;
  const lastWarm = getTagValue(tags, 'last_warm') ? parseInt(getTagValue(tags, 'last_warm')!) : undefined;
  const lastTalk = getTagValue(tags, 'last_talk') ? parseInt(getTagValue(tags, 'last_talk')!) : undefined;
  const lastCheck = getTagValue(tags, 'last_check') ? parseInt(getTagValue(tags, 'last_check')!) : undefined;
  const lastSing = getTagValue(tags, 'last_sing') ? parseInt(getTagValue(tags, 'last_sing')!) : undefined;
  const lastMedicine = getTagValue(tags, 'last_medicine') ? parseInt(getTagValue(tags, 'last_medicine')!) : undefined;
  // Legacy: last_interaction_time is deprecated in favor of last_interaction, but read for backward compat
  const lastInteractionTime = getTagValue(tags, 'last_interaction_time') ? parseInt(getTagValue(tags, 'last_interaction_time')!) : undefined;

  const interactionTimes = [lastMeal, lastClean, lastWarm, lastTalk, lastCheck, lastSing, lastMedicine, lastInteractionTime];
  const validTimes = interactionTimes.filter((t): t is number => typeof t === 'number');
  const mostRecentInteraction = validTimes.length > 0 ? Math.max(...validTimes) : undefined;

  if (!mostRecentInteraction) {
    return {
      stats: {
        hunger: 80,
        happiness: 80,
        health: 80,
        hygiene: 80,
        energy: 80,
      },
      usedRecovery: true,
      warningMessage: 'No timestamp tags found, using safe defaults'
    };
  }

  // Calculate time passed: convert currentTime (ms) to seconds, then calculate hours
  const currentTimeSeconds = Math.floor(currentTime / 1000);
  
  // Convert mostRecentInteraction to seconds if it looks like milliseconds
  let mostRecentSeconds = mostRecentInteraction;
  if (mostRecentInteraction > 1e12) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Timestamp] mostRecentInteraction looks like milliseconds (${mostRecentInteraction}), converting to seconds. ` +
        `Blobbi: ${blobbiId}`
      );
    }
    mostRecentSeconds = Math.floor(mostRecentInteraction / 1000);
  }
  
  // Clock skew protection: if mostRecentSeconds is in the future, treat as 0 hours passed
  const hoursPassed = mostRecentSeconds > currentTimeSeconds 
    ? 0 
    : (currentTimeSeconds - mostRecentSeconds) / (60 * 60);
  const safeHoursPassed = Math.max(0, Math.min(hoursPassed, 24));

  let currentHunger = hungerStr ? clampStat(parseInt(hungerStr)) : 80;
  let currentHappiness = happinessStr ? clampStat(parseInt(happinessStr)) : 80;
  let currentHealth = healthStr ? clampStat(parseInt(healthStr)) : 80;
  let currentHygiene = hygieneStr ? clampStat(parseInt(hygieneStr)) : 80;
  let currentEnergy = energyStr ? clampStat(parseInt(energyStr)) : 80;

  const HUNGER_DECAY_RATE = -5;
  const HAPPINESS_DECAY_RATE = -3;
  const HYGIENE_DECAY_RATE = -4;
  const ENERGY_DECAY_RATE = -5;
  const HEALTH_DECAY_RATE = -1;

  currentHunger = clampStat(currentHunger + (HUNGER_DECAY_RATE * safeHoursPassed));
  currentHappiness = clampStat(currentHappiness + (HAPPINESS_DECAY_RATE * safeHoursPassed));
  currentHygiene = clampStat(currentHygiene + (HYGIENE_DECAY_RATE * safeHoursPassed));
  currentEnergy = clampStat(currentEnergy + (ENERGY_DECAY_RATE * safeHoursPassed));
  currentHealth = clampStat(currentHealth + (HEALTH_DECAY_RATE * safeHoursPassed));

  if (currentHunger < 30) currentHealth = Math.max(0, currentHealth - 2);
  if (currentHygiene < 20) currentHealth = Math.max(0, currentHealth - 1);
  if (currentEnergy < 20) currentHealth = Math.max(0, currentHealth - 1);
  if (currentHappiness < 30) currentHealth = Math.max(0, currentHealth - 1);

  const recoveredStats = {
    hunger: currentHunger,
    happiness: currentHappiness,
    health: currentHealth,
    hygiene: currentHygiene,
    energy: currentEnergy,
  };

  return {
    stats: recoveredStats,
    usedRecovery: true,
    warningMessage: `Reconstructed from ${safeHoursPassed.toFixed(1)} hours of decay`
  };
}

/**
 * Publish a corrected state event using the canonical pipeline
 * 
 * This function uses the canonical pipeline to ensure:
 * - Stats are validated and clamped
 * - Timestamps are normalized
 * - Tags are deduplicated and ordered
 * - No fields are lost during repair
 */
async function publishCorrectedStateEvent(
  blobbiId: string,
  correctedBlobbi: Blobbi,
  originalEvent: NostrEvent
): Promise<void> {
  if (!autoRepairPublishCallback) {
    console.warn(`[AutoRepair] No publish callback registered for ${blobbiId}`);
    return;
  }

  try {
    console.log(`[AutoRepair] Detected incomplete Blobbi ${blobbiId}, publishing repair...`);

    // Use canonical pipeline for corrected event
    const correctedEvent = createBlobbiStateEvent(correctedBlobbi);

    const eventToPublish: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: correctedEvent.kind,
      content: correctedEvent.content,
      tags: correctedEvent.tags,
      pubkey: originalEvent.pubkey,
      created_at: Math.floor(Date.now() / 1000),
    };

    await autoRepairPublishCallback(eventToPublish);

    console.log(`✅ Published repair for ${blobbiId}`);
  } catch (error) {
    console.error(`[AutoRepair] Failed to publish repair for ${blobbiId}:`, error);
    // Remove from repaired sets so it can be retried
    repairedEventIds.delete(originalEvent.id);
    repairedBlobbis.delete(blobbiId);
  }
}

// ============================================================================
// TAG FILTERING FOR STAGE TRANSITIONS
// ============================================================================

function isEggOnlyTag(tagName: string): boolean {
  if (EGG_ONLY_TAGS.has(tagName)) return true;

  for (const pattern of TASK_TAG_PATTERNS) {
    if (tagName.includes(pattern)) return true;
  }

  return false;
}

function filterTagsForStage(tags: NostrTag[], stage: BlobbiLifeStage): NostrTag[] {

  if (stage === 'egg') return tags;

  return tags.filter((t) => !isEggOnlyTag(t?.[0] || ''));
}

// ============================================================================
// BLOBBI ID HELPERS
// ============================================================================

export function validateBlobbiId(blobbiId: string): boolean {
  return /^blobbi-[a-z0-9_-]+$/.test(blobbiId) && blobbiId.length > 7 && blobbiId.length <= 57;
}

export function createBlobbiId(blobbiName: string): string {
  if (!isValidBlobbiName(blobbiName)) {
    throw new Error('Invalid Blobbi name: must contain at least one alphanumeric character');
  }
  const cleanName = normalizeBlobbiName(blobbiName);
  return `blobbi-${cleanName}`;
}

export function extractBlobbiName(blobbiId: string): string {
  if (!validateBlobbiId(blobbiId)) {
    throw new Error('Invalid blobbiId format');
  }
  return blobbiId.replace('blobbi-', '');
}

export function normalizeBlobbiName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function isValidBlobbiName(name: string): boolean {
  const normalized = normalizeBlobbiName(name);
  return normalized.length > 0 && normalized.length <= 50;
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Extracts action timestamps from a Blobbi object for UI display.
 * 
 * TIME UNITS:
 * - Input (blobbi.lastX): SECONDS (internal model format)
 * - Output: MILLISECONDS (for JavaScript Date/UI usage)
 * 
 * @param blobbi - Blobbi object with timestamp fields in SECONDS
 * @returns Action timestamps in MILLISECONDS for UI
 */
export function extractActionTimestamps(blobbi: Blobbi): Record<string, number> {
  const actionTimestamps: Record<string, number> = {};

  // Convert from seconds (model) to milliseconds (UI/Date)
  if (blobbi.lastMeal) actionTimestamps.feed = toMillisecondsTimestamp(blobbi.lastMeal);
  if (blobbi.lastClean) actionTimestamps.clean = toMillisecondsTimestamp(blobbi.lastClean);
  if (blobbi.lastWarm) actionTimestamps.warm = toMillisecondsTimestamp(blobbi.lastWarm);
  if (blobbi.lastTalk) actionTimestamps.talk = toMillisecondsTimestamp(blobbi.lastTalk);
  if (blobbi.lastCheck) actionTimestamps.check = toMillisecondsTimestamp(blobbi.lastCheck);
  if (blobbi.lastSing) actionTimestamps.sing = toMillisecondsTimestamp(blobbi.lastSing);
  if (blobbi.lastMedicine) actionTimestamps.medicine = toMillisecondsTimestamp(blobbi.lastMedicine);

  return actionTimestamps;
}

/**
 * Calculate stat degradation based on time passed since last interaction.
 * 
 * TIME UNITS:
 * - lastInteractionSeconds: SECONDS (Nostr standard, matches Blobbi.lastInteraction)
 * - currentTimeMs: MILLISECONDS (defaults to Date.now())
 * - Converts currentTimeMs to seconds internally
 * 
 * @param lastInteractionSeconds - Last interaction time in SECONDS
 * @param currentTimeMs - Current time in MILLISECONDS (defaults to Date.now())
 * @returns Absolute degradation amounts (positive values) per stat to be SUBTRACTED from current values
 */
export function calculateStatDegradation(
  lastInteractionSeconds: number,
  currentTimeMs: number = Date.now()
): Partial<BlobbiStats> {
  const currentTimeSeconds = Math.floor(currentTimeMs / 1000);
  const hoursPassed = Math.max(0, (currentTimeSeconds - lastInteractionSeconds) / (60 * 60));

  // Degradation rates (positive values = amount lost per hour)
  const degradationRates = {
    hunger: 5,
    happiness: 3,
    hygiene: 2,
    energy: 4,
  };

  // Return positive loss amounts
  return {
    hunger: Math.max(0, degradationRates.hunger * hoursPassed),
    happiness: Math.max(0, degradationRates.happiness * hoursPassed),
    hygiene: Math.max(0, degradationRates.hygiene * hoursPassed),
    energy: Math.max(0, degradationRates.energy * hoursPassed),
  };
}

// ============================================================================
// EVENT CREATION FUNCTIONS
// ============================================================================

/**
 * Creates a kind 31124 STATE event from a Blobbi object.
 * 
 * TIME UNITS:
 * - Input blobbi.lastInteraction, lastMeal, etc.: SECONDS (Nostr standard)
 * - Input blobbi.birthTime, hatchTime: MILLISECONDS (UI compatibility - special case)
 * - Output tags: ALL timestamps stored in SECONDS (Nostr standard)
 * - toSecondsTimestamp() safely converts any milliseconds to seconds
 * 
 * @param blobbi - Blobbi object with current state
 * @param adoptionFees - Optional adoption fees
 * @returns Event template (without id, pubkey, created_at, sig)
 */
export function createBlobbiStateEvent(
  blobbi: Blobbi,
  adoptionFees?: number
): Omit<BlobbiStateEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  validateBlobbiStats(blobbi, 'createBlobbiStateEvent');

  const divinePreservedBlobbi = ensureDivineTags(blobbi);

  let preservedTags: NostrTag[] = [];

  if (divinePreservedBlobbi.tags && Array.isArray(divinePreservedBlobbi.tags) && divinePreservedBlobbi.tags.length > 0) {
    preservedTags = divinePreservedBlobbi.tags.filter((tag) => tag[0]);
  }

  if (blobbi.lifeStage === 'baby' && blobbi.tags && blobbi.tags.length > 0) {
    const hasBlobbiTag = blobbi.tags.some(([name]) => name === 'b');
    const hasTopicTag = blobbi.tags.some(([name]) => name === 't');
    const hasCanonicalOrder = hasBlobbiTag && hasTopicTag;

    if (!hasCanonicalOrder) {
      try {
        const filteredTags = filterEggTagsForBaby(
          (blobbi.tags || []) as NostrTag[],
          blobbi
        );
        preservedTags = filteredTags.filter(([k, v]) => k && v);
      } catch (error) {
        console.warn('[Hatching] Could not apply egg tag filter, using original tags:', error);
      }
    }
  }

  const coreUpdates: NostrTag[] = [
    ['d', blobbi.id],
    ['stage', blobbi.lifeStage],
    ['breeding_ready', blobbi.breedingReady.toString()],
    ['generation', blobbi.generation.toString()],
    ['hunger', validateStat(blobbi.stats.hunger, 'hunger').toString()],
    ['happiness', validateStat(blobbi.stats.happiness, 'happiness').toString()],
    ['health', validateStat(blobbi.stats.health, 'health').toString()],
    ['hygiene', validateStat(blobbi.stats.hygiene, 'hygiene').toString()],
    ['energy', validateStat(blobbi.stats.energy, 'energy').toString()],
    ['experience', Math.max(0, blobbi.experience || 0).toString()],
    ['care_streak', Math.max(0, blobbi.careStreak || 0).toString()],
    ['last_interaction', toSecondsTimestamp(blobbi.lastInteraction).toString()],
  ];

  const stateTagMap = new Map<string, string>();

  preservedTags.forEach((tag) => {
    const key = tag[0];
    const value = tag[1];
    if (!key) return;

    if (blobbi.lifeStage === 'baby' && isEggOnlyTag(key)) {
      return;
    }

    // Tags that are always set in coreUpdates - don't preserve from old tags to avoid duplication
    const CORE_STAT_TAGS = new Set([
      'hunger', 'happiness', 'health', 'hygiene', 'energy', 
      'experience', 'care_streak', 'last_interaction',
      'd', 'stage', 'breeding_ready', 'generation'
    ]);
    // Note: last_interaction_time is NOT in coreUpdates, so if preserved tags have it, 
    // it will be included but normalizeTags() will dedupe if both exist (keeping last_interaction)
    if (CORE_STAT_TAGS.has(key)) {
      return;
    }

    stateTagMap.set(key, value);
  });

  coreUpdates.forEach(([key, value]) => {
    stateTagMap.set(key, value);
  });

  if (adoptionFees !== undefined) {
    stateTagMap.set('fees', adoptionFees.toString());
  }

  if (blobbi.baseColor) stateTagMap.set('base_color', blobbi.baseColor);
  if (blobbi.secondaryColor) stateTagMap.set('secondary_color', blobbi.secondaryColor);
  if (blobbi.pattern) stateTagMap.set('pattern', blobbi.pattern);
  if (blobbi.eyeColor) stateTagMap.set('eye_color', blobbi.eyeColor);
  if (blobbi.specialMark) stateTagMap.set('special_mark', blobbi.specialMark);

  const isDivine = isDivineBlobbi(blobbi);
  if (isDivine) {
    stateTagMap.set('theme', DIVINE_THEME);
    stateTagMap.set('crossover_app', DIVINE_CROSSOVER_APP);
    stateTagMap.delete('secondary_color');
  } else {
    if (blobbi.themeVariant) stateTagMap.set('theme', blobbi.themeVariant);
    if (blobbi.crossoverApp) stateTagMap.set('crossover_app', blobbi.crossoverApp);
  }

  if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi') {
    stateTagMap.set('adult_type', blobbi.evolutionForm);
  }

  if (blobbi.mood) stateTagMap.set('mood', blobbi.mood);
  if (blobbi.favoriteFood) stateTagMap.set('favorite_food', blobbi.favoriteFood);
  if (blobbi.voiceType) stateTagMap.set('voice_type', blobbi.voiceType);
  if (blobbi.size) stateTagMap.set('size', blobbi.size);
  if (blobbi.title) stateTagMap.set('title', blobbi.title);
  if (blobbi.skill) stateTagMap.set('skill', blobbi.skill);

  if (blobbi.lifeStage === 'egg') {
    if (blobbi.incubationTime) stateTagMap.set('incubation_time', blobbi.incubationTime.toString());
    if (blobbi.incubationProgress) stateTagMap.set('incubation_progress', blobbi.incubationProgress.toString());
    if (blobbi.eggTemperature !== undefined) stateTagMap.set('egg_temperature', blobbi.eggTemperature.toString());
    if (blobbi.eggStatus) stateTagMap.set('egg_status', blobbi.eggStatus);
    if (blobbi.shellIntegrity) stateTagMap.set('shell_integrity', blobbi.shellIntegrity.toString());
  }

  if (blobbi.isSleeping) stateTagMap.set('is_sleeping', blobbi.isSleeping.toString());
  if (blobbi.isDirty) stateTagMap.set('is_dirty', blobbi.isDirty.toString());
  if (blobbi.hasBuff) stateTagMap.set('has_buff', blobbi.hasBuff);
  if (blobbi.hasDebuff) stateTagMap.set('has_debuff', blobbi.hasDebuff);
  // Note: last_interaction is already set in coreUpdates, don't duplicate it here

  if (blobbi.sleepStartedAt) stateTagMap.set('sleep_started_at', toSecondsTimestamp(blobbi.sleepStartedAt).toString());

  if (blobbi.isSleeping && blobbi.lastSleepUpdate) {
    stateTagMap.set('last_sleep_update', toSecondsTimestamp(blobbi.lastSleepUpdate).toString());
  }

  if (blobbi.lastMeal) stateTagMap.set('last_meal', toSecondsTimestamp(blobbi.lastMeal).toString());
  if (blobbi.lastClean) stateTagMap.set('last_clean', toSecondsTimestamp(blobbi.lastClean).toString());
  if (blobbi.lastWarm) stateTagMap.set('last_warm', toSecondsTimestamp(blobbi.lastWarm).toString());
  if (blobbi.lastTalk) stateTagMap.set('last_talk', toSecondsTimestamp(blobbi.lastTalk).toString());
  if (blobbi.lastCheck) stateTagMap.set('last_check', toSecondsTimestamp(blobbi.lastCheck).toString());
  if (blobbi.lastSing) stateTagMap.set('last_sing', toSecondsTimestamp(blobbi.lastSing).toString());
  if (blobbi.lastMedicine) stateTagMap.set('last_medicine', toSecondsTimestamp(blobbi.lastMedicine).toString());

  if (blobbi.adoptedBy) stateTagMap.set('adopted_by', blobbi.adoptedBy);
  if (blobbi.adoptedFrom) stateTagMap.set('adopted_from', blobbi.adoptedFrom);
  if (blobbi.currentLocation) stateTagMap.set('current_location', blobbi.currentLocation);
  if (blobbi.inParty) stateTagMap.set('in_party', blobbi.inParty.toString());
  if (blobbi.visibleToOthers !== undefined) stateTagMap.set('visible_to_others', blobbi.visibleToOthers.toString());

  const updatedSingleValueTags = Array.from(stateTagMap.entries()).filter(([key]) =>
    key !== 'personality' && key !== 'trait'
  );

  const finalStateTagsArray: NostrTag[] = [...updatedSingleValueTags];

  // Add multi-value tags AFTER singletons are fully set
  if (blobbi.personality) {
    blobbi.personality.forEach(trait => finalStateTagsArray.push(['personality', trait]));
  }
  if (blobbi.traits) {
    blobbi.traits.forEach(trait => finalStateTagsArray.push(['trait', trait]));
  }

  const finalStateTags = ensureBlobbiTagsAndNormalize(
    finalStateTagsArray,
    'createBlobbiStateEvent',
    BLOBBI_EVENT_KINDS.STATE
  );

  return {
    kind: BLOBBI_EVENT_KINDS.STATE,
    content: `${blobbi.name} is a ${blobbi.lifeStage} Blobbi.`,
    tags: finalStateTags,
  };
}

/**
 * Creates a shell integrity penalty event as a valid STATE event.
 * This is a corrective state update that includes all required STATE tags.
 */
export function createShellIntegrityPenaltyEvent(
  blobbi: Blobbi,
  carePointsDeducted: number
): Omit<BlobbiStateEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  // Include all required STATE tags to pass validation
  const tags: NostrTag[] = [
    ['d', blobbi.id],
    ['stage', blobbi.lifeStage],
    ['breeding_ready', blobbi.breedingReady.toString()],
    ['generation', blobbi.generation.toString()],
    ['experience', Math.max(0, blobbi.experience || 0).toString()],
    ['care_streak', Math.max(0, Math.max(0, blobbi.careStreak || 0) - carePointsDeducted).toString()],
    
    // Include current stats
    ['hunger', validateStat(blobbi.stats.hunger, 'hunger').toString()],
    ['happiness', validateStat(blobbi.stats.happiness, 'happiness').toString()],
    ['health', validateStat(blobbi.stats.health, 'health').toString()],
    ['hygiene', validateStat(blobbi.stats.hygiene, 'hygiene').toString()],
    ['energy', validateStat(blobbi.stats.energy, 'energy').toString()],
    
    // Penalty-specific tags
    ['penalty', 'shell_integrity_breach'],
    ['shell_integrity', (blobbi.shellIntegrity ?? 100).toString()],
    ['care_points_deducted', carePointsDeducted.toString()],
    ['last_interaction', toSecondsTimestamp(blobbi.lastInteraction).toString()],
  ];

  const finalTags = ensureBlobbiTagsAndNormalize(
    tags,
    'createShellIntegrityPenaltyEvent',
    BLOBBI_EVENT_KINDS.STATE
  );

  return {
    kind: BLOBBI_EVENT_KINDS.STATE,
    content: `${blobbi.name}'s shell integrity is critically low (${blobbi.shellIntegrity ?? 100}%). Care points deducted: ${carePointsDeducted}`,
    tags: finalTags,
  };
}

export function createBlobbiInteractionEvent(
  blobbiId: string,
  interactionData: BlobbiInteractionData
): Omit<BlobbiInteractionEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: NostrTag[] = [
    ['blobbi_id', blobbiId],
    ['action', interactionData.action],
    ['action_category', interactionData.actionCategory],
  ];

  // 🔥 FIX: Add ALL stat changes as separate tags
  if (interactionData.statChanges && interactionData.statChanges.length > 0) {
    // Use statChanges array if provided (includes all effects)
    interactionData.statChanges.forEach(([stat, value]) => {
      tags.push(['stat_change', `${stat}:${value}`]);
    });
  } else {
    // Fallback to single statChange for backward compatibility
    tags.push(['stat_change', `${interactionData.statChange[0]}:${interactionData.statChange[1]}`]);
  }

  if (interactionData.itemUsed) tags.push(['item_used', interactionData.itemUsed]);
  if (interactionData.itemQuantity) tags.push(['item_quantity', interactionData.itemQuantity.toString()]);
  if (interactionData.itemQuality) tags.push(['item_quality', interactionData.itemQuality]);
  if (interactionData.timeOfDay) tags.push(['time_of_day', interactionData.timeOfDay]);
  if (interactionData.blobbiMoodBefore) tags.push(['blobbi_mood_before', interactionData.blobbiMoodBefore]);
  if (interactionData.blobbiMoodAfter) tags.push(['blobbi_mood_after', interactionData.blobbiMoodAfter]);
  if (interactionData.animationPlayed) tags.push(['animation_played', interactionData.animationPlayed]);
  if (interactionData.soundPlayed) tags.push(['sound_played', interactionData.soundPlayed]);
  if (interactionData.bonusApplied) tags.push(['bonus_applied', interactionData.bonusApplied]);
  if (interactionData.experienceGained) tags.push(['experience_gained', interactionData.experienceGained.toString()]);
  if (interactionData.careStreak) tags.push(['care_streak', interactionData.careStreak.toString()]);
  if (interactionData.carePoints) tags.push(['care_points', interactionData.carePoints.toString()]);
  if (interactionData.achievementProgress) tags.push(['achievement_progress', `${interactionData.achievementProgress[0]}:${interactionData.achievementProgress[1]}`]);
  if (interactionData.achievementUnlocked) tags.push(['achievement_unlocked', interactionData.achievementUnlocked]);
  if (interactionData.specialEvent) tags.push(['special_event', interactionData.specialEvent]);
  if (interactionData.memoryCreated) tags.push(['memory_created', interactionData.memoryCreated]);

  if (interactionData.gameType) tags.push(['game_type', interactionData.gameType]);
  if (interactionData.toyUsed) tags.push(['toy_used', interactionData.toyUsed]);
  if (interactionData.playDuration) tags.push(['play_duration', interactionData.playDuration.toString()]);
  if (interactionData.location) tags.push(['location', interactionData.location]);
  if (interactionData.playPartner) tags.push(['play_partner', interactionData.playPartner]);
  if (interactionData.skillImproved) tags.push(['skill_improved', `${interactionData.skillImproved[0]}:${interactionData.skillImproved[1]}`]);
  if (interactionData.bondIncreased) tags.push(['bond_increased', `${interactionData.bondIncreased[0]}:${interactionData.bondIncreased[1]}`]);
  if (interactionData.newMoveLearn) tags.push(['new_move_learned', interactionData.newMoveLearn]);
  if (interactionData.cleaningType) tags.push(['cleaning_type', interactionData.cleaningType]);
  if (interactionData.waterTemperature) tags.push(['water_temperature', interactionData.waterTemperature]);
  if (interactionData.soapUsed) tags.push(['soap_used', interactionData.soapUsed]);
  if (interactionData.groomingTool) tags.push(['grooming_tool', interactionData.groomingTool]);
  if (interactionData.specialEffect) tags.push(['special_effect', interactionData.specialEffect]);
  if (interactionData.scentApplied) tags.push(['scent_applied', interactionData.scentApplied]);
  if (interactionData.moodBoost) tags.push(['mood_boost', interactionData.moodBoost]);
  if (interactionData.restType) tags.push(['rest_type', interactionData.restType]);
  if (interactionData.bedType) tags.push(['bed_type', interactionData.bedType]);
  if (interactionData.lullabyPlayed) tags.push(['lullaby_played', interactionData.lullabyPlayed]);
  if (interactionData.sleepDuration) tags.push(['sleep_duration', interactionData.sleepDuration.toString()]);
  if (interactionData.dreamType) tags.push(['dream_type', interactionData.dreamType]);
  if (interactionData.growthBonus) tags.push(['growth_bonus', interactionData.growthBonus]);
  if (interactionData.dreamMemory) tags.push(['dream_memory', interactionData.dreamMemory]);
  if (interactionData.socialRole) tags.push(['social_role', `${interactionData.socialRole[0]}:${interactionData.socialRole[1]}`]);
  if (interactionData.interactionQuality) tags.push(['interaction_quality', interactionData.interactionQuality]);
  if (interactionData.emotionTriggered) tags.push(['emotion_triggered', interactionData.emotionTriggered]);
  if (interactionData.sharedMemory) tags.push(['shared_memory', interactionData.sharedMemory]);
  if (interactionData.interactionContext) tags.push(['interaction_context', interactionData.interactionContext]);

  const finalTags = ensureBlobbiTagsAndNormalize(
    tags,
    'createBlobbiInteractionEvent',
    BLOBBI_EVENT_KINDS.INTERACTION
  );

  return {
    kind: BLOBBI_EVENT_KINDS.INTERACTION,
    content: `Blobbi ${interactionData.action} interaction`,
    tags: finalTags,
  };
}

export function createBlobbiRecordEvent(
  blobbiId: string,
  recordData: BlobbiRecordData,
  content?: string
): Omit<BlobbiRecordEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: NostrTag[] = [
    ['blobbi_id', blobbiId],
    ['record_type', recordData.recordType],
  ];

  switch (recordData.recordType) {
    case 'birth':
      if (recordData.generation) tags.push(['generation', recordData.generation.toString()]);
      if (recordData.origin) tags.push(['origin', recordData.origin]);
      if (recordData.birthLocation) tags.push(['birth_location', recordData.birthLocation]);
      if (recordData.weatherAtBirth) tags.push(['weather_at_birth', recordData.weatherAtBirth]);
      if (recordData.shellColor) tags.push(['shell_color', recordData.shellColor]);
      if (recordData.shellPattern) tags.push(['shell_pattern', recordData.shellPattern]);
      if (recordData.initialTrait) {
        recordData.initialTrait.forEach(trait => tags.push(['initial_trait', trait]));
      }
      if (recordData.rarity) tags.push(['rarity', recordData.rarity]);
      if (recordData.parent1) tags.push(['parent_1', recordData.parent1]);
      if (recordData.parent2) tags.push(['parent_2', recordData.parent2]);
      if (recordData.lineageDepth) tags.push(['lineage_depth', recordData.lineageDepth.toString()]);
      if (recordData.geneticMarker) tags.push(['genetic_marker', recordData.geneticMarker]);
      if (recordData.birthSeason) tags.push(['birth_season', recordData.birthSeason]);
      if (recordData.birthMoonPhase) tags.push(['birth_moon_phase', recordData.birthMoonPhase]);
      if (recordData.creator) tags.push(['creator', recordData.creator]);
      if (recordData.designUrl) tags.push(['design_url', recordData.designUrl]);
      if (recordData.adoptionFee) tags.push(['adoption_fee', recordData.adoptionFee.toString()]);
      if (recordData.legacyTrait) {
        recordData.legacyTrait.forEach(trait => tags.push(['legacy_trait', trait]));
      }
      if (recordData.passiveTrait) {
        recordData.passiveTrait.forEach(trait => tags.push(['passive_trait', trait]));
      }
      if (recordData.evolvedFrom) tags.push(['evolved_from', recordData.evolvedFrom]);
      if (recordData.hatchFee) tags.push(['hatch_fee', recordData.hatchFee.toString()]);
      if (recordData.evolutionStage) tags.push(['evolution_stage', recordData.evolutionStage]);
      break;

    case 'hatched':
      // Store hatched_at as SECONDS (Nostr standard)
      if (recordData.hatchedAt) tags.push(['hatched_at', toSecondsTimestamp(recordData.hatchedAt).toString()]);
      if (recordData.hatchedBy) tags.push(['hatched_by', recordData.hatchedBy]);
      if (recordData.eggType) tags.push(['egg_type', recordData.eggType]);
      if (recordData.incubationTime) tags.push(['incubation_time', recordData.incubationTime]);
      if (recordData.generation) tags.push(['generation', recordData.generation.toString()]);
      if (recordData.eyeColor) tags.push(['eye_color', recordData.eyeColor]);
      if (recordData.baseColor) tags.push(['base_color', recordData.baseColor]);
      if (recordData.pattern) tags.push(['pattern', recordData.pattern]);
      if (recordData.secondaryColor) tags.push(['secondary_color', recordData.secondaryColor]);
      if (recordData.manifestation) tags.push(['manifestation', recordData.manifestation]);
      if (recordData.title) tags.push(['title', recordData.title]);
      if (recordData.titleReason) tags.push(['title_reason', recordData.titleReason]);
      if (recordData.blessing) tags.push(['blessing', recordData.blessing]);
      if (recordData.memoryTitle) tags.push(['memory_title', recordData.memoryTitle]);
      if (recordData.memoryDescription) tags.push(['memory_description', recordData.memoryDescription]);
      if (recordData.memoryDate) tags.push(['memory_date', recordData.memoryDate]);
      if (recordData.passiveTrait) {
        recordData.passiveTrait.forEach(trait => tags.push(['passive_trait', trait]));
      }
      break;

    case 'adoption':
      if (recordData.adoptedBy) tags.push(['adopted_by', recordData.adoptedBy]);
      // Store adopted_on as SECONDS (Nostr standard)
      if (recordData.adoptedOn) tags.push(['adopted_on', toSecondsTimestamp(recordData.adoptedOn).toString()]);
      if (recordData.adoptionMethod) tags.push(['adoption_method', recordData.adoptionMethod]);
      if (recordData.title) tags.push(['title', recordData.title]);
      if (recordData.titleReason) tags.push(['title_reason', recordData.titleReason]);
      break;

    case 'evolution':
      if (recordData.evolutionStage) tags.push(['evolution_stage', recordData.evolutionStage]);
      if (recordData.evolutionReason) tags.push(['evolution_reason', recordData.evolutionReason]);
      if (recordData.evolvedFrom) tags.push(['evolved_from', recordData.evolvedFrom]);
      break;

    case 'memory':
      if (recordData.memoryTitle) tags.push(['memory_title', recordData.memoryTitle]);
      if (recordData.memoryDescription) tags.push(['memory_description', recordData.memoryDescription]);
      if (recordData.memoryDate) tags.push(['memory_date', recordData.memoryDate]);
      if (recordData.discoveredTrait) tags.push(['discovered_trait', recordData.discoveredTrait]);
      if (recordData.achievement) tags.push(['achievement', recordData.achievement]);
      if (recordData.milestone) tags.push(['milestone', recordData.milestone]);
      break;
  }

  const finalTags = ensureBlobbiTagsAndNormalize(
    tags,
    'createBlobbiRecordEvent',
    BLOBBI_EVENT_KINDS.RECORD
  );

  return {
    kind: BLOBBI_EVENT_KINDS.RECORD,
    content: content || `Blobbi ${recordData.recordType} record`,
    tags: finalTags,
  };
}

export function createBlobbiBreedingEvent(
  parentA: string,
  parentB: string,
  ownerA: string,
  ownerB: string,
  success: boolean,
  offspringId?: string,
  additionalData?: Record<string, string>
): Omit<BlobbiBreedingEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: NostrTag[] = [
    ['parent_a', parentA],
    ['parent_b', parentB],
    ['owner_a', ownerA],
    ['owner_b', ownerB],
    ['breed_time', nowInSeconds().toString()], // SECONDS (Nostr standard)
    ['success', success.toString()],
  ];

  if (offspringId) tags.push(['offspring_id', offspringId]);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      tags.push([key, value]);
    });
  }

  const finalTags = ensureBlobbiTagsAndNormalize(
    tags,
    'createBlobbiBreedingEvent',
    BLOBBI_EVENT_KINDS.BREEDING
  );

  return {
    kind: BLOBBI_EVENT_KINDS.BREEDING,
    content: success ? 'New life is forming ✨' : 'Breeding attempt was unsuccessful',
    tags: finalTags,
  };
}

export function createBlobbonautProfileEvent(
  profile: BlobbonautProfile
): Omit<BlobbonautProfileEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: NostrTag[] = [
    ['d', profile.id],
    ['name', profile.name || ''],
  ];

  if (profile.coins !== undefined) tags.push(['coins', profile.coins.toString()]);
  if (profile.pettingLevel !== undefined) tags.push(['pettingLevel', profile.pettingLevel.toString()]);
  if (profile.lifetimeBlobbis !== undefined) tags.push(['lifetimeBlobbis', profile.lifetimeBlobbis.toString()]);
  if (profile.favoriteBlobbi) tags.push(['favoriteBlobbi', profile.favoriteBlobbi]);
  if (profile.starterBlobbi) tags.push(['starterBlobbi', profile.starterBlobbi]);
  if (profile.style) tags.push(['style', profile.style]);
  if (profile.background) tags.push(['background', profile.background]);
  if (profile.title) tags.push(['title', profile.title]);
  if (profile.currentCompanion) tags.push(['current_companion', profile.currentCompanion]);

  tags.push(['onboarding_done', (profile.onboardingDone ?? false).toString()]);

  profile.ownedBlobbis.forEach(blobbiId => {
    tags.push(['has', blobbiId]);
  });

  profile.achievements.forEach(achievement => {
    tags.push(['achievements', achievement]);
  });

  profile.storage.forEach(storageItem => {
    tags.push(['storage', `${storageItem.itemId}:${storageItem.quantity}`]);
  });

  if (profile.additionalTags) {
    Object.entries(profile.additionalTags).forEach(([tagName, tagValue]) => {
      if (Array.isArray(tagValue)) {
        tagValue.forEach(value => {
          if (typeof value === 'string' && value.trim() !== '') {
            tags.push([tagName, value]);
          }
        });
      } else if (typeof tagValue === 'string' && tagValue.trim() !== '') {
        tags.push([tagName, tagValue]);
      }
    });
  }

  const finalTags = ensureBlobbiTagsAndNormalize(
    tags,
    'createBlobbonautProfileEvent',
    BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE
  );

  return {
    kind: BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE,
    content: '',
    tags: finalTags,
  };
}

// ============================================================================
// EVENT PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a Blobbi from a kind 31124 STATE event.
 * 
 * TIME UNITS:
 * - birthTime: MILLISECONDS (event.created_at * 1000) - for UI compatibility (Date, formatDistanceToNow)
 * - lastInteraction: SECONDS (from tag or event.created_at) - Nostr standard
 * - lastMeal, lastClean, lastWarm, etc.: SECONDS (from tags) - Nostr standard
 * - sleepStartedAt, lastSleepUpdate: SECONDS (from tags) - Nostr standard
 * 
 * CONVENTION: birthTime/hatchTime are the ONLY fields stored in milliseconds for UI compatibility.
 * All other timestamps use SECONDS (Nostr standard). Convert to ms at UI boundaries.
 * 
 * @param event - Nostr event of kind 31124
 * @returns Parsed Blobbi object or null if invalid
 */
export function parseBlobbiFromStateEvent(event: NostrEvent): Blobbi | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.STATE) return null;

    const tags = event.tags;
    const normalizedTags = event.tags.map(tag => [tag[0] ?? '', tag[1] ?? '']) as [string, string][];

    const id = getTagValue(tags, 'd');
    const stage = getTagValue(tags, 'stage') as BlobbiLifeStage;

    if (!id || !tags) {
      return null;
    }

    const { stats: recoveredStats, usedRecovery } = recoverMissingStatsFromTimestamps(id, tags);

    const hungerStr = getTagValue(tags, 'hunger');
    const happinessStr = getTagValue(tags, 'happiness');
    const healthStr = getTagValue(tags, 'health');
    const hygieneStr = getTagValue(tags, 'hygiene');
    const energyStr = getTagValue(tags, 'energy');

    let stats: BlobbiStats;

    if (hungerStr && happinessStr && healthStr && hygieneStr && energyStr) {
      stats = {
        hunger: Math.max(0, Math.min(100, parseInt(hungerStr))),
        happiness: Math.max(0, Math.min(100, parseInt(happinessStr))),
        health: Math.max(0, Math.min(100, parseInt(healthStr))),
        hygiene: Math.max(0, Math.min(100, parseInt(hygieneStr))),
        energy: Math.max(0, Math.min(100, parseInt(energyStr))),
      };
      // Note: Auto-repair is triggered separately by eventNeedsRepair() if needed
    } else {
      stats = recoveredStats;
      // Note: Auto-repair is triggered separately by eventNeedsRepair() if needed
    }

    // Use defaults for missing non-stat required tags instead of failing
    const breedingReady = getTagValue(tags, 'breeding_ready') === 'true';
    const generation = parseInt(getTagValue(tags, 'generation') || '1');
    const experience = parseInt(getTagValue(tags, 'experience') || '0');
    const careStreak = parseInt(getTagValue(tags, 'care_streak') || '0');

    // Only fail if we don't have stage - use 'baby' as default if missing
    const finalStage = stage || 'baby';

    const isDivine = getTagValue(tags, 'theme') === 'divine' || getTagValue(tags, 'crossover_app') === 'divine';

    const blobbi: Blobbi = {
      id,
      ownerPubkey: event.pubkey,
      name: extractBlobbiName(id),
      birthTime: event.created_at * 1000, // MILLISECONDS (for UI compatibility - Date, formatDistanceToNow, etc.)
      lastInteraction: getTagValue(tags, 'last_interaction') ? parseInt(getTagValue(tags, 'last_interaction')!) : event.created_at, // SECONDS
      lifeStage: finalStage,
      state: getTagValue(tags, 'is_sleeping') === 'true' ? 'sleeping' : 'active',
      stats,
      customization: {
        color: getTagValue(tags, 'base_color') || '#7C3AED',
        pattern: getTagValue(tags, 'pattern'),
        accessories: [],
      },
      experience,
      coins: 0,
      inventory: [],
      generation,
      breedingReady,
      careStreak,
      evolutionProgress: {
        totalCareDays: 0,
        currentStreak: careStreak,
        lastCareDate: 0,
        careSessions: [],
        isEligibleForEvolution: false,
        nextEvolutionCheck: Date.now(),
      },
      tags: tags.map(t => t.filter(x => typeof x === 'string') as string[]), // preserve extra fields safely
      themeVariant: getTagValue(tags, 'theme'),
      crossoverApp: getTagValue(tags, 'crossover_app'),
      baseColor: getTagValue(tags, 'base_color'),
      secondaryColor: isDivine ? undefined : getTagValue(tags, 'secondary_color'),
      pattern: getTagValue(tags, 'pattern'),
      eyeColor: getTagValue(tags, 'eye_color'),
      specialMark: getTagValue(tags, 'special_mark'),
      personality: getTagValues(tags, 'personality'),
      traits: getTagValues(tags, 'trait'),
      mood: getTagValue(tags, 'mood') as BlobbiMood,
      favoriteFood: getTagValue(tags, 'favorite_food'),
      voiceType: getTagValue(tags, 'voice_type'),
      size: getTagValue(tags, 'size'),
      title: getTagValue(tags, 'title'),
      skill: getTagValue(tags, 'skill'),
      ...(finalStage === 'egg' && {
        incubationTime: getTagValue(tags, 'incubation_time') ? parseInt(getTagValue(tags, 'incubation_time')!) : undefined,
        incubationProgress: getTagValue(tags, 'incubation_progress') ? parseInt(getTagValue(tags, 'incubation_progress')!) : undefined,
        eggTemperature: getTagValue(tags, 'egg_temperature') ? parseInt(getTagValue(tags, 'egg_temperature')!) : undefined,
        eggStatus: getTagValue(tags, 'egg_status'),
        shellIntegrity: getTagValue(tags, 'shell_integrity') ? parseInt(getTagValue(tags, 'shell_integrity')!) : undefined,
      }),
      isSleeping: getTagValue(tags, 'is_sleeping') === 'true',
      isDirty: getTagValue(tags, 'is_dirty') === 'true',
      hasBuff: getTagValue(tags, 'has_buff'),
      hasDebuff: getTagValue(tags, 'has_debuff'),
      sleepStartedAt: getTagValue(tags, 'sleep_started_at') ? parseInt(getTagValue(tags, 'sleep_started_at')!) : undefined,
      lastSleepUpdate: getTagValue(tags, 'last_sleep_update') ? parseInt(getTagValue(tags, 'last_sleep_update')!) : undefined,
      lastMeal: getTagValue(tags, 'last_meal') ? parseInt(getTagValue(tags, 'last_meal')!) : undefined,
      lastClean: getTagValue(tags, 'last_clean') ? parseInt(getTagValue(tags, 'last_clean')!) : undefined,
      lastWarm: getTagValue(tags, 'last_warm') ? parseInt(getTagValue(tags, 'last_warm')!) : undefined,
      lastTalk: getTagValue(tags, 'last_talk') ? parseInt(getTagValue(tags, 'last_talk')!) : undefined,
      lastCheck: getTagValue(tags, 'last_check') ? parseInt(getTagValue(tags, 'last_check')!) : undefined,
      lastSing: getTagValue(tags, 'last_sing') ? parseInt(getTagValue(tags, 'last_sing')!) : undefined,
      lastMedicine: getTagValue(tags, 'last_medicine') ? parseInt(getTagValue(tags, 'last_medicine')!) : undefined,
      adoptedBy: getTagValue(tags, 'adopted_by'),
      adoptedFrom: getTagValue(tags, 'adopted_from'),
      currentLocation: getTagValue(tags, 'current_location'),
      inParty: getTagValue(tags, 'in_party') === 'true',
      visibleToOthers: getTagValue(tags, 'visible_to_others') !== 'false',
      evolutionForm: getTagValue(tags, 'adult_type') as BlobbiEvolutionForm || undefined,
    };

    const syncedBlobbi = syncDivineModelFields(blobbi);

    // DEV: Assert timestamps are in correct units
    if (import.meta.env.DEV) {
      const validation = validateDivineConsistency(syncedBlobbi);
      if (!validation.isValid) {
        console.warn('[Divine Tags] Inconsistency detected in parsed Blobbi:', validation.errors);
      }
      
      // Check for milliseconds in SECONDS fields (birthTime/hatchTime are intentionally ms)
      const secondsFields: Array<{ name: string; value?: number }> = [
        { name: 'lastInteraction', value: syncedBlobbi.lastInteraction },
        { name: 'lastMeal', value: syncedBlobbi.lastMeal },
        { name: 'lastClean', value: syncedBlobbi.lastClean },
        { name: 'lastWarm', value: syncedBlobbi.lastWarm },
        { name: 'sleepStartedAt', value: syncedBlobbi.sleepStartedAt },
        { name: 'lastSleepUpdate', value: syncedBlobbi.lastSleepUpdate },
      ];
      
      for (const { name, value } of secondsFields) {
        if (value && value > 1e12) {
          console.warn(
            `[Timestamp] ${name} looks like milliseconds (${value}), expected seconds. ` +
            `Blobbi: ${id}`
          );
        }
      }
      
      // Check birthTime is in milliseconds (should be > 1e12)
      if (syncedBlobbi.birthTime && syncedBlobbi.birthTime < 1e12) {
        console.warn(
          `[Timestamp] birthTime looks like seconds (${syncedBlobbi.birthTime}), expected milliseconds. ` +
          `Blobbi: ${id}`
        );
      }
    }

    validateBlobbiStats(syncedBlobbi, `parseBlobbiFromStateEvent(${id})`);

    return syncedBlobbi;
  } catch (error) {
    console.error('Error parsing Blobbi from state event:', error);
    return null;
  }
}

export function parseInteractionFromEvent(event: NostrEvent): BlobbiInteractionData | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.INTERACTION) return null;

    const tags = event.tags;
    if (!validateRequiredTags(tags, REQUIRED_INTERACTION_TAGS)) return null;

    const action = getTagValue(tags, 'action') as BlobbiInteractionType;
    const actionCategory = getTagValue(tags, 'action_category');
    
    // Collect ALL stat_change tags
    const statChangeTags = tags.filter(([name]) => name === 'stat_change');
    
    if (!action || !actionCategory || statChangeTags.length === 0) return null;

    // Parse all stat changes
    const statChanges: Array<[string, string]> = [];
    for (const tag of statChangeTags) {
      const parts = tag[1]?.split(':');
      if (parts && parts.length === 2) {
        statChanges.push([parts[0], parts[1]]);
      }
    }
    
    if (statChanges.length === 0) return null;
    
    // First stat change for backward compatibility
    const statChange: [string, string] = statChanges[0];

    const interactionData: BlobbiInteractionData = {
      action,
      actionCategory,
      statChange,
      statChanges, // NEW: all stat changes
      itemUsed: getTagValue(tags, 'item_used'),
      itemQuality: getTagValue(tags, 'item_quality'),
      timeOfDay: getTagValue(tags, 'time_of_day'),
      blobbiMoodBefore: getTagValue(tags, 'blobbi_mood_before'),
      blobbiMoodAfter: getTagValue(tags, 'blobbi_mood_after'),
      animationPlayed: getTagValue(tags, 'animation_played'),
      soundPlayed: getTagValue(tags, 'sound_played'),
      bonusApplied: getTagValue(tags, 'bonus_applied'),
      experienceGained: getTagValue(tags, 'experience_gained') ? parseInt(getTagValue(tags, 'experience_gained')!) : undefined,
      careStreak: getTagValue(tags, 'care_streak') ? parseInt(getTagValue(tags, 'care_streak')!) : undefined,
      carePoints: getTagValue(tags, 'care_points') ? parseInt(getTagValue(tags, 'care_points')!) : undefined,
      achievementUnlocked: getTagValue(tags, 'achievement_unlocked'),
      specialEvent: getTagValue(tags, 'special_event'),
      memoryCreated: getTagValue(tags, 'memory_created'),
      gameType: getTagValue(tags, 'game_type'),
      toyUsed: getTagValue(tags, 'toy_used'),
      playDuration: getTagValue(tags, 'play_duration') ? parseInt(getTagValue(tags, 'play_duration')!) : undefined,
      location: getTagValue(tags, 'location'),
      playPartner: getTagValue(tags, 'play_partner'),
      newMoveLearn: getTagValue(tags, 'new_move_learned'),
      cleaningType: getTagValue(tags, 'cleaning_type'),
      waterTemperature: getTagValue(tags, 'water_temperature'),
      soapUsed: getTagValue(tags, 'soap_used'),
      groomingTool: getTagValue(tags, 'grooming_tool'),
      specialEffect: getTagValue(tags, 'special_effect'),
      scentApplied: getTagValue(tags, 'scent_applied'),
      moodBoost: getTagValue(tags, 'mood_boost'),
      restType: getTagValue(tags, 'rest_type'),
      bedType: getTagValue(tags, 'bed_type'),
      lullabyPlayed: getTagValue(tags, 'lullaby_played'),
      sleepDuration: getTagValue(tags, 'sleep_duration') ? parseInt(getTagValue(tags, 'sleep_duration')!) : undefined,
      dreamType: getTagValue(tags, 'dream_type'),
      growthBonus: getTagValue(tags, 'growth_bonus'),
      dreamMemory: getTagValue(tags, 'dream_memory'),
      interactionQuality: getTagValue(tags, 'interaction_quality'),
      emotionTriggered: getTagValue(tags, 'emotion_triggered'),
      sharedMemory: getTagValue(tags, 'shared_memory'),
      interactionContext: getTagValue(tags, 'interaction_context'),
    };

    const achievementProgressTag = tags.find(([name]) => name === 'achievement_progress');
    if (achievementProgressTag) {
      const parts = achievementProgressTag[1].split(':');
      if (parts.length === 2) {
        interactionData.achievementProgress = [parts[0], parts[1]];
      }
    }

    const skillImprovedTag = tags.find(([name]) => name === 'skill_improved');
    if (skillImprovedTag) {
      const parts = skillImprovedTag[1].split(':');
      if (parts.length === 2) {
        interactionData.skillImproved = [parts[0], parts[1]];
      }
    }

    const bondIncreasedTag = tags.find(([name]) => name === 'bond_increased');
    if (bondIncreasedTag) {
      const parts = bondIncreasedTag[1].split(':');
      if (parts.length === 2) {
        interactionData.bondIncreased = [parts[0], parts[1]];
      }
    }

    const socialRoleTag = tags.find(([name]) => name === 'social_role');
    if (socialRoleTag) {
      const parts = socialRoleTag[1].split(':');
      if (parts.length === 2) {
        interactionData.socialRole = [parts[0], parts[1]];
      }
    }

    return interactionData;
  } catch (error) {
    console.error('Error parsing interaction from event:', error);
    return null;
  }
}

export function parseRecordFromEvent(event: NostrEvent): BlobbiRecordData | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.RECORD) return null;

    const tags = event.tags;
    if (!validateRequiredTags(tags, REQUIRED_RECORD_TAGS)) return null;

    const recordType = getTagValue(tags, 'record_type') as BlobbiRecordType;
    if (!recordType) return null;

    const recordData: BlobbiRecordData = {
      recordType,
      generation: getTagValue(tags, 'generation') ? parseInt(getTagValue(tags, 'generation')!) : undefined,
    };

    switch (recordType) {
      case 'birth': {
        recordData.origin = getTagValue(tags, 'origin');
        recordData.birthLocation = getTagValue(tags, 'birth_location');
        recordData.weatherAtBirth = getTagValue(tags, 'weather_at_birth');
        recordData.shellColor = getTagValue(tags, 'shell_color');
        recordData.shellPattern = getTagValue(tags, 'shell_pattern');
        recordData.initialTrait = getTagValues(tags, 'initial_trait');
        recordData.rarity = getTagValue(tags, 'rarity');
        recordData.parent1 = getTagValue(tags, 'parent_1');
        recordData.parent2 = getTagValue(tags, 'parent_2');
        recordData.lineageDepth = getTagValue(tags, 'lineage_depth') ? parseInt(getTagValue(tags, 'lineage_depth')!) : undefined;
        recordData.geneticMarker = getTagValue(tags, 'genetic_marker');
        recordData.birthSeason = getTagValue(tags, 'birth_season');
        recordData.birthMoonPhase = getTagValue(tags, 'birth_moon_phase');
        recordData.creator = getTagValue(tags, 'creator');
        recordData.designUrl = getTagValue(tags, 'design_url');
        recordData.adoptionFee = getTagValue(tags, 'adoption_fee') ? parseInt(getTagValue(tags, 'adoption_fee')!) : undefined;
        recordData.legacyTrait = getTagValues(tags, 'legacy_trait');
        recordData.passiveTrait = getTagValues(tags, 'passive_trait');
        break;
      }

      case 'hatched': {
        // Parse hatched_at: supports numeric seconds (new) or ISO string (legacy)
        recordData.hatchedAt = parseTimestampTag(getTagValue(tags, 'hatched_at'));
        recordData.hatchedBy = getTagValue(tags, 'hatched_by');
        recordData.eggType = getTagValue(tags, 'egg_type');
        recordData.incubationTime = getTagValue(tags, 'incubation_time');
        recordData.eyeColor = getTagValue(tags, 'eye_color');
        recordData.baseColor = getTagValue(tags, 'base_color');
        recordData.pattern = getTagValue(tags, 'pattern');
        recordData.secondaryColor = getTagValue(tags, 'secondary_color');
        recordData.manifestation = getTagValue(tags, 'manifestation');
        recordData.title = getTagValue(tags, 'title');
        recordData.titleReason = getTagValue(tags, 'title_reason');
        recordData.blessing = getTagValue(tags, 'blessing');
        recordData.memoryTitle = getTagValue(tags, 'memory_title');
        recordData.memoryDescription = getTagValue(tags, 'memory_description');
        recordData.memoryDate = getTagValue(tags, 'memory_date');
        recordData.passiveTrait = getTagValues(tags, 'passive_trait');
        recordData.evolvedFrom = getTagValue(tags, 'evolved_from');
        recordData.hatchFee = getTagValue(tags, 'hatch_fee') ? parseInt(getTagValue(tags, 'hatch_fee')!) : undefined;
        recordData.evolutionStage = getTagValue(tags, 'evolution_stage');
        break;
      }

      case 'adoption': {
        recordData.adoptedBy = getTagValue(tags, 'adopted_by');
        // Parse adopted_on: supports numeric seconds (new) or ISO string (legacy)
        recordData.adoptedOn = parseTimestampTag(getTagValue(tags, 'adopted_on'));
        recordData.adoptionMethod = getTagValue(tags, 'adoption_method');
        recordData.title = getTagValue(tags, 'title');
        recordData.titleReason = getTagValue(tags, 'title_reason');
        break;
      }

      case 'evolution': {
        recordData.evolutionStage = getTagValue(tags, 'evolution_stage');
        recordData.evolutionReason = getTagValue(tags, 'evolution_reason');
        recordData.evolvedFrom = getTagValue(tags, 'evolved_from');
        break;
      }

      case 'memory': {
        recordData.memoryTitle = getTagValue(tags, 'memory_title');
        recordData.memoryDescription = getTagValue(tags, 'memory_description');
        recordData.memoryDate = getTagValue(tags, 'memory_date');
        recordData.discoveredTrait = getTagValue(tags, 'discovered_trait');
        recordData.achievement = getTagValue(tags, 'achievement');
        recordData.milestone = getTagValue(tags, 'milestone');
        break;
      }
    }

    return recordData;
  } catch (error) {
    console.error('Error parsing record from event:', error);
    return null;
  }
}

export function parseBlobbonautProfileFromEvent(event: NostrEvent): BlobbonautProfile | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE) {
      console.warn('[Blobbonaut Parser] Invalid event kind:', event.kind);
      return null;
    }

    const tags = event.tags;

    const id = getTagValue(tags, 'd');
    if (!id) {
      console.warn('[Blobbonaut Parser] Missing required "d" tag');
      return null;
    }

    console.log('[Blobbonaut Parser] Parsing profile with id:', id);

    const knownTagNames = [
      'd', 'name', 'coins', 'has', 'pettingLevel', 'lifetimeBlobbis',
      'achievements', 'storage', 'favoriteBlobbi', 'starterBlobbi', 'style',
      'background', 'title', 'current_companion', 'onboarding_done'
    ];

    const storageTagValues = getTagValues(tags, 'storage');
    const storage: BlobbonautStorageItem[] = storageTagValues
      .map(storageValue => {
        const parts = storageValue.split(':');
        if (parts.length === 2) {
          const itemId = parts[0];
          const quantity = parseInt(parts[1]);
          if (!isNaN(quantity) && quantity > 0) {
            return { itemId, quantity };
          }
        }
        return null;
      })
      .filter((item): item is BlobbonautStorageItem => item !== null);

    const onboardingDoneValue = getTagValue(tags, 'onboarding_done');
    const onboardingDone = onboardingDoneValue !== undefined ? onboardingDoneValue === 'true' : false;

    const additionalTags: Record<string, string | string[]> = {};
    tags.forEach(([tagName, tagValue]) => {
      if (tagName && tagValue && !knownTagNames.includes(tagName)) {
        if (additionalTags[tagName]) {
          if (Array.isArray(additionalTags[tagName])) {
            (additionalTags[tagName] as string[]).push(tagValue);
          } else {
            additionalTags[tagName] = [additionalTags[tagName] as string, tagValue];
          }
        } else {
          additionalTags[tagName] = tagValue;
        }
      }
    });

    const profile: BlobbonautProfile = {
      id,
      ownerPubkey: event.pubkey,
      name: (() => {
        const nameValue = getTagValue(tags, 'name');
        return nameValue && nameValue.trim() !== '' ? nameValue : undefined;
      })(),
      coins: (() => {
        const coinsValue = getTagValue(tags, 'coins');
        const parsed = parseInt(coinsValue || '0');
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      })(),
      ownedBlobbis: getTagValues(tags, 'has') || [],
      pettingLevel: (() => {
        const levelValue = getTagValue(tags, 'pettingLevel');
        const parsed = parseInt(levelValue || '0');
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      })(),
      lifetimeBlobbis: (() => {
        const lifetimeValue = getTagValue(tags, 'lifetimeBlobbis');
        const parsed = parseInt(lifetimeValue || '0');
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      })(),
      achievements: getTagValues(tags, 'achievements') || [],
      storage: storage || [],
      favoriteBlobbi: getTagValue(tags, 'favoriteBlobbi'),
      starterBlobbi: getTagValue(tags, 'starterBlobbi'),
      style: getTagValue(tags, 'style'),
      background: getTagValue(tags, 'background'),
      title: getTagValue(tags, 'title'),
      currentCompanion: getTagValue(tags, 'current_companion'),
      onboardingDone,
      lastModified: event.created_at,
      additionalTags: Object.keys(additionalTags).length > 0 ? additionalTags : undefined,
    };

    console.log('[Blobbonaut Parser] Successfully parsed profile:', {
      id: profile.id,
      name: profile.name,
      coins: profile.coins,
      ownedBlobbis: profile.ownedBlobbis.length,
    });

    return profile;
  } catch (error) {
    console.error('[Blobbonaut Parser] Error parsing Blobbonaut Profile from event:', error);
    return null;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateRecordTypeSpecificTags(tags: string[][], recordType: string): boolean {
  const tagNames = tags.map(tag => tag[0]).filter(Boolean);

  switch (recordType) {
    case 'birth':
      return tagNames.includes('generation');
    case 'hatched':
      return tagNames.includes('hatched_at') || tagNames.includes('hatched_by');
    case 'evolution':
      return tagNames.includes('evolution_stage');
    case 'memory':
      return tagNames.includes('memory_title') || tagNames.includes('achievement') || tagNames.includes('milestone');
    case 'adoption':
      return tagNames.includes('adopted_by') || tagNames.includes('title');
    default:
      return true;
  }
}

function validateStatChange(statChangeTag: string): boolean {
  const parts = statChangeTag.split(':');
  if (parts.length !== 2) return false;

  const [stat, change] = parts;
  const changeNum = parseInt(change);

  return VALID_STAT_NAMES.includes(stat as typeof VALID_STAT_NAMES[number]) && !isNaN(changeNum) && Math.abs(changeNum) <= 100;
}

/**
 * Validates a timestamp tag value.
 * Supports both formats:
 * - Numeric seconds (new format): "1700000000"
 * - ISO string (legacy format): "2023-11-14T22:13:20.000Z"
 * 
 * @param timestamp - Tag value to validate
 * @returns true if valid timestamp
 */
function validateTimestamp(timestamp: string): boolean {
  // Try parsing as numeric seconds
  const numericValue = parseInt(timestamp, 10);
  if (!isNaN(numericValue) && numericValue > 0) {
    return true; // Valid numeric seconds
  }
  
  // Fallback: try parsing as ISO string
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.getTime() > 0;
}

/**
 * Validates a Blobbi event.
 * 
 * @param event - Nostr event to validate
 * @param mode - Validation mode ('strict' or 'lenient'), defaults to 'strict'
 * @returns true if event is valid
 */
export function validateBlobbiEvent(event: NostrEvent, mode: ValidationMode = 'strict'): boolean {
  try {
    if (!Object.values(BLOBBI_EVENT_KINDS).includes(event.kind as typeof BLOBBI_EVENT_KINDS[keyof typeof BLOBBI_EVENT_KINDS])) {
      return false;
    }

    switch (event.kind) {
      case BLOBBI_EVENT_KINDS.STATE: {
        if (!validateRequiredTags(event.tags, REQUIRED_STATE_TAGS)) return false;

        const statTags = ['hunger', 'happiness', 'health', 'hygiene', 'energy'];
        
        if (mode === 'strict') {
          // Strict mode: require all stat tags
          for (const statTag of statTags) {
            const value = getTagValue(event.tags, statTag);
            if (!value) return false; // Missing stat tag in strict mode
            
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 100) return false;
          }
        } else {
          // Lenient mode: validate stats if present, but don't require them
          for (const statTag of statTags) {
            const value = getTagValue(event.tags, statTag);
            if (value) {
              const numValue = parseInt(value);
              if (isNaN(numValue) || numValue < 0 || numValue > 100) return false;
            }
          }
        }

        const stage = getTagValue(event.tags, 'stage');
        if (stage && !VALID_STAGES.includes(stage as BlobbiLifeStage)) return false;

        break;
      }

      case BLOBBI_EVENT_KINDS.INTERACTION: {
        if (!validateRequiredTags(event.tags, REQUIRED_INTERACTION_TAGS)) return false;

        // Validate ALL stat_change tags
        const statChangeTags = event.tags.filter(([name]) => name === 'stat_change');
        if (statChangeTags.length === 0) return false; // At least one required
        
        for (const statChangeTag of statChangeTags) {
          if (!validateStatChange(statChangeTag[1])) return false;
        }

        const action = getTagValue(event.tags, 'action');
        if (action && !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) return false;

        break;
      }

      case BLOBBI_EVENT_KINDS.RECORD: {
        if (!validateRequiredTags(event.tags, REQUIRED_RECORD_TAGS)) return false;

        const recordType = getTagValue(event.tags, 'record_type');
        if (recordType && !validateRecordTypeSpecificTags(event.tags, recordType)) return false;

        const timestampFields = ['hatched_at', 'adopted_on'];
        for (const field of timestampFields) {
          const timestamp = getTagValue(event.tags, field);
          if (timestamp && !validateTimestamp(timestamp)) return false;
        }

        break;
      }

      case BLOBBI_EVENT_KINDS.BREEDING: {
        if (!validateRequiredTags(event.tags, REQUIRED_BREEDING_TAGS)) return false;

        const breedTime = getTagValue(event.tags, 'breed_time');
        if (breedTime && !validateTimestamp(breedTime)) return false;

        const success = getTagValue(event.tags, 'success');
        if (success && !['true', 'false'].includes(success)) return false;

        break;
      }

      case BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE: {
        if (!validateRequiredTags(event.tags, REQUIRED_BLOBBONAUT_TAGS)) return false;

        if (event.content !== '') return false;

        const numericFields = ['coins', 'pettingLevel', 'lifetimeBlobbis'];
        for (const field of numericFields) {
          const value = getTagValue(event.tags, field);
          if (value) {
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 0) return false;
          }
        }

        break;
      }

      default:
        return false;
    }

    const minTimestamp = new Date('2020-01-01').getTime() / 1000;
    const maxTimestamp = (Date.now() + 5 * 60 * 1000) / 1000;

    if (event.created_at < minTimestamp || event.created_at > maxTimestamp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
