/**
 * Cooldown Storage System
 * 
 * Manages persistent storage of Blobbi interaction cooldowns using IndexedDB
 * with localStorage fallback for compatibility.
 */

import { BlobbiAction, BlobbiLifeStage } from '@/types/blobbi';

// Database configuration
const DB_NAME = 'BlobbiCooldowns';
const DB_VERSION = 1;
const STORE_NAME = 'cooldowns';

// Cooldown durations in milliseconds according to the specification
export const COOLDOWN_DURATIONS: Record<BlobbiLifeStage, Record<BlobbiAction, number>> = {
  egg: {
    warming: 30 * 60 * 1000,    // 30 minutes
    singing: 15 * 60 * 1000,    // 15 minutes
    checking: 5 * 60 * 1000,    // 5 minutes
    talking: 10 * 60 * 1000,    // 10 minutes
    medicine: 45 * 60 * 1000,   // 45 minutes - for egg health care
    clean: 20 * 60 * 1000,      // 20 minutes - for shell cleaning
    // Actions not available in egg stage
    feed: 0,
    play: 0,
    rest: 0,
    cruzar: 0,
  },
  baby: {
    feed: 45 * 60 * 1000,       // 45 minutes
    play: 30 * 60 * 1000,       // 30 minutes
    clean: 60 * 60 * 1000,      // 60 minutes
    rest: 90 * 60 * 1000,       // 90 minutes
    medicine: 120 * 60 * 1000,  // 120 minutes
    checking: 5 * 60 * 1000,    // 5 minutes
    talking: 15 * 60 * 1000,    // 15 minutes
    // Actions not available in baby stage
    warming: 0,
    singing: 0,
    cruzar: 0,
  },
  adult: {
    feed: 60 * 60 * 1000,       // 60 minutes
    play: 45 * 60 * 1000,       // 45 minutes
    clean: 90 * 60 * 1000,      // 90 minutes
    rest: 120 * 60 * 1000,      // 120 minutes
    medicine: 180 * 60 * 1000,  // 180 minutes
    checking: 5 * 60 * 1000,    // 5 minutes
    talking: 15 * 60 * 1000,    // 15 minutes
    cruzar: 24 * 60 * 60 * 1000, // 1 day
    // Actions not available in adult stage
    warming: 0,
    singing: 0,
  },
};

// Sync window durations according to the specification
export const SYNC_WINDOWS: Record<BlobbiLifeStage, number> = {
  egg: 2 * 60 * 60 * 1000,     // 2 hours
  baby: 2 * 60 * 60 * 1000,    // 2 hours (child stage)
  adult: 24 * 60 * 60 * 1000,  // 24 hours (includes cruzar action)
};

// Interface for stored cooldown data
export interface CooldownData {
  blobbiId: string;
  action: BlobbiAction;
  timestamp: number;
  stage: BlobbiLifeStage;
}

// Interface for cooldown cache entry
export interface CooldownCacheEntry {
  [action: string]: number; // action -> timestamp
}

// Interface for the complete cooldown cache
export interface CooldownCache {
  [blobbiId: string]: CooldownCacheEntry;
}

class CooldownStorage {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
  private cache: CooldownCache = {};

  constructor() {
    this.dbReady = this.initDB();
    this.loadCacheFromLocalStorage();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available, using localStorage fallback');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('Failed to open IndexedDB, using localStorage fallback');
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('blobbiId', 'blobbiId', { unique: false });
          store.createIndex('action', 'action', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Load cache from localStorage as fallback
   */
  private loadCacheFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('blobbi-cooldowns');
      if (stored) {
        this.cache = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load cooldowns from localStorage:', error);
      this.cache = {};
    }
  }

  /**
   * Save cache to localStorage as fallback
   */
  private saveCacheToLocalStorage(): void {
    try {
      localStorage.setItem('blobbi-cooldowns', JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save cooldowns to localStorage:', error);
    }
  }

  /**
   * Generate a unique ID for a cooldown entry
   */
  private generateId(blobbiId: string, action: BlobbiAction): string {
    return `${blobbiId}-${action}`;
  }

  /**
   * Store a cooldown timestamp for a specific Blobbi and action
   */
  async setCooldown(blobbiId: string, action: BlobbiAction, timestamp: number, stage: BlobbiLifeStage): Promise<void> {
    // Log cooldown being set
    console.log(`⏱️ COOLDOWN SET | ${action} | ${blobbiId} | ${stage} | ${new Date(timestamp).toLocaleString()}`);
    
    // Update cache immediately
    if (!this.cache[blobbiId]) {
      this.cache[blobbiId] = {};
    }
    this.cache[blobbiId][action] = timestamp;
    this.saveCacheToLocalStorage();

    // Try to store in IndexedDB
    await this.dbReady;
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const data: CooldownData & { id: string } = {
          id: this.generateId(blobbiId, action),
          blobbiId,
          action,
          timestamp,
          stage,
        };

        await new Promise<void>((resolve, reject) => {
          const request = store.put(data);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.warn('Failed to store cooldown in IndexedDB:', error);
      }
    }
  }

  /**
   * Get cooldown timestamp for a specific Blobbi and action
   */
  async getCooldown(blobbiId: string, action: BlobbiAction): Promise<number | null> {
    // Check cache first
    const cached = this.cache[blobbiId]?.[action];
    if (cached) {
      return cached;
    }

    // Try IndexedDB
    await this.dbReady;
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        const data = await new Promise<CooldownData & { id: string } | undefined>((resolve, reject) => {
          const request = store.get(this.generateId(blobbiId, action));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (data) {
          // Update cache
          if (!this.cache[blobbiId]) {
            this.cache[blobbiId] = {};
          }
          this.cache[blobbiId][action] = data.timestamp;
          this.saveCacheToLocalStorage();
          return data.timestamp;
        }
      } catch (error) {
        console.warn('Failed to get cooldown from IndexedDB:', error);
      }
    }

    return null;
  }

  /**
   * Get all cooldowns for a specific Blobbi
   */
  async getAllCooldowns(blobbiId: string): Promise<CooldownCacheEntry> {
    // Start with cache
    const result = this.cache[blobbiId] ? { ...this.cache[blobbiId] } : {};

    // Try to get additional data from IndexedDB
    await this.dbReady;
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('blobbiId');
        
        const cooldowns = await new Promise<(CooldownData & { id: string })[]>((resolve, reject) => {
          const request = index.getAll(blobbiId);
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });

        // Merge with cache
        for (const cooldown of cooldowns) {
          if (!result[cooldown.action] || result[cooldown.action] < cooldown.timestamp) {
            result[cooldown.action] = cooldown.timestamp;
          }
        }

        // Update cache
        this.cache[blobbiId] = result;
        this.saveCacheToLocalStorage();
      } catch (error) {
        console.warn('Failed to get all cooldowns from IndexedDB:', error);
      }
    }

    return result;
  }

  /**
   * Clear old cooldown entries to prevent storage bloat
   */
  async clearOldCooldowns(olderThan: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - olderThan;

    // Clear from cache
    for (const blobbiId in this.cache) {
      for (const action in this.cache[blobbiId]) {
        if (this.cache[blobbiId][action] < cutoff) {
          delete this.cache[blobbiId][action];
        }
      }
      // Remove empty entries
      if (Object.keys(this.cache[blobbiId]).length === 0) {
        delete this.cache[blobbiId];
      }
    }
    this.saveCacheToLocalStorage();

    // Clear from IndexedDB
    await this.dbReady;
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        
        const range = IDBKeyRange.upperBound(cutoff);
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      } catch (error) {
        console.warn('Failed to clear old cooldowns from IndexedDB:', error);
      }
    }
  }

  /**
   * Check if an action is currently on cooldown
   */
  async isOnCooldown(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): Promise<boolean> {
    const lastTimestamp = await this.getCooldown(blobbiId, action);
    if (!lastTimestamp) {
      console.log(`✅ COOLDOWN CHECK | ${action} | ${blobbiId} | ${stage} | No previous timestamp - NOT on cooldown`);
      return false;
    }

    const cooldownDuration = COOLDOWN_DURATIONS[stage][action];
    if (cooldownDuration === 0) {
      console.log(`🚫 COOLDOWN CHECK | ${action} | ${blobbiId} | ${stage} | Action not available for stage - NOT on cooldown`);
      return false; // Action not available for this stage
    }

    const now = Date.now();
    const isOnCooldown = (now - lastTimestamp) < cooldownDuration;
    const remaining = isOnCooldown ? cooldownDuration - (now - lastTimestamp) : 0;
    
    console.log(`${isOnCooldown ? '⏳' : '✅'} COOLDOWN CHECK | ${action} | ${blobbiId} | ${stage} | ${isOnCooldown ? `ON cooldown (${formatCooldownTime(remaining)} remaining)` : 'NOT on cooldown'}`);
    
    return isOnCooldown;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  async getRemainingCooldown(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): Promise<number> {
    const lastTimestamp = await this.getCooldown(blobbiId, action);
    if (!lastTimestamp) return 0;

    const cooldownDuration = COOLDOWN_DURATIONS[stage][action];
    if (cooldownDuration === 0) return 0;

    const now = Date.now();
    const elapsed = now - lastTimestamp;
    return Math.max(0, cooldownDuration - elapsed);
  }

  /**
   * Get all actions that are currently on cooldown for a Blobbi
   */
  async getActiveCooldowns(blobbiId: string, stage: BlobbiLifeStage): Promise<Record<BlobbiAction, number>> {
    const allCooldowns = await this.getAllCooldowns(blobbiId);
    const activeCooldowns: Record<string, number> = {};
    const now = Date.now();

    for (const action in allCooldowns) {
      const lastTimestamp = allCooldowns[action];
      const cooldownDuration = COOLDOWN_DURATIONS[stage][action as BlobbiAction];
      
      if (cooldownDuration > 0) {
        const elapsed = now - lastTimestamp;
        const remaining = cooldownDuration - elapsed;
        
        if (remaining > 0) {
          activeCooldowns[action] = remaining;
        }
      }
    }

    return activeCooldowns as Record<BlobbiAction, number>;
  }
}

// Export singleton instance
export const cooldownStorage = new CooldownStorage();

/**
 * Utility functions for cooldown management
 */

/**
 * Check if an action is available for a specific life stage
 */
export function isActionAvailableForStage(action: BlobbiAction, stage: BlobbiLifeStage): boolean {
  return COOLDOWN_DURATIONS[stage][action] > 0;
}

/**
 * Get the cooldown duration for an action and stage
 */
export function getCooldownDuration(action: BlobbiAction, stage: BlobbiLifeStage): number {
  return COOLDOWN_DURATIONS[stage][action];
}

/**
 * Get the sync window for a life stage
 */
export function getSyncWindow(stage: BlobbiLifeStage): number {
  return SYNC_WINDOWS[stage];
}

/**
 * Format cooldown time for display
 */
export function formatCooldownTime(milliseconds: number): string {
  if (milliseconds <= 0) return '';
  
  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  return `${seconds}s`;
}