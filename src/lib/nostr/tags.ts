/**
 * Canonical Nostr Tag Normalization
 *
 * Provides proper tag deduplication and ordering for Nostr events.
 * Handles tags as string[] (NOT [string, string]).
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Canonical Nostr tag type: array of strings
 * Examples:
 *   ["t", "blobbi"]
 *   ["e", "<id>", "<relay>", "root"]
 *   ["p", "<pubkey>"]
 *   ["d", "identifier"]
 */
export type NostrTag = string[];

// ============================================================================
// TAG CLASSIFICATION
// ============================================================================

/**
 * Singleton tags - only one allowed per event (keep LAST occurrence)
 */
const SINGLETON_TAGS = new Set([
  // Identity/required tags
  'd',
  'b',
  'name',
  'client',
  
  // Profile metadata
  'pettingLevel',
  'lifetimeBlobbis',
  'favoriteBlobbi',
  'starterBlobbi',
  'style',
  'background',
  'title',
  'current_companion',
  'onboarding_done',
  'coins',
  
  // Mission/quest tags
  'mission_daily_checkin_claimed_at',
  
  // Blobbi state tags
  'stage',
  'breeding_ready',
  'generation',
  'experience',
  'care_streak',
  'hunger',
  'happiness',
  'health',
  'hygiene',
  'energy',
  'last_interaction',
  'last_interaction_time', // DEPRECATED: use last_interaction instead
  'base_color',
  'secondary_color',
  'pattern',
  'eye_color',
  'special_mark',
  'theme',
  'crossover_app',
  'adult_type',
  'mood',
  'favorite_food',
  'voice_type',
  'size',
  'skill',
  'incubation_time',
  'incubation_progress',
  'egg_temperature',
  'egg_status',
  'shell_integrity',
  'is_sleeping',
  'is_dirty',
  'has_buff',
  'has_debuff',
  'sleep_started_at',
  'last_sleep_update',
  'last_meal',
  'last_clean',
  'last_warm',
  'last_talk',
  'last_check',
  'last_sing',
  'last_medicine',
  'adopted_by',
  'adopted_from',
  'current_location',
  'in_party',
  'visible_to_others',
  'fees',
  'hatch_time',
  'start_incubation',
  'start_evolution',
]);

/**
 * Multi-value tags that need special deduplication logic
 */
const MULTI_VALUE_TAG_HANDLERS: Record<
  string,
  (tags: NostrTag[]) => NostrTag[]
> = {
/**
 * t: allow multiple topics, unique by value (tag[1]), preserve full tuples, keep last for same value
 */
  t: (tags) => {
    const seen = new Map<string, NostrTag>();
    for (const tag of tags) {
      const topic = (tag[1] || '').toLowerCase();
      if (topic) seen.set(topic, tag);
    }
    return Array.from(seen.values());
  },
  /**
   * has: unique by Blobbi ID (second value), keep last
   */
  has: (tags) => {
    const seen = new Map<string, NostrTag>();
    // Keep last occurrence of each unique ID
    for (const tag of tags) {
      const blobbiId = tag[1];
      if (blobbiId) {
        seen.set(blobbiId, tag);
      }
    }
    return Array.from(seen.values());
  },

  /**
   * storage: unique by itemId (parse itemId:qty), keep last qty for each itemId
   */
  storage: (tags) => {
    const seen = new Map<string, NostrTag>();
    for (const tag of tags) {
      const value = tag[1];
      if (value) {
        const itemId = value.split(':')[0];
        if (itemId) {
          seen.set(itemId, tag);
        }
      }
    }
    return Array.from(seen.values());
  },

  /**
   * Other multi-value tags: keep unique full tuples
   */
  personality: (tags) => dedupeByFullTuple(tags),
  trait: (tags) => dedupeByFullTuple(tags),
  achievements: (tags) => dedupeByFullTuple(tags),
};

/**
 * Deduplicate tags by exact full tuple match (preserves all fields)
 */
function dedupeByFullTuple(tags: NostrTag[]): NostrTag[] {
  const seen = new Set<string>();
  const result: NostrTag[] = [];

  for (const tag of tags) {
    const key = JSON.stringify(tag);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }

  return result;
}

// ============================================================================
// TAG ORDERING
// ============================================================================

/**
 * Tag name priority for canonical ordering
 */
const TAG_ORDER_PRIORITY: Record<string, number> = {
  // Identity/ecosystem (0-99)
  d: 0,
  b: 1,
  t: 2,
  client: 3,
  name: 4,

  // Profile/meta (100-199)
  coins: 100,
  pettingLevel: 101,
  lifetimeBlobbis: 102,
  onboarding_done: 103,
  mission_daily_checkin_claimed_at: 104,
  favoriteBlobbi: 105,
  starterBlobbi: 106,
  style: 107,
  background: 108,
  title: 109,
  current_companion: 110,

  // Blobbi core state (200-299)
  stage: 200,
  breeding_ready: 201,
  generation: 202,
  experience: 203,
  care_streak: 204,

  // Stats (300-399)
  hunger: 300,
  happiness: 301,
  health: 302,
  hygiene: 303,
  energy: 304,
  last_interaction: 305,
  last_interaction_time: 306,

  // Visual attributes (400-499)
  base_color: 400,
  secondary_color: 401,
  pattern: 402,
  eye_color: 403,
  special_mark: 404,
  theme: 405,
  crossover_app: 406,
  adult_type: 407,
  mood: 408,
  favorite_food: 409,
  voice_type: 410,
  size: 411,
  skill: 412,

  // Multi-value tags (500-599)
  has: 500,
  storage: 501,
  achievements: 502,
  personality: 503,
  trait: 504,
};

/**
 * Get sort priority for a tag name
 */
function getTagPriority(tagName: string): number {
  if (TAG_ORDER_PRIORITY[tagName] !== undefined) {
    return TAG_ORDER_PRIORITY[tagName];
  }

  // Special patterns
  if (tagName.endsWith('_confirmed')) return 600;
  if (tagName.endsWith('_progress')) return 601;
  if (tagName.startsWith('quest_')) return 602;
  if (tagName.startsWith('task_')) return 603;
  if (tagName.startsWith('incubation_')) return 604;

  // Default priority for unknown tags
  return 1000;
}

/**
 * Compare two tags for sorting
 */
function compareTags(a: NostrTag, b: NostrTag): number {
  const nameA = a[0] || '';
  const nameB = b[0] || '';

  // First, sort by tag name priority
  const priorityA = getTagPriority(nameA);
  const priorityB = getTagPriority(nameB);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  // Within same priority/name, sort by second value lexicographically
  if (nameA === nameB) {
    const valueA = a[1] || '';
    const valueB = b[1] || '';
    return valueA.localeCompare(valueB);
  }

  // Fallback: sort by tag name
  return nameA.localeCompare(nameB);
}

// ============================================================================
// CORE NORMALIZATION
// ============================================================================

/**
 * Normalize and deduplicate Nostr event tags
 *
 * Rules:
 * - Groups tags by tag[0]
 * - Singleton tags: keep only LAST occurrence
 * - Multi-value tags: apply custom deduplication logic
 * - Unknown tags: dedupe by full tuple equality
 * - Preserves ALL tag fields (tag[2], tag[3], etc.)
 * - Returns deterministically ordered tags
 *
 * @param tags - Input tags (may contain duplicates)
 * @returns Canonical, deduplicated, ordered tags
 */
export function normalizeTags(tags: NostrTag[]): NostrTag[] {
  // Group tags by name (tag[0])
  const tagGroups = new Map<string, NostrTag[]>();

  for (const tag of tags) {
    const tagName = tag[0];

    // Skip completely empty tags
    if (!tagName) continue;

    if (!tagGroups.has(tagName)) {
      tagGroups.set(tagName, []);
    }
    tagGroups.get(tagName)!.push(tag);
  }

  // Deduplicate and process each tag group
  const deduplicatedTags: NostrTag[] = [];

  for (const [tagName, tagList] of tagGroups.entries()) {
    if (SINGLETON_TAGS.has(tagName)) {
      // For singleton tags, keep only the LAST occurrence
      deduplicatedTags.push(tagList[tagList.length - 1]);
    } else if (MULTI_VALUE_TAG_HANDLERS[tagName]) {
      // Use custom handler for multi-value tags
      const deduped = MULTI_VALUE_TAG_HANDLERS[tagName](tagList);
      deduplicatedTags.push(...deduped);
    } else {
      // For other tags, dedupe by full tuple
      const deduped = dedupeByFullTuple(tagList);
      deduplicatedTags.push(...deduped);
    }
  }

  // Sort tags for canonical ordering
  const sortedTags = [...deduplicatedTags].sort(compareTags);

  return sortedTags;
}

// ============================================================================
// DUPLICATE DETECTION (DEV ONLY)
// ============================================================================

/**
 * Detect and log duplicate tags (DEV mode only)
 *
 * @param tags - Tags to check
 * @param context - Context string for logging (e.g. function name)
 * @returns Object with duplicate detection results
 */
export function detectDuplicateTags(
  tags: NostrTag[],
  context?: string
): {
  hasDuplicates: boolean;
  duplicates: Record<string, number>;
  before: NostrTag[];
  after: NostrTag[];
} {
  const tagCounts = new Map<string, number>();

  // Count occurrences of each singleton tag
  for (const tag of tags) {
    const name = tag[0];
    if (!name) continue;
    if (SINGLETON_TAGS.has(name)) {
      tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
    }
  }

  // Find duplicates
  const duplicates: Record<string, number> = {};
  let hasDuplicates = false;

  for (const [name, count] of tagCounts.entries()) {
    if (count > 1) {
      duplicates[name] = count;
      hasDuplicates = true;
    }
  }

  const normalizedTags = normalizeTags(tags);

  // Log in DEV mode (Vite-safe)
  if (hasDuplicates && import.meta.env.DEV) {
    const contextStr = context ? ` in ${context}` : '';
    console.warn(`[Tag Normalization] Duplicates detected${contextStr}:`, duplicates);
    console.warn('[Tag Normalization] Before:', tags.length, 'tags');
    console.warn('[Tag Normalization] After:', normalizedTags.length, 'tags');

    // Show specific duplicate examples
    for (const [tagName, count] of Object.entries(duplicates)) {
      const examples = tags.filter((tag) => tag[0] === tagName);
      console.warn(`  - "${tagName}": ${count} occurrences`, examples);
    }
  }

  return {
    hasDuplicates,
    duplicates,
    before: tags,
    after: normalizedTags,
  };
}

/**
 * Assert no duplicates (throws error if duplicates found)
 *
 * @param tags - Tags to check
 * @param context - Context string for error message
 */
export function assertNoDuplicates(
  tags: NostrTag[],
  context?: string
): void {
  const { hasDuplicates, duplicates } = detectDuplicateTags(tags, context);

  if (hasDuplicates) {
    const contextStr = context ? ` in ${context}` : '';
    throw new Error(
      `[Tag Normalization] Duplicate tags detected${contextStr}: ${JSON.stringify(duplicates)}`
    );
  }
}
