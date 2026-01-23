/**
 * Tests for the Canonical Blobbi Pipeline
 * 
 * Verifies the core requirements:
 * 1. Patch updates don't delete untouched fields
 * 2. Duplicate tags never appear after normalization
 * 3. Egg-only tags removed after hatching
 * 4. Timestamps never end up in milliseconds inside seconds fields
 * 5. Multi-value tags dedupe properly
 */

import { describe, it, expect } from 'vitest';
import {
  mergeBlobbiState,
  filterBlobbiForStage,
  validateStats,
  normalizeTimestamps,
  clampStat,
  type MergeContext,
} from '@/lib/blobbi-canonical-pipeline';
import { Blobbi, BlobbiStats } from '@/types/blobbi';
import { createBlobbiStateEvent } from '@/lib/blobbi-events';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestBlobbi(overrides: Partial<Blobbi> = {}): Blobbi {
  return {
    id: 'blobbi-test',
    ownerPubkey: 'test-pubkey',
    name: 'Test',
    birthTime: 1700000000000, // Milliseconds
    lastInteraction: 1700000000, // Seconds
    lifeStage: 'baby',
    state: 'active',
    stats: {
      hunger: 80,
      happiness: 80,
      health: 80,
      hygiene: 80,
      energy: 80,
    },
    customization: {
      color: '#7C3AED',
      accessories: [],
    },
    experience: 100,
    coins: 0,
    inventory: [],
    generation: 1,
    breedingReady: false,
    careStreak: 5,
    evolutionProgress: {
      totalCareDays: 0,
      currentStreak: 0,
      lastCareDate: 0,
      careSessions: [],
      isEligibleForEvolution: false,
      nextEvolutionCheck: Date.now(),
    },
    ...overrides,
  };
}

// ============================================================================
// STAT VALIDATION TESTS
// ============================================================================

describe('Stat Validation', () => {
  it('clamps stat to [0, 100] range', () => {
    expect(clampStat(-10)).toBe(0);
    expect(clampStat(0)).toBe(0);
    expect(clampStat(50)).toBe(50);
    expect(clampStat(100)).toBe(100);
    expect(clampStat(110)).toBe(100);
    expect(clampStat(50.7)).toBe(51); // Rounds
  });

  it('validates all stats in BlobbiStats object', () => {
    const stats = validateStats({
      hunger: -5,
      happiness: 110,
      health: 50.9,
      hygiene: undefined, // Missing
      energy: 30,
    });

    expect(stats).toEqual({
      hunger: 0,       // Clamped from -5
      happiness: 100,  // Clamped from 110
      health: 51,      // Rounded from 50.9
      hygiene: 80,     // Default (missing)
      energy: 30,      // Unchanged
    });
  });
});

// ============================================================================
// TIMESTAMP NORMALIZATION TESTS
// ============================================================================

describe('Timestamp Normalization', () => {
  it('converts milliseconds to seconds for action timestamps', () => {
    const blobbi = createTestBlobbi({
      lastMeal: 1700000000000, // Milliseconds
      lastClean: 1700003600000, // Milliseconds
      lastInteraction: 1700007200000, // Milliseconds
    });

    const normalized = normalizeTimestamps(blobbi) as Blobbi;

    expect(normalized.lastMeal).toBe(1700000000); // Seconds
    expect(normalized.lastClean).toBe(1700003600); // Seconds
    expect(normalized.lastInteraction).toBe(1700007200); // Seconds
  });

  it('preserves birthTime in milliseconds', () => {
    const blobbi = createTestBlobbi({
      birthTime: 1700000000000, // Milliseconds (UI format)
    });

    const normalized = normalizeTimestamps(blobbi) as Blobbi;

    expect(normalized.birthTime).toBe(1700000000000); // Stays in milliseconds
  });

  it('handles already-normalized seconds timestamps', () => {
    const blobbi = createTestBlobbi({
      lastMeal: 1700000000, // Already in seconds
      sleepStartedAt: 1700003600, // Already in seconds
    });

    const normalized = normalizeTimestamps(blobbi) as Blobbi;

    expect(normalized.lastMeal).toBe(1700000000); // Unchanged
    expect(normalized.sleepStartedAt).toBe(1700003600); // Unchanged
  });
});

