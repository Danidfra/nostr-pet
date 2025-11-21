import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Blobbi, BlobbiStats } from '@/types/blobbi';

interface FakeStatusData {
  blobbi: Blobbi;
  pendingInteractions: number;
  lastFakeUpdate: number;
}

interface BlobbiFakeStatusContextType {
  // Core fake status management
  getFakeStatus: (blobbiId: string) => Blobbi | null;
  setFakeStatus: (blobbiId: string, blobbi: Blobbi) => void;
  updateFakeStatus: (blobbiId: string, updates: Partial<Blobbi>) => void;
  clearFakeStatus: (blobbiId: string) => void;

  // Interaction tracking
  incrementPendingInteractions: (blobbiId: string) => void;
  decrementPendingInteractions: (blobbiId: string) => void;
  getPendingInteractionCount: (blobbiId: string) => number;

  // Status checks
  hasFakeStatus: (blobbiId: string) => boolean;

  // Sync with real data
  syncWithRealData: (blobbiId: string, realBlobbi: Blobbi) => void;
}

const BlobbiFakeStatusContext = createContext<BlobbiFakeStatusContextType | undefined>(undefined);

const FAKE_STATUS_STORAGE_KEY = 'blobbi-fake-status';
const FAKE_STATUS_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function BlobbiFakeStatusProvider({ children }: { children: React.ReactNode }) {
  const [fakeStatusMap, setFakeStatusMap] = useState<Map<string, FakeStatusData>>(new Map());

  // 🔥 FIX: Load fake status from sessionStorage with stricter validation
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(FAKE_STATUS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();

        // 🔥 CRITICAL: Only restore fake status that is very recent (< 2 minutes old)
        // This prevents stale cached data from overriding fresh Nostr data
        const STRICT_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes only

        const validEntries: [string, FakeStatusData][] = [];
        Object.entries(data).forEach(([key, value]) => {
          if (value && typeof value === 'object' && 'lastFakeUpdate' in value && 'pendingInteractions' in value) {
            const fakeStatusData = value as FakeStatusData;
            const isRecent = now - fakeStatusData.lastFakeUpdate < STRICT_EXPIRY_MS;
            const hasPendingInteractions = fakeStatusData.pendingInteractions > 0;

            // Only restore if recent AND has pending interactions (indicating real optimistic updates)
            if (isRecent && hasPendingInteractions) {
              validEntries.push([key, fakeStatusData]);
            }
          }
        });

        if (validEntries.length > 0) {
          const newMap = new Map<string, FakeStatusData>();
          validEntries.forEach(([blobbiId, value]) => {
            newMap.set(blobbiId, value);

          });
          setFakeStatusMap(newMap);
        } else {

        }
      }
    } catch (error) {
      console.warn('Failed to load fake status from storage:', error);
      // Clear corrupted storage
      sessionStorage.removeItem(FAKE_STATUS_STORAGE_KEY);
    }
  }, []);

  // Save fake status to sessionStorage when it changes
  useEffect(() => {
    try {
      const dataToStore: Record<string, FakeStatusData> = {};
      fakeStatusMap.forEach((value, key) => {
        dataToStore[key] = value;
      });
      sessionStorage.setItem(FAKE_STATUS_STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
      console.warn('Failed to save fake status to storage:', error);
    }
  }, [fakeStatusMap]);

  // Clean up expired fake status entries
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      setFakeStatusMap(prev => {
        const newMap = new Map(prev);
        let hasChanges = false;

        newMap.forEach((value, key) => {
          if (now - value.lastFakeUpdate > FAKE_STATUS_EXPIRY_MS) {
            newMap.delete(key);
            hasChanges = true;
          }
        });

        return hasChanges ? newMap : prev;
      });
    };

    const interval = setInterval(cleanup, 60000); // Clean up every minute
    return () => clearInterval(interval);
  }, []);

  const getFakeStatus = useCallback((blobbiId: string): Blobbi | null => {
    const data = fakeStatusMap.get(blobbiId);
    if (!data) return null;

    // Check if expired
    if (Date.now() - data.lastFakeUpdate > FAKE_STATUS_EXPIRY_MS) {
      setFakeStatusMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(blobbiId);
        return newMap;
      });
      return null;
    }

    return data.blobbi;
  }, [fakeStatusMap]);

  const setFakeStatus = useCallback((blobbiId: string, blobbi: Blobbi) => {
    setFakeStatusMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(blobbiId);
      newMap.set(blobbiId, {
        blobbi: { ...blobbi },
        pendingInteractions: existing?.pendingInteractions || 0,
        lastFakeUpdate: Date.now(),
      });
      return newMap;
    });
  }, []);

  const updateFakeStatus = useCallback((blobbiId: string, updates: Partial<Blobbi>) => {
    setFakeStatusMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(blobbiId);
      if (!existing) return prev;

      newMap.set(blobbiId, {
        ...existing,
        blobbi: { ...existing.blobbi, ...updates },
        lastFakeUpdate: Date.now(),
      });
      return newMap;
    });
  }, []);

  const clearFakeStatus = useCallback((blobbiId: string) => {
    setFakeStatusMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(blobbiId);
      return newMap;
    });
  }, []);

  const incrementPendingInteractions = useCallback((blobbiId: string) => {
    setFakeStatusMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(blobbiId);
      if (!existing) return prev;

      newMap.set(blobbiId, {
        ...existing,
        pendingInteractions: existing.pendingInteractions + 1,
        lastFakeUpdate: Date.now(),
      });
      return newMap;
    });
  }, []);

  const decrementPendingInteractions = useCallback((blobbiId: string) => {
    setFakeStatusMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(blobbiId);
      if (!existing) return prev;

      const newPendingCount = Math.max(0, existing.pendingInteractions - 1);

      // If no more pending interactions and fake status is older than real data, clear it
      if (newPendingCount === 0) {
        newMap.delete(blobbiId);
      } else {
        newMap.set(blobbiId, {
          ...existing,
          pendingInteractions: newPendingCount,
          lastFakeUpdate: Date.now(),
        });
      }
      return newMap;
    });
  }, []);

  const getPendingInteractionCount = useCallback((blobbiId: string): number => {
    const data = fakeStatusMap.get(blobbiId);
    return data?.pendingInteractions || 0;
  }, [fakeStatusMap]);

  const hasFakeStatus = useCallback((blobbiId: string): boolean => {
    return getFakeStatus(blobbiId) !== null;
  }, [getFakeStatus]);

  const syncWithRealData = useCallback((blobbiId: string, realBlobbi: Blobbi) => {
    const fakeData = fakeStatusMap.get(blobbiId);
    if (!fakeData) return;

    // 🔥 FIX: Enhanced sync logic with better timing and state comparison
    const fakeIsSleeping = fakeData.blobbi.isSleeping;
    const realIsSleeping = realBlobbi.isSleeping;
    const timeSinceFakeUpdate = Date.now() - fakeData.lastFakeUpdate;

    // Special handling for sleep state mismatches
    if (fakeIsSleeping !== realIsSleeping) {
      const shouldGiveUpOnOptimisticState = timeSinceFakeUpdate > 30000; // 30 seconds timeout

      if (shouldGiveUpOnOptimisticState) {

        clearFakeStatus(blobbiId);
      } else {

      }
      return;
    }

    // 🔥 FIX: More sophisticated sync decision based on multiple factors
    const realTimestamp = realBlobbi.lastInteraction;
    const fakeTimestamp = fakeData.blobbi.lastInteraction;
    const timeDifference = realTimestamp - fakeTimestamp;

    // Clear fake status if:
    // 1. Real data is significantly newer (5+ seconds) AND no pending interactions
    // 2. Fake data is very old (60+ seconds) regardless of pending interactions
    // 3. Real and fake timestamps are identical (indicating real update completed)

    const isRealDataNewer = timeDifference >= 5;
    const isFakeDataStale = timeSinceFakeUpdate > 60000;
    const areTimestampsIdentical = timeDifference === 0;

    if ((isRealDataNewer && fakeData.pendingInteractions === 0) || isFakeDataStale || areTimestampsIdentical) {

      clearFakeStatus(blobbiId);
    } else if (fakeData.pendingInteractions > 0 && timeDifference >= 0) {
      // Real data has caught up to or passed fake data, reset pending count

      setFakeStatusMap(prev => {
        const newMap = new Map(prev);
        newMap.set(blobbiId, {
          ...fakeData,
          pendingInteractions: 0,
          lastFakeUpdate: Date.now(),
        });
        return newMap;
      });
    } else {
      
    }
  }, [fakeStatusMap, clearFakeStatus]);

  const value: BlobbiFakeStatusContextType = {
    getFakeStatus,
    setFakeStatus,
    updateFakeStatus,
    clearFakeStatus,
    incrementPendingInteractions,
    decrementPendingInteractions,
    getPendingInteractionCount,
    hasFakeStatus,
    syncWithRealData,
  };

  return (
    <BlobbiFakeStatusContext.Provider value={value}>
      {children}
    </BlobbiFakeStatusContext.Provider>
  );
}

