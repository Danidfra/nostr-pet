// Blobbi Pet Types and Interfaces

export interface BlobbiStats {
  hunger: number;      // 0-100 (0 = starving, 100 = full)
  happiness: number;   // 0-100 (0 = sad, 100 = very happy)
  energy: number;      // 0-100 (0 = exhausted, 100 = energetic)
  hygiene: number;     // 0-100 (0 = dirty, 100 = clean) - renamed from cleanliness
  health: number;      // 0-100 (0 = sick, 100 = healthy)
}

// Updated lifecycle stages according to spec
export type BlobbiLifeStage = 'egg' | 'baby' | 'adult';
export type BlobbiEvolutionForm = 'blobbi' | 'pandi' | 'owli' | 'catti' | 'froggi' | 'cloudi' | 'crysti' | 'bloomi' | 'starri' | 'flammi' | 'droppi' | 'breezy' | 'rocky' | 'cacti' | 'mushie' | 'leafy' | 'rosey';
export type BlobbiMood = 'happy' | 'sad' | 'sleepy' | 'hungry' | 'dirty' | 'sick' | 'neutral' | 'playful';
export type BlobbiState = 'active' | 'sleeping' | 'hibernating';

// Record types for Kind 14921 events
export type BlobbiRecordType = 'birth' | 'hatched' | 'evolution' | 'memory' | 'adoption';

// Interaction types for Kind 14919 events
export type BlobbiInteractionType = 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar' | 'wake';

export interface BlobbiCustomization {
  color: string;
  pattern?: string;
  accessories: string[];
}

export interface BlobbiInventoryItem {
  itemId: string;       // Reference to the item definition
  quantity: number;     // How many of this item
  purchasedAt: number;  // Unix timestamp when purchased
}

// Evolution tracking system
export interface BlobbiCareSession {
  startTime: number;    // Unix timestamp when care session started
  endTime?: number;     // Unix timestamp when care session ended (if ended)
  actions: number;      // Number of care actions performed in this session
}

export interface BlobbiEvolutionProgress {
  totalCareDays: number;           // Total days of care accumulated
  currentStreak: number;           // Current consecutive days of care
  lastCareDate: number;            // Unix timestamp of last care action
  careSessions: BlobbiCareSession[]; // History of care sessions
  isEligibleForEvolution: boolean; // Whether the pet can evolve
  nextEvolutionCheck: number;      // Unix timestamp for next evolution eligibility check
}

export interface Blobbi {
  id: string;           // Unique ID (blobbi-{blobbi_name})
  ownerPubkey: string;  // Nostr pubkey of the owner
  name: string;         // Pet's name
  birthTime: number;    // Unix timestamp of creation (milliseconds)
  hatchTime?: number;   // Unix timestamp of hatching (milliseconds)
  lastInteraction: number; // Unix timestamp of last interaction (seconds, same as Nostr created_at)
  lifeStage: BlobbiLifeStage;
  state: BlobbiState;
  stats: BlobbiStats;
  customization: BlobbiCustomization;
  experience: number;   // Total XP earned
  coins: number;        // In-game currency
  evolutionForm?: BlobbiEvolutionForm; // Evolution form after evolution
  evolutionTime?: number; // Unix timestamp when evolution occurred
  evolutionProgress: BlobbiEvolutionProgress; // Track evolution progress
  inventory: BlobbiInventoryItem[]; // Items owned by the Blobbi
  generation: number;   // Generation number
  breedingReady: boolean; // Whether ready to breed
  careStreak: number;   // Consecutive care days
  // Appearance
  baseColor?: string;
  secondaryColor?: string;
  pattern?: string;
  eyeColor?: string;
  specialMark?: string;
  manifestation?: string;
  visualEffect?: string;
  blessing?: string;
  // Personality
  personality?: string[];
  traits?: string[];
  mood?: BlobbiMood;
  favoriteFood?: string;
  voiceType?: string;
  size?: string;
  title?: string;
  skill?: string;
  // Egg-specific
  incubationTime?: number;
  incubationProgress?: number;
  eggTemperature?: number; // 0-100 (0 = very cold, 100 = very warm)
  eggStatus?: string;
  shellIntegrity?: number;
  // Behavior
  isSleeping?: boolean;
  isDirty?: boolean;
  hasBuff?: string;
  hasDebuff?: string;
  // Behavior timestamp fields - Unix timestamps in seconds (same format as Nostr's created_at)
  lastMeal?: number;
  lastClean?: number;
  // Last care tracking fields (for egg phase)
  // Unix timestamps in seconds (same format as Nostr's created_at)
  lastWarm?: number;
  lastTalk?: number;
  lastCheck?: number;
  lastSing?: number;
  lastMedicine?: number;
  // Sleep system fields
  sleepStartedAt?: number; // Unix timestamp when sleep began
  lastSleepUpdate?: number; // Unix timestamp of last rest-based energy update (only present during sleep)
  // Social
  adoptedBy?: string;
  adoptedFrom?: string;
  currentLocation?: string;
  inParty?: boolean;
  visibleToOthers?: boolean;
}

// Kind 31124: Blobbi Current State (Addressable)
export interface BlobbiStateEvent {
  kind: 31124;
  content: string; // Description of current state
  tags: Array<[string, string]>; // All the tags defined in the spec
}

// Kind 14919: Blobbi Interactions (Regular)
export interface BlobbiInteractionEvent {
  kind: 14919;
  content: string; // Description of the interaction
  tags: Array<[string, string]>; // Interaction-specific tags
}

// Kind 14920: Blobbi Breeding Event (Regular)
export interface BlobbiBreedingEvent {
  kind: 14920;
  content: string; // Description of breeding
  tags: Array<[string, string]>; // Breeding-specific tags
}

// Kind 14921: Blobbi Records (Regular, Immutable)
export interface BlobbiRecordEvent {
  kind: 14921;
  content: string; // Description of the record
  tags: Array<[string, string]>; // Record-specific tags based on record_type
}

// Kind 31125: Blobbanaut Profile (Addressable)
export interface BlobbonautProfileEvent {
  kind: 31125;
  content: string; // Must be empty according to spec
  tags: Array<[string, string]>; // Profile-specific tags
}

// Storage item for Blobbanaut Profile
export interface BlobbonautStorageItem {
  itemId: string; // Item identifier
  quantity: number; // Quantity owned
}

// Blobbanaut Profile data structure
export interface BlobbonautProfile {
  id: string; // Unique identifier (d tag value)
  ownerPubkey: string; // Nostr pubkey of the Blobbanaut
  name?: string; // Display name of the user
  coins: number; // Amount of in-game coins
  ownedBlobbis: string[]; // Array of Blobbi IDs owned
  pettingLevel: number; // Interaction/care level
  lifetimeBlobbis: number; // Total Blobbis adopted over time
  favoriteBlobbi?: string; // Favorite Blobbi ID
  starterBlobbi?: string; // First Blobbi ID
  achievements: string[]; // Array of achievement IDs
  storage: BlobbonautStorageItem[]; // Items stored in inventory
  style?: string; // Aesthetic style
  background?: string; // Background/theme
  title?: string; // Custom title or role
  currentCompanion?: string; // Currently selected companion Blobbi ID
  lastModified: number; // Unix timestamp of last modification
}

// Action types for interacting with Blobbi (updated to match spec)
export type BlobbiAction = 
  | 'feed'
  | 'play'
  | 'clean'
  | 'rest'
  | 'warm'
  | 'check'
  | 'sing'
  | 'talk'
  | 'medicine'
  | 'cruzar';

// Care actions that count towards evolution
export type BlobbiCareAction = 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar';

// Interaction data structure for detailed tracking
export interface BlobbiInteractionData {
  action: BlobbiInteractionType;
  actionCategory: string;
  statChange: [string, string]; // [stat_name, change_value] - kept for backward compatibility
  statChanges?: Array<[string, string]>; // Multiple stat changes for items
  itemUsed?: string;
  itemQuality?: string;
  timeOfDay?: string;
  blobbiMoodBefore?: string;
  blobbiMoodAfter?: string;
  animationPlayed?: string;
  soundPlayed?: string;
  bonusApplied?: string;
  experienceGained?: number;
  careStreak?: number;
  carePoints?: number;
  achievementProgress?: [string, string];
  achievementUnlocked?: string;
  specialEvent?: string;
  memoryCreated?: string;
  // Action-specific fields
  gameType?: string;
  toyUsed?: string;
  playDuration?: number;
  location?: string;
  playPartner?: string;
  skillImproved?: [string, string];
  bondIncreased?: [string, string];
  newMoveLearn?: string;
  cleaningType?: string;
  waterTemperature?: string;
  soapUsed?: string;
  groomingTool?: string;
  specialEffect?: string;
  scentApplied?: string;
  moodBoost?: string;
  restType?: string;
  bedType?: string;
  lullabyPlayed?: string;
  sleepDuration?: number;
  dreamType?: string;
  growthBonus?: string;
  dreamMemory?: string;
  socialRole?: [string, string];
  interactionQuality?: string;
  emotionTriggered?: string;
  sharedMemory?: string;
  interactionContext?: string;
}

// Record data structures for different record types
export interface BlobbiRecordData {
  recordType: BlobbiRecordType;
  // Common fields
  generation?: number;
  // Birth record fields
  origin?: string;
  birthLocation?: string;
  weatherAtBirth?: string;
  shellColor?: string;
  shellPattern?: string;
  initialTrait?: string[];
  rarity?: string;
  parent1?: string;
  parent2?: string;
  lineageDepth?: number;
  geneticMarker?: string;
  birthSeason?: string;
  birthMoonPhase?: string;
  creator?: string;
  designUrl?: string;
  adoptionFee?: number;
  legacyTrait?: string[];
  passiveTrait?: string[];
  // Hatching record fields
  hatchedAt?: number;
  hatchedBy?: string;
  eggType?: string;
  incubationTime?: string;
  eyeColor?: string;
  baseColor?: string;
  pattern?: string;
  secondaryColor?: string;
  manifestation?: string;
  blessing?: string;
  memoryTitle?: string;
  memoryDescription?: string;
  memoryDate?: string;
  evolvedFrom?: string;
  hatchFee?: number;
  evolutionStage?: string;
  // Adoption record fields
  adoptedBy?: string;
  adoptedOn?: number;
  adoptionMethod?: string;
  title?: string;
  titleReason?: string;
  // Evolution record fields
  evolutionReason?: string;
  // Memory record fields
  discoveredTrait?: string;
  achievement?: string;
  milestone?: string;
}

// Item types for the shop
export interface BlobbiItem {
  id: string;
  name: string;
  type: 'food' | 'toy' | 'accessory' | 'medicine' | 'decoration' | 'hygiene';
  price: number;
  effect?: Partial<BlobbiStats & { egg_temperature?: number; shell_integrity?: number }>; // Support negative values, egg_temperature, and shell_integrity
  icon?: string;
}