import { Blobbi, BlobbiStats, BlobbiLifeStage, BlobbiMood, BlobbiState, BlobbiAction, BlobbiEvolutionForm, BlobbiItem } from '@/types/blobbi';

// Constants for game mechanics
const STAT_DECAY_RATES = {
  hunger: 0.5,      // Points lost per hour
  happiness: 0.3,   // Points lost per hour
  energy: 0.4,      // Points lost per hour
  cleanliness: 0.2, // Points lost per hour
  health: 0.1,      // Points lost per hour
};

const LIFE_STAGE_THRESHOLDS = {
  baby: 0,
  child: 3 * 24 * 60 * 60 * 1000,    // 3 days
  teen: 7 * 24 * 60 * 60 * 1000,     // 7 days
  adult: 14 * 24 * 60 * 60 * 1000,   // 14 days
};

const ACTION_EFFECTS: Record<BlobbiAction, Partial<BlobbiStats>> = {
  feed: { hunger: 30, happiness: 5 },
  play: { happiness: 25, energy: -15, cleanliness: -5 },
  clean: { cleanliness: 40, happiness: 10 },
  sleep: { energy: 50, happiness: 5 },
  wake: { energy: -5 },
  medicine: { health: 30, happiness: -5 },
};

const ACTION_COOLDOWNS: Record<BlobbiAction, number> = {
  feed: 30 * 60 * 1000,      // 30 minutes
  play: 15 * 60 * 1000,      // 15 minutes
  clean: 60 * 60 * 1000,     // 1 hour
  sleep: 4 * 60 * 60 * 1000, // 4 hours
  wake: 0,                   // No cooldown
  medicine: 2 * 60 * 60 * 1000, // 2 hours
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
      cleanliness: 80,
      health: 100,
    },
    customization: {
      color: '#7C3AED', // Default purple color
      accessories: [],
    },
    experience: 0,
    coins: 100, // Starting coins
    inventory: [], // Empty inventory
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
    cleanliness: Math.max(0, blobbi.stats.cleanliness - (STAT_DECAY_RATES.cleanliness * hoursPassed * sleepMultiplier)),
    health: Math.max(0, blobbi.stats.health - (STAT_DECAY_RATES.health * hoursPassed * sleepMultiplier)),
  };
  
  // Health decreases faster if other stats are low
  const avgStats = (newStats.hunger + newStats.happiness + newStats.energy + newStats.cleanliness) / 4;
  if (avgStats < 30) {
    newStats.health = Math.max(0, newStats.health - (hoursPassed * 0.5));
  }
  
  return newStats;
}

// Get current life stage based on age
export function getLifeStage(birthTime: number, currentTime: number = Date.now()): BlobbiLifeStage {
  const age = currentTime - birthTime;
  
  if (age >= LIFE_STAGE_THRESHOLDS.adult) return 'adult';
  if (age >= LIFE_STAGE_THRESHOLDS.teen) return 'teen';
  if (age >= LIFE_STAGE_THRESHOLDS.child) return 'child';
  return 'baby';
}

// Determine current mood based on stats
export function getBlobbiMood(stats: BlobbiStats, state: BlobbiState): BlobbiMood {
  if (state === 'sleeping') return 'sleepy';
  if (stats.health < 30) return 'sick';
  if (stats.hunger < 30) return 'hungry';
  if (stats.cleanliness < 30) return 'dirty';
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

// Get random evolution form with better randomization
function getRandomEvolutionForm(): BlobbiEvolutionForm {
  const forms: BlobbiEvolutionForm[] = ['pengui', 'owli', 'catti', 'froggi'];
  
  // Use multiple sources of randomness for better distribution
  const timestamp = Date.now();
  const random1 = Math.random();
  const random2 = Math.random();
  
  // Combine multiple random factors
  const seed = (timestamp % 1000) / 1000;
  const finalRandom = (random1 + random2 + seed) / 3;
  
  const index = Math.floor(finalRandom * forms.length);
  return forms[index];
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
  
  // Handle sleep/wake actions
  if (action === 'sleep' && blobbi.state !== 'sleeping') {
    newState = 'sleeping';
  } else if (action === 'wake' && blobbi.state === 'sleeping') {
    newState = 'active';
  }
  
  // Apply action effects (combine base effects with item effects if provided)
  const baseEffects = ACTION_EFFECTS[action] || {};
  const combinedEffects = itemEffects ? {
    hunger: (baseEffects.hunger || 0) + (itemEffects.hunger || 0),
    happiness: (baseEffects.happiness || 0) + (itemEffects.happiness || 0),
    energy: (baseEffects.energy || 0) + (itemEffects.energy || 0),
    cleanliness: (baseEffects.cleanliness || 0) + (itemEffects.cleanliness || 0),
    health: (baseEffects.health || 0) + (itemEffects.health || 0),
  } : baseEffects;
  
  const newStats: BlobbiStats = {
    hunger: Math.max(0, Math.min(100, currentStats.hunger + (combinedEffects.hunger || 0))),
    happiness: Math.max(0, Math.min(100, currentStats.happiness + (combinedEffects.happiness || 0))),
    energy: Math.max(0, Math.min(100, currentStats.energy + (combinedEffects.energy || 0))),
    cleanliness: Math.max(0, Math.min(100, currentStats.cleanliness + (combinedEffects.cleanliness || 0))),
    health: Math.max(0, Math.min(100, currentStats.health + (combinedEffects.health || 0))),
  };
  
  // Calculate experience gain
  const expGain = action === 'play' ? 10 : 5;
  
  // Calculate coin rewards for good care
  let coinReward = 0;
  if (Object.values(newStats).every(stat => stat > 70)) {
    coinReward = 10; // Bonus for keeping all stats high
  }
  
  // Check for evolution - happens on first care action if not already evolved
  let evolutionForm = blobbi.evolutionForm;
  let evolutionTime = blobbi.evolutionTime;
  
  if (!blobbi.evolutionForm && ['feed', 'play', 'clean'].includes(action)) {
    // Trigger evolution on first care action
    evolutionForm = getRandomEvolutionForm();
    evolutionTime = currentTime;
    coinReward += 50; // Bonus coins for evolution!
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