export function useBlobbiFakeStatus() {
  const context = useContext(BlobbiFakeStatusContext);
  if (context === undefined) {
    throw new Error('useBlobbiFakeStatus must be used within a BlobbiFakeStatusProvider');
  }
  return context;
}

// Helper function to apply stat changes to a Blobbi object
export function applyStatChangesToBlobbi(
  blobbi: Blobbi,
  statChanges: Array<[string, number]>
): Blobbi {
  const updatedBlobbi = { ...blobbi };
  const updatedStats = { ...blobbi.stats };

  statChanges.forEach(([stat, change]) => {
    switch (stat) {
      case 'hunger':
        updatedStats.hunger = Math.max(0, Math.min(100, updatedStats.hunger + change));
        break;
      case 'happiness':
        updatedStats.happiness = Math.max(0, Math.min(100, updatedStats.happiness + change));
        break;
      case 'health':
        updatedStats.health = Math.max(0, Math.min(100, updatedStats.health + change));
        break;
      case 'hygiene':
        updatedStats.hygiene = Math.max(0, Math.min(100, updatedStats.hygiene + change));
        break;
      case 'energy':
        updatedStats.energy = Math.max(0, Math.min(100, updatedStats.energy + change));
        break;
      case 'egg_temperature':
        if (updatedBlobbi.eggTemperature !== undefined) {
          updatedBlobbi.eggTemperature = Math.max(0, Math.min(100, updatedBlobbi.eggTemperature + change));
        }
        break;
      case 'shell_integrity':
        if (updatedBlobbi.shellIntegrity !== undefined) {
          updatedBlobbi.shellIntegrity = Math.max(0, Math.min(100, updatedBlobbi.shellIntegrity + change));
        }
        break;
    }
  });

  updatedBlobbi.stats = updatedStats;
  // Don't automatically update lastInteraction here - let the calling code handle timing

  return updatedBlobbi;
}