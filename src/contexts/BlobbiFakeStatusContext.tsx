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

  // Load fake status from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(FAKE_STATUS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        const validEntries = Object.entries(data).filter(([_, value]: [string, FakeStatusData]) => {
          return now - value.lastFakeUpdate < FAKE_STATUS_EXPIRY_MS;
        });
        
        if (validEntries.length > 0) {
          const newMap = new Map();
          validEntries.forEach(([blobbiId, value]) => {
            newMap.set(blobbiId, value);
          });
          setFakeStatusMap(newMap);
        }
      }
    } catch (error) {
      console.warn('Failed to load fake status from storage:', error);
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
    
    // Special handling for sleep state: only sync if the real sleep state matches the fake sleep state
    // This prevents intermediate events (like "rest" interactions) from overriding optimistic sleep state
    const fakeIsSleeping = fakeData.blobbi.isSleeping;
    const realIsSleeping = realBlobbi.isSleeping;
    
    // If we have an optimistic sleep state that doesn't match reality, keep the fake state
    // until the real sleep state catches up
    if (fakeIsSleeping !== realIsSleeping) {
      // Only clear fake status if real data is significantly newer (indicating the sleep operation completed)
      // and the sleep states now match, or if enough time has passed that we should give up
      const timeSinceFakeUpdate = Date.now() - fakeData.lastFakeUpdate;
      const shouldGiveUpOnOptimisticState = timeSinceFakeUpdate > 30000; // 30 seconds timeout
      
      if (shouldGiveUpOnOptimisticState) {
        console.log('Giving up on optimistic sleep state after timeout');
        clearFakeStatus(blobbiId);
      }
      // Otherwise, keep the optimistic state
      return;
    }
    
    // If sleep states match, proceed with normal sync logic
    // If real data is newer than our fake data, and no pending interactions, clear fake status
    if (realBlobbi.lastInteraction > fakeData.blobbi.lastInteraction && fakeData.pendingInteractions === 0) {
      clearFakeStatus(blobbiId);
    } else if (fakeData.pendingInteractions > 0) {
      // Keep fake status but reset pending count if real data caught up
      if (realBlobbi.lastInteraction >= fakeData.blobbi.lastInteraction) {
        setFakeStatusMap(prev => {
          const newMap = new Map(prev);
          newMap.set(blobbiId, {
            ...fakeData,
            pendingInteractions: 0,
            lastFakeUpdate: Date.now(),
          });
          return newMap;
        });
      }
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
  updatedBlobbi.lastInteraction = Math.floor(Date.now() / 1000);
  
  return updatedBlobbi;
}