// ============================================================================
// MERGE TESTS - REQUIREMENT 1: PRESERVE UNTOUCHED FIELDS
// ============================================================================

describe('Merge: Preserve Untouched Fields', () => {
  it('only updates fields provided in patch', () => {
    const base = createTestBlobbi({
      stats: {
        hunger: 50,
        happiness: 80,
        health: 90,
        hygiene: 70,
        energy: 60,
      },
      personality: ['brave', 'shy'],
      lastMeal: 1700000000,
      careStreak: 10,
    });

    const patch = {
      stats: { hunger: 75 }, // Only update hunger
      lastMeal: 1700003600,
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    // Updated fields
    expect(merged.stats.hunger).toBe(75);
    expect(merged.lastMeal).toBe(1700003600);

    // Untouched fields PRESERVED
    expect(merged.stats.happiness).toBe(80);
    expect(merged.stats.health).toBe(90);
    expect(merged.stats.hygiene).toBe(70);
    expect(merged.stats.energy).toBe(60);
    expect(merged.personality).toEqual(['brave', 'shy']);
    expect(merged.careStreak).toBe(10);
  });

  it('preserves all fields when patch is empty', () => {
    const base = createTestBlobbi();
    const patch = {};

    const merged = mergeBlobbiState(base, patch, { source: 'auto' });

    expect(merged).toEqual(expect.objectContaining({
      id: base.id,
      name: base.name,
      stats: base.stats,
      lastInteraction: base.lastInteraction,
    }));
  });
});

// ============================================================================
// MERGE TESTS - ARRAYS ARE REPLACED (NOT MERGED)
// ============================================================================

describe('Merge: Arrays Are Replaced', () => {
  it('replaces personality array (not appends)', () => {
    const base = createTestBlobbi({
      personality: ['brave', 'shy'],
    });

    const patch = {
      personality: ['curious'],
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    expect(merged.personality).toEqual(['curious']); // REPLACED, not ['brave', 'shy', 'curious']
  });

  it('replaces traits array (not appends)', () => {
    const base = createTestBlobbi({
      traits: ['night_owl', 'social'],
    });

    const patch = {
      traits: ['adventurous'],
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    expect(merged.traits).toEqual(['adventurous']); // REPLACED
  });
});

// ============================================================================
// STAGE FILTERING TESTS - REQUIREMENT 3: EGG-ONLY TAGS REMOVED
// ============================================================================

describe('Stage Filtering: Egg → Baby', () => {
  it('removes egg-only fields when transitioning to baby', () => {
    const eggBlobbi = createTestBlobbi({
      lifeStage: 'egg',
      incubationTime: 7,
      incubationProgress: 50,
      eggTemperature: 75,
      shellIntegrity: 90,
      eggStatus: 'healthy',
      tags: [
        ['d', 'blobbi-test'],
        ['stage', 'egg'],
        ['egg_temperature', '75'],
        ['shell_integrity', '90'],
        ['start_incubation', '1700000000'],
      ],
    });

    const filtered = filterBlobbiForStage(eggBlobbi, 'baby');

    // Egg fields cleared
    expect(filtered.incubationTime).toBeUndefined();
    expect(filtered.incubationProgress).toBeUndefined();
    expect(filtered.eggTemperature).toBeUndefined();
    expect(filtered.shellIntegrity).toBeUndefined();
    expect(filtered.eggStatus).toBeUndefined();

    // Egg tags removed
    const tagNames = filtered.tags?.map(([name]) => name) || [];
    expect(tagNames).not.toContain('egg_temperature');
    expect(tagNames).not.toContain('shell_integrity');
    expect(tagNames).not.toContain('start_incubation');

    // Stage updated
    expect(filtered.lifeStage).toBe('baby');
  });

  it('removes task-related tags during stage transition', () => {
    const eggBlobbi = createTestBlobbi({
      lifeStage: 'egg',
      tags: [
        ['d', 'blobbi-test'],
        ['stage', 'egg'],
        ['interact_6_progress', '3'],
        ['interact_6_confirmed', '1700000000'],
        ['blobbi_hashtag_post_progress', '1'],
        ['quest_complete', 'true'],
      ],
    });

    const filtered = filterBlobbiForStage(eggBlobbi, 'baby');

    const tagNames = filtered.tags?.map(([name]) => name) || [];
    expect(tagNames).not.toContain('interact_6_progress');
    expect(tagNames).not.toContain('interact_6_confirmed');
    expect(tagNames).not.toContain('blobbi_hashtag_post_progress');
    expect(tagNames).not.toContain('quest_complete');
  });

  it('preserves non-egg tags during transition', () => {
    const eggBlobbi = createTestBlobbi({
      lifeStage: 'egg',
      tags: [
        ['d', 'blobbi-test'],
        ['stage', 'egg'],
        ['base_color', '#7C3AED'],
        ['pattern', 'stripes'],
        ['personality', 'brave'],
        ['egg_temperature', '75'], // This should be removed
      ],
    });

    const filtered = filterBlobbiForStage(eggBlobbi, 'baby');

    const tagNames = filtered.tags?.map(([name]) => name) || [];
    expect(tagNames).toContain('d');
    expect(tagNames).toContain('base_color');
    expect(tagNames).toContain('pattern');
    expect(tagNames).toContain('personality');
    expect(tagNames).not.toContain('egg_temperature');
  });
});

describe('Stage Filtering: Baby → Adult', () => {
  it('updates breeding readiness when transitioning to adult', () => {
    const babyBlobbi = createTestBlobbi({
      lifeStage: 'baby',
      breedingReady: false,
    });

    const filtered = filterBlobbiForStage(babyBlobbi, 'adult');

    expect(filtered.lifeStage).toBe('adult');
    expect(filtered.breedingReady).toBe(true);
  });
});

// ============================================================================
// TIMESTAMP TESTS - REQUIREMENT 4: NO MILLISECONDS IN SECONDS FIELDS
// ============================================================================

describe('Merge: Timestamp Convention', () => {
  it('normalizes milliseconds to seconds in lastMeal', () => {
    const base = createTestBlobbi({
      lastMeal: 1700000000, // Seconds
    });

    const patch = {
      lastMeal: 1700003600000, // Milliseconds (from Date.now())
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    expect(merged.lastMeal).toBe(1700003600); // Converted to seconds
  });

  it('normalizes all action timestamps to seconds', () => {
    const base = createTestBlobbi();

    const patch = {
      lastMeal: 1700000000000,
      lastClean: 1700003600000,
      lastInteraction: 1700007200000,
      sleepStartedAt: 1700010800000,
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    expect(merged.lastMeal).toBe(1700000000);
    expect(merged.lastClean).toBe(1700003600);
    expect(merged.lastInteraction).toBe(1700007200);
    expect(merged.sleepStartedAt).toBe(1700010800);
  });

  it('preserves birthTime in milliseconds', () => {
    const base = createTestBlobbi({
      birthTime: 1700000000000,
    });

    const patch = {
      lastMeal: 1700003600000, // Will be normalized to seconds
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    expect(merged.birthTime).toBe(1700000000000); // Stays in milliseconds
    expect(merged.lastMeal).toBe(1700003600); // Normalized to seconds
  });
});

// ============================================================================
// TAG DEDUPLICATION TESTS - REQUIREMENT 2: NO DUPLICATE TAGS
// ============================================================================

describe('Tag Deduplication via createBlobbiStateEvent', () => {
  it('removes duplicate singleton tags', () => {
    const blobbi = createTestBlobbi({
      tags: [
        ['d', 'blobbi-test'],
        ['stage', 'egg'],
        ['stage', 'baby'], // Duplicate (last-write-wins)
        ['hunger', '50'],
        ['hunger', '75'], // Duplicate (last-write-wins)
      ],
    });

    const event = createBlobbiStateEvent(blobbi);

    // Count occurrences
    const stageTags = event.tags.filter(([name]) => name === 'stage');
    const hungerTags = event.tags.filter(([name]) => name === 'hunger');

    expect(stageTags.length).toBe(1);
    expect(hungerTags.length).toBe(1);

    // Verify last-write-wins
    expect(stageTags[0][1]).toBe('baby');
  });

  it('deduplicates multi-value tags by full tuple', () => {
    const blobbi = createTestBlobbi({
      personality: ['brave', 'brave', 'curious'], // Duplicate 'brave'
      traits: ['night_owl', 'night_owl'], // Duplicate 'night_owl'
    });

    const event = createBlobbiStateEvent(blobbi);

    const personalityTags = event.tags.filter(([name]) => name === 'personality');
    const traitTags = event.tags.filter(([name]) => name === 'trait');

    // Deduplicated
    expect(personalityTags.length).toBe(2); // ['brave', 'curious']
    expect(traitTags.length).toBe(1); // ['night_owl']
  });

  it('always includes ecosystem tags', () => {
    const blobbi = createTestBlobbi();

    const event = createBlobbiStateEvent(blobbi);

    const tagNames = event.tags.map(([name]) => name);

    expect(tagNames).toContain('b'); // b:blobbi:ecosystem:v1
    expect(tagNames).toContain('t'); // t:blobbi
    expect(tagNames).toContain('client'); // client:blobbi
  });
});

// ============================================================================
// INTEGRATION TESTS: FULL PIPELINE
// ============================================================================

describe('Integration: Full Canonical Pipeline', () => {
  it('applies patch → normalizes → filters → deduplicates', () => {
    const base = createTestBlobbi({
      lifeStage: 'egg',
      stats: { hunger: 50, happiness: 80, health: 90, hygiene: 70, energy: 60 },
      incubationTime: 7,
      eggTemperature: 75,
      personality: ['brave'],
      tags: [
        ['d', 'blobbi-test'],
        ['stage', 'egg'],
        ['egg_temperature', '75'],
        ['start_incubation', '1700000000'],
      ],
    });

    // Apply patch: hatch to baby, update stats
    const patch = {
      lifeStage: 'baby' as const,
      stats: { hunger: 85, energy: 90 }, // Partial stat update
      lastMeal: 1700003600000, // Milliseconds
    };

    const merged = mergeBlobbiState(base, patch, { source: 'hatching' });

    // 1. Patch applied
    expect(merged.lifeStage).toBe('baby');
    expect(merged.stats.hunger).toBe(85);
    expect(merged.stats.energy).toBe(90);

    // 2. Untouched stats preserved
    expect(merged.stats.happiness).toBe(80);
    expect(merged.stats.health).toBe(90);
    expect(merged.stats.hygiene).toBe(70);

    // 3. Timestamps normalized
    expect(merged.lastMeal).toBe(1700003600); // Converted to seconds

    // 4. Stage filtering applied
    expect(merged.incubationTime).toBeUndefined();
    expect(merged.eggTemperature).toBeUndefined();
    const tagNames = merged.tags?.map(([name]) => name) || [];
    expect(tagNames).not.toContain('egg_temperature');
    expect(tagNames).not.toContain('start_incubation');

    // 5. Arrays preserved
    expect(merged.personality).toEqual(['brave']);

    // 6. Create event and verify deduplication
    const event = createBlobbiStateEvent(merged);
    const eventTagNames = event.tags.map(([name]) => name);

    // No duplicates
    const uniqueTagNames = new Set(eventTagNames.filter(name => 
      !['personality', 'trait', 't', 'achievements', 'has', 'storage'].includes(name)
    ));
    const singletonTags = eventTagNames.filter(name => 
      !['personality', 'trait', 't', 'achievements', 'has', 'storage'].includes(name)
    );
    expect(singletonTags.length).toBe(uniqueTagNames.size);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('handles empty stats patch', () => {
    const base = createTestBlobbi({
      stats: { hunger: 50, happiness: 80, health: 90, hygiene: 70, energy: 60 },
    });

    const patch = {
      lastMeal: 1700003600,
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    // Stats unchanged and re-validated
    expect(merged.stats).toEqual(base.stats);
  });

  it('handles missing required fields with defaults', () => {
    const base = createTestBlobbi({
      experience: 0,
      careStreak: 0,
      generation: 1,
    });

    const patch = {};

    const merged = mergeBlobbiState(base, patch, { source: 'auto' });

    // Ensures minimum values
    expect(merged.experience).toBeGreaterThanOrEqual(0);
    expect(merged.careStreak).toBeGreaterThanOrEqual(0);
    expect(merged.generation).toBeGreaterThanOrEqual(1);
  });

  it('handles undefined arrays gracefully', () => {
    const base = createTestBlobbi({
      personality: undefined,
      traits: undefined,
    });

    const patch = {
      personality: ['brave'],
    };

    const merged = mergeBlobbiState(base, patch, { source: 'user' });

    expect(merged.personality).toEqual(['brave']);
    expect(merged.traits).toBeUndefined();
  });
});
