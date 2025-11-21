import { NostrEvent } from '@nostrify/nostrify';
import { ensureBlobbiTags, hasBlobbiEcosystemTag, hasBlobbiTopicTag } from './blobbi-tags';

/**
 * Interface for merge options when updating Blobbi state tags
 */
export interface BlobbiStateMergeOptions {
  /** New stage to set (e.g., 'egg', 'baby', 'adult') */
  stage?: string;
  /** Timestamp when incubation started (Unix timestamp in seconds) */
  startIncubation?: number;
  /** Whether to remove the start_incubation tag */
  removeStartIncubation?: boolean;
  /** Timestamp when evolution started (Unix timestamp in seconds) */
  startEvolution?: number;
  /** Whether to remove the start_evolution tag */
  removeStartEvolution?: boolean;
  /** Task ID to mark as confirmed (e.g., 'interact_6', 'blobbi_hashtag_post') */
  addConfirmedTaskId?: string;
  /** Progress value for a specific task (e.g., 'interact_6_progress', '3') */
  updateTaskProgress?: { taskId: string; progress: number };
  /** Hatch time timestamp (Unix timestamp in seconds) */
  hatchTime?: number;
  /** Any additional tags to add/override */
  additionalTags?: Array<[string, string]>;
  /** Any tag names to completely remove */
  removeTags?: string[];
  /** Whether to preserve all incubation and quest-related tags (default: true) */
  preserveIncubationAndQuestTags?: boolean;
}

/**
 * Safely merges Blobbi state tags for kind 31124 events
 *
 * This function preserves all existing tags that are not explicitly touched,
 * ensuring we never accidentally lose important metadata like start_incubation
 * or future custom tags.
 *
 * @param originalEventTags - Array of tags from the original 31124 event
 * @param options - Merge options specifying what to change
 * @returns New array of merged tags
 */
export function mergeBlobbiStateTags(
  originalEventTags: string[][],
  options: BlobbiStateMergeOptions
): Array<[string, string]> {
  const preserveIncubationAndQuestTags = options.preserveIncubationAndQuestTags !== false; // Default to true

  // Convert original tags to a more workable format
  const existingTags = new Map<string, string[]>();

  // Group tags by name to handle multiple values
  originalEventTags.forEach(tag => {
    const [name, value] = tag;
    if (!name) return;

    if (!existingTags.has(name)) {
      existingTags.set(name, []);
    }
    if (value) {
      existingTags.get(name)!.push(value);
    }
  });

  // Create the result array
  const result: Array<[string, string]> = [];

  // Track which tags from additionalTags we've processed
  const processedAdditionalTags = new Set<string>();

  // Process each tag name from the original event
  existingTags.forEach((values, tagName) => {
    // Skip tags that we're explicitly removing
    if (options.removeTags?.includes(tagName)) {
      return;
    }

    // Handle special tag modifications
    switch (tagName) {
      case 'stage':
        if (options.stage !== undefined) {
          // Replace with new stage
          result.push(['stage', options.stage]);
        } else {
          // Keep original stage(s)
          values.forEach(value => result.push([tagName, value]));
        }
        break;

      case 'start_incubation':
        if (options.removeStartIncubation) {
          // Don't include this tag at all
          return;
        } else if (options.startIncubation !== undefined) {
          // Replace with new timestamp
          result.push(['start_incubation', options.startIncubation.toString()]);
        } else {
          // Keep original start_incubation tag(s)
          values.forEach(value => result.push([tagName, value]));
        }
        break;

      case 'start_evolution':
        if (options.removeStartEvolution) {
          // Don't include this tag at all
          return;
        } else if (options.startEvolution !== undefined) {
          // Replace with new timestamp
          result.push(['start_evolution', options.startEvolution.toString()]);
        } else {
          // Keep original start_evolution tag(s)
          values.forEach(value => result.push([tagName, value]));
        }
        break;

      case 'hatch_time':
        if (options.hatchTime !== undefined) {
          // Replace with new hatch time
          result.push(['hatch_time', options.hatchTime.toString()]);
        } else {
          // Keep original hatch_time tag(s)
          values.forEach(value => result.push([tagName, value]));
        }
        break;

      default: {
        // Handle specific task progress updates first
        if (options.updateTaskProgress && tagName === `${options.updateTaskProgress.taskId}_progress`) {
          // Replace this specific progress tag with new value
          result.push([tagName, options.updateTaskProgress.progress.toString()]);

          // Don't break here - continue to check if this is also a confirmation tag
        }

        // Handle specific task confirmation updates
        if (options.addConfirmedTaskId && tagName === `${options.addConfirmedTaskId}_confirmed`) {
          // Replace this specific confirmation tag with timestamp
          const timestamp = Math.floor(Date.now() / 1000).toString();
          result.push([tagName, timestamp]);

          // Don't break here - continue to preservation logic
        }

        // 🔥 FIX: Never preserve core stat tags - they must always be current
        const CORE_STAT_TAGS = new Set(['hunger', 'happiness', 'health', 'hygiene', 'energy', 'experience', 'care_streak', 'last_interaction']);

        if (CORE_STAT_TAGS.has(tagName)) {
          // 🔥 CRITICAL: Skip preserved stat tags - they will be overridden by additionalTags with current values

          return; // Don't preserve any stat tags - always use fresh values
        }

        // Check if this tag should be preserved (incubation/quest tags only)
        const shouldPreserveTag = preserveIncubationAndQuestTags && (
          tagName === 'start_incubation' ||
          tagName === 'start_evolution' ||
          tagName === 'hatch_time' ||
          tagName.endsWith('_confirmed') ||
          tagName.endsWith('_progress') ||
          // Add other patterns that should be preserved
          tagName.includes('quest_') ||
          tagName.includes('task_') ||
          tagName.includes('incubation_')
        );

        // Check if this tag is being overridden by additionalTags
        const isBeingOverridden = options.additionalTags?.some(([name]) => name === tagName);

        // Only add the original values if we haven't already processed this tag
        const wasProgressUpdated = options.updateTaskProgress && tagName === `${options.updateTaskProgress.taskId}_progress`;
        const wasConfirmationUpdated = options.addConfirmedTaskId && tagName === `${options.addConfirmedTaskId}_confirmed`;

        if (!wasProgressUpdated && !wasConfirmationUpdated) {
          if (isBeingOverridden && !shouldPreserveTag) {
            // Skip this tag - it will be replaced by additionalTags
            processedAdditionalTags.add(tagName);
          } else {
            // Keep all other tags as-is
            values.forEach(value => result.push([tagName, value]));
          }
        }
        break;
      }
    }
  });

  // Add new tags that weren't in the original event
  if (options.stage !== undefined && !existingTags.has('stage')) {
    result.push(['stage', options.stage]);
  }

  if (options.startIncubation !== undefined && !existingTags.has('start_incubation')) {
    result.push(['start_incubation', options.startIncubation.toString()]);
  }

  if (options.startEvolution !== undefined && !existingTags.has('start_evolution')) {
    result.push(['start_evolution', options.startEvolution.toString()]);
  }

  if (options.hatchTime !== undefined && !existingTags.has('hatch_time')) {
    result.push(['hatch_time', options.hatchTime.toString()]);
  }

  if (options.addConfirmedTaskId && !existingTags.has(`${options.addConfirmedTaskId}_confirmed`)) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    result.push([`${options.addConfirmedTaskId}_confirmed`, timestamp]);
  }

  if (options.updateTaskProgress) {
    // Always add/update progress tags, regardless of whether they already exist
    // The switch logic above handles updating existing tags, but we need to ensure
    // new tags get added here if they weren't processed in the switch
    const progressTagName = `${options.updateTaskProgress.taskId}_progress`;
    const existingProgressIndex = result.findIndex(tag => tag[0] === progressTagName);

    if (existingProgressIndex === -1) {
      // Tag doesn't exist yet, add it
      result.push([progressTagName, options.updateTaskProgress.progress.toString()]);

    }
    // If it exists, it was already updated in the switch logic above
  }

  // Add any additional tags
  if (options.additionalTags) {
    options.additionalTags.forEach(([name, value]) => {
      // Skip if this is a progress tag that was already handled
      if (options.updateTaskProgress && name === `${options.updateTaskProgress.taskId}_progress`) {
        return;
      }

      // Skip if this is a confirmation tag that was already handled
      if (options.addConfirmedTaskId && name === `${options.addConfirmedTaskId}_confirmed`) {
        return;
      }

      // Check if this tag should be preserved (incubation/quest tags)
      const shouldPreserveExisting = preserveIncubationAndQuestTags && (
        name === 'start_incubation' ||
        name === 'start_evolution' ||
        name === 'hatch_time' ||
        name.endsWith('_confirmed') ||
        name.endsWith('_progress') ||
        name.includes('quest_') ||
        name.includes('task_') ||
        name.includes('incubation_')
      );

      if (shouldPreserveExisting && existingTags.has(name)) {
        // Don't override preserved tags
        return;
      }

      // Remove any existing instances of this tag first (if not preserved)
      if (!shouldPreserveExisting || !existingTags.has(name)) {
        const filteredResult = result.filter(tag => tag[0] !== name);
        result.length = 0;
        result.push(...filteredResult);

        // Add the new tag
        result.push([name, value]);
      }
    });
  }

  // Ensure all Blobbi tags are preserved (never removed accidentally)
  if (!hasBlobbiEcosystemTag(result) || !hasBlobbiTopicTag(result)) {
    console.warn('[Blobbi Tags] Blobbi tags were lost during merge, restoring them');
    // Add both tags if either is missing
    if (!hasBlobbiEcosystemTag(result)) {
      result.unshift(['b', 'blobbi:ecosystem:v1']);
    }
    if (!hasBlobbiTopicTag(result)) {
      result.unshift(['t', 'Blobbi']);
      result.unshift(['t', 'blobbi']);
    }
  }

  return result;
}

/**
 * Helper function to extract tag values from a 31124 event
 */
export function extractTagValues(event: NostrEvent, tagName: string): string[] {
  return event.tags
    .filter(tag => tag[0] === tagName && tag[1])
    .map(tag => tag[1]);
}

/**
 * Helper function to check if a tag exists in a 31124 event
 */
export function hasTag(event: NostrEvent, tagName: string): boolean {
  return event.tags.some(tag => tag[0] === tagName);
}

/**
 * Helper function to get the first value of a tag from a 31124 event
 */
export function getFirstTagValue(event: NostrEvent, tagName: string): string | undefined {
  const tag = event.tags.find(tag => tag[0] === tagName);
  return tag?.[1];
}