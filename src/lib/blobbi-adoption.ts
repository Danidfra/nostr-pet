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
  // Required fields with default values
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
  
  // Appearance fields (randomized or null/empty)
  base_color: string;
  secondary_color: string | null;
  pattern: string | null;
  special_mark: string | null;
  title: string | null;
  size: string | null;
  
  // Egg-specific fields with default values
  incubation_time: number;
  incubation_progress: number;
  egg_temperature: number;
  egg_status: string;
  shell_integrity: number;
}

// Randomization options for appearance fields
const BASE_COLORS = [
  '#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff', '#99ffff',
  '#ffcc99', '#ccff99', '#99ccff', '#ffccff', '#ccffcc', '#ffffcc'
];

const SECONDARY_COLORS = [
  '#ffcccc', '#ccffcc', '#ccccff', '#ffffcc', '#ffccff', '#ccffff',
  '#ffeedd', '#eeffdd', '#ddeeff', '#ffeeff', '#eeffee', '#ffffee',
  null, null // 20% chance of no secondary color
];

const PATTERNS = [
  'gradient', 'stripes', 'spots', 'swirl', 'sparkles', 'waves',
  'geometric', 'marble', 'cloud', 'starry',
  null, null, null // 30% chance of no pattern
];

const SPECIAL_MARKS = [
  'star_forehead', 'heart_tail', 'crescent_moon', 'diamond_chest',
  'spiral_eyes', 'glowing_spots', 'rainbow_stripe', 'crystal_horn',
  'flower_crown', 'lightning_bolt',
  null, null, null, null // 40% chance of no special mark
];

const TITLES = [
  'Starlight Wanderer', 'Crystal Guardian', 'Dream Weaver', 'Sky Dancer',
  'Moon Whisperer', 'Forest Friend', 'Ocean Explorer', 'Fire Spirit',
  'Wind Rider', 'Earth Keeper', 'Shadow Walker', 'Light Bearer',
  null, null, null, null, null // 50% chance of no title
];

const SIZES = [
  'tiny', 'small', 'medium', 'large', 'giant',
  null, null // 30% chance of no specific size
];

/**
 * Randomly selects an item from an array
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Creates a Blobbi adoption record with randomized appearance fields
 */
export function createBlobbiAdoptionRecord(): BlobbiAdoptionRecord {
  return {
    // Required fields with default values from spec
    stage: "egg",
    breeding_ready: false,
    generation: 1,
    hunger: 100,
    happiness: 100,
    health: 100,
    hygiene: 100,
    energy: 100,
    experience: 0,
    care_streak: 0,
    
    // Randomized appearance fields
    base_color: randomChoice(BASE_COLORS),
    secondary_color: randomChoice(SECONDARY_COLORS),
    pattern: randomChoice(PATTERNS),
    special_mark: randomChoice(SPECIAL_MARKS),
    title: randomChoice(TITLES),
    size: randomChoice(SIZES),
    
    // Egg-specific fields with default values
    incubation_time: 345600, // 4 days in seconds
    incubation_progress: 0,
    egg_temperature: 100,
    egg_status: "stable",
    shell_integrity: 100
  };
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
 * Creates a complete Blobbi with adoption record following the specification
 */
export function createBlobbiWithAdoption(params: BlobbiAdoptionParams): {
  blobbi: Blobbi;
  adoptionRecord: BlobbiRecordData;
} {
  const { petName, userPubkey } = params;
  
  if (!isValidBlobbiName(petName)) {
    throw new Error('Invalid pet name: must contain at least one alphanumeric character');
  }
  
  // Create the adoption record with randomized values
  const record = createBlobbiAdoptionRecord();
  const blobbiId = createBlobbiId(petName);
  const now = Date.now();
  
  // Create the Blobbi object following the specification
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
      pattern: record.pattern || undefined,
      accessories: [],
    },
    experience: record.experience,
    coins: 100, // Starting coins
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
    pattern: record.pattern || undefined,
    specialMark: record.special_mark || undefined,
    title: record.title || undefined,
    size: record.size || undefined,
    
    // Egg-specific fields from the specification
    incubationTime: record.incubation_time,
    incubationProgress: record.incubation_progress,
    eggTemperature: 'warm', // Convert number to string as expected by the type
    eggStatus: record.egg_status,
    shellIntegrity: record.shell_integrity,
  };
  
  // Create the adoption record
  const adoptionRecord: BlobbiRecordData = {
    recordType: 'birth',
    generation: record.generation,
    origin: 'wild',
    rarity: 'common',
    creator: userPubkey,
    birthLocation: 'enchanted_grove',
    weatherAtBirth: 'clear_sky',
    shellColor: record.base_color,
    shellPattern: record.pattern || undefined,
    initialTrait: ['curious', 'gentle'], // Default traits
  };
  
  return {
    blobbi,
    adoptionRecord,
  };
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