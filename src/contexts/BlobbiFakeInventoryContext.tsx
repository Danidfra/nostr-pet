import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BlobbonautProfile } from '@/types/blobbi';

interface FakeInventoryData {
  inventory: BlobbonautProfile;
  pendingInteractions: number;
  lastFakeUpdate: number;
}

interface BlobbiFakeInventoryContextType {
  getFakeInventory: (profileId: string) => BlobbonautProfile | null;
  setFakeInventory: (profileId: string, inventory: BlobbonautProfile) => void;
  updateFakeInventory: (profileId: string, updates: Partial<BlobbonautProfile>) => void;
  clearFakeInventory: (profileId: string) => void;
  
  incrementPendingInteractions: (profileId: string) => void;
  decrementPendingInteractions: (profileId: string) => void;
  getPendingInteractionCount: (profileId: string) => number;
  
  hasFakeInventory: (profileId: string) => boolean;
  
  syncWithRealData: (profileId: string, realInventory: BlobbonautProfile) => void;
}

const BlobbiFakeInventoryContext = createContext<BlobbiFakeInventoryContextType | undefined>(undefined);

const FAKE_INVENTORY_STORAGE_KEY = 'blobbi-fake-inventory';
const FAKE_INVENTORY_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function BlobbiFakeInventoryProvider({ children }: { children: React.ReactNode }) {
  const [fakeInventoryMap, setFakeInventoryMap] = useState<Map<string, FakeInventoryData>>(new Map());

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(FAKE_INVENTORY_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        const validEntries = Object.entries(data).filter(([_, value]: [string, FakeInventoryData]) => {
          return now - value.lastFakeUpdate < FAKE_INVENTORY_EXPIRY_MS;
        });
        
        if (validEntries.length > 0) {
          const newMap = new Map(validEntries as [string, FakeInventoryData][]);
          setFakeInventoryMap(newMap);
        }
      }
    } catch (error) {
      console.warn('Failed to load fake inventory from storage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const dataToStore: Record<string, FakeInventoryData> = {};
      fakeInventoryMap.forEach((value, key) => {
        dataToStore[key] = value;
      });
      sessionStorage.setItem(FAKE_INVENTORY_STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
      console.warn('Failed to save fake inventory to storage:', error);
    }
  }, [fakeInventoryMap]);

  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      setFakeInventoryMap(prev => {
        const newMap = new Map(prev);
        let hasChanges = false;
        
        newMap.forEach((value, key) => {
          if (now - value.lastFakeUpdate > FAKE_INVENTORY_EXPIRY_MS) {
            newMap.delete(key);
            hasChanges = true;
          }
        });
        
        return hasChanges ? newMap : prev;
      });
    };

    const interval = setInterval(cleanup, 60000);
    return () => clearInterval(interval);
  }, []);

  const getFakeInventory = useCallback((profileId: string): BlobbonautProfile | null => {
    const data = fakeInventoryMap.get(profileId);
    if (!data) return null;
    
    if (Date.now() - data.lastFakeUpdate > FAKE_INVENTORY_EXPIRY_MS) {
      setFakeInventoryMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(profileId);
        return newMap;
      });
      return null;
    }
    
    return data.inventory;
  }, [fakeInventoryMap]);

  const setFakeInventory = useCallback((profileId: string, inventory: BlobbonautProfile) => {
    setFakeInventoryMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(profileId);
      newMap.set(profileId, {
        inventory: { ...inventory },
        pendingInteractions: existing?.pendingInteractions || 0,
        lastFakeUpdate: Date.now(),
      });
      return newMap;
    });
  }, []);

  const updateFakeInventory = useCallback((profileId: string, updates: Partial<BlobbonautProfile>) => {
    setFakeInventoryMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(profileId);
      if (!existing) return prev;
      
      newMap.set(profileId, {
        ...existing,
        inventory: { ...existing.inventory, ...updates },
        lastFakeUpdate: Date.now(),
      });
      return newMap;
    });
  }, []);

  const clearFakeInventory = useCallback((profileId: string) => {
    setFakeInventoryMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(profileId);
      return newMap;
    });
  }, []);

  const incrementPendingInteractions = useCallback((profileId: string) => {
    setFakeInventoryMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(profileId);
      if (!existing) return prev;
      
      newMap.set(profileId, {
        ...existing,
        pendingInteractions: existing.pendingInteractions + 1,
        lastFakeUpdate: Date.now(),
      });
      return newMap;
    });
  }, []);

  const decrementPendingInteractions = useCallback((profileId: string) => {
    setFakeInventoryMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(profileId);
      if (!existing) return prev;
      
      const newPendingCount = Math.max(0, existing.pendingInteractions - 1);
      
      if (newPendingCount === 0) {
        newMap.delete(profileId);
      } else {
        newMap.set(profileId, {
          ...existing,
          pendingInteractions: newPendingCount,
          lastFakeUpdate: Date.now(),
        });
      }
      return newMap;
    });
  }, []);

  const getPendingInteractionCount = useCallback((profileId: string): number => {
    const data = fakeInventoryMap.get(profileId);
    return data?.pendingInteractions || 0;
  }, [fakeInventoryMap]);

  const hasFakeInventory = useCallback((profileId: string): boolean => {
    return getFakeInventory(profileId) !== null;
  }, [getFakeInventory]);

  const syncWithRealData = useCallback((profileId: string, realInventory: BlobbonautProfile) => {
    const fakeData = fakeInventoryMap.get(profileId);
    if (!fakeData) return;
    
    if (realInventory.lastModified > fakeData.inventory.lastModified && fakeData.pendingInteractions === 0) {
      clearFakeInventory(profileId);
    } else if (fakeData.pendingInteractions > 0) {
      if (realInventory.lastModified >= fakeData.inventory.lastModified) {
        setFakeInventoryMap(prev => {
          const newMap = new Map(prev);
          newMap.set(profileId, {
            ...fakeData,
            pendingInteractions: 0,
            lastFakeUpdate: Date.now(),
          });
          return newMap;
        });
      }
    }
  }, [fakeInventoryMap, clearFakeInventory]);

  const value: BlobbiFakeInventoryContextType = {
    getFakeInventory,
    setFakeInventory,
    updateFakeInventory,
    clearFakeInventory,
    incrementPendingInteractions,
    decrementPendingInteractions,
    getPendingInteractionCount,
    hasFakeInventory,
    syncWithRealData,
  };

  return (
    <BlobbiFakeInventoryContext.Provider value={value}>
      {children}
    </BlobbiFakeInventoryContext.Provider>
  );
}

export function useBlobbiFakeInventory() {
  const context = useContext(BlobbiFakeInventoryContext);
  if (context === undefined) {
    throw new Error('useBlobbiFakeInventory must be used within a BlobbiFakeInventoryProvider');
  }
  return context;
}
