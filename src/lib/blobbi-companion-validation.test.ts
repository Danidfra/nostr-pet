import { describe, it, expect } from 'vitest';
import { canBlobbiBeCompanion, getCompanionValidationMessage, filterValidCompanions } from './blobbi-companion-validation';
import { Blobbi } from '@/types/blobbi';

// Helper function to create a mock Blobbi
function createMockBlobbi(lifeStage: 'egg' | 'baby' | 'adult', id: string = 'test-id'): Blobbi {
  return {
    id,
    ownerPubkey: 'test-pubkey',
    name: 'Test Blobbi',
    birthTime: Date.now(),
    lastInteraction: Math.floor(Date.now() / 1000),
    lifeStage,
    state: 'active',
    stats: {
      hunger: 50,
      happiness: 50,
      energy: 50,
      hygiene: 50,
      health: 50,
    },
    customization: {
      color: '#8B5CF6',
      accessories: [],
    },
    experience: 0,
    coins: 0,
    evolutionProgress: {
      totalCareDays: 0,
      currentStreak: 0,
      lastCareDate: 0,
      careSessions: [],
      isEligibleForEvolution: false,
      nextEvolutionCheck: Date.now() + 24 * 60 * 60 * 1000,
    },
    inventory: [],
    generation: 1,
    breedingReady: false,
    careStreak: 0,
  };
}

describe('Blobbi Companion Validation', () => {
  describe('canBlobbiBeCompanion', () => {
    it('should return false for null/undefined Blobbi', () => {
      expect(canBlobbiBeCompanion(null)).toBe(false);
      expect(canBlobbiBeCompanion(undefined)).toBe(false);
    });

    it('should return false for egg stage Blobbi', () => {
      const eggBlobbi = createMockBlobbi('egg');
      expect(canBlobbiBeCompanion(eggBlobbi)).toBe(false);
    });

    it('should return true for baby stage Blobbi', () => {
      const babyBlobbi = createMockBlobbi('baby');
      expect(canBlobbiBeCompanion(babyBlobbi)).toBe(true);
    });

    it('should return true for adult stage Blobbi', () => {
      const adultBlobbi = createMockBlobbi('adult');
      expect(canBlobbiBeCompanion(adultBlobbi)).toBe(true);
    });
  });

  describe('getCompanionValidationMessage', () => {
    it('should return appropriate message for null/undefined Blobbi', () => {
      expect(getCompanionValidationMessage(null)).toBe('Blobbi not found');
      expect(getCompanionValidationMessage(undefined)).toBe('Blobbi not found');
    });

    it('should return egg-specific message for egg stage Blobbi', () => {
      const eggBlobbi = createMockBlobbi('egg');
      const message = getCompanionValidationMessage(eggBlobbi);
      expect(message).toBe('Eggs cannot be selected as companions. Wait for your Blobbi to hatch first!');
    });

    it('should return success message for baby stage Blobbi', () => {
      const babyBlobbi = createMockBlobbi('baby');
      const message = getCompanionValidationMessage(babyBlobbi);
      expect(message).toBe('This Blobbi can be selected as a companion');
    });

    it('should return success message for adult stage Blobbi', () => {
      const adultBlobbi = createMockBlobbi('adult');
      const message = getCompanionValidationMessage(adultBlobbi);
      expect(message).toBe('This Blobbi can be selected as a companion');
    });
  });

  describe('filterValidCompanions', () => {
    it('should filter out egg stage Blobbis', () => {
      const blobbis = [
        createMockBlobbi('egg', 'egg-1'),
        createMockBlobbi('baby', 'baby-1'),
        createMockBlobbi('egg', 'egg-2'),
        createMockBlobbi('adult', 'adult-1'),
        createMockBlobbi('egg', 'egg-3'),
      ];

      const validCompanions = filterValidCompanions(blobbis);
      
      expect(validCompanions).toHaveLength(2);
      expect(validCompanions[0].id).toBe('baby-1');
      expect(validCompanions[1].id).toBe('adult-1');
      
      // Ensure no egg stage Blobbis are included
      validCompanions.forEach(blobbi => {
        expect(blobbi.lifeStage).not.toBe('egg');
      });
    });

    it('should return empty array when all Blobbis are eggs', () => {
      const blobbis = [
        createMockBlobbi('egg', 'egg-1'),
        createMockBlobbi('egg', 'egg-2'),
        createMockBlobbi('egg', 'egg-3'),
      ];

      const validCompanions = filterValidCompanions(blobbis);
      expect(validCompanions).toHaveLength(0);
    });

    it('should return all Blobbis when none are eggs', () => {
      const blobbis = [
        createMockBlobbi('baby', 'baby-1'),
        createMockBlobbi('adult', 'adult-1'),
        createMockBlobbi('baby', 'baby-2'),
      ];

      const validCompanions = filterValidCompanions(blobbis);
      expect(validCompanions).toHaveLength(3);
      expect(validCompanions).toEqual(blobbis);
    });

    it('should handle empty array', () => {
      const validCompanions = filterValidCompanions([]);
      expect(validCompanions).toHaveLength(0);
    });
  });
});