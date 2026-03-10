import { NostrEvent } from '@nostrify/nostrify';
import { Blobbi, BlobbiRecordData } from '@/types/blobbi';
import { 
  getCanonicalBlobbiD, 
  generatePetId10, 
  deriveBlobbiSeedV1 
} from '@/lib/blobbi';
import { isValidBlobbiName } from '@/lib/blobbi-events'; // Legacy validation still used
import {
  VALID_BASE_COLORS,
  VALID_SECONDARY_COLORS,
  VALID_SIZES,
  VALID_SPECIAL_MARKS,
  VALID_TITLES,
  VALID_PATTERNS,
  VALID_EGG_STATUSES
} from './blobbi-egg-validation';

/**
 * Blobbi Adoption System - Canonical Format
 * 
 * Creates Blobbi eggs following canonical format:
 * - ID: blobbi-{12hex}-{10hex}
 * - Seed: 64-char hex deterministic seed
 * - State: canonical 'state' tag
 * - Name: explicit 'name' tag
 * 
 * Adoption records follow blobbi-adoption-record-specification.md
 */
export interface BlobbiAdoptionParams {
  petName: string;
  userPubkey: string;
  createdAt?: number;
}

export interface BlobbiAdoptionRecord {
  // Required fields with exact values per blobbi-egg.md
  stage: string;
  breeding_ready: boolean;
  generation: number;
  hunger: number;
  happiness: number;
  health: number;
  hygiene: number;
  energy: number;
  experience: number;
  care_streak: number;

  // Required appearance fields (always present)
  base_color: string;
  pattern: string;
  size: string;

  // Optional appearance fields (spawn chance based)
  secondary_color: string | null;
  special_mark: string | null;
  title: string | null;

  // Required egg-specific fields
  incubation_time: number;
  incubation_progress: number;
  egg_temperature: number;
  egg_status: string;
  shell_integrity: number;

  // New optional Divine fields
  theme?: string | null;
  crossover_app?: string | null;
}

// Rarity-based randomization following blobbi-egg.md specifications
interface RarityTier<T> {
  probability: number;
  values: T[];
}

interface RaritySystem<T> {
  common: RarityTier<T>;
  uncommon: RarityTier<T>;
  rare: RarityTier<T>;
  legendary: RarityTier<T>;
}

// Base color rarity system (Required - Always Present)
const BASE_COLOR_RARITY: RaritySystem<string> = {
  common: { probability: 0.5, values: [...VALID_BASE_COLORS.common] },
  uncommon: { probability: 0.3, values: [...VALID_BASE_COLORS.uncommon] },
  rare: { probability: 0.15, values: [...VALID_BASE_COLORS.rare] },
  legendary: { probability: 0.05, values: [...VALID_BASE_COLORS.legendary] }
};

// Size rarity system (Required - Always Present)
const SIZE_RARITY: RaritySystem<string> = {
  common: { probability: 0.6, values: [...VALID_SIZES.common] },
  uncommon: { probability: 0.25, values: [...VALID_SIZES.uncommon] },
  rare: { probability: 0.1, values: [...VALID_SIZES.rare] },
  legendary: { probability: 0.05, values: [...VALID_SIZES.legendary] }
};

// Secondary color rarity system (Optional - 45% spawn chance)
const SECONDARY_COLOR_RARITY: RaritySystem<string> = {
  common: { probability: 0.6, values: [...VALID_SECONDARY_COLORS.common] },
  uncommon: { probability: 0.25, values: [...VALID_SECONDARY_COLORS.uncommon] },
  rare: { probability: 0.1, values: [...VALID_SECONDARY_COLORS.rare] },
  legendary: { probability: 0.05, values: [...VALID_SECONDARY_COLORS.legendary] }
};

// Special mark rarity system (Optional - 15% spawn chance)
const SPECIAL_MARK_RARITY: RaritySystem<string> = {
  common: { probability: 0.5, values: [...VALID_SPECIAL_MARKS.common] },
  uncommon: { probability: 0.3, values: [...VALID_SPECIAL_MARKS.uncommon] },
  rare: { probability: 0.15, values: [...VALID_SPECIAL_MARKS.rare] },
  legendary: { probability: 0.05, values: [...VALID_SPECIAL_MARKS.legendary] }
};

// Title rarity system (Optional - 10% spawn chance)
const TITLE_RARITY: RaritySystem<string> = {
  common: { probability: 0.5, values: [...VALID_TITLES.common] },
  uncommon: { probability: 0.3, values: [...VALID_TITLES.uncommon] },
  rare: { probability: 0.15, values: [...VALID_TITLES.rare] },
  legendary: { probability: 0.05, values: [...VALID_TITLES.legendary] }
};

// Pattern options (Required) - from validation
const PATTERN_OPTIONS = [...VALID_PATTERNS];

// Egg status options (Required) - from validation
const EGG_STATUS_OPTIONS = [...VALID_EGG_STATUSES];

// Interaction type options (Required)
const INTERACTION_TYPES = ['tap', 'stroke', 'whisper', 'sing'];

// Divine constants
const DIVINE_EGG_CHANCE = 0.40; // 40% chance, tweakable

// Divine brand color (green) — keep in sync with EggGraphic
export const DIVINE_PRIMARY_GREEN = '#55C4A2';

/**
 * Generates a random number between min and max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random float between 0 and 1
 */
function random(): number {
  return Math.random();
}

/**
 * Selects a value from a rarity system using weighted random selection
 */
function selectFromRarity<T>(raritySystem: RaritySystem<T>): T {
  const roll = random();
  let cumulative = 0;

  const tiers = [
    { tier: raritySystem.common, name: 'common' },
    { tier: raritySystem.uncommon, name: 'uncommon' },
    { tier: raritySystem.rare, name: 'rare' },
    { tier: raritySystem.legendary, name: 'legendary' }
  ];

  for (const { tier } of tiers) {
    cumulative += tier.probability;
    if (roll <= cumulative) {
      return tier.values[Math.floor(random() * tier.values.length)];
    }
  }

  // Fallback to common if something goes wrong
  return raritySystem.common.values[0];
}

/**
 * Randomly selects an item from an array
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(random() * array.length)];
}

/**
 * Generates ISO timestamp for current time
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generates ISO timestamp for a past time (hours ago)
 */
function getPastTimestamp(hoursAgo: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
}

/**
 * Creates a Blobbi adoption record following exact blobbi-egg.md specifications
 */
export function createBlobbiAdoptionRecord(): BlobbiAdoptionRecord {
  const now = getCurrentTimestamp();

  // Required fields with exact values from specification
  const record: BlobbiAdoptionRecord = {
    stage: "egg",
    breeding_ready: false,
    generation: 1,
    // Stats that must be 100
    hunger: 100,
    health: 100,
    energy: 100,
    // Stats that must be random between 80-100
    happiness: randomBetween(80, 100),
    hygiene: randomBetween(80, 100),
    // Ensure default values are always set as specified
    experience: 0, // Must always start at 0
    care_streak: 0,  // Must always start at 0

    // Required fields with rarity-based selection
    base_color: selectFromRarity(BASE_COLOR_RARITY),
    size: selectFromRarity(SIZE_RARITY),

    // Required fields with random selection from options
    pattern: randomChoice(PATTERN_OPTIONS),

    // Egg-specific required fields with enforced defaults
    incubation_time: 345600, // Must always be 345600 (4 days in seconds)
    incubation_progress: 0, // Must always start at 0
    egg_temperature: randomBetween(80, 100),
    egg_status: randomChoice(EGG_STATUS_OPTIONS),
    shell_integrity: randomBetween(80, 100),

    // Initialize optional fields as null (will be set based on spawn chances)
    secondary_color: null,
    special_mark: null,
    title: null,

    theme: null,
    crossover_app: null,
  };

  // Optional fields with spawn chances

  // secondary_color: 45% spawn chance
  if (random() <= 0.45) {
    record.secondary_color = selectFromRarity(SECONDARY_COLOR_RARITY);
  }

  // special_mark: 15% spawn chance
  if (random() <= 0.15) {
    record.special_mark = selectFromRarity(SPECIAL_MARK_RARITY);
  }

  // title: 10% spawn chance
  if (random() <= 0.10) {
    record.title = selectFromRarity(TITLE_RARITY);
  }

  // --- Divine crossover logic ---
  // A small chance that this egg is a Divine crossover egg
  if (random() <= DIVINE_EGG_CHANCE) {
    record.theme = 'divine';
    record.crossover_app = 'divine';

    // Force Divine base color and disable secondary color
    record.base_color = DIVINE_PRIMARY_GREEN;
    record.secondary_color = null;

    // Optionally, you can set a default special mark here if needed
    // record.special_mark = record.special_mark ?? 'divine_wordmark';
  }

  return record;
}

/**
 * Converts null values to empty strings for consistency with spec requirements
 */
function normalizeValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * Creates a complete Blobbi with adoption record in canonical format
 * - Generates canonical ID: blobbi-{12hex}-{10hex}
 * - Derives deterministic seed for visual traits
 * - Includes all canonical tags (state, name, seed)
 * - Follows blobbi-egg.md specification for stats and appearance
 */
export function createBlobbiWithAdoption(params: BlobbiAdoptionParams): {
  blobbi: Blobbi;
  adoptionRecord: BlobbiRecordData;
} {
  const { petName, userPubkey } = params;

  if (!isValidBlobbiName(petName)) {
    throw new Error('Invalid pet name: must contain at least one alphanumeric character');
  }

  // Create the adoption record with specification-compliant randomized values
  const record = createBlobbiAdoptionRecord();
  
  // Generate canonical ID (blobbi-{12hex}-{10hex})
  const petId = generatePetId10();
  const blobbiId = getCanonicalBlobbiD(userPubkey, petId);
  
  const now = Date.now();
  const createdAtSeconds = Math.floor(now / 1000); // Unix timestamp in seconds for Nostr compatibility
  
  // Generate deterministic seed
  const seed = deriveBlobbiSeedV1(userPubkey, blobbiId, createdAtSeconds);

  // Create the Blobbi object following the exact specification
  const blobbi: Blobbi = {
    id: blobbiId, // Canonical format
    ownerPubkey: userPubkey,
    name: petName,
    birthTime: now,
    lifeStage: 'egg',
    state: 'active',
    stats: {
      hunger: record.hunger,
      happiness: record.happiness,
      health: record.health,
      hygiene: record.hygiene,
      energy: record.energy,
    },
    customization: {
      color: record.base_color,
      pattern: record.pattern,
      accessories: [],
    },
    experience: record.experience,
    coins: 0, // Eggs don't start with coins per spec
    inventory: [],
    generation: record.generation,
    breedingReady: record.breeding_ready,
    careStreak: record.care_streak,
    evolutionProgress: {
      totalCareDays: 0,
      currentStreak: 0,
      lastCareDate: 0,
      careSessions: [],
      isEligibleForEvolution: false,
      nextEvolutionCheck: now + 24 * 60 * 60 * 1000, // 24 hours
    },
    visibleToOthers: true,

    // Canonical fields
    seed, // Deterministic seed for visual traits

    // Appearance fields from the specification
    baseColor: record.base_color,
    secondaryColor: record.secondary_color || undefined,
    pattern: record.pattern,
    specialMark: record.special_mark || undefined,
    title: record.title || undefined,
    size: record.size,

    // Egg-specific fields from the specification
    incubationTime: record.incubation_time,
    incubationProgress: record.incubation_progress,
    eggTemperature: record.egg_temperature,
    eggStatus: record.egg_status,
    shellIntegrity: record.shell_integrity,

    // Additional timestamp fields - all use the same creation timestamp in Unix seconds
    lastInteraction: createdAtSeconds,

    themeVariant: record.theme || undefined,
    crossoverApp: record.crossover_app || undefined,
    // Optionally: store tags here if you want the UI to use them directly
    // tags: blobbiEggToTags(record, blobbiId),
  };

  // Create the adoption record with proper rarity determination
  let rarity = 'common';
  if (record.title && ['Defender of the Grove', 'The Primordial'].includes(record.title)) {
    rarity = 'legendary';
  } else if (record.special_mark && ['sigil_eye'].includes(record.special_mark)) {
    rarity = 'legendary';
  } else if (record.title && ['Echo of Ancients', 'Shellbound Hero'].includes(record.title)) {
    rarity = 'rare';
  } else if (record.special_mark && ['rune_top'].includes(record.special_mark)) {
    rarity = 'rare';
  } else if (record.secondary_color || record.special_mark || record.title) {
    rarity = 'uncommon';
  }

  const adoptionRecord: BlobbiRecordData = {
    recordType: 'birth',
    generation: record.generation,
    origin: 'wild',
    rarity,
    creator: userPubkey,
    birthLocation: 'enchanted_grove',
    weatherAtBirth: 'clear_sky',
    shellColor: record.base_color,
    shellPattern: record.pattern,
    initialTrait: ['curious', 'gentle'],
    // NEW Divine fields
    theme: record.theme ?? null,
    crossoverApp: record.crossover_app ?? null,
  };

  return {
    blobbi,
    adoptionRecord,
  };
}

/**
 * Generates a unique Blobbi ID following the specification
 */
/**
 * Generate a random pubkey for demo/testing purposes
 * Returns a valid 64-character hex pubkey
 */
function generateRandomPubkey(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(random() * chars.length));
  }
  return result;
}

/**
 * Converts a BlobbiAdoptionRecord to Nostr event tags format following blobbi-egg.md
 * @param record - The adoption record with all egg data
 * @param blobbiId - Canonical blobbi ID (blobbi-{12hex}-{10hex})
 * @param seed - Deterministic seed for visual traits (64-char hex)
 * @param name - Pet name (required for canonical events)
 */
export function blobbiEggToTags(
  record: BlobbiAdoptionRecord, 
  blobbiId: string,
  seed?: string,
  name?: string
): string[][] {
  const now = getCurrentTimestamp();
  const createdAtSeconds = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const tags: string[][] = [
    // Required canonical tags
    ['d', blobbiId],
    ['stage', record.stage],
    ['state', 'active'], // Canonical state tag
    ['breeding_ready', record.breeding_ready.toString()],
    ['generation', record.generation.toString()],
    ['hunger', record.hunger.toString()],
    ['happiness', record.happiness.toString()],
    ['health', record.health.toString()],
    ['hygiene', record.hygiene.toString()],
    ['energy', record.energy.toString()],
    ['experience', record.experience.toString()],
    ['care_streak', record.care_streak.toString()],
    ['base_color', record.base_color],
    ['pattern', record.pattern],
    ['size', record.size],
    ['incubation_time', record.incubation_time.toString()],
    ['incubation_progress', record.incubation_progress.toString()],
    ['egg_temperature', record.egg_temperature.toString()],
    ['egg_status', record.egg_status],
    ['shell_integrity', record.shell_integrity.toString()],
    ['last_interaction', createdAtSeconds.toString()],
    ['last_interaction_type', randomChoice(INTERACTION_TYPES)],
    ['visible_to_others', 'true']
  ];

  // Add canonical seed tag if provided
  if (seed) {
    tags.push(['seed', seed]);
  }

  // Add canonical name tag if provided
  if (name) {
    tags.push(['name', name]);
  }

  // Add optional tags only if they exist
  if (record.secondary_color) {
    tags.push(['secondary_color', record.secondary_color]);
  }
  if (record.special_mark) {
    tags.push(['special_mark', record.special_mark]);
  }
  if (record.title) {
    tags.push(['title', record.title]);
  }

  // New Divine tags
  if (record.theme) {
    tags.push(['theme', record.theme]);
  }
  if (record.crossover_app) {
    tags.push(['crossover_app', record.crossover_app]);
  }

  return tags;
}

/**
 * Generates a complete Nostr event for a Blobbi egg following canonical format
 * NOTE: This is a demo/testing helper. For production adoption, use createBlobbiWithAdoption()
 */
export function generateBlobbiEggEvent(): {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  blobbiId: string;
  record: BlobbiAdoptionRecord;
} {
  const record = createBlobbiAdoptionRecord();
  
  // Generate canonical ID
  const dummyPubkey = generateRandomPubkey();
  const petId = generatePetId10();
  const blobbiId = getCanonicalBlobbiD(dummyPubkey, petId);
  
  // Generate seed
  const createdAtSeconds = Math.floor(Date.now() / 1000);
  const seed = deriveBlobbiSeedV1(dummyPubkey, blobbiId, createdAtSeconds);
  
  // Generate a random name for the demo egg
  const demoNames = ['Puck', 'Luna', 'Nova', 'Spark', 'Misty', 'Ember'];
  const name = demoNames[Math.floor(random() * demoNames.length)];
  
  const tags = blobbiEggToTags(record, blobbiId, seed, name);

  return {
    kind: 31124,
    content: `A new Blobbi egg has appeared! This ${record.size} egg with ${record.base_color} coloring is ready to be cared for.`,
    tags,
    created_at: Math.floor(Date.now() / 1000),
    blobbiId,
    record
  };
}

/**
 * Generates a sample Blobbi egg for demonstration
 */
export function generateSampleBlobbiEgg(): Record<string, string> {
  const eggEvent = generateBlobbiEggEvent();

  // Convert tags array to object for easier reading
  const eggData: Record<string, string> = {};
  eggEvent.tags.forEach(([key, value]) => {
    eggData[key] = value;
  });

  return eggData;
}

/**
 * Validates a pet name for Blobbi adoption
 */
export function validatePetName(name: string): { isValid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Please enter a name for your Blobbi' };
  }

  if (name.length < 2 || name.length > 20) {
    return { isValid: false, error: 'Pet name must be between 2 and 20 characters' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { isValid: false, error: 'Pet name can only contain letters, numbers, underscores, and hyphens' };
  }

  if (!isValidBlobbiName(name)) {
    return { isValid: false, error: 'Invalid pet name format' };
  }

  return { isValid: true };
}