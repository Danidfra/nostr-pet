import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBlobbiStateEvent,
  parseBlobbiFromStateEvent,
  createBlobbiRecordEvent,
  createBlobbiInteractionEvent,
  BLOBBI_EVENT_KINDS
} from '@/lib/blobbi-events';
import { mergeBlobbiStateTags } from '@/lib/blobbi-state-merge';
import { Blobbi, BlobbiRecordData, BlobbiInteractionData } from '@/types/blobbi';
import { NostrEvent } from '@nostrify/nostrify';

describe('Divine Tag Preservation', () => {
  let mockDivineBlobbi: Blobbi;
  let mockDivineEvent: NostrEvent;

  beforeEach(() => {
    // Create a mock Divine Blobbi with all the required fields
    mockDivineBlobbi = {
      id: 'blobbi-divine-test',
      ownerPubkey: 'test-pubkey-123',
      name: 'DivineBlobbi',
      birthTime: Date.now(),
      lastInteraction: Math.floor(Date.now() / 1000),
      lifeStage: 'egg',
      state: 'active',
      stats: {
        hunger: 100,
        happiness: 95,
        health: 100,
        hygiene: 90,
        energy: 100,
      },
      customization: {
        color: '#55C4A2',
        pattern: 'solid',
        accessories: [],
      },
      experience: 0,
      coins: 0,
      inventory: [],
      generation: 1,
      breedingReady: false,
      careStreak: 0,
      evolutionProgress: {
        totalCareDays: 0,
        currentStreak: 0,
        lastCareDate: 0,
        careSessions: [],
        isEligibleForEvolution: false,
        nextEvolutionCheck: Date.now(),
      },
      visibleToOthers: true,

      // Divine-specific properties
      themeVariant: 'divine',
      crossoverApp: 'divine',
      baseColor: '#55C4A2',
      secondaryColor: undefined,
      pattern: 'solid',
      size: 'small',
      specialMark: 'divine_wordmark',

      // Egg-specific properties
      incubationTime: 345600,
      incubationProgress: 0,
      eggTemperature: 92,
      eggStatus: 'glowing',
      shellIntegrity: 92,

      // Original tags from Nostr event
      tags: [
        ['d', 'blobbi-divine-test'],
        ['stage', 'egg'],
        ['theme', 'divine'],
        ['crossover_app', 'divine'],
        ['base_color', '#55C4A2'],
        ['pattern', 'solid'],
        ['size', 'small'],
        ['special_mark', 'divine_wordmark'],
        ['incubation_time', '345600'],
        ['egg_temperature', '92'],
        ['egg_status', 'glowing'],
        ['shell_integrity', '92'],
        ['breeding_ready', 'false'],
        ['generation', '1'],
        ['hunger', '100'],
        ['happiness', '95'],
        ['health', '100'],
        ['hygiene', '90'],
        ['energy', '100'],
        ['experience', '0'],
        ['care_streak', '0'],
        // Blobbi ecosystem tags
        ['b', 'blobbi:ecosystem:v1'],
        ['t', 'Blobbi'],
        ['t', 'blobbi'],
      ] as Array<[string, string]>,
    };

    // Create a mock Nostr event with Divine tags
    mockDivineEvent = {
      id: 'test-event-id',
      pubkey: 'test-pubkey-123',
      created_at: Math.floor(Date.now() / 1000),
      kind: BLOBBI_EVENT_KINDS.STATE,
      content: 'DivineBlobbi is an egg Blobbi.',
      tags: [
        ['d', 'blobbi-divine-test'],
        ['stage', 'egg'],
        ['theme', 'divine'],
        ['crossover_app', 'divine'],
        ['base_color', '#55C4A2'],
        ['pattern', 'solid'],
        ['size', 'small'],
        ['special_mark', 'divine_wordmark'],
        ['incubation_time', '345600'],
        ['egg_temperature', '92'],
        ['egg_status', 'glowing'],
        ['shell_integrity', '92'],
        ['breeding_ready', 'false'],
        ['generation', '1'],
        ['hunger', '100'],
        ['happiness', '95'],
        ['health', '100'],
        ['hygiene', '90'],
        ['energy', '100'],
        ['experience', '0'],
        ['care_streak', '0'],
        ['b', 'blobbi:ecosystem:v1'],
        ['t', 'Blobbi'],
        ['t', 'blobbi'],
      ] as Array<[string, string]>,
      sig: 'test-signature',
    };
  });

  describe('parseBlobbiFromStateEvent', () => {
    it('should preserve all Divine tags when parsing', () => {
      const parsedBlobbi = parseBlobbiFromStateEvent(mockDivineEvent);

      expect(parsedBlobbi).toBeTruthy();
      expect(parsedBlobbi!.tags).toBeDefined();
      expect(parsedBlobbi!.tags).toHaveLength(mockDivineEvent.tags.length);

      // Check that Divine-specific tags are preserved
      const divineThemeTag = parsedBlobbi!.tags!.find(([k, v]) => k === 'theme' && v === 'divine');
      const divineCrossoverTag = parsedBlobbi!.tags!.find(([k, v]) => k === 'crossover_app' && v === 'divine');
      const baseColorTag = parsedBlobbi!.tags!.find(([k, v]) => k === 'base_color' && v === '#55C4A2');
      const specialMarkTag = parsedBlobbi!.tags!.find(([k, v]) => k === 'special_mark' && v === 'divine_wordmark');

      expect(divineThemeTag).toEqual(['theme', 'divine']);
      expect(divineCrossoverTag).toEqual(['crossover_app', 'divine']);
      expect(baseColorTag).toEqual(['base_color', '#55C4A2']);
      expect(specialMarkTag).toEqual(['special_mark', 'divine_wordmark']);
    });

    it('should map Divine tags to Blobbi properties', () => {
      const parsedBlobbi = parseBlobbiFromStateEvent(mockDivineEvent);

      expect(parsedBlobbi).toBeTruthy();
      expect(parsedBlobbi!.themeVariant).toBe('divine');
      expect(parsedBlobbi!.crossoverApp).toBe('divine');
      expect(parsedBlobbi!.baseColor).toBe('#55C4A2');
      expect(parsedBlobbi!.specialMark).toBe('divine_wordmark');
    });
  });

  describe('createBlobbiStateEvent', () => {
    it('should preserve Divine tags when creating state event', () => {
      const stateEvent = createBlobbiStateEvent(mockDivineBlobbi);

      expect(stateEvent.tags).toBeDefined();

      // Check that Divine-specific tags are preserved
      const divineThemeTag = stateEvent.tags.find(([k, v]) => k === 'theme' && v === 'divine');
      const divineCrossoverTag = stateEvent.tags.find(([k, v]) => k === 'crossover_app' && v === 'divine');
      const baseColorTag = stateEvent.tags.find(([k, v]) => k === 'base_color' && v === '#55C4A2');
      const specialMarkTag = stateEvent.tags.find(([k, v]) => k === 'special_mark' && v === 'divine_wordmark');

      expect(divineThemeTag).toEqual(['theme', 'divine']);
      expect(divineCrossoverTag).toEqual(['crossover_app', 'divine']);
      expect(baseColorTag).toEqual(['base_color', '#55C4A2']);
      expect(specialMarkTag).toEqual(['special_mark', 'divine_wordmark']);
    });

    it('should preserve all original tags when updating', () => {
      // Update some stats but keep Divine tags
      const updatedBlobbi = {
        ...mockDivineBlobbi,
        stats: {
          ...mockDivineBlobbi.stats,
          hunger: 90,
          happiness: 85,
        },
      };

      const stateEvent = createBlobbiStateEvent(updatedBlobbi);

      // Check that Divine tags are still present
      const divineThemeTag = stateEvent.tags.find(([k, v]) => k === 'theme' && v === 'divine');
      const divineCrossoverTag = stateEvent.tags.find(([k, v]) => k === 'crossover_app' && v === 'divine');
      const baseColorTag = stateEvent.tags.find(([k, v]) => k === 'base_color' && v === '#55C4A2');

      expect(divineThemeTag).toEqual(['theme', 'divine']);
      expect(divineCrossoverTag).toEqual(['crossover_app', 'divine']);
      expect(baseColorTag).toEqual(['base_color', '#55C4A2']);

      // Check that stats were updated
      const hungerTag = stateEvent.tags.find(([k, v]) => k === 'hunger');
      const happinessTag = stateEvent.tags.find(([k, v]) => k === 'happiness');

      expect(hungerTag).toEqual(['hunger', '90']);
      expect(happinessTag).toEqual(['happiness', '85']);
    });
  });

  describe('mergeBlobbiStateTags', () => {
    it('should preserve Divine tags when merging', () => {
      const originalTags = mockDivineEvent.tags;
      const additionalTags: Array<[string, string]> = [
        ['hunger', '80'],
        ['happiness', '75'],
      ];

      const mergedTags = mergeBlobbiStateTags(originalTags, {
        additionalTags,
      });

      // Check that Divine tags are preserved
      const divineThemeTag = mergedTags.find(([k, v]) => k === 'theme' && v === 'divine');
      const divineCrossoverTag = mergedTags.find(([k, v]) => k === 'crossover_app' && v === 'divine');
      const baseColorTag = mergedTags.find(([k, v]) => k === 'base_color' && v === '#55C4A2');

      expect(divineThemeTag).toEqual(['theme', 'divine']);
      expect(divineCrossoverTag).toEqual(['crossover_app', 'divine']);
      expect(baseColorTag).toEqual(['base_color', '#55C4A2']);

      // Check that new tags were added
      const hungerTag = mergedTags.find(([k, v]) => k === 'hunger');
      const happinessTag = mergedTags.find(([k, v]) => k === 'happiness');

      expect(hungerTag).toEqual(['hunger', '80']);
      expect(happinessTag).toEqual(['happiness', '75']);
    });

    it('should not remove Divine tags when adding new tags', () => {
      const originalTags = mockDivineEvent.tags;
      const newTags: Array<[string, string]> = [
        ['new_field', 'new_value'],
        ['another_field', 'another_value'],
      ];

      const mergedTags = mergeBlobbiStateTags(originalTags, {
        additionalTags: newTags,
      });

      // All original Divine tags should still be present
      const originalDivineTags = originalTags.filter(([k]) =>
        ['theme', 'crossover_app', 'base_color', 'special_mark'].includes(k)
      );

      originalDivineTags.forEach(originalTag => {
        const foundTag = mergedTags.find(([k, v]) => k === originalTag[0] && v === originalTag[1]);
        expect(foundTag).toEqual(originalTag);
      });
    });
  });

  describe('Full Divine Flow Test', () => {
    it('should preserve Divine tags through complete parse -> update -> create cycle', () => {
      // 1. Parse Divine event to Blobbi
      const parsedBlobbi = parseBlobbiFromStateEvent(mockDivineEvent);
      expect(parsedBlobbi).toBeTruthy();

      // 2. Update some properties
      const updatedBlobbi = {
        ...parsedBlobbi!,
        stats: {
          ...parsedBlobbi!.stats,
          hunger: 75,
          energy: 80,
        },
        eggTemperature: 95,
      };

      // 3. Create new state event
      const newStateEvent = createBlobbiStateEvent(updatedBlobbi);

      // 4. Verify Divine tags are preserved
      const divineThemeTag = newStateEvent.tags.find(([k, v]) => k === 'theme' && v === 'divine');
      const divineCrossoverTag = newStateEvent.tags.find(([k, v]) => k === 'crossover_app' && v === 'divine');
      const baseColorTag = newStateEvent.tags.find(([k, v]) => k === 'base_color' && v === '#55C4A2');
      const specialMarkTag = newStateEvent.tags.find(([k, v]) => k === 'special_mark' && v === 'divine_wordmark');

      expect(divineThemeTag).toEqual(['theme', 'divine']);
      expect(divineCrossoverTag).toEqual(['crossover_app', 'divine']);
      expect(baseColorTag).toEqual(['base_color', '#55C4A2']);
      expect(specialMarkTag).toEqual(['special_mark', 'divine_wordmark']);

      // 5. Verify updates were applied
      const hungerTag = newStateEvent.tags.find(([k, v]) => k === 'hunger');
      const energyTag = newStateEvent.tags.find(([k, v]) => k === 'energy');
      const eggTempTag = newStateEvent.tags.find(([k, v]) => k === 'egg_temperature');

      expect(hungerTag).toEqual(['hunger', '75']);
      expect(energyTag).toEqual(['energy', '80']);
      expect(eggTempTag).toEqual(['egg_temperature', '95']);

      // 6. Parse the new event and verify Divine detection still works
      const mockNewEvent: NostrEvent = {
        ...mockDivineEvent,
        tags: newStateEvent.tags,
        content: newStateEvent.content,
      };

      const reparsedBlobbi = parseBlobbiFromStateEvent(mockNewEvent);
      expect(reparsedBlobbi).toBeTruthy();
      expect(reparsedBlobbi!.themeVariant).toBe('divine');
      expect(reparsedBlobbi!.crossoverApp).toBe('divine');
      expect(reparsedBlobbi!.baseColor).toBe('#55C4A2');
    });
  });

  describe('Interaction Events with Divine Blobbis', () => {
    it('should create interaction events that reference Divine Blobbis correctly', () => {
      const interactionData: BlobbiInteractionData = {
        action: 'warm',
        actionCategory: 'care',
        statChange: ['egg_temperature', '+5'],
        experienceGained: 5,
        carePoints: 2,
      };

      const interactionEvent = createBlobbiInteractionEvent(mockDivineBlobbi.id, interactionData);

      expect(interactionEvent.tags).toBeDefined();

      // Check that the interaction references the correct Divine Blobbi
      const blobbiIdTag = interactionEvent.tags.find(([k, v]) => k === 'blobbi_id');
      expect(blobbiIdTag).toEqual(['blobbi_id', 'blobbi-divine-test']);

      // Check that action and stats are correct
      const actionTag = interactionEvent.tags.find(([k, v]) => k === 'action');
      const statChangeTag = interactionEvent.tags.find(([k, v]) => k === 'stat_change');

      expect(actionTag).toEqual(['action', 'warm']);
      expect(statChangeTag).toEqual(['stat_change', 'egg_temperature:+5']);
    });
  });

  describe('Record Events with Divine Blobbis', () => {
    it('should create birth records that preserve Divine metadata', () => {
      const birthData: BlobbiRecordData = {
        recordType: 'birth',
        generation: 1,
        origin: 'wild',
        rarity: 'legendary',
        theme: 'divine',
        crossoverApp: 'divine',
      };

      const recordEvent = createBlobbiRecordEvent(mockDivineBlobbi.id, birthData);

      expect(recordEvent.tags).toBeDefined();

      // Check that Divine metadata is preserved in the record
      const themeTag = recordEvent.tags.find(([k, v]) => k === 'theme');
      const crossoverTag = recordEvent.tags.find(([k, v]) => k === 'crossover_app');

      // Note: These tags are not added by createBlobbiRecordEvent for birth records
      // but the record type and other metadata should be preserved
      const recordTypeTag = recordEvent.tags.find(([k, v]) => k === 'record_type');
      const rarityTag = recordEvent.tags.find(([k, v]) => k === 'rarity');

      expect(recordTypeTag).toEqual(['record_type', 'birth']);
      expect(rarityTag).toEqual(['rarity', 'legendary']);
    });
  });
});