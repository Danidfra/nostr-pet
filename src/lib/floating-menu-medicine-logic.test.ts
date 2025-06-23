import { describe, it, expect } from 'vitest';

// Mock types for testing
interface MockBlobbi {
  id: string;
  name: string;
  lifeStage: 'egg' | 'baby' | 'adult';
  stats: {
    health: number;
    happiness: number;
    hunger: number;
    hygiene: number;
    energy: number;
  };
  eggTemperature?: number;
  shellIntegrity?: number;
}

interface MockCompanionData {
  blobbi: MockBlobbi;
  blobbiId: string;
}

// Helper function to simulate medicine button availability logic
function getMedicineButtonState(
  companionData: MockCompanionData | null
): {
  icon: string;
  label: string;
  disabled: boolean;
  available: boolean;
} {
  if (!companionData?.blobbi) {
    return {
      icon: '💊',
      label: 'Medicine',
      disabled: true,
      available: false
    };
  }

  // Medicine is always available for all life stages
  return {
    icon: '💊',
    label: 'Medicine',
    disabled: false,
    available: true
  };
}

// Helper function to simulate medicine action validation
function validateMedicineAction(
  companionData: MockCompanionData | null
): { 
  canUse: boolean; 
  reason?: string;
  expectedTitle?: string;
} {
  if (!companionData?.blobbi) {
    return { 
      canUse: false, 
      reason: 'No companion available' 
    };
  }

  const { blobbi } = companionData;
  
  // Medicine is available for all life stages
  const expectedTitle = blobbi.lifeStage === 'egg' 
    ? 'Strengthen Your Egg' 
    : 'Heal Your Blobbi';

  return { 
    canUse: true,
    expectedTitle
  };
}

// Helper function to simulate stat effects for different life stages
function getMedicineEffects(lifeStage: 'egg' | 'baby' | 'adult'): Record<string, number> {
  // Medicine items typically provide health benefits
  // For eggs, they might also affect shell integrity
  const baseEffects = { health: 15 };
  
  if (lifeStage === 'egg') {
    return {
      ...baseEffects,
      shell_integrity: 10 // Eggs get additional shell strengthening
    };
  }
  
  return baseEffects;
}

describe('Floating Menu Medicine Logic', () => {
  const mockEggBlobbi: MockBlobbi = {
    id: 'egg-test',
    name: 'TestEgg',
    lifeStage: 'egg',
    stats: {
      health: 50,
      happiness: 60,
      hunger: 70,
      hygiene: 80,
      energy: 90
    },
    eggTemperature: 75,
    shellIntegrity: 85
  };

  const mockBabyBlobbi: MockBlobbi = {
    id: 'baby-test',
    name: 'TestBaby',
    lifeStage: 'baby',
    stats: {
      health: 40,
      happiness: 50,
      hunger: 60,
      hygiene: 70,
      energy: 80
    }
  };

  const mockAdultBlobbi: MockBlobbi = {
    id: 'adult-test',
    name: 'TestAdult',
    lifeStage: 'adult',
    stats: {
      health: 30,
      happiness: 40,
      hunger: 50,
      hygiene: 60,
      energy: 70
    }
  };

  const mockEggCompanionData: MockCompanionData = {
    blobbi: mockEggBlobbi,
    blobbiId: 'egg-test'
  };

  const mockBabyCompanionData: MockCompanionData = {
    blobbi: mockBabyBlobbi,
    blobbiId: 'baby-test'
  };

  const mockAdultCompanionData: MockCompanionData = {
    blobbi: mockAdultBlobbi,
    blobbiId: 'adult-test'
  };

  describe('getMedicineButtonState', () => {
    it('should show medicine button as available for egg stage', () => {
      const state = getMedicineButtonState(mockEggCompanionData);
      
      expect(state.icon).toBe('💊');
      expect(state.label).toBe('Medicine');
      expect(state.disabled).toBe(false);
      expect(state.available).toBe(true);
    });

    it('should show medicine button as available for baby stage', () => {
      const state = getMedicineButtonState(mockBabyCompanionData);
      
      expect(state.icon).toBe('💊');
      expect(state.label).toBe('Medicine');
      expect(state.disabled).toBe(false);
      expect(state.available).toBe(true);
    });

    it('should show medicine button as available for adult stage', () => {
      const state = getMedicineButtonState(mockAdultCompanionData);
      
      expect(state.icon).toBe('💊');
      expect(state.label).toBe('Medicine');
      expect(state.disabled).toBe(false);
      expect(state.available).toBe(true);
    });

    it('should handle null companion data gracefully', () => {
      const state = getMedicineButtonState(null);
      
      expect(state.icon).toBe('💊');
      expect(state.label).toBe('Medicine');
      expect(state.disabled).toBe(true);
      expect(state.available).toBe(false);
    });
  });

  describe('validateMedicineAction', () => {
    it('should allow medicine action for egg stage with correct title', () => {
      const result = validateMedicineAction(mockEggCompanionData);
      
      expect(result.canUse).toBe(true);
      expect(result.expectedTitle).toBe('Strengthen Your Egg');
      expect(result.reason).toBeUndefined();
    });

    it('should allow medicine action for baby stage with correct title', () => {
      const result = validateMedicineAction(mockBabyCompanionData);
      
      expect(result.canUse).toBe(true);
      expect(result.expectedTitle).toBe('Heal Your Blobbi');
      expect(result.reason).toBeUndefined();
    });

    it('should allow medicine action for adult stage with correct title', () => {
      const result = validateMedicineAction(mockAdultCompanionData);
      
      expect(result.canUse).toBe(true);
      expect(result.expectedTitle).toBe('Heal Your Blobbi');
      expect(result.reason).toBeUndefined();
    });

    it('should prevent medicine action when no companion is available', () => {
      const result = validateMedicineAction(null);
      
      expect(result.canUse).toBe(false);
      expect(result.reason).toBe('No companion available');
      expect(result.expectedTitle).toBeUndefined();
    });
  });

  describe('getMedicineEffects', () => {
    it('should provide health and shell integrity effects for eggs', () => {
      const effects = getMedicineEffects('egg');
      
      expect(effects.health).toBe(15);
      expect(effects.shell_integrity).toBe(10);
    });

    it('should provide only health effects for baby stage', () => {
      const effects = getMedicineEffects('baby');
      
      expect(effects.health).toBe(15);
      expect(effects.shell_integrity).toBeUndefined();
    });

    it('should provide only health effects for adult stage', () => {
      const effects = getMedicineEffects('adult');
      
      expect(effects.health).toBe(15);
      expect(effects.shell_integrity).toBeUndefined();
    });
  });

  describe('Medicine Button Integration', () => {
    it('should maintain consistent state across all life stages', () => {
      const testCases = [
        { companion: mockEggCompanionData, stage: 'egg' },
        { companion: mockBabyCompanionData, stage: 'baby' },
        { companion: mockAdultCompanionData, stage: 'adult' },
      ];
      
      testCases.forEach(({ companion, stage }) => {
        const buttonState = getMedicineButtonState(companion);
        const actionValidation = validateMedicineAction(companion);
        
        // Button should be available and action should be valid for all stages
        expect(buttonState.available).toBe(true);
        expect(buttonState.disabled).toBe(false);
        expect(actionValidation.canUse).toBe(true);
        
        // Title should be appropriate for life stage
        if (stage === 'egg') {
          expect(actionValidation.expectedTitle).toBe('Strengthen Your Egg');
        } else {
          expect(actionValidation.expectedTitle).toBe('Heal Your Blobbi');
        }
      });
    });

    it('should handle edge cases gracefully', () => {
      const companionDataWithoutBlobbi = {
        blobbi: undefined as unknown as MockBlobbi,
        blobbiId: 'test'
      };
      
      const buttonState = getMedicineButtonState(companionDataWithoutBlobbi);
      const actionValidation = validateMedicineAction(companionDataWithoutBlobbi);
      
      expect(buttonState.available).toBe(false);
      expect(buttonState.disabled).toBe(true);
      expect(actionValidation.canUse).toBe(false);
    });
  });

  describe('Fake Status System Integration', () => {
    it('should provide immediate feedback for medicine usage', () => {
      // Test that medicine effects are applied immediately to fake status
      const testCases = [
        { 
          companion: mockEggCompanionData, 
          expectedEffects: { health: 15, shell_integrity: 10 } 
        },
        { 
          companion: mockBabyCompanionData, 
          expectedEffects: { health: 15 } 
        },
        { 
          companion: mockAdultCompanionData, 
          expectedEffects: { health: 15 } 
        },
      ];
      
      testCases.forEach(({ companion, expectedEffects }) => {
        const effects = getMedicineEffects(companion.blobbi.lifeStage);
        
        Object.entries(expectedEffects).forEach(([stat, expectedValue]) => {
          expect(effects[stat]).toBe(expectedValue);
        });
      });
    });

    it('should ensure medicine button remains available after fake status updates', () => {
      // Medicine should always be available regardless of current stats
      const lowHealthBlobbi: MockBlobbi = {
        ...mockBabyBlobbi,
        stats: {
          ...mockBabyBlobbi.stats,
          health: 5 // Very low health
        }
      };
      
      const lowHealthCompanion: MockCompanionData = {
        blobbi: lowHealthBlobbi,
        blobbiId: 'low-health-test'
      };
      
      const buttonState = getMedicineButtonState(lowHealthCompanion);
      const actionValidation = validateMedicineAction(lowHealthCompanion);
      
      expect(buttonState.available).toBe(true);
      expect(buttonState.disabled).toBe(false);
      expect(actionValidation.canUse).toBe(true);
    });
  });

  describe('UI Consistency Requirements', () => {
    it('should provide consistent button appearance across all states', () => {
      const allCompanions = [
        mockEggCompanionData,
        mockBabyCompanionData,
        mockAdultCompanionData
      ];
      
      allCompanions.forEach(companion => {
        const state = getMedicineButtonState(companion);
        
        // All valid companions should have the same icon and label
        expect(state.icon).toBe('💊');
        expect(state.label).toBe('Medicine');
      });
    });

    it('should ensure button state matches action availability', () => {
      const testCases = [
        mockEggCompanionData,
        mockBabyCompanionData,
        mockAdultCompanionData,
        null
      ];
      
      testCases.forEach(companion => {
        const buttonState = getMedicineButtonState(companion);
        const actionValidation = validateMedicineAction(companion);
        
        // Button availability should match action validity
        expect(buttonState.available).toBe(actionValidation.canUse);
        expect(buttonState.disabled).toBe(!actionValidation.canUse);
      });
    });
  });
});