import { describe, it, expect } from 'vitest';

// Mock types for testing
interface MockBlobbi {
  id: string;
  name: string;
  isSleeping: boolean;
  ownerPubkey: string;
}

interface MockCompanionData {
  blobbi: MockBlobbi;
  blobbiId: string;
}

// Helper function to simulate floating menu bed button logic
function getBedButtonState(
  isBedVisible: boolean,
  companionData: MockCompanionData | null
): {
  icon: string;
  label: string;
  disabled: boolean;
  shouldPreventAction: boolean;
} {
  const isBlobbiSleeping = companionData?.blobbi?.isSleeping || false;
  
  return {
    icon: isBedVisible ? '🛏️' : '😴',
    label: isBedVisible 
      ? (isBlobbiSleeping ? 'Bed Required (Sleeping)' : 'Remove Bed') 
      : 'Show Bed',
    disabled: isBedVisible && isBlobbiSleeping,
    shouldPreventAction: isBedVisible && isBlobbiSleeping
  };
}

// Helper function to simulate the handleSleep action logic
function shouldAllowBedToggle(
  isBedVisible: boolean,
  companionData: MockCompanionData | null
): { allowed: boolean; reason?: string } {
  // Check if Blobbi is sleeping - if so, prevent hiding the bed
  if (isBedVisible && companionData?.blobbi?.isSleeping) {
    return { 
      allowed: false, 
      reason: 'Cannot hide bed when Blobbi is sleeping' 
    };
  }
  
  return { allowed: true };
}

describe('Floating Menu Bed Logic', () => {
  const mockAwakeBlobbi: MockBlobbi = {
    id: 'blobbi-test',
    name: 'TestBlobbi',
    isSleeping: false,
    ownerPubkey: 'user123'
  };

  const mockSleepingBlobbi: MockBlobbi = {
    id: 'blobbi-test',
    name: 'TestBlobbi',
    isSleeping: true,
    ownerPubkey: 'user123'
  };

  const mockAwakeCompanionData: MockCompanionData = {
    blobbi: mockAwakeBlobbi,
    blobbiId: 'blobbi-test'
  };

  const mockSleepingCompanionData: MockCompanionData = {
    blobbi: mockSleepingBlobbi,
    blobbiId: 'blobbi-test'
  };

  describe('getBedButtonState', () => {
    it('should show "Show Bed" when bed is not visible', () => {
      const state = getBedButtonState(false, mockAwakeCompanionData);
      
      expect(state.icon).toBe('😴');
      expect(state.label).toBe('Show Bed');
      expect(state.disabled).toBe(false);
      expect(state.shouldPreventAction).toBe(false);
    });

    it('should show "Remove Bed" when bed is visible and Blobbi is awake', () => {
      const state = getBedButtonState(true, mockAwakeCompanionData);
      
      expect(state.icon).toBe('🛏️');
      expect(state.label).toBe('Remove Bed');
      expect(state.disabled).toBe(false);
      expect(state.shouldPreventAction).toBe(false);
    });

    it('should show "Bed Required (Sleeping)" when bed is visible and Blobbi is sleeping', () => {
      const state = getBedButtonState(true, mockSleepingCompanionData);
      
      expect(state.icon).toBe('🛏️');
      expect(state.label).toBe('Bed Required (Sleeping)');
      expect(state.disabled).toBe(true);
      expect(state.shouldPreventAction).toBe(true);
    });

    it('should handle null companion data gracefully', () => {
      const state = getBedButtonState(true, null);
      
      expect(state.icon).toBe('🛏️');
      expect(state.label).toBe('Remove Bed');
      expect(state.disabled).toBe(false);
      expect(state.shouldPreventAction).toBe(false);
    });
  });

  describe('shouldAllowBedToggle', () => {
    it('should allow showing bed when bed is not visible', () => {
      const result = shouldAllowBedToggle(false, mockAwakeCompanionData);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow hiding bed when bed is visible and Blobbi is awake', () => {
      const result = shouldAllowBedToggle(true, mockAwakeCompanionData);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prevent hiding bed when bed is visible and Blobbi is sleeping', () => {
      const result = shouldAllowBedToggle(true, mockSleepingCompanionData);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot hide bed when Blobbi is sleeping');
    });

    it('should allow bed toggle when no companion data is available', () => {
      const result = shouldAllowBedToggle(true, null);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Bed Visibility State Transitions', () => {
    it('should handle bed show → bed hide transition when Blobbi is awake', () => {
      // Start with bed not visible
      const bedVisibleInitial = false;
      const stateInitial = getBedButtonState(bedVisibleInitial, mockAwakeCompanionData);
      
      expect(stateInitial.label).toBe('Show Bed');
      expect(stateInitial.disabled).toBe(false);
      
      // Show bed
      const bedVisibleAfterShow = true;
      const stateAfterShow = getBedButtonState(bedVisibleAfterShow, mockAwakeCompanionData);
      
      expect(stateAfterShow.label).toBe('Remove Bed');
      expect(stateAfterShow.disabled).toBe(false);
      
      // Should allow hiding bed
      const toggleResult = shouldAllowBedToggle(bedVisibleAfterShow, mockAwakeCompanionData);
      expect(toggleResult.allowed).toBe(true);
    });

    it('should prevent bed hide when Blobbi goes to sleep', () => {
      // Start with bed visible and Blobbi awake
      const bedVisible = true;
      const stateAwake = getBedButtonState(bedVisible, mockAwakeCompanionData);
      
      expect(stateAwake.label).toBe('Remove Bed');
      expect(stateAwake.disabled).toBe(false);
      
      // Blobbi goes to sleep
      const stateSleeping = getBedButtonState(bedVisible, mockSleepingCompanionData);
      
      expect(stateSleeping.label).toBe('Bed Required (Sleeping)');
      expect(stateSleeping.disabled).toBe(true);
      
      // Should prevent hiding bed
      const toggleResult = shouldAllowBedToggle(bedVisible, mockSleepingCompanionData);
      expect(toggleResult.allowed).toBe(false);
    });

    it('should re-enable bed hide when Blobbi wakes up', () => {
      // Start with bed visible and Blobbi sleeping
      const bedVisible = true;
      const stateSleeping = getBedButtonState(bedVisible, mockSleepingCompanionData);
      
      expect(stateSleeping.label).toBe('Bed Required (Sleeping)');
      expect(stateSleeping.disabled).toBe(true);
      
      // Blobbi wakes up
      const stateAwake = getBedButtonState(bedVisible, mockAwakeCompanionData);
      
      expect(stateAwake.label).toBe('Remove Bed');
      expect(stateAwake.disabled).toBe(false);
      
      // Should allow hiding bed again
      const toggleResult = shouldAllowBedToggle(bedVisible, mockAwakeCompanionData);
      expect(toggleResult.allowed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined companion blobbi', () => {
      const companionDataWithoutBlobbi = {
        blobbi: undefined as unknown as MockBlobbi,
        blobbiId: 'test'
      };
      
      const state = getBedButtonState(true, companionDataWithoutBlobbi);
      
      expect(state.disabled).toBe(false);
      expect(state.shouldPreventAction).toBe(false);
    });

    it('should handle companion data with missing isSleeping property', () => {
      const companionDataWithoutSleepState = {
        blobbi: {
          id: 'test',
          name: 'Test',
          ownerPubkey: 'user123'
          // isSleeping property missing
        } as unknown as MockBlobbi,
        blobbiId: 'test'
      };
      
      const state = getBedButtonState(true, companionDataWithoutSleepState);
      
      expect(state.disabled).toBe(false);
      expect(state.shouldPreventAction).toBe(false);
    });
  });

  describe('UI Consistency Requirements', () => {
    it('should ensure disabled state matches prevent action state', () => {
      const testCases = [
        { bedVisible: false, companion: mockAwakeCompanionData },
        { bedVisible: true, companion: mockAwakeCompanionData },
        { bedVisible: true, companion: mockSleepingCompanionData },
        { bedVisible: false, companion: mockSleepingCompanionData },
        { bedVisible: true, companion: null },
      ];
      
      testCases.forEach(({ bedVisible, companion }) => {
        const state = getBedButtonState(bedVisible, companion);
        const actionResult = shouldAllowBedToggle(bedVisible, companion);
        
        // Disabled state should match whether action is prevented
        expect(state.disabled).toBe(!actionResult.allowed);
        expect(state.shouldPreventAction).toBe(!actionResult.allowed);
      });
    });

    it('should provide clear labels for all states', () => {
      const testCases = [
        { 
          bedVisible: false, 
          companion: mockAwakeCompanionData, 
          expectedLabel: 'Show Bed' 
        },
        { 
          bedVisible: true, 
          companion: mockAwakeCompanionData, 
          expectedLabel: 'Remove Bed' 
        },
        { 
          bedVisible: true, 
          companion: mockSleepingCompanionData, 
          expectedLabel: 'Bed Required (Sleeping)' 
        },
      ];
      
      testCases.forEach(({ bedVisible, companion, expectedLabel }) => {
        const state = getBedButtonState(bedVisible, companion);
        expect(state.label).toBe(expectedLabel);
      });
    });
  });
});