/**
 * Cooldown Storage System
 * 
 * Manages persistent storage of Blobbi interaction cooldowns using IndexedDB
 * with localStorage fallback for compatibility. Implements session-based cooldowns
 * with global cooldowns according to the specification.
 */

import { BlobbiAction, BlobbiLifeStage } from '@/types/blobbi';

// Database configuration
const DB_NAME = 'BlobbiCooldowns';
const DB_VERSION = 1;
const STORE_NAME = 'cooldowns';

// Cooldown durations in milliseconds according to specification
export const COOLDOWN_DURATIONS: Record<BlobbiLifeStage, Record<BlobbiAction, number>> = {
  egg: {
    warm: 5 * 60 * 1000,        // 5 minutes per use
    sing: 5 * 60 * 1000,        // 5 minutes per use
    check: 3 * 60 * 1000,       // 3 minutes per use
    talk: 5 * 60 * 1000,        // 5 minutes per use
    clean: 10 * 60 * 1000,      // 10 minutes per use
    medicine: 120 * 60 * 1000,  // 120 minutes per use (2 hours)
    // Actions not available in egg stage
    feed: 0,
    play: 0,
    rest: 0,
    cruzar: 0,
  },
  child: {
    feed: 5 * 60 * 1000,        // 5 minutes per use
    play: 10 * 60 * 1000,       // 10 minutes per use
    clean: 10 * 60 * 1000,      // 10 minutes per use
    rest: 0,                    // Special handling - 1 use per session until full/4h
    talk: 5 * 60 * 1000,        // 5 minutes per use
    check: 3 * 60 * 1000,       // 3 minutes per use
    medicine: 120 * 60 * 1000,  // 120 minutes per use (2 hours)
    // Actions not available in child stage
    warm: 0,
    sing: 0,
    cruzar: 0,
  },
  adult: {
    feed: 5 * 60 * 1000,        // 5 minutes per use
    play: 10 * 60 * 1000,       // 10 minutes per use
    clean: 10 * 60 * 1000,      // 10 minutes per use
    rest: 0,                    // Special handling - 1 use per session until full/4h
    talk: 5 * 60 * 1000,        // 5 minutes per use
    check: 3 * 60 * 1000,       // 3 minutes per use
    medicine: 180 * 60 * 1000,  // 180 minutes per use (3 hours)
    cruzar: 24 * 60 * 60 * 1000, // 24 hours (1 use per day)
    // Actions not available in adult stage
    warm: 0,
    sing: 0,
  },
};

// Global cooldown durations in milliseconds according to specification
export const GLOBAL_COOLDOWN_DURATIONS: Record<BlobbiLifeStage, Record<BlobbiAction, number>> = {
  egg: {
    warm: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    sing: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    check: 1 * 60 * 60 * 1000,     // 1 hour
    talk: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    clean: 1.5 * 60 * 60 * 1000,   // 1.5 hours
    medicine: 0,                    // No global cooldown (only 1 use per session)
    // Actions not available in egg stage
    feed: 0,
    play: 0,
    rest: 0,
    cruzar: 0,
  },
  child: {
    feed: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    play: 2 * 60 * 60 * 1000,      // 2 hours
    clean: 1.5 * 60 * 60 * 1000,   // 1.5 hours
    rest: 4 * 60 * 60 * 1000,      // Until full or 4 hours
    talk: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    check: 1 * 60 * 60 * 1000,     // 1 hour
    medicine: 0,                    // No global cooldown (only 1 use per session)
    // Actions not available in child stage
    warm: 0,
    sing: 0,
    cruzar: 0,
  },
  adult: {
    feed: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    play: 2 * 60 * 60 * 1000,      // 2 hours
    clean: 1.5 * 60 * 60 * 1000,   // 1.5 hours
    rest: 4 * 60 * 60 * 1000,      // Until full or 4 hours
    talk: 1.5 * 60 * 60 * 1000,    // 1.5 hours
    check: 1 * 60 * 60 * 1000,     // 1 hour
    medicine: 0,                    // No global cooldown (only 1 use per session)
    cruzar: 24 * 60 * 60 * 1000,   // 24 hours
    // Actions not available in adult stage
    warm: 0,
    sing: 0,
  },
};

