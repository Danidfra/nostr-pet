import { createContext, useState, useCallback, useContext, ReactNode } from 'react';

const BED_VISIBILITY_KEY = 'blobbi-bed-visible';

interface BedContextType {
  isBedVisible: boolean;
  showBed: () => void;
  hideBed: () => void;
  toggleBed: () => void;
}

const BedContext = createContext<BedContextType | undefined>(undefined);

export function BedProvider({ children }: { children: ReactNode }) {
  const [isBedVisible, setIsBedVisible] = useState(() => {
    try {
      const saved = localStorage.getItem(BED_VISIBILITY_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      console.error('Failed to parse bed visibility from localStorage:', error);
      return false;
    }
  });

  const setBedVisibility = useCallback((visible: boolean) => {
    setIsBedVisible(visible);
    try {
      localStorage.setItem(BED_VISIBILITY_KEY, JSON.stringify(visible));
    } catch (error) {
      console.error('Failed to save bed visibility to localStorage:', error);
    }
  }, []);

  const showBed = useCallback(() => setBedVisibility(true), [setBedVisibility]);
  const hideBed = useCallback(() => setBedVisibility(false), [setBedVisibility]);
  const toggleBed = useCallback(() => setBedVisibility(!isBedVisible), [isBedVisible, setBedVisibility]);

  const value = { isBedVisible, showBed, hideBed, toggleBed };

  return <BedContext.Provider value={value}>{children}</BedContext.Provider>;
}

export function useBed() {
  const context = useContext(BedContext);
  if (context === undefined) {
    throw new Error('useBed must be used within a BedProvider');
  }
  return context;
}
