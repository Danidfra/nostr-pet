import { createContext, useState, useCallback, useContext, ReactNode, useEffect, useRef } from 'react';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';

const BED_VISIBILITY_KEY = 'blobbi-bed-visible';
const BED_MANUAL_OVERRIDE_KEY = 'blobbi-bed-manual-override';

interface BedContextType {
  isBedVisible: boolean;
  isCompanionLoaded: boolean;
  shouldRenderBed: boolean;
  showBed: () => void;
  hideBed: () => void;
  toggleBed: () => void;
  setCompanionLoaded: (loaded: boolean) => void;
}

const BedContext = createContext<BedContextType | undefined>(undefined);

export function BedProvider({ children }: { children: ReactNode }) {
  const { data: companionData } = useCurrentCompanion();
  
  const [isBedVisible, setIsBedVisible] = useState(() => {
    try {
      const saved = localStorage.getItem(BED_VISIBILITY_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      console.error('Failed to parse bed visibility from localStorage:', error);
      return false;
    }
  });

  // ✅ NEW: Track companion loading state
  const [isCompanionLoaded, setIsCompanionLoaded] = useState(false);

  // ✅ FIXED: Track manual override state to prevent auto-hide when user manually shows bed
  const [isManualOverride, setIsManualOverride] = useState(() => {
    try {
      const saved = localStorage.getItem(BED_MANUAL_OVERRIDE_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      console.error('Failed to parse manual override from localStorage:', error);
      return false;
    }
  });

  const previousSleepState = useRef<boolean | null>(null);

  const setBedVisibility = useCallback((visible: boolean, isManual: boolean = false) => {
    setIsBedVisible(visible);
    
    // ✅ FIXED: Set manual override when user manually toggles bed
    if (isManual) {
      setIsManualOverride(visible);
      try {
        localStorage.setItem(BED_MANUAL_OVERRIDE_KEY, JSON.stringify(visible));
      } catch (error) {
        console.error('Failed to save manual override to localStorage:', error);
      }
    }
    
    try {
      localStorage.setItem(BED_VISIBILITY_KEY, JSON.stringify(visible));
    } catch (error) {
      console.error('Failed to save bed visibility to localStorage:', error);
    }
  }, []);

  // ✅ FIXED: Manual actions set override flag
  const showBed = useCallback(() => setBedVisibility(true, true), [setBedVisibility]);
  const hideBed = useCallback(() => setBedVisibility(false, true), [setBedVisibility]);
  const toggleBed = useCallback(() => setBedVisibility(!isBedVisible, true), [isBedVisible, setBedVisibility]);

  // ✅ NEW: Function to set companion loaded state
  const setCompanionLoaded = useCallback((loaded: boolean) => {
    console.log(`🔄 Companion loaded state changed: ${loaded}`);
    setIsCompanionLoaded(loaded);
  }, []);

  // ✅ FIXED: Auto-show bed when companion goes to sleep, but respect manual overrides
  // ✅ NEW: Only process sleep state changes when companion is loaded
  useEffect(() => {
    if (companionData?.blobbi && isCompanionLoaded) {
      const isCompanionSleeping = companionData.blobbi.isSleeping || false;
      
      // Track sleep state changes
      if (previousSleepState.current !== null && previousSleepState.current !== isCompanionSleeping) {
        // Sleep state changed
        if (isCompanionSleeping) {
          // Companion just went to sleep - always show bed and clear manual override
          console.log('🛏️ Auto-showing bed because companion went to sleep');
          setIsManualOverride(false);
          setBedVisibility(true, false);
          try {
            localStorage.setItem(BED_MANUAL_OVERRIDE_KEY, JSON.stringify(false));
          } catch (error) {
            console.error('Failed to clear manual override:', error);
          }
        } else {
          // Companion just woke up - only auto-hide if no manual override
          if (!isManualOverride) {
            console.log('🛏️ Auto-hiding bed because companion woke up (no manual override)');
            setBedVisibility(false, false);
          } else {
            console.log('🛏️ Keeping bed visible due to manual override');
          }
        }
      } else if (previousSleepState.current === null && isCompanionLoaded) {
        // Initial load after companion is loaded - show bed if companion is sleeping
        if (isCompanionSleeping && (!isManualOverride || isBedVisible)) {
          console.log('🛏️ Auto-showing bed on load because companion is sleeping');
          setBedVisibility(true, false);
        }
      }
      
      previousSleepState.current = isCompanionSleeping;
    }
  }, [companionData?.blobbi?.isSleeping, isCompanionLoaded, isManualOverride, isBedVisible, setBedVisibility]);

  // ✅ NEW: Only render bed when companion is loaded and bed should be visible
  const shouldRenderBed = isCompanionLoaded && isBedVisible;

  const value = { 
    isBedVisible, 
    isCompanionLoaded, 
    shouldRenderBed, 
    showBed, 
    hideBed, 
    toggleBed, 
    setCompanionLoaded 
  };

  return <BedContext.Provider value={value}>{children}</BedContext.Provider>;
}

export function useBed() {
  const context = useContext(BedContext);
  if (context === undefined) {
    throw new Error('useBed must be used within a BedProvider');
  }
  return context;
}
