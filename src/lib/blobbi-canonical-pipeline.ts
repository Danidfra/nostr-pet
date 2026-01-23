/**
 * CANONICAL BLOBBI STATE PIPELINE
 * 
 * This module provides THE SINGLE SOURCE OF TRUTH for how Blobbi state is:
 * - Merged (applying patches without losing untouched fields)
 * - Normalized (timestamps, stats clamping, stage filtering)
 * - Built into events (kind 31124 state events)
 * 
 * ALL state creation and updates MUST go through this pipeline.
 * 
 * ARCHITECTURE:
 * 1. mergeBlobbiState(base, patch, context) → mergedBlobbi
 * 2. filterBlobbiForStage(blobbi, stage) → stageBlobbi
 * 3. createBlobbiStateEvent(blobbi) → kind 31124 event
 * 4. ensureBlobbiTagsAndNormalize(tags) → deduplicated, ordered tags
 */

import { Blobbi, BlobbiLifeStage, BlobbiStats } from '@/types/blobbi';
import { toSecondsTimestamp, nowInSeconds } from './nostr/time';
import { NostrTag } from './nostr/tags';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Context for merge operations - helps track why/where merge is happening
 */
export interface MergeContext {
  /** Source of the merge ('user' | 'auto' | 'system' | 'repair' | 'hatching' | 'evolution') */
  source: 'user' | 'auto' | 'system' | 'repair' | 'hatching' | 'evolution';
  /** Optional description for debugging */
  reason?: string;
  /** Whether to preserve incubation/quest tags (default: true) */
  preserveTaskTags?: boolean;
}

/**
 * Partial Blobbi patch - only fields that are provided will be merged
 * 
 * Note: stats can be partially provided (only update specific stats)
 */
export type BlobbiPatch = Partial<Omit<Blobbi, 'stats'>> & {
  stats?: Partial<BlobbiStats>;
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Egg-only tags that MUST be removed when transitioning to baby/adult
 */
const EGG_ONLY_TAGS = new Set([
  'egg_temperature',
  'egg_status',
  'shell_integrity',
  'hatch_time',
  'start_incubation',
  'incubation_time',
  'start_evolution',
  'last_warm',
  'last_check',
  'last_talk',
  'last_medicine',
  'last_sing',
  'incubation_progress',
  'shell_color',
  'shell_pattern',
]);

/**
 * Task-related tag patterns that should be removed during stage transitions
 */
const TASK_TAG_PATTERNS = [
  '_progress',
  '_confirmed',
  'quest_',
  'task_',
  'incubation_',
  'post_blobbi_photo',
  'interact_',
  'blobbi_hashtag',
];

// ============================================================================
// STAT VALIDATION
// ============================================================================

/**
 * Clamp stat to valid range [0, 100]
 */
export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Validate and clamp all stats in a BlobbiStats object
 */
export function validateStats(stats: Partial<BlobbiStats>): BlobbiStats {
  return {
    hunger: clampStat(stats.hunger ?? 80),
    happiness: clampStat(stats.happiness ?? 80),
    health: clampStat(stats.health ?? 80),
    hygiene: clampStat(stats.hygiene ?? 80),
    energy: clampStat(stats.energy ?? 80),
  };
}

// ============================================================================
// TIMESTAMP NORMALIZATION
// ============================================================================

/**
 * Normalize timestamp fields in a Blobbi object
 * 
 * CONVENTION:
 * - birthTime, hatchTime: MILLISECONDS (UI compatibility)
 * - All other timestamps: SECONDS (Nostr standard)
 */
export function normalizeTimestamps(blobbi: Partial<Blobbi>): Partial<Blobbi> {
  const normalized: Partial<Blobbi> = { ...blobbi };

  // Normalize all SECONDS fields using toSecondsTimestamp
  if (normalized.lastInteraction !== undefined) {
    normalized.lastInteraction = toSecondsTimestamp(normalized.lastInteraction);
  }
  if (normalized.lastMeal !== undefined) {
    normalized.lastMeal = toSecondsTimestamp(normalized.lastMeal);
  }
  if (normalized.lastClean !== undefined) {
    normalized.lastClean = toSecondsTimestamp(normalized.lastClean);
  }
  if (normalized.lastWarm !== undefined) {
    normalized.lastWarm = toSecondsTimestamp(normalized.lastWarm);
  }
  if (normalized.lastTalk !== undefined) {
    normalized.lastTalk = toSecondsTimestamp(normalized.lastTalk);
  }
  if (normalized.lastCheck !== undefined) {
    normalized.lastCheck = toSecondsTimestamp(normalized.lastCheck);
  }
  if (normalized.lastSing !== undefined) {
    normalized.lastSing = toSecondsTimestamp(normalized.lastSing);
  }
  if (normalized.lastMedicine !== undefined) {
    normalized.lastMedicine = toSecondsTimestamp(normalized.lastMedicine);
  }
  if (normalized.sleepStartedAt !== undefined) {
    normalized.sleepStartedAt = toSecondsTimestamp(normalized.sleepStartedAt);
  }
  if (normalized.lastSleepUpdate !== undefined) {
    normalized.lastSleepUpdate = toSecondsTimestamp(normalized.lastSleepUpdate);
  }
  if (normalized.evolutionTime !== undefined) {
    normalized.evolutionTime = toSecondsTimestamp(normalized.evolutionTime);
  }

  // birthTime and hatchTime remain in MILLISECONDS (already handled by UI)

  return normalized;
}

// ============================================================================
// STAGE FILTERING
// ============================================================================

/**
 * Check if a tag should be filtered based on stage transition rules
 */
function shouldFilterTag(tagName: string, targetStage: BlobbiLifeStage): boolean {
  // Egg stage: keep everything
  if (targetStage === 'egg') {
    return false;
  }

  // Baby/Adult: remove egg-only tags
  if (EGG_ONLY_TAGS.has(tagName)) {
    return true;
  }

  // Baby/Adult: remove task-related tags during transitions
  for (const pattern of TASK_TAG_PATTERNS) {
    if (tagName.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter Blobbi fields based on life stage
 * Removes stage-inappropriate fields and tags
 */
export function filterBlobbiForStage(blobbi: Blobbi, targetStage: BlobbiLifeStage): Blobbi {
  const filtered: Blobbi = { ...blobbi, lifeStage: targetStage };

  // Clear egg-specific fields for non-egg stages
  if (targetStage !== 'egg') {
    filtered.incubationTime = undefined;
    filtered.incubationProgress = undefined;
    filtered.eggTemperature = undefined;
    filtered.eggStatus = undefined;
    filtered.shellIntegrity = undefined;
  }

  // Filter tags
  if (filtered.tags) {
    filtered.tags = filtered.tags.filter(([tagName]) => {
      return !shouldFilterTag(tagName || '', targetStage);
    });
  }

  // Update breeding readiness for adults
  if (targetStage === 'adult') {
    filtered.breedingReady = true;
  }

  return filtered;
}

// ============================================================================
// CANONICAL MERGE FUNCTION
// ============================================================================

/**
 * CANONICAL MERGE FUNCTION
 * 
 * Merges a partial Blobbi patch into a base Blobbi object.
 * 
 * RULES:
 * 1. Only fields present in `patch` are updated
 * 2. Untouched fields in `base` are preserved
 * 3. Stats are validated and clamped [0, 100]
 * 4. Timestamps are normalized (seconds convention)
 * 5. Arrays (personality, traits) are REPLACED (not merged)
 * 6. Tags are merged intelligently (multi-value tags are combined)
 * 7. Stage transitions trigger field filtering
 * 
 * @param base - The current Blobbi state
 * @param patch - Partial updates to apply
 * @param context - Merge context (source, reason, options)
 * @returns Merged Blobbi with all fields normalized
 */
export function mergeBlobbiState(
  base: Blobbi,
  patch: BlobbiPatch,
  context: MergeContext
): Blobbi {
  if (import.meta.env.DEV) {
    console.log('[Canonical Pipeline] Merging Blobbi state:', {
      blobbiId: base.id,
      source: context.source,
      reason: context.reason,
      patchKeys: Object.keys(patch),
    });
  }

  // Start with base
  let merged: Blobbi = { ...base };

  // Apply patch fields (shallow merge for top-level fields)
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }

  // Special handling for stats (deep merge + validation)
  if (patch.stats) {
    merged.stats = validateStats({
      ...base.stats,
      ...patch.stats,
    });
  } else {
    // Re-validate existing stats
    merged.stats = validateStats(merged.stats);
  }

  // Normalize all timestamps
  merged = normalizeTimestamps(merged) as Blobbi;

  // Handle stage transitions
  if (patch.lifeStage && patch.lifeStage !== base.lifeStage) {
    merged = filterBlobbiForStage(merged, patch.lifeStage);
  }

  // Handle arrays: personality and traits (REPLACE, not merge)
  if (patch.personality !== undefined) {
    merged.personality = patch.personality;
  }
  if (patch.traits !== undefined) {
    merged.traits = patch.traits;
  }

  // Handle tags: merge intelligently
  if (patch.tags) {
    merged.tags = mergeTagArrays(base.tags, patch.tags, context);
  }

  // Ensure required fields have valid values
  merged.lastInteraction = merged.lastInteraction || nowInSeconds();
  merged.experience = Math.max(0, merged.experience || 0);
  merged.careStreak = Math.max(0, merged.careStreak || 0);
  merged.generation = Math.max(1, merged.generation || 1);

  if (import.meta.env.DEV) {
    console.log('[Canonical Pipeline] Merge complete:', {
      blobbiId: merged.id,
      stage: merged.lifeStage,
      statsValid: Object.values(merged.stats).every(v => v >= 0 && v <= 100),
      tagCount: merged.tags?.length || 0,
    });
  }

  return merged;
}

/**
 * Merge two tag arrays intelligently
 * 
 * Multi-value tags (personality, trait, achievements, has, storage) are combined
 * Singleton tags from `patchTags` override `baseTags`
 * Task-related tags are preserved unless context.preserveTaskTags = false
 */
function mergeTagArrays(
  baseTags: string[][] | undefined,
  patchTags: string[][],
  context: MergeContext
): string[][] {
  const base = baseTags || [];
  const patch = patchTags || [];

  // Multi-value tags that should be combined (not replaced)
  const MULTI_VALUE_TAGS = new Set(['personality', 'trait', 'achievements', 'has', 'storage', 't']);

  // Build a map of base tags
  const baseTagMap = new Map<string, string[][]>();
  for (const tag of base) {
    const name = tag[0];
    if (!name) continue;
    
    if (!baseTagMap.has(name)) {
      baseTagMap.set(name, []);
    }
    baseTagMap.get(name)!.push(tag);
  }

  // Build a map of patch tags
  const patchTagMap = new Map<string, string[][]>();
  for (const tag of patch) {
    const name = tag[0];
    if (!name) continue;
    
    if (!patchTagMap.has(name)) {
      patchTagMap.set(name, []);
    }
    patchTagMap.get(name)!.push(tag);
  }

  // Merge logic
  const merged: string[][] = [];

  // Add all base tags that aren't being replaced
  for (const [tagName, tagList] of baseTagMap.entries()) {
    if (patchTagMap.has(tagName)) {
      // Tag is being updated by patch
      if (MULTI_VALUE_TAGS.has(tagName)) {
        // Multi-value: combine base + patch
        merged.push(...tagList);
      }
      // Singleton: skip base (will be replaced by patch)
    } else {
      // Tag not in patch: keep base
      // Check if should be filtered by stage or task preservation
      const shouldKeep = tagList.every(([name]) => {
        if (!context.preserveTaskTags && context.preserveTaskTags !== undefined) {
          // Check if this is a task tag
          for (const pattern of TASK_TAG_PATTERNS) {
            if ((name || '').includes(pattern)) {
              return false;
            }
          }
        }
        return true;
      });

      if (shouldKeep) {
        merged.push(...tagList);
      }
    }
  }

  // Add all patch tags (overrides for singletons, additions for multi-value)
  for (const [tagName, tagList] of patchTagMap.entries()) {
    merged.push(...tagList);
  }

  return merged;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Apply a patch to a Blobbi (convenience wrapper)
 */
export function applyBlobbiPatch(
  blobbi: Blobbi,
  patch: BlobbiPatch,
  source: MergeContext['source'] = 'user',
  reason?: string
): Blobbi {
  return mergeBlobbiState(blobbi, patch, { source, reason });
}
