// Blobbi Pet Types and Interfaces

export interface BlobbiStats {
  hunger: number;      // 0-100 (0 = starving, 100 = full)
  happiness: number;   // 0-100 (0 = sad, 100 = very happy)
  energy: number;      // 0-100 (0 = exhausted, 100 = energetic)
  cleanliness: number; // 0-100 (0 = dirty, 100 = clean)
  health: number;      // 0-100 (0 = sick, 100 = healthy)
}

export type BlobbiLifeStage = 'baby' | 'child' | 'teen' | 'adult';
export type BlobbiEvolutionForm = 'blobbi' | 'pengui' | 'owli' | 'catti' | 'froggi';
export type BlobbiMood = 'happy' | 'sad' | 'sleepy' | 'hungry' | 'dirty' | 'sick' | 'neutral';
export type BlobbiState = 'active' | 'sleeping' | 'hibernating';

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

export interface Blobbi {
  id: string;           // Unique ID (derived from owner's pubkey)
  ownerPubkey: string;  // Nostr pubkey of the owner
  name: string;         // Pet's name
  birthTime: number;    // Unix timestamp of creation
  lastInteraction: number; // Unix timestamp of last interaction
  lifeStage: BlobbiLifeStage;
  state: BlobbiState;
  stats: BlobbiStats;
  customization: BlobbiCustomization;
  experience: number;   // Total XP earned
  coins: number;        // In-game currency
  evolutionForm?: BlobbiEvolutionForm; // Evolution form after 10 days
  evolutionTime?: number; // Unix timestamp when evolution occurred
  inventory: BlobbiInventoryItem[]; // Items owned by the Blobbi
}

// Nostr event structure for Blobbi data
export interface BlobbiNostrEvent {
  kind: 30078; // Custom replaceable event kind for Blobbi
  content: string; // JSON stringified Blobbi data
  tags: [
    ['d', string], // Unique identifier (owner's pubkey)
    ['title', string], // Pet's name
    ['summary', string], // Brief status description
  ];
}

// Action types for interacting with Blobbi
export type BlobbiAction = 
  | 'feed'
  | 'play'
  | 'clean'
  | 'sleep'
  | 'wake'
  | 'medicine';

// Item types for the shop
export interface BlobbiItem {
  id: string;
  name: string;
  type: 'food' | 'toy' | 'accessory' | 'medicine' | 'decoration' | 'hygiene';
  price: number;
  effect?: Partial<BlobbiStats>;
  icon?: string;
}