// Maximum uses per session according to specification
export const MAX_USES_PER_SESSION: Record<BlobbiLifeStage, Record<BlobbiAction, number>> = {
  egg: {
    warm: 4,
    sing: 4,
    check: 4,
    talk: 4,
    clean: 4,
    medicine: 1,
    // Actions not available in egg stage
    feed: 0,
    play: 0,
    rest: 0,
    cruzar: 0,
  },
  child: {
    feed: 4,
    play: 4,
    clean: 4,
    rest: 1,
    talk: 4,
    check: 4,
    medicine: 1,
    // Actions not available in child stage
    warm: 0,
    sing: 0,
    cruzar: 0,
  },
  adult: {
    feed: 4,
    play: 4,
    clean: 4,
    rest: 1,
    talk: 4,
    check: 4,
    medicine: 1,
    cruzar: 1, // 1 per day
    // Actions not available in adult stage
    warm: 0,
    sing: 0,
  },
};

// Sync window durations according to the specification
export const SYNC_WINDOWS: Record<BlobbiLifeStage, number> = {
  egg: 2 * 60 * 60 * 1000,     // 2 hours
  child: 2 * 60 * 60 * 1000,   // 2 hours (child stage)
  adult: 24 * 60 * 60 * 1000,  // 24 hours (includes cruzar action)
};

// Interface for stored cooldown data
export interface CooldownData {
  blobbiId: string;
  action: BlobbiAction;
  timestamp: number;
  stage: BlobbiLifeStage;
}

// Interface for session tracking
export interface SessionData {
  blobbiId: string;
  action: BlobbiAction;
  sessionStart: number;
  usesInSession: number;
  globalCooldownStart?: number;
  lastUse?: number;
}

// Interface for cooldown cache entry
export interface CooldownCacheEntry {
  [action: string]: number; // action -> timestamp
}

// Interface for session cache entry
export interface SessionCacheEntry {
  [action: string]: {
    sessionStart: number;
    usesInSession: number;
    globalCooldownStart?: number;
    lastUse?: number;
  };
}

// Interface for the complete cooldown cache
export interface CooldownCache {
  [blobbiId: string]: CooldownCacheEntry;
}

// Interface for the complete session cache
export interface SessionCache {
  [blobbiId: string]: SessionCacheEntry;
}

// Interface for local data tracking
export interface LocalDataTracker {
  [blobbiId: string]: {
    lastSyncTimestamp: number;
    lastUpdateTimestamp: number;
  };
}

class CooldownStorage {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
  private cache: CooldownCache = {};
  private sessionCache: SessionCache = {};
  private localDataTracker: LocalDataTracker = {};

  constructor() {
    this.dbReady = this.initDB();
    this.loadCacheFromLocalStorage();
    this.loadSessionCacheFromLocalStorage();
    this.loadLocalDataTrackerFromLocalStorage();
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
   * Load session cache from localStorage
   */
  private loadSessionCacheFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('blobbi-sessions');
      if (stored) {
        this.sessionCache = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load sessions from localStorage:', error);
      this.sessionCache = {};
    }
  }

  /**
   * Save session cache to localStorage
   */
  private saveSessionCacheToLocalStorage(): void {
    try {
      localStorage.setItem('blobbi-sessions', JSON.stringify(this.sessionCache));
    } catch (error) {
      console.warn('Failed to save sessions to localStorage:', error);
    }
  }

  /**
   * Load local data tracker from localStorage
   */
  private loadLocalDataTrackerFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('blobbi-local-data-tracker');
      if (stored) {
        this.localDataTracker = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load local data tracker from localStorage:', error);
      this.localDataTracker = {};
    }
  }

  /**
   * Save local data tracker to localStorage
   */
  private saveLocalDataTrackerToLocalStorage(): void {
    try {
      localStorage.setItem('blobbi-local-data-tracker', JSON.stringify(this.localDataTracker));
    } catch (error) {
      console.warn('Failed to save local data tracker to localStorage:', error);
    }
  }

  /**
   * Generate a unique ID for a cooldown entry
   */
  private generateId(blobbiId: string, action: BlobbiAction): string {
    return `${blobbiId}-${action}`;
  }

  /**
   * Check if a new session should start for an action
   */
  private shouldStartNewSession(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): boolean {
    const sessionData = this.sessionCache[blobbiId]?.[action];
    if (!sessionData) return true;

    const now = Date.now();
    const globalCooldownDuration = GLOBAL_COOLDOWN_DURATIONS[stage][action];
    
    // If there's a global cooldown and it's still active, don't start new session
    if (sessionData.globalCooldownStart && globalCooldownDuration > 0) {
      const globalCooldownRemaining = globalCooldownDuration - (now - sessionData.globalCooldownStart);
      if (globalCooldownRemaining > 0) {
        return false;
      }
    }

    // For rest action, check if Blobbi is full energy or 4 hours have passed
    if (action === 'rest') {
      const timeSinceSession = now - sessionData.sessionStart;
      return timeSinceSession >= (4 * 60 * 60 * 1000); // 4 hours
    }

    // Start new session if global cooldown has expired
    return true;
  }

  /**
   * Record an interaction and update session tracking
   */
  async recordInteraction(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): Promise<void> {
    const now = Date.now();
    
    // Initialize caches if needed
    if (!this.cache[blobbiId]) {
      this.cache[blobbiId] = {};
    }
    if (!this.sessionCache[blobbiId]) {
      this.sessionCache[blobbiId] = {};
    }

    // Check if we should start a new session
    const shouldStartNew = this.shouldStartNewSession(blobbiId, action, stage);
    
    if (shouldStartNew) {
      // Start new session
      this.sessionCache[blobbiId][action] = {
        sessionStart: now,
        usesInSession: 1,
        lastUse: now,
      };
      console.log(`🆕 NEW SESSION | ${action} | ${blobbiId} | ${stage} | Session 1/4`);
    } else {
      // Continue existing session
      const sessionData = this.sessionCache[blobbiId][action];
      sessionData.usesInSession += 1;
      sessionData.lastUse = now;
      
      const maxUses = MAX_USES_PER_SESSION[stage][action];
      console.log(`📈 SESSION CONTINUE | ${action} | ${blobbiId} | ${stage} | Session ${sessionData.usesInSession}/${maxUses}`);
      
      // Check if we've reached max uses and should start global cooldown
      if (sessionData.usesInSession >= maxUses) {
        const globalCooldownDuration = GLOBAL_COOLDOWN_DURATIONS[stage][action];
        if (globalCooldownDuration > 0) {
          sessionData.globalCooldownStart = now;
          console.log(`🚫 GLOBAL COOLDOWN | ${action} | ${blobbiId} | ${stage} | ${formatCooldownTime(globalCooldownDuration)}`);
        }
      }
    }

    // Update individual action cooldown
    this.cache[blobbiId][action] = now;
    
    // Update local data tracker
    if (!this.localDataTracker[blobbiId]) {
      this.localDataTracker[blobbiId] = {
        lastSyncTimestamp: now,
        lastUpdateTimestamp: now,
      };
    } else {
      this.localDataTracker[blobbiId].lastUpdateTimestamp = now;
    }

    // Save to storage
    this.saveCacheToLocalStorage();
    this.saveSessionCacheToLocalStorage();
    this.saveLocalDataTrackerToLocalStorage();
    
    // Try to store in IndexedDB
    await this.setCooldown(blobbiId, action, now, stage);
  }

  /**
   * Store a cooldown timestamp for a specific Blobbi and action
   */
  async setCooldown(blobbiId: string, action: BlobbiAction, timestamp: number, stage: BlobbiLifeStage): Promise<void> {
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
   * Check if an action is currently on cooldown (individual or global)
   */
  async isOnCooldown(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): Promise<boolean> {
    const now = Date.now();
    
    // Check if action is available for this stage
    if (!isActionAvailableForStage(action, stage)) {
      return false; // Not on cooldown, just not available
    }

    // Check individual action cooldown
    const lastUse = this.cache[blobbiId]?.[action];
    if (lastUse) {
      const individualCooldown = COOLDOWN_DURATIONS[stage][action];
      const individualRemaining = individualCooldown - (now - lastUse);
      if (individualRemaining > 0) {
        console.log(`⏳ INDIVIDUAL COOLDOWN | ${action} | ${blobbiId} | ${stage} | ${formatCooldownTime(individualRemaining)}`);
        return true;
      }
    }

    // Check session limits and global cooldown
    const sessionData = this.sessionCache[blobbiId]?.[action];
    if (sessionData) {
      const maxUses = MAX_USES_PER_SESSION[stage][action];
      
      // If we've reached max uses, check global cooldown
      if (sessionData.usesInSession >= maxUses && sessionData.globalCooldownStart) {
        const globalCooldownDuration = GLOBAL_COOLDOWN_DURATIONS[stage][action];
        if (globalCooldownDuration > 0) {
          const globalRemaining = globalCooldownDuration - (now - sessionData.globalCooldownStart);
          if (globalRemaining > 0) {
            console.log(`🚫 GLOBAL COOLDOWN | ${action} | ${blobbiId} | ${stage} | ${formatCooldownTime(globalRemaining)}`);
            return true;
          }
        }
      }
    }

    console.log(`✅ AVAILABLE | ${action} | ${blobbiId} | ${stage} | Ready to use`);
    return false;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  async getRemainingCooldown(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): Promise<number> {
    const now = Date.now();
    
    if (!isActionAvailableForStage(action, stage)) {
      return 0;
    }

    // Check individual action cooldown first
    const lastUse = this.cache[blobbiId]?.[action];
    if (lastUse) {
      const individualCooldown = COOLDOWN_DURATIONS[stage][action];
      const individualRemaining = individualCooldown - (now - lastUse);
      if (individualRemaining > 0) {
        return individualRemaining;
      }
    }

    // Check global cooldown
    const sessionData = this.sessionCache[blobbiId]?.[action];
    if (sessionData) {
      const maxUses = MAX_USES_PER_SESSION[stage][action];
      
      if (sessionData.usesInSession >= maxUses && sessionData.globalCooldownStart) {
        const globalCooldownDuration = GLOBAL_COOLDOWN_DURATIONS[stage][action];
        if (globalCooldownDuration > 0) {
          const globalRemaining = globalCooldownDuration - (now - sessionData.globalCooldownStart);
          if (globalRemaining > 0) {
            return globalRemaining;
          }
        }
      }
    }

    return 0;
  }

  /**
   * Get all actions that are currently on cooldown for a Blobbi
   */
  async getActiveCooldowns(blobbiId: string, stage: BlobbiLifeStage): Promise<Record<BlobbiAction, number>> {
    const activeCooldowns: Record<string, number> = {};
    const allActions: BlobbiAction[] = ['feed', 'play', 'clean', 'rest', 'warm', 'check', 'sing', 'talk', 'medicine', 'cruzar'];

    for (const action of allActions) {
      const remaining = await this.getRemainingCooldown(blobbiId, action, stage);
      if (remaining > 0) {
        activeCooldowns[action] = remaining;
      }
    }

    return activeCooldowns as Record<BlobbiAction, number>;
  }

  /**
   * Get session information for an action
   */
  getSessionInfo(blobbiId: string, action: BlobbiAction, stage: BlobbiLifeStage): {
    usesInSession: number;
    maxUses: number;
    isInGlobalCooldown: boolean;
    globalCooldownRemaining: number;
  } {
    const sessionData = this.sessionCache[blobbiId]?.[action];
    const maxUses = MAX_USES_PER_SESSION[stage][action];
    
    if (!sessionData) {
      return {
        usesInSession: 0,
        maxUses,
        isInGlobalCooldown: false,
        globalCooldownRemaining: 0,
      };
    }

    const now = Date.now();
    let isInGlobalCooldown = false;
    let globalCooldownRemaining = 0;

    if (sessionData.globalCooldownStart) {
      const globalCooldownDuration = GLOBAL_COOLDOWN_DURATIONS[stage][action];
      if (globalCooldownDuration > 0) {
        globalCooldownRemaining = Math.max(0, globalCooldownDuration - (now - sessionData.globalCooldownStart));
        isInGlobalCooldown = globalCooldownRemaining > 0;
      }
    }

    return {
      usesInSession: sessionData.usesInSession,
      maxUses,
      isInGlobalCooldown,
      globalCooldownRemaining,
    };
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

    // Clear from session cache
    for (const blobbiId in this.sessionCache) {
      for (const action in this.sessionCache[blobbiId]) {
        const sessionData = this.sessionCache[blobbiId][action];
        if (sessionData.sessionStart < cutoff) {
          delete this.sessionCache[blobbiId][action];
        }
      }
      // Remove empty entries
      if (Object.keys(this.sessionCache[blobbiId]).length === 0) {
        delete this.sessionCache[blobbiId];
      }
    }

    this.saveCacheToLocalStorage();
    this.saveSessionCacheToLocalStorage();

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
   * Get the age of local data for a specific Blobbi
   * Returns null if no local data exists, otherwise returns age in milliseconds
   */
  async getLocalDataAge(blobbiId: string): Promise<number | null> {
    const tracker = this.localDataTracker[blobbiId];
    if (!tracker) {
      return null;
    }

    const now = Date.now();
    return now - tracker.lastUpdateTimestamp;
  }

  /**
   * Update the local data timestamp to mark successful sync
   */
  async updateLocalDataTimestamp(blobbiId: string): Promise<void> {
    const now = Date.now();
    
    if (!this.localDataTracker[blobbiId]) {
      this.localDataTracker[blobbiId] = {
        lastSyncTimestamp: now,
        lastUpdateTimestamp: now,
      };
    } else {
      this.localDataTracker[blobbiId].lastSyncTimestamp = now;
      this.localDataTracker[blobbiId].lastUpdateTimestamp = now;
    }

    this.saveLocalDataTrackerToLocalStorage();
  }

  /**
   * Check if local data is fresh enough to avoid relay sync
   * NOTE: This method is deprecated - we now always use blobbiState as source of truth
   */
  async isLocalDataFresh(blobbiId: string, stage: BlobbiLifeStage): Promise<boolean> {
    // Always return false to force using blobbiState as source of truth
    return false;
  }

  /**
   * Force a local data refresh (marks data as stale)
   */
  async forceLocalDataRefresh(blobbiId: string): Promise<void> {
    if (this.localDataTracker[blobbiId]) {
      // Set last update to a very old timestamp to force sync
      this.localDataTracker[blobbiId].lastUpdateTimestamp = 0;
      this.saveLocalDataTrackerToLocalStorage();
    }
  }

  /**
   * Initialize cooldowns from pre-extracted action timestamps (from kind 31124 event)
   * Always uses blobbiState as the source of truth, ignoring any cached data
   */
  async initializeFromActionTimestamps(
    blobbiId: string, 
    actionTimestamps: Record<string, number>, 
    stage: BlobbiLifeStage
  ): Promise<void> {
    const now = Date.now();
    
    // Clear any existing data for this Blobbi to ensure fresh state
    this.cache[blobbiId] = {};
    this.sessionCache[blobbiId] = {};

    // Update cache with action timestamps from blobbiState
    for (const [action, timestamp] of Object.entries(actionTimestamps)) {
      this.cache[blobbiId][action] = timestamp;
      
      // Initialize session data based on the timestamp from blobbiState
      this.sessionCache[blobbiId][action] = {
        sessionStart: timestamp,
        usesInSession: 1,
        lastUse: timestamp,
      };
    }

    // For actions that don't have last_* timestamps (rest, play, cruzar),
    // initialize empty session data
    const allActions: BlobbiAction[] = ['feed', 'play', 'clean', 'rest', 'warm', 'check', 'sing', 'talk', 'medicine', 'cruzar'];
    for (const action of allActions) {
      if (isActionAvailableForStage(action, stage) && !this.sessionCache[blobbiId][action]) {
        // Initialize with no previous usage
        this.sessionCache[blobbiId][action] = {
          sessionStart: now,
          usesInSession: 0,
        };
      }
    }

    // Update local data tracker
    this.localDataTracker[blobbiId] = {
      lastSyncTimestamp: now,
      lastUpdateTimestamp: now,
    };

    // Save to storage
    this.saveCacheToLocalStorage();
    this.saveSessionCacheToLocalStorage();
    this.saveLocalDataTrackerToLocalStorage();

    console.log(`📊 COOLDOWNS INITIALIZED FROM BLOBBI STATE | ${blobbiId} | ${stage} | Actions with timestamps: ${Object.keys(actionTimestamps).join(', ')}`);
  }

  /**
   * Check if cooldowns have been initialized for a Blobbi
   * NOTE: This method is deprecated - we now always reinitialize from blobbiState
   */
  hasCooldownData(blobbiId: string): boolean {
    // Always return false to force reinitialization from blobbiState
    return false;
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
  return MAX_USES_PER_SESSION[stage][action] > 0;
}

/**
 * Get the cooldown duration for an action and stage
 */
export function getCooldownDuration(action: BlobbiAction, stage: BlobbiLifeStage): number {
  return COOLDOWN_DURATIONS[stage][action];
}

/**
 * Get the global cooldown duration for an action and stage
 */
export function getGlobalCooldownDuration(action: BlobbiAction, stage: BlobbiLifeStage): number {
  return GLOBAL_COOLDOWN_DURATIONS[stage][action];
}

/**
 * Get the maximum uses per session for an action and stage
 */
export function getMaxUsesPerSession(action: BlobbiAction, stage: BlobbiLifeStage): number {
  return MAX_USES_PER_SESSION[stage][action];
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