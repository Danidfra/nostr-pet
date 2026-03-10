import { Blobbi, BlobbiStats, BlobbiLifeStage, BlobbiMood, BlobbiState, BlobbiAction, BlobbiEvolutionForm, BlobbiItem } from '@/types/blobbi';
import { 
  initializeEvolutionProgress, 
  updateEvolutionProgress, 
  shouldTriggerEvolution,
  determineEvolutionForm 
} from './blobbi-evolution';
import { generateRandomVisualEffects } from './blobbi-visual-tags';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// Constants for game mechanics
const STAT_DECAY_RATES = {
  hunger: 0.5,      // Points lost per hour
  happiness: 0.3,   // Points lost per hour
  energy: 0.4,      // Points lost per hour
  hygiene: 0.2,     // Points lost per hour (renamed from cleanliness)
  health: 0.1,      // Points lost per hour
};

const LIFE_STAGE_THRESHOLDS = {
  egg: 0,
  baby: 4 * 24 * 60 * 60 * 1000,    // 4 days (hatching)
  adult: 14 * 24 * 60 * 60 * 1000,   // 14 days (evolution)
};

const ACTION_EFFECTS: Record<BlobbiAction, Partial<BlobbiStats>> = {
  feed: { hunger: 30, happiness: 5 },
  play: { happiness: 25, energy: -15, hygiene: -5 },
  clean: { hygiene: 40, happiness: 10 }, // For baby/adult: hygiene boost; For eggs: shell health boost
  rest: { energy: 50, happiness: 5 },
  warm: { health: 5, happiness: 2 },
  check: { health: 2 },
  sing: { happiness: 15, energy: -5 },
  talk: { happiness: 10 },
  medicine: { health: 30, happiness: -5 }, // For eggs: stronger shell health; For baby/adult: general health
  cruzar: { happiness: 20, energy: -10 }, // Breed action
};

// DEPRECATED: These cooldown constants are superseded by the comprehensive cooldown system
// in cooldown-storage.ts which handles per-stage cooldowns, session limits, and global cooldowns.
// This is kept for backward compatibility only.
const ACTION_COOLDOWNS: Record<BlobbiAction, number> = {
  feed: 30 * 60 * 1000,      // 30 minutes (DEPRECATED - see cooldown-storage.ts)
  play: 15 * 60 * 1000,      // 15 minutes (DEPRECATED - see cooldown-storage.ts)
  clean: 60 * 60 * 1000,     // 1 hour (DEPRECATED - see cooldown-storage.ts)
  rest: 4 * 60 * 60 * 1000,  // 4 hours (DEPRECATED - see cooldown-storage.ts)
  warm: 10 * 60 * 1000,      // 10 minutes (DEPRECATED - see cooldown-storage.ts)
  check: 5 * 60 * 1000,      // 5 minutes (DEPRECATED - see cooldown-storage.ts)
  sing: 20 * 60 * 1000,      // 20 minutes (DEPRECATED - see cooldown-storage.ts)
  talk: 10 * 60 * 1000,      // 10 minutes (DEPRECATED - see cooldown-storage.ts)
  medicine: 2 * 60 * 60 * 1000, // 2 hours (DEPRECATED - see cooldown-storage.ts)
  cruzar: 24 * 60 * 60 * 1000, // 1 day (DEPRECATED - see cooldown-storage.ts)
};

// ============================================================================
// CANONICAL ID GENERATION
// ============================================================================

/**
 * Get first 12 lowercase hex characters from pubkey
 */
export function getPubkeyPrefix12(pubkey: string): string {
  return pubkey.slice(0, 12).toLowerCase();
}

/**
 * Generate random 10-character hex pet ID
 * 5 bytes = 10 hex chars = 40 bits = ~1 trillion possible values
 */
export function generatePetId10(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build canonical Blobbi d-tag: blobbi-{12hex}-{10hex}
 */
export function getCanonicalBlobbiD(pubkey: string, petId: string): string {
  return `blobbi-${getPubkeyPrefix12(pubkey)}-${petId}`;
}

/**
 * Check if d-tag is canonical format
 */
export function isCanonicalBlobbiD(d: string): boolean {
  return /^blobbi-[0-9a-f]{12}-[0-9a-f]{10}$/.test(d);
}

/**
 * Check if d-tag is legacy format
 */
export function isLegacyBlobbiD(d: string): boolean {
  if (!d.startsWith('blobbi-')) return false;
  if (isCanonicalBlobbiD(d)) return false;
  return true;
}

/**
 * Derive display name from legacy d-tag
 * "blobbi-puck" → "Puck"
 * "blobbi-mr-cool" → "Mr Cool"
 */
export function deriveNameFromLegacyD(d: string): string {
  if (!d.startsWith('blobbi-')) {
    return 'Unnamed Blobbi';
  }
  
  const rawName = d
    .replace('blobbi-', '')
    .replace(/[-_]/g, ' ')
    .trim();
  
  if (!rawName || rawName.length === 0) {
    return 'Unnamed Blobbi';
  }
  
  // Capitalize words: "mr cool" → "Mr Cool"
  return rawName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// SEED GENERATION
// ============================================================================

/**
 * Derive deterministic seed (v1 algorithm)
 * seed = sha256("blobbi:v1|" + pubkey + ":" + d + ":" + created_at)
 * 
 * @param pubkey - Owner's full pubkey
 * @param d - Canonical Blobbi d-tag
 * @param createdAt - Unix timestamp in seconds
 * @returns 64-character hex seed
 */
export function deriveBlobbiSeedV1(
  pubkey: string,
  d: string,
  createdAt: number
): string {
  const input = `blobbi:v1|${pubkey}:${d}:${createdAt}`;
  const hashBytes = sha256(new TextEncoder().encode(input));
  return bytesToHex(hashBytes);
}

/**
 * Extract name from Blobbi ID (handles both canonical and legacy formats)
 */
export function extractBlobbiName(id: string): string {
  // If it's a legacy d-tag, derive the name
  if (isLegacyBlobbiD(id)) {
    return deriveNameFromLegacyD(id);
  }
  
  // For canonical IDs, return a default (name should come from name tag)
  return 'Blobbi';
}

// Create a new Blobbi for a user
export function createBlobbi(ownerPubkey: string, name: string = 'Blobbi'): Blobbi {
  // Generate canonical ID (blobbi-{12hex}-{10hex})
  const petId = generatePetId10();
  const canonicalId = getCanonicalBlobbiD(ownerPubkey, petId);
  
  // Generate seed for deterministic visual traits
  const now = Math.floor(Date.now() / 1000); // Unix seconds
  const seed = deriveBlobbiSeedV1(ownerPubkey, canonicalId, now);
  
  // Generate random visual effects for the new Blobbi
  const visualEffects = generateRandomVisualEffects();
  
  // Generate random base colors
  const baseColors = [
    '#ffdab9', '#808080', '#98ff98', // Common: peach, grey, mint
    '#ffcc99', '#00ffff', '#f4a460', // Uncommon: sunset, aqua, sand
    '#f8f8ff', '#0b0b0b', '#ffd700'  // Rare: lunar_white, void_black, radiant_gold
  ];
  
  // Generate random eye colors
  const eyeColors = [
    '#6b4423', '#6699ff', '#a0522d', // Common: brown, blue, hazel
    '#50c878', '#8a2be2', '#c0c0c0', // Uncommon: emerald, violet, silver
    '#ff66cc', '#ffd700', '#ff0033'  // Rare: glow_pink, golden_flare, red_shift
  ];
  
  const baseColor = baseColors[Math.floor(Math.random() * baseColors.length)];
  const eyeColor = eyeColors[Math.floor(Math.random() * eyeColors.length)];
  
  return {
    id: canonicalId, // Canonical format: blobbi-{12hex}-{10hex}
    ownerPubkey,
    name,
    birthTime: Date.now(),
    lastInteraction: now, // Unix seconds
    lifeStage: 'baby',
    state: 'active',
    seed, // Deterministic seed for visual traits
    stats: {
      hunger: 80,
      happiness: 80,
      energy: 80,
      hygiene: 80,
      health: 100,
    },
    customization: {
      color: baseColor,
      accessories: [],
    },
    experience: 0,
    coins: 100, // Starting coins
    inventory: [], // Empty inventory
    evolutionProgress: initializeEvolutionProgress(), // Initialize evolution tracking
    generation: 1,
    breedingReady: false,
    careStreak: 0,
    // Visual appearance
    baseColor,
    eyeColor,
    // Apply random visual effects
    ...visualEffects,
  };
}

// Calculate stat decay based on time passed
export function calculateStatDecay(blobbi: Blobbi, currentTime: number = Date.now()): BlobbiStats {
  const hoursPassed = (currentTime / 1000 - blobbi.lastInteraction) / (60 * 60);
  
  // If sleeping, only energy increases, other stats decay slower
  const sleepMultiplier = blobbi.state === 'sleeping' ? 0.3 : 1;
  
  const newStats: BlobbiStats = {
    hunger: Math.max(0, blobbi.stats.hunger - (STAT_DECAY_RATES.hunger * hoursPassed * sleepMultiplier)),
    happiness: Math.max(0, blobbi.stats.happiness - (STAT_DECAY_RATES.happiness * hoursPassed * sleepMultiplier)),
    energy: blobbi.state === 'sleeping' 
      ? Math.min(100, blobbi.stats.energy + (STAT_DECAY_RATES.energy * hoursPassed * 2))
      : Math.max(0, blobbi.stats.energy - (STAT_DECAY_RATES.energy * hoursPassed)),
    hygiene: Math.max(0, blobbi.stats.hygiene - (STAT_DECAY_RATES.hygiene * hoursPassed * sleepMultiplier)),
    health: Math.max(0, blobbi.stats.health - (STAT_DECAY_RATES.health * hoursPassed * sleepMultiplier)),
  };
  
  // Health decreases faster if other stats are low
  const avgStats = (newStats.hunger + newStats.happiness + newStats.energy + newStats.hygiene) / 4;
  if (avgStats < 30) {
    newStats.health = Math.max(0, newStats.health - (hoursPassed * 0.5));
  }
  
  return newStats;
}

// Get current life stage based on age
export function getLifeStage(birthTime: number, currentTime: number = Date.now()): BlobbiLifeStage {
  const age = currentTime - birthTime;
  
  if (age >= LIFE_STAGE_THRESHOLDS.adult) return 'adult';
  if (age >= LIFE_STAGE_THRESHOLDS.baby) return 'baby';
  return 'egg';
}

// Determine current mood based on stats
export function getBlobbiMood(stats: BlobbiStats, state: BlobbiState): BlobbiMood {
  if (state === 'sleeping') return 'sleepy';
  if (stats.health < 30) return 'sick';
  if (stats.hunger < 30) return 'hungry';
  if (stats.hygiene < 30) return 'dirty';
  if (stats.energy < 30) return 'sleepy';
  if (stats.happiness < 30) return 'sad';
  if (stats.happiness > 70) return 'happy';
  return 'neutral';
}

// Check if Blobbi should go into hibernation
export function shouldHibernate(blobbi: Blobbi, currentTime: number = Date.now()): boolean {
  const daysSinceInteraction = (currentTime / 1000 - blobbi.lastInteraction) / (60 * 60 * 24);
  return daysSinceInteraction > 7 && blobbi.state !== 'hibernating';
}

// Apply an action to Blobbi
export function applyAction(blobbi: Blobbi, action: BlobbiAction, currentTime: number = Date.now(), itemEffects?: Partial<BlobbiStats>): Blobbi {
  // First, calculate current stats with decay
  const currentStats = calculateStatDecay(blobbi, currentTime);
  const currentLifeStage = getLifeStage(blobbi.birthTime, currentTime);
  
  // Wake from hibernation on any action
  let newState = blobbi.state;
  if (blobbi.state === 'hibernating') {
    newState = 'active';
  }
  
  // Handle rest action
  if (action === 'rest' && blobbi.state !== 'sleeping') {
    newState = 'sleeping';
  }
  
  // Apply action effects (combine base effects with item effects if provided)
  const baseEffects = ACTION_EFFECTS[action] || {};
  const combinedEffects = itemEffects ? {
    hunger: (baseEffects.hunger || 0) + (itemEffects.hunger || 0),
    happiness: (baseEffects.happiness || 0) + (itemEffects.happiness || 0),
    energy: (baseEffects.energy || 0) + (itemEffects.energy || 0),
    hygiene: (baseEffects.hygiene || 0) + (itemEffects.hygiene || 0),
    health: (baseEffects.health || 0) + (itemEffects.health || 0),
  } : baseEffects;
  
  const newStats: BlobbiStats = {
    hunger: Math.max(0, Math.min(100, currentStats.hunger + (combinedEffects.hunger || 0))),
    happiness: Math.max(0, Math.min(100, currentStats.happiness + (combinedEffects.happiness || 0))),
    energy: Math.max(0, Math.min(100, currentStats.energy + (combinedEffects.energy || 0))),
    hygiene: Math.max(0, Math.min(100, currentStats.hygiene + (combinedEffects.hygiene || 0))),
    health: Math.max(0, Math.min(100, currentStats.health + (combinedEffects.health || 0))),
  };
  
  // Calculate experience gain
  const expGain = action === 'play' ? 10 : 5;
  
  // Calculate coin rewards for good care
  let coinReward = 0;
  if (Object.values(newStats).every(stat => stat > 70)) {
    coinReward = 10; // Bonus for keeping all stats high
  }
  
  // Update evolution progress
  const updatedEvolutionProgress = updateEvolutionProgress(blobbi, action, currentTime);
  
  // Check for evolution - only after 4 days of consistent care
  let evolutionForm = blobbi.evolutionForm;
  let evolutionTime = blobbi.evolutionTime;
  
  if (!blobbi.evolutionForm && shouldTriggerEvolution({ ...blobbi, evolutionProgress: updatedEvolutionProgress })) {
    // Determine evolution form based on care patterns
    evolutionForm = determineEvolutionForm({ ...blobbi, evolutionProgress: updatedEvolutionProgress });
    evolutionTime = currentTime;
    coinReward += 100; // Big bonus coins for evolution after 4 days of care!
  }
  
  return {
    ...blobbi,
    stats: newStats,
    state: newState,
    lifeStage: currentLifeStage,
    lastInteraction: Math.floor(currentTime / 1000),
    experience: blobbi.experience + expGain,
    coins: blobbi.coins + coinReward,
    evolutionForm,
    evolutionTime,
    evolutionProgress: updatedEvolutionProgress,
  };
}

// DEPRECATED: Check if an action is available (not on cooldown)
// This function is deprecated in favor of the comprehensive cooldown system in cooldown-storage.ts
// which handles per-stage cooldowns, session limits, and global cooldowns.
// Use useBlobbiCooldowns hook or cooldownStorage.isOnCooldown() instead.
export function isActionAvailable(
  action: BlobbiAction, 
  lastActionTime: number | undefined, 
  currentTime: number = Date.now()
): boolean {
  console.warn('isActionAvailable() is deprecated. Use useBlobbiCooldowns hook or cooldownStorage.isOnCooldown() instead.');
  if (!lastActionTime) return true;
  const cooldown = ACTION_COOLDOWNS[action];
  return currentTime - lastActionTime >= cooldown;
}

// Add coins to Blobbi (for rewards)
export function addCoins(blobbi: Blobbi, amount: number): Blobbi {
  return {
    ...blobbi,
    coins: blobbi.coins + amount,
  };
}

// Serialize Blobbi for Nostr storage
export function serializeBlobbi(blobbi: Blobbi): string {
  return JSON.stringify(blobbi);
}

// Deserialize Blobbi from Nostr storage
export function deserializeBlobbi(data: string): Blobbi | null {
  try {
    const blobbi = JSON.parse(data) as Blobbi;
    // Ensure inventory exists for backward compatibility
    if (!blobbi.inventory) {
      blobbi.inventory = [];
    }
    // Ensure customization exists with default values for backward compatibility
    if (!blobbi.customization) {
      blobbi.customization = {
        color: '#7C3AED',
        accessories: [],
      };
    }
    // Ensure customization has all required fields
    if (!blobbi.customization.color) {
      blobbi.customization.color = '#7C3AED';
    }
    if (!blobbi.customization.accessories) {
      blobbi.customization.accessories = [];
    }
    // Ensure pattern field exists (might be missing in older Blobbis)
    if (!blobbi.customization.pattern) {
      blobbi.customization.pattern = '';
    }
    // Ensure evolution progress exists for backward compatibility
    if (!blobbi.evolutionProgress) {
      blobbi.evolutionProgress = initializeEvolutionProgress();
    }
    // Ensure evolution progress has all required fields
    if (!blobbi.evolutionProgress.careSessions) {
      blobbi.evolutionProgress.careSessions = [];
    }
    if (blobbi.evolutionProgress.isEligibleForEvolution === undefined) {
      blobbi.evolutionProgress.isEligibleForEvolution = false;
    }
    if (!blobbi.evolutionProgress.nextEvolutionCheck) {
      blobbi.evolutionProgress.nextEvolutionCheck = Date.now() + 24 * 60 * 60 * 1000;
    }
    return blobbi;
  } catch {
    return null;
  }
}

// Add item to inventory
export function addItemToInventory(blobbi: Blobbi, itemId: string, quantity: number = 1): Blobbi {
  const existingItem = blobbi.inventory.find(item => item.itemId === itemId);
  
  if (existingItem) {
    // Update quantity if item already exists
    return {
      ...blobbi,
      inventory: blobbi.inventory.map(item =>
        item.itemId === itemId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ),
    };
  } else {
    // Add new item to inventory
    return {
      ...blobbi,
      inventory: [...blobbi.inventory, {
        itemId,
        quantity,
        purchasedAt: Date.now(),
      }],
    };
  }
}

// Remove item from inventory
export function removeItemFromInventory(blobbi: Blobbi, itemId: string, quantity: number = 1): Blobbi {
  const existingItem = blobbi.inventory.find(item => item.itemId === itemId);
  
  if (!existingItem) return blobbi;
  
  if (existingItem.quantity <= quantity) {
    // Remove item completely
    return {
      ...blobbi,
      inventory: blobbi.inventory.filter(item => item.itemId !== itemId),
    };
  } else {
    // Reduce quantity
    return {
      ...blobbi,
      inventory: blobbi.inventory.map(item =>
        item.itemId === itemId
          ? { ...item, quantity: item.quantity - quantity }
          : item
      ),
    };
  }
}

// Get items by type from inventory
export function getInventoryItemsByType(blobbi: Blobbi, type: string, shopItems: BlobbiItem[]): (BlobbiItem & { quantity: number })[] {
  return blobbi.inventory
    .map(invItem => {
      const shopItem = shopItems.find(item => item.id === invItem.itemId);
      return shopItem && shopItem.type === type
        ? { ...shopItem, quantity: invItem.quantity }
        : null;
    })
    .filter((item): item is (BlobbiItem & { quantity: number }) => item !== null);
}