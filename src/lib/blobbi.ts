import { Blobbi, BlobbiStats, BlobbiLifeStage, BlobbiMood, BlobbiState, BlobbiAction, BlobbiEvolutionForm, BlobbiItem } from '@/types/blobbi';
import { 
  initializeEvolutionProgress, 
  updateEvolutionProgress, 
  shouldTriggerEvolution,
  determineEvolutionForm 
} from './blobbi-evolution';

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
  baby: 4 * 24 * 60 * 60 * 1000,     // 4 days (hatching)
  adult: 14 * 24 * 60 * 60 * 1000,   // 14 days (evolution)
};

const ACTION_EFFECTS: Record<BlobbiAction, Partial<BlobbiStats>> = {
  feed: { hunger: 30, happiness: 5 },
  play: { happiness: 25, energy: -15, hygiene: -5 },
  clean: { hygiene: 40, happiness: 10 },
  rest: { energy: 50, happiness: 5 },
  warming: { health: 5, happiness: 2 },
  checking: { health: 2 },
  singing: { happiness: 15, energy: -5 },
  talking: { happiness: 10 },
  medicine: { health: 30, happiness: -5 },
  cruzar: { happiness: 20, energy: -10 }, // Special breeding action
};

const ACTION_COOLDOWNS: Record<BlobbiAction, number> = {
  feed: 30 * 60 * 1000,      // 30 minutes
  play: 15 * 60 * 1000,      // 15 minutes
  clean: 60 * 60 * 1000,     // 1 hour
  rest: 4 * 60 * 60 * 1000,  // 4 hours
  warming: 10 * 60 * 1000,   // 10 minutes
  checking: 5 * 60 * 1000,   // 5 minutes
  singing: 20 * 60 * 1000,   // 20 minutes
  talking: 10 * 60 * 1000,   // 10 minutes
  medicine: 2 * 60 * 60 * 1000, // 2 hours
  cruzar: 24 * 60 * 60 * 1000, // 1 day
};

// Create a new Blobbi for a user
export function createBlobbi(ownerPubkey: string, name: string = 'Blobbi'): Blobbi {
  return {
    id: `blobbi_${ownerPubkey}`,
    ownerPubkey,
    name,
    birthTime: Date.now(),
    lastInteraction: Date.now(),
    lifeStage: 'baby',
    state: 'active',
    stats: {
      hunger: 80,
      happiness: 80,
      energy: 80,
      hygiene: 80,
      health: 100,
    },
    customization: {
      color: '#7C3AED', // Default purple color
      accessories: [],
    },
    experience: 0,
    coins: 100, // Starting coins
    inventory: [], // Empty inventory
    evolutionProgress: initializeEvolutionProgress(), // Initialize evolution tracking
    generation: 1,
    breedingReady: false,
    careStreak: 0,
  };
}

// Calculate stat decay based on time passed
export function calculateStatDecay(blobbi: Blobbi, currentTime: number = Date.now()): BlobbiStats {
  const hoursPassed = (currentTime - blobbi.lastInteraction) / (1000 * 60 * 60);
  
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
  const daysSinceInteraction = (currentTime - blobbi.lastInteraction) / (1000 * 60 * 60 * 24);
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
    lastInteraction: currentTime,
    experience: blobbi.experience + expGain,
    coins: blobbi.coins + coinReward,
    evolutionForm,
    evolutionTime,
    evolutionProgress: updatedEvolutionProgress,
  };
}

// Check if an action is available (not on cooldown)
export function isActionAvailable(
  action: BlobbiAction, 
  lastActionTime: number | undefined, 
  currentTime: number = Date.now()
): boolean {
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