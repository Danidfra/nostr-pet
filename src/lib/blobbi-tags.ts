/**
 * Blobbi Ecosystem Tagging Utilities
 *
 * This module provides utilities for ensuring all Blobbi ecosystem events
 * are properly tagged with the ecosystem identifier and topic tags.
 */

export const BLOBBI_ECOSYSTEM_TAG: [string, string] = ["b", "blobbi:ecosystem:v1"];
export const BLOBBI_TOPIC_TAG: [string, string] = ["t", "blobbi"];

/**
 * Ensures that the Blobbi ecosystem tag is present in the tags array.
 * If the tag already exists, returns the original array unchanged.
 * If not, adds the tag at the beginning of the array.
 *
 * @param tags - Existing tags array (optional)
 * @returns Tags array with ecosystem tag guaranteed to be present
 */
export function ensureBlobbiEcosystemTag(tags: string[][] = []): string[][] {
  const hasBlobbiTag = tags.some(
    (t) => t[0] === "b" && t[1] === BLOBBI_ECOSYSTEM_TAG[1]
  );

  if (hasBlobbiTag) {
    return tags;
  }

  // Add the ecosystem tag at the beginning
  return [BLOBBI_ECOSYSTEM_TAG, ...tags];
}

/**
 * Ensures that the Blobbi topic tag is present in the tags array.
 * If the tag already exists, returns the original array unchanged.
 * If not, adds the tag at the beginning of the array.
 *
 * @param tags - Existing tags array (optional)
 * @returns Tags array with topic tag guaranteed to be present
 */
export function ensureBlobbiTopicTag(tags: string[][] = []): string[][] {
  const hasTopicTag = tags.some(
    (t) => t[0] === "t" && t[1]?.toLowerCase() === "blobbi"
  );

  if (hasTopicTag) {
    return tags;
  }

  // Add the topic tag at the beginning
  return [BLOBBI_TOPIC_TAG, ...tags];
}

/**
 * Ensures that both Blobbi ecosystem and topic tags are present in the tags array.
 * This is the main function that should be used for all Blobbi events.
 *
 * @param tags - Existing tags array (optional)
 * @returns Tags array with both ecosystem and topic tags guaranteed to be present
 */
export function ensureBlobbiTags(tags: string[][] = []): string[][] {
  let finalTags = tags;

  // Add ecosystem tag if not present
  finalTags = ensureBlobbiEcosystemTag(finalTags);

  // Add topic tag if not present
  finalTags = ensureBlobbiTopicTag(finalTags);

  return finalTags;
}

/**
 * Checks if a tags array contains the Blobbi ecosystem tag.
 *
 * @param tags - Tags array to check
 * @returns True if ecosystem tag is present, false otherwise
 */
export function hasBlobbiEcosystemTag(tags: string[][]): boolean {
  return tags.some(
    (t) => t[0] === "b" && t[1] === BLOBBI_ECOSYSTEM_TAG[1]
  );
}

/**
 * Checks if a tags array contains the Blobbi topic tag.
 *
 * @param tags - Tags array to check
 * @returns True if topic tag is present, false otherwise
 */
export function hasBlobbiTopicTag(tags: string[][]): boolean {
  return tags.some(
    (t) => t[0] === "t" && t[1]?.toLowerCase() === "blobbi"
  );
}

/**
 * Checks if a tags array contains all required Blobbi tags.
 *
 * @param tags - Tags array to check
 * @returns True if both ecosystem and topic tags are present, false otherwise
 */
export function hasAllBlobbiTags(tags: string[][]): boolean {
  return hasBlobbiEcosystemTag(tags) && hasBlobbiTopicTag(tags);
}

/**
 * Debug utility to log missing Blobbi tags in development.
 *
 * @param functionName - Name of the function creating the event
 * @param tags - Tags array being used
 * @param kind - Event kind for context
 */
export function debugBlobbiTags(
  functionName: string,
  tags: string[][],
  kind?: number
): void {
  if (process.env.NODE_ENV !== 'production') {
    if (!hasBlobbiEcosystemTag(tags)) {
      console.warn(`[Blobbi Debug] Missing ecosystem tag in ${functionName}${kind ? ` (kind: ${kind})` : ''}. Adding ["b", "blobbi:ecosystem:v1"]`);
    }
    if (!hasBlobbiTopicTag(tags)) {
      console.warn(`[Blobbi Debug] Missing topic tag in ${functionName}${kind ? ` (kind: ${kind})` : ''}. Adding ["t", "blobbi"]`);
    }
  }
}

/**
 * Enhanced version of ensureBlobbiTags that includes debug logging.
 *
 * @param tags - Existing tags array (optional)
 * @param functionName - Name of the function creating the event (for debug logging)
 * @param kind - Event kind (for debug logging)
 * @returns Tags array with both ecosystem and topic tags guaranteed to be present
 */
export function ensureBlobbiTagsWithDebug(
  tags: string[][] = [],
  functionName?: string,
  kind?: number
): string[][] {
  if (functionName && process.env.NODE_ENV !== 'production') {
    debugBlobbiTags(functionName, tags, kind);
  }

  return ensureBlobbiTags(tags);
}