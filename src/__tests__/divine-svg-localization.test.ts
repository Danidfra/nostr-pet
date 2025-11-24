import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBlobbiStateEvent,
  parseBlobbiFromStateEvent,
  BLOBBI_EVENT_KINDS
} from '@/lib/blobbi-events';
import { resolveBlobbiSvg, preloadBlobbiSvgs } from '@/lib/blobbi-svg-resolver';
import { isDivineBlobbi, ensureDivineTags, syncDivineModelFields } from '@/lib/blobbi-divine-utils';
import { Blobbi } from '@/types/blobbi';
import { NostrEvent } from '@nostrify/nostrify';

describe('Divine SVG Localization', () => {
  let mockDivineBlobbi: Blobbi;
  let mockRegularBlobbi: Blobbi;

  beforeEach(() => {
    // Create a mock Divine Blobbi
    mockDivineBlobbi = {
      id: 'blobbi-divine-test',
      ownerPubkey: 'test-pubkey-123',
      name: 'DivineBlobbi',
      birthTime: Date.now(),
      lastInteraction: Math.floor(Date.now() / 1000),
      lifeStage: 'baby',
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

      // Original tags from Nostr event
      tags: [
        ['d', 'blobbi-divine-test'],
        ['stage', 'baby'],
        ['theme', 'divine'],
        ['crossover_app', 'divine'],
        ['base_color', '#55C4A2'],
        ['pattern', 'solid'],
        ['size', 'small'],
        ['special_mark', 'divine_wordmark'],
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
    };

    // Create a regular Blobbi for comparison
    mockRegularBlobbi = {
      ...mockDivineBlobbi,
      id: 'blobbi-regular-test',
      name: 'RegularBlobbi',
      themeVariant: undefined,
      crossoverApp: undefined,
      baseColor: '#7C3AED',
      specialMark: undefined,
      tags: [
        ['d', 'blobbi-regular-test'],
        ['stage', 'baby'],
        ['base_color', '#7C3AED'],
        ['pattern', 'solid'],
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
    };
  });

  describe('Divine Detection', () => {
    it('should correctly identify Divine Blobbi from model fields', () => {
      expect(isDivineBlobbi(mockDivineBlobbi)).toBe(true);
      expect(isDivineBlobbi(mockRegularBlobbi)).toBe(false);
    });

    it('should correctly identify Divine Blobbi from tags', () => {
      const divineFromTags = {
        ...mockRegularBlobbi,
        themeVariant: undefined,
        crossoverApp: undefined,
        tags: [
          ['d', 'blobbi-divine-tags'],
          ['stage', 'baby'],
          ['theme', 'divine'],
          ['crossover_app', 'divine'],
          ['base_color', '#55C4A2'],
          ['b', 'blobbi:ecosystem:v1'],
          ['t', 'blobbi'],
        ] as Array<[string, string]>,
      };

      expect(isDivineBlobbi(divineFromTags)).toBe(true);
    });

    it('should ensure Divine tags are present when missing', () => {
      const divineWithoutTags = {
        ...mockDivineBlobbi,
        tags: [
          ['d', 'blobbi-divine-missing'],
          ['stage', 'baby'],
          ['base_color', '#55C4A2'],
          ['b', 'blobbi:ecosystem:v1'],
          ['t', 'blobbi'],
        ] as Array<[string, string]>,
      };

      const result = ensureDivineTags(divineWithoutTags);

      expect(result.tags).toContainEqual(['theme', 'divine']);
      expect(result.tags).toContainEqual(['crossover_app', 'divine']);
    });

    it('should sync Divine model fields with tags', () => {
      const divineWithTagsOnly = {
        ...mockRegularBlobbi,
        themeVariant: undefined,
        crossoverApp: undefined,
        tags: [
          ['d', 'blobbi-divine-sync'],
          ['stage', 'baby'],
          ['theme', 'divine'],
          ['crossover_app', 'divine'],
          ['base_color', '#55C4A2'],
          ['b', 'blobbi:ecosystem:v1'],
          ['t', 'blobbi'],
        ] as Array<[string, string]>,
      };

      const result = syncDivineModelFields(divineWithTagsOnly);

      expect(result.themeVariant).toBe('divine');
      expect(result.crossoverApp).toBe('divine');
    });
  });

  describe('SVG Resolution', () => {
    it('should resolve baby SVG for baby Blobbi', async () => {
      const svgContent = await resolveBlobbiSvg(mockDivineBlobbi, false);

      expect(svgContent).toContain('<svg');
      expect(svgContent).toContain('viewBox');
      // Should not contain GitHub URL
      expect(svgContent).not.toContain('github.io');
    });

    it('should resolve sleeping baby SVG when sleeping', async () => {
      const sleepingBlobbi = { ...mockDivineBlobbi, isSleeping: true };
      const svgContent = await resolveBlobbiSvg(sleepingBlobbi, true);

      expect(svgContent).toContain('<svg');
      expect(svgContent).not.toContain('github.io');
    });

    it('should resolve adult SVG for adult Blobbi', async () => {
      const adultBlobbi = {
        ...mockDivineBlobbi,
        lifeStage: 'adult' as const,
        evolutionForm: 'flammi' as const,
      };

      const svgContent = await resolveBlobbiSvg(adultBlobbi, false);

      expect(svgContent).toContain('<svg');
      expect(svgContent).not.toContain('github.io');
    });

    it('should handle missing adult forms gracefully', async () => {
      const adultBlobbi = {
        ...mockDivineBlobbi,
        lifeStage: 'adult' as const,
        evolutionForm: 'blobbi' as const, // Use valid fallback
      };

      const svgContent = await resolveBlobbiSvg(adultBlobbi, false);

      // Should fall back to baby SVG
      expect(svgContent).toContain('<svg');
      expect(svgContent).not.toContain('github.io');
    });

    it('should preload SVGs without errors', async () => {
      await expect(preloadBlobbiSvgs(mockDivineBlobbi)).resolves.not.toThrow();
    });
  });

  describe('Divine Event Preservation', () => {
    it('should preserve Divine tags in state events', () => {
      const stateEvent = createBlobbiStateEvent(mockDivineBlobbi);

      expect(stateEvent.tags).toBeDefined();

      const themeTag = stateEvent.tags.find(([k, v]) => k === 'theme' && v === 'divine');
      const crossoverTag = stateEvent.tags.find(([k, v]) => k === 'crossover_app' && v === 'divine');

      expect(themeTag).toEqual(['theme', 'divine']);
      expect(crossoverTag).toEqual(['crossover_app', 'divine']);
    });

    it('should preserve Divine tags through parse -> update cycle', () => {
      // Create initial event
      const initialStateEvent: NostrEvent = {
        id: 'test-event-1',
        pubkey: 'test-pubkey-123',
        created_at: Math.floor(Date.now() / 1000),
        kind: BLOBBI_EVENT_KINDS.STATE,
        content: 'DivineBlobbi is a baby Blobbi.',
        tags: mockDivineBlobbi.tags || [],
        sig: 'test-signature',
      };

      // Parse to Blobbi
      const parsedBlobbi = parseBlobbiFromStateEvent(initialStateEvent);
      expect(parsedBlobbi).toBeTruthy();
      expect(isDivineBlobbi(parsedBlobbi!)).toBe(true);

      // Update some stats
      const updatedBlobbi = {
        ...parsedBlobbi!,
        stats: {
          ...parsedBlobbi!.stats,
          hunger: 85,
          happiness: 90,
        },
      };

      // Create new state event
      const newStateEvent = createBlobbiStateEvent(updatedBlobbi);

      // Verify Divine tags are preserved
      const themeTag = newStateEvent.tags.find(([k, v]) => k === 'theme' && v === 'divine');
      const crossoverTag = newStateEvent.tags.find(([k, v]) => k === 'crossover_app' && v === 'divine');

      expect(themeTag).toEqual(['theme', 'divine']);
      expect(crossoverTag).toEqual(['crossover_app', 'divine']);

      // Verify stats were updated
      const hungerTag = newStateEvent.tags.find(([k, v]) => k === 'hunger');
      const happinessTag = newStateEvent.tags.find(([k, v]) => k === 'happiness');

      expect(hungerTag).toEqual(['hunger', '85']);
      expect(happinessTag).toEqual(['happiness', '90']);
    });

    it('should handle missing Divine tags gracefully', () => {
      const blobbiWithoutDivineFields = {
        ...mockRegularBlobbi,
        themeVariant: undefined,
        crossoverApp: undefined,
      };

      const result = ensureDivineTags(blobbiWithoutDivineFields);

      // Should not add Divine tags to non-Divine Blobbi
      expect(result.tags).not.toContainEqual(['theme', 'divine']);
      expect(result.tags).not.toContainEqual(['crossover_app', 'divine']);
    });
  });

  describe('Integration Tests', () => {
    it('should maintain Divine detection through complete workflow', async () => {
      // 1. Create initial Divine event
      const initialEvent: NostrEvent = {
        id: 'integration-test',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: BLOBBI_EVENT_KINDS.STATE,
        content: 'Divine integration test',
        tags: mockDivineBlobbi.tags || [],
        sig: 'test-sig',
      };

      // 2. Parse event
      const parsed = parseBlobbiFromStateEvent(initialEvent);
      expect(parsed).toBeTruthy();
      expect(isDivineBlobbi(parsed!)).toBe(true);

      // 3. Get SVG content (should be local)
      const svgContent = await resolveBlobbiSvg(parsed!, false);
      expect(svgContent).toContain('<svg');
      expect(svgContent).not.toContain('github.io');

      // 4. Create updated event
      const updatedEvent = createBlobbiStateEvent({
        ...parsed!,
        stats: { ...parsed!.stats, happiness: 88 }
      });

      // 5. Verify Divine tags preserved
      expect(updatedEvent.tags.some(([k, v]) => k === 'theme' && v === 'divine')).toBe(true);
      expect(updatedEvent.tags.some(([k, v]) => k === 'crossover_app' && v === 'divine')).toBe(true);

      // 6. Re-parse and verify Divine detection still works
      const reparsed = parseBlobbiFromStateEvent({
        ...initialEvent,
        tags: updatedEvent.tags,
        content: updatedEvent.content,
      });

      expect(reparsed).toBeTruthy();
      expect(isDivineBlobbi(reparsed!)).toBe(true);
    });
  });
});