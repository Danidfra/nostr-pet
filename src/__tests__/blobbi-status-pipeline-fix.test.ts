import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseBlobbiFromStateEvent, createBlobbiStateEvent } from '@/lib/blobbi-events';
import { mergeBlobbiStateTags } from '@/lib/blobbi-state-merge';
import { applyStatChangesToBlobbi } from '@/contexts/BlobbiFakeStatusContext';
import { Blobbi } from '@/types/blobbi';

describe('Blobbi Status Pipeline Fixes', () => {
  beforeEach(() => {
    // Mock console methods to capture logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseBlobbiFromStateEvent - Stat Parsing Fix', () => {
    it('should reject events with missing required stat tags instead of using defaults', () => {
      const invalidEvent = {
        kind: 31124,
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        content: 'Test Blobbi',
        tags: [
          ['d', 'blobbi-test'],
          ['stage', 'baby'],
          ['breeding_ready', 'false'],
          ['generation', '1'],
          // Missing hunger, happiness, health, hygiene, energy tags
          ['experience', '0'],
          ['care_streak', '0'],
        ],
        id: 'test-id',
        sig: 'test-sig'
      };

      const result = parseBlobbiFromStateEvent(invalidEvent);
      expect(result).toBeNull(); // Should reject invalid events
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing required stat tags')
      );
    });

    it('should correctly parse valid stat tags without fallbacks', () => {
      const validEvent = {
        kind: 31124,
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        content: 'Test Blobbi',
        tags: [
          ['d', 'blobbi-test'],
          ['stage', 'baby'],
          ['breeding_ready', 'false'],
          ['generation', '1'],
          ['hunger', '85'],
          ['happiness', '90'],
          ['health', '95'],
          ['hygiene', '75'],
          ['energy', '80'],
          ['experience', '50'],
          ['care_streak', '3'],
        ],
        id: 'test-id',
        sig: 'test-sig'
      };

      const result = parseBlobbiFromStateEvent(validEvent);
      expect(result).toBeTruthy();
      expect(result!.stats).toEqual({
        hunger: 85,
        happiness: 90,
        health: 95,
        hygiene: 75,
        energy: 80,
      });
    });

    it('should clamp out-of-range stat values', () => {
      const eventWithInvalidStats = {
        kind: 31124,
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        content: 'Test Blobbi',
        tags: [
          ['d', 'blobbi-test'],
          ['stage', 'baby'],
          ['breeding_ready', 'false'],
          ['generation', '1'],
          ['hunger', '150'], // Over 100
          ['happiness', '-10'], // Below 0
          ['health', '105'], // Over 100
          ['hygiene', '75'],
          ['energy', '80'],
          ['experience', '50'],
          ['care_streak', '3'],
        ],
        id: 'test-id',
        sig: 'test-sig'
      };

      const result = parseBlobbiFromStateEvent(eventWithInvalidStats);
      expect(result).toBeTruthy();
      expect(result!.stats).toEqual({
        hunger: 100, // Clamped to 100
        happiness: 0, // Clamped to 0
        health: 100, // Clamped to 100
        hygiene: 75,
        energy: 80,
      });
    });
  });

  describe('createBlobbiStateEvent - Stat Validation', () => {
    it('should validate and correct invalid stats during event creation', () => {
      const blobbiWithInvalidStats: Blobbi = {
        id: 'blobbi-test',
        ownerPubkey: 'test-pubkey',
        name: 'Test',
        birthTime: Date.now(),
        lastInteraction: Math.floor(Date.now() / 1000),
        lifeStage: 'baby',
        state: 'active',
        stats: {
          hunger: 150, // Invalid: over 100
          happiness: -5, // Invalid: below 0
          health: 95,
          hygiene: 75,
          energy: 80,
        },
        customization: { color: '#7C3AED', pattern: 'solid', accessories: [] },
        experience: 50,
        coins: 0,
        inventory: [],
        generation: 1,
        breedingReady: false,
        careStreak: 3,
        evolutionProgress: {
          totalCareDays: 0,
          currentStreak: 0,
          lastCareDate: 0,
          careSessions: [],
          isEligibleForEvolution: false,
          nextEvolutionCheck: Date.now(),
        },
        visibleToOthers: true,
      };

      const result = createBlobbiStateEvent(blobbiWithInvalidStats);
      
      // Find stat tags in the result
      const hungerTag = result.tags.find(tag => tag[0] === 'hunger');
      const happinessTag = result.tags.find(tag => tag[0] === 'happiness');
      
      expect(hungerTag?.[1]).toBe('100'); // Corrected to 100
      expect(happinessTag?.[1]).toBe('0'); // Corrected to 0
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Corrected invalid hunger')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Corrected invalid happiness')
      );
    });

    it('should include last_interaction tag in core updates', () => {
      const blobbi: Blobbi = {
        id: 'blobbi-test',
        ownerPubkey: 'test-pubkey',
        name: 'Test',
        birthTime: Date.now(),
        lastInteraction: 1640995200, // Specific timestamp
        lifeStage: 'baby',
        state: 'active',
        stats: {
          hunger: 85,
          happiness: 90,
          health: 95,
          hygiene: 75,
          energy: 80,
        },
        customization: { color: '#7C3AED', pattern: 'solid', accessories: [] },
        experience: 50,
        coins: 0,
        inventory: [],
        generation: 1,
        breedingReady: false,
        careStreak: 3,
        evolutionProgress: {
          totalCareDays: 0,
          currentStreak: 0,
          lastCareDate: 0,
          careSessions: [],
          isEligibleForEvolution: false,
          nextEvolutionCheck: Date.now(),
        },
        visibleToOthers: true,
      };

      const result = createBlobbiStateEvent(blobbi);
      
      const lastInteractionTag = result.tags.find(tag => tag[0] === 'last_interaction');
      expect(lastInteractionTag?.[1]).toBe('1640995200');
    });
  });

  describe('mergeBlobbiStateTags - Core Stat Protection', () => {
    it('should never preserve core stat tags from original event', () => {
      const originalTags = [
        ['d', 'blobbi-test'],
        ['stage', 'baby'],
        ['hunger', '50'], // Old stat value
        ['happiness', '60'], // Old stat value
        ['health', '70'], // Old stat value
        ['hygiene', '40'], // Old stat value
        ['energy', '30'], // Old stat value
        ['start_incubation', '1640995200'], // Should be preserved
        ['quest_progress', '5'], // Should be preserved
      ];

      const additionalTags: Array<[string, string]> = [
        ['hunger', '85'], // New stat value
        ['happiness', '90'], // New stat value
        ['health', '95'], // New stat value
        ['hygiene', '75'], // New stat value
        ['energy', '80'], // New stat value
        ['experience', '100'],
        ['care_streak', '5'],
      ];

      const result = mergeBlobbiStateTags(originalTags, {
        additionalTags,
        preserveIncubationAndQuestTags: true,
      });

      // Check that new stat values are used, not old ones
      const hungerTag = result.find(tag => tag[0] === 'hunger');
      const happinessTag = result.find(tag => tag[0] === 'happiness');
      const healthTag = result.find(tag => tag[0] === 'health');
      const hygieneTag = result.find(tag => tag[0] === 'hygiene');
      const energyTag = result.find(tag => tag[0] === 'energy');

      expect(hungerTag?.[1]).toBe('85'); // New value, not 50
      expect(happinessTag?.[1]).toBe('90'); // New value, not 60
      expect(healthTag?.[1]).toBe('95'); // New value, not 70
      expect(hygieneTag?.[1]).toBe('75'); // New value, not 40
      expect(energyTag?.[1]).toBe('80'); // New value, not 30

      // Check that non-stat tags are preserved
      const incubationTag = result.find(tag => tag[0] === 'start_incubation');
      const questTag = result.find(tag => tag[0] === 'quest_progress');
      expect(incubationTag?.[1]).toBe('1640995200');
      expect(questTag?.[1]).toBe('5');

      // Verify console logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipping preserved stat tag')
      );
    });
  });

  describe('applyStatChangesToBlobbi - Fake Status Logic', () => {
    it('should correctly apply stat changes without corruption', () => {
      const blobbi: Blobbi = {
        id: 'blobbi-test',
        ownerPubkey: 'test-pubkey',
        name: 'Test',
        birthTime: Date.now(),
        lastInteraction: Math.floor(Date.now() / 1000),
        lifeStage: 'baby',
        state: 'active',
        stats: {
          hunger: 70,
          happiness: 80,
          health: 90,
          hygiene: 60,
          energy: 50,
        },
        customization: { color: '#7C3AED', pattern: 'solid', accessories: [] },
        experience: 50,
        coins: 0,
        inventory: [],
        generation: 1,
        breedingReady: false,
        careStreak: 3,
        evolutionProgress: {
          totalCareDays: 0,
          currentStreak: 0,
          lastCareDate: 0,
          careSessions: [],
          isEligibleForEvolution: false,
          nextEvolutionCheck: Date.now(),
        },
        visibleToOthers: true,
      };

      const statChanges: Array<[string, number]> = [
        ['hunger', 25], // Feed action
        ['happiness', 10], // Bonus happiness
      ];

      const result = applyStatChangesToBlobbi(blobbi, statChanges);

      expect(result.stats.hunger).toBe(95); // 70 + 25
      expect(result.stats.happiness).toBe(90); // 80 + 10
      expect(result.stats.health).toBe(90); // Unchanged
      expect(result.stats.hygiene).toBe(60); // Unchanged
      expect(result.stats.energy).toBe(50); // Unchanged
    });

    it('should clamp stat changes to valid ranges', () => {
      const blobbi: Blobbi = {
        id: 'blobbi-test',
        ownerPubkey: 'test-pubkey',
        name: 'Test',
        birthTime: Date.now(),
        lastInteraction: Math.floor(Date.now() / 1000),
        lifeStage: 'baby',
        state: 'active',
        stats: {
          hunger: 90,
          happiness: 10,
          health: 95,
          hygiene: 95,
          energy: 95,
        },
        customization: { color: '#7C3AED', pattern: 'solid', accessories: [] },
        experience: 50,
        coins: 0,
        inventory: [],
        generation: 1,
        breedingReady: false,
        careStreak: 3,
        evolutionProgress: {
          totalCareDays: 0,
          currentStreak: 0,
          lastCareDate: 0,
          careSessions: [],
          isEligibleForEvolution: false,
          nextEvolutionCheck: Date.now(),
        },
        visibleToOthers: true,
      };

      const statChanges: Array<[string, number]> = [
        ['hunger', 20], // Would exceed 100
        ['happiness', -20], // Would go below 0
      ];

      const result = applyStatChangesToBlobbi(blobbi, statChanges);

      expect(result.stats.hunger).toBe(100); // Clamped to 100
      expect(result.stats.happiness).toBe(0); // Clamped to 0
    });
  });

  describe('Stat Validation Function', () => {
    it('should detect and log stat corruption issues', () => {
      const corruptedBlobbi: Blobbi = {
        id: 'blobbi-test',
        ownerPubkey: 'test-pubkey',
        name: 'Test',
        birthTime: Date.now(),
        lastInteraction: Math.floor(Date.now() / 1000),
        lifeStage: 'baby',
        state: 'active',
        stats: {
          hunger: NaN, // Corrupted
          happiness: 200, // Out of range
          health: -50, // Out of range
          hygiene: 75,
          energy: 80,
        },
        customization: { color: '#7C3AED', pattern: 'solid', accessories: [] },
        experience: 50,
        coins: 0,
        inventory: [],
        generation: 1,
        breedingReady: false,
        careStreak: 3,
        evolutionProgress: {
          totalCareDays: 0,
          currentStreak: 0,
          lastCareDate: 0,
          careSessions: [],
          isEligibleForEvolution: false,
          nextEvolutionCheck: Date.now(),
        },
        visibleToOthers: true,
      };

      // This should trigger validation errors when creating state event
      createBlobbiStateEvent(corruptedBlobbi);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Issues detected')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('hunger is not a number'),
        expect.any(Array)
      );
    });

    it('should detect suspicious stat patterns', () => {
      const suspiciousBlobbi: Blobbi = {
        id: 'blobbi-test',
        ownerPubkey: 'test-pubkey',
        name: 'Test',
        birthTime: Date.now(),
        lastInteraction: Math.floor(Date.now() / 1000),
        lifeStage: 'baby',
        state: 'active',
        stats: {
          hunger: 0,
          happiness: 0,
          health: 0,
          hygiene: 0,
          energy: 0,
        },
        customization: { color: '#7C3AED', pattern: 'solid', accessories: [] },
        experience: 50,
        coins: 0,
        inventory: [],
        generation: 1,
        breedingReady: false,
        careStreak: 3,
        evolutionProgress: {
          totalCareDays: 0,
          currentStreak: 0,
          lastCareDate: 0,
          careSessions: [],
          isEligibleForEvolution: false,
          nextEvolutionCheck: Date.now(),
        },
        visibleToOthers: true,
      };

      createBlobbiStateEvent(suspiciousBlobbi);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('All stats are zero'),
        expect.any(Array)
      );
    });
  });
});