import { NostrEvent } from '@nostrify/nostrify';
import { Blobbi, BlobbiRecordData } from '@/types/blobbi';
import { createBlobbiId, isValidBlobbiName } from '@/lib/blobbi-events';

/**
 * Generates a Nostr event of kind 14921 for Blobbi adoption following the exact rules
 * defined in the blobbi-adoption-record-specification.md
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
  common: { probability: 0.5, values: ['#ffffff', '#f2f2f2', '#e6e6ff'] },
  uncommon: { probability: 0.3, values: ['#99ccff', '#ccffcc', '#ffffcc'] },
  rare: { probability: 0.15, values: ['#cc99ff', '#ffb3cc', '#66ffcc'] },
  legendary: { probability: 0.05, values: ['#6633cc', '#ff3399', '#00ffff'] }
};

// Size rarity system (Required - Always Present)
const SIZE_RARITY: RaritySystem<string> = {
  common: { probability: 0.6, values: ['small'] },
  uncommon: { probability: 0.25, values: ['medium'] },
  rare: { probability: 0.1, values: ['large'] },
  legendary: { probability: 0.05, values: ['tiny'] }
};

// Secondary color rarity system (Optional - 45% spawn chance)
const SECONDARY_COLOR_RARITY: RaritySystem<string> = {
  common: { probability: 0.6, values: ['#cccccc', '#f0f0f0', '#aabbcc'] },
  uncommon: { probability: 0.25, values: ['#99ccff', '#ccffcc', '#ffcc99'] },
  rare: { probability: 0.1, values: ['#ff99ff', '#9966ff', '#66cccc'] },
  legendary: { probability: 0.05, values: ['#9933ff', '#ff3399', '#00ffcc'] }
};

// Special mark rarity system (Optional - 15% spawn chance)
const SPECIAL_MARK_RARITY: RaritySystem<string> = {
  common: { probability: 0.5, values: ['dot_center', 'oval_spots'] },
  uncommon: { probability: 0.3, values: ['ring_mark', 'blush_sides'] },
  rare: { probability: 0.15, values: ['rune_top', 'shimmer_band'] },
  legendary: { probability: 0.05, values: ['sigil_eye', 'glow_crack_pattern'] }
};

// Title rarity system (Optional - 10% spawn chance)
const TITLE_RARITY: RaritySystem<string> = {
  common: { probability: 0.5, values: ['Hatchling', 'Watcher of the Nest'] },
  uncommon: { probability: 0.3, values: ['Tender of Flames', 'Whisperer'] },
  rare: { probability: 0.15, values: ['Echo of Ancients', 'Shellbound Hero'] },
  legendary: { probability: 0.05, values: ['Defender of the Grove', 'The Primordial'] }
};

// Pattern options (Required)
const PATTERN_OPTIONS = ['gradient', 'solid', 'speckled', 'striped'];

// Egg status options (Required)
const EGG_STATUS_OPTIONS = ['cracking', 'warm', 'glowing', 'pulsing'];

// Interaction type options (Required)
const INTERACTION_TYPES = ['tap', 'stroke', 'whisper', 'sing'];

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
    title: null
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
 * Creates a complete Blobbi with adoption record following the blobbi-egg.md specification
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
  const blobbiId = createBlobbiId(petName);
  const now = Date.now();
  const createdAtSeconds = Math.floor(now / 1000); // Unix timestamp in seconds for Nostr compatibility
  
  // Create the Blobbi object following the exact specification
  const blobbi: Blobbi = {
    id: blobbiId,
    ownerPubkey: userPubkey,
    name: petName,
    birthTime: now,
    lastInteraction: now,
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
    
    // Additional timestamp fields per specification
    lastMeal: now - (randomBetween(1, 6) * 60 * 60 * 1000), // 1-6 hours ago
    lastBath: now - (randomBetween(12, 48) * 60 * 60 * 1000), // 12-48 hours ago
    
    // Last care tracking fields - initialized with exact timestamp of pet creation
    // These fields are only included during the egg phase for care tracking
    // Using Unix timestamp in seconds (same format as Nostr's created_at)
    lastWarm: createdAtSeconds,
    lastTalk: createdAtSeconds,
    lastCheck: createdAtSeconds,
    lastSing: createdAtSeconds,
    lastClean: createdAtSeconds,
    lastMedicine: createdAtSeconds
  };
  
  // Create the adoption record with proper rarity determination
  let rarity = 'common';
  if (record.title && ['Defender of the Grove', 'The Primordial'].includes(record.title)) {
    rarity = 'legendary';
  } else if (record.special_mark && ['sigil_eye', 'glow_crack_pattern'].includes(record.special_mark)) {
    rarity = 'legendary';
  } else if (record.title && ['Echo of Ancients', 'Shellbound Hero'].includes(record.title)) {
    rarity = 'rare';
  } else if (record.special_mark && ['rune_top', 'shimmer_band'].includes(record.special_mark)) {
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
  };
  
  return {
    blobbi,
    adoptionRecord,
  };
}

/**
 * Generates a unique Blobbi ID following the specification
 */
function generateBlobbiId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'blobbi-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(random() * chars.length));
  }
  return result;
}

/**
 * Converts a BlobbiAdoptionRecord to Nostr event tags format following blobbi-egg.md
 */
export function blobbiEggToTags(record: BlobbiAdoptionRecord, blobbiId: string): string[][] {
  const now = getCurrentTimestamp();
  const createdAtSeconds = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const tags: string[][] = [
    // Required tags
    ['d', blobbiId],
    ['stage', record.stage],
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
    ['last_interaction', now],
    ['last_interaction_type', randomChoice(INTERACTION_TYPES)],
    ['last_meal', getPastTimestamp(randomBetween(1, 6))],
    ['last_bath', getPastTimestamp(randomBetween(12, 48))],
    ['visible_to_others', 'true'],
    // Last care tracking fields - initialized with exact timestamp of pet creation
    // Using Unix timestamp in seconds (same format as Nostr's created_at)
    ['last_warm', createdAtSeconds.toString()],
    ['last_talk', createdAtSeconds.toString()],
    ['last_check', createdAtSeconds.toString()],
    ['last_sing', createdAtSeconds.toString()],
    ['last_clean', createdAtSeconds.toString()],
    ['last_medicine', createdAtSeconds.toString()]
  ];
  
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

  return tags;
}

/**
 * Generates a complete Nostr event for a Blobbi egg following blobbi-egg.md specifications
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
  const blobbiId = generateBlobbiId();
  const tags = blobbiEggToTags(record, blobbiId);
  
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