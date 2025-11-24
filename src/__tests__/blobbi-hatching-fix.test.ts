import { describe, it, expect } from 'vitest';
import { processHatching } from '@/lib/blobbi-evolution';
import { Blobbi } from '@/types/blobbi';

describe('Blobbi Hatching Logic', () => {
  const createMockEggBlobbi = (): Blobbi => ({
    id: 'blobbi-test-egg',
    ownerPubkey: 'test-pubkey',
    name: 'TestEgg',
    birthTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    lastInteraction: Math.floor(Date.now() / 1000),
    lifeStage: 'egg',
    state: 'active',
    stats: {
      hunger: 60,
      happiness: 80,
      health: 85,
      hygiene: 70,
      energy: 65,
    },
    customization: {
      color: '#ffccaa',
      pattern: 'spotted',
      accessories: [],
    },
    experience: 45,
    coins: 0,
    inventory: [],
    generation: 1,
    breedingReady: false,
    careStreak: 4,
    evolutionProgress: {
      totalCareDays: 4,
      currentStreak: 4,
      lastCareDate: Date.now() - 2 * 60 * 60 * 1000,
      careSessions: [],
      isEligibleForEvolution: true,
      nextEvolutionCheck: Date.now() + 24 * 60 * 60 * 1000,
    },
    // Egg-specific tags that should be removed
    incubationTime: 100000,
    incubationProgress: 95,
    eggTemperature: 75,
    eggStatus: 'ready_to_hatch',
    shellIntegrity: 90,
    // Divine theme
    themeVariant: 'divine',
    crossoverApp: 'divine',
    baseColor: '#55C4A2',
    secondaryColor: '#ffffff', // This should be removed for divine
    specialMark: 'divine_wordmark',
    // Task-related tags that should be removed
    tags: [
      ['b', 'blobbi:ecosystem:v1'],
      ['t', 'blobbi'],
      ['d', 'blobbi-test-egg'],
      ['stage', 'egg'],
      ['theme', 'divine'],
      ['crossover_app', 'divine'],
      ['base_color', '#55C4A2'],
      ['secondary_color', '#ffffff'],
      ['special_mark', 'divine_wordmark'],
      ['egg_temperature', '75'],
      ['egg_status', 'ready_to_hatch'],
      ['shell_integrity', '90'],
      ['incubation_time', '100000'],
      ['start_incubation', '1640995200'],
      ['hatch_time', '1641081600'],
      ['interact_6_progress', '3'],
      ['interact_6_confirmed', '1640995200'],
      ['quest_1_progress', '5'],
      ['task_2_confirmed', '1640995200'],
      ['last_warm', '1640995200'],
      ['last_check', '1640995200'],
    ],
  });

  it('should remove egg-only tags during hatching', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    // Check that egg-specific tags are removed
    expect(updatedBlobbi.incubationTime).toBeUndefined();
    expect(updatedBlobbi.incubationProgress).toBeUndefined();
    expect(updatedBlobbi.eggTemperature).toBeUndefined();
    expect(updatedBlobbi.eggStatus).toBeUndefined();
    expect(updatedBlobbi.shellIntegrity).toBeUndefined();

    // Check that tags array doesn't contain egg-specific tags
    const tagNames = updatedBlobbi.tags?.map(([name]) => name) || [];
    expect(tagNames).not.toContain('egg_temperature');
    expect(tagNames).not.toContain('egg_status');
    expect(tagNames).not.toContain('shell_integrity');
    expect(tagNames).not.toContain('incubation_time');
    expect(tagNames).not.toContain('start_incubation');
    expect(tagNames).not.toContain('hatch_time');
  });

  it('should remove task-related tags during hatching', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    // Check that task-related tags are removed from tags array
    const tagNames = updatedBlobbi.tags?.map(([name]) => name) || [];

    // Check for progress tags
    const progressTags = tagNames.filter(name => name.includes('_progress'));
    expect(progressTags).toHaveLength(0);

    // Check for confirmed tags
    const confirmedTags = tagNames.filter(name => name.includes('_confirmed'));
    expect(confirmedTags).toHaveLength(0);

    // Check for quest tags
    const questTags = tagNames.filter(name => name.includes('quest_'));
    expect(questTags).toHaveLength(0);

    // Check for task tags
    const taskTags = tagNames.filter(name => name.includes('task_'));
    expect(taskTags).toHaveLength(0);
  });

  it('should preserve divine tags perfectly', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    // Check divine tags are preserved
    expect(updatedBlobbi.themeVariant).toBe('divine');
    expect(updatedBlobbi.crossoverApp).toBe('divine');
    expect(updatedBlobbi.specialMark).toBe('divine_wordmark');
    expect(updatedBlobbi.baseColor).toBe('#55C4A2');

    // Check that secondary_color is removed for divine
    expect(updatedBlobbi.secondaryColor).toBeUndefined();

    // Check tags array has divine tags
    const tagMap = new Map<string, string>(updatedBlobbi.tags || [] as any);
    expect(tagMap.get('theme')).toBe('divine');
    expect(tagMap.get('crossover_app')).toBe('divine');
    expect(tagMap.get('special_mark')).toBe('divine_wordmark');
    expect(tagMap.get('base_color')).toBe('#55C4A2');
    expect(tagMap.get('secondary_color')).toBeUndefined();
  });

  it('should reset core stats properly for baby stage', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    // Check stage is changed to baby
    expect(updatedBlobbi.lifeStage).toBe('baby');

    // Check breeding readiness is false
    expect(updatedBlobbi.breedingReady).toBe(false);

    // Check evolution progress is reset
    expect(updatedBlobbi.evolutionProgress.totalCareDays).toBe(0);
    expect(updatedBlobbi.evolutionProgress.currentStreak).toBe(0);
    expect(updatedBlobbi.evolutionProgress.isEligibleForEvolution).toBe(false);

    // Check stats have been updated with hatching boost
    expect(updatedBlobbi.stats.happiness).toBeGreaterThan(egg.stats.happiness);
    expect(updatedBlobbi.stats.energy).toBeGreaterThan(egg.stats.energy);
  });

  it('should maintain canonical tag order', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    const tags = updatedBlobbi.tags || [];

    // Check that tags start with required ecosystem tags
    expect(tags[0]).toEqual(['b', 'blobbi:ecosystem:v1']);
    expect(tags[1]).toEqual(['t', 'blobbi']);
    expect(tags[2]).toEqual(['client', 'blobbi']);
    expect(tags[3]).toEqual(['d', egg.id]);

    // Check that core state tags come next
    const stageIndex = tags.findIndex(([name]) => name === 'stage');
    const generationIndex = tags.findIndex(([name]) => name === 'generation');
    const hungerIndex = tags.findIndex(([name]) => name === 'hunger');

    expect(stageIndex).toBeGreaterThan(3);
    expect(generationIndex).toBeGreaterThan(3);
    expect(hungerIndex).toBeGreaterThan(3);

    // Check that appearance tags are in the right section
    const baseColorIndex = tags.findIndex(([name]) => name === 'base_color');
    const themeIndex = tags.findIndex(([name]) => name === 'theme');

    expect(baseColorIndex).toBeGreaterThan(hungerIndex);
    expect(themeIndex).toBeGreaterThan(hungerIndex);
  });

  it('should preserve appearance and theme tags correctly', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    // Check appearance tags are preserved
    expect(updatedBlobbi.baseColor).toBe('#55C4A2');
    expect(updatedBlobbi.specialMark).toBe('divine_wordmark');

    // Check tags array has appearance tags
    const tagMap = new Map<string, string>(updatedBlobbi.tags || [] as any);
    expect(tagMap.get('base_color')).toBe('#55C4A2');
    expect(tagMap.get('special_mark')).toBe('divine_wordmark');
  });

  it('should not contain any egg-related fields in the model', () => {
    const egg = createMockEggBlobbi();
    const { updatedBlobbi } = processHatching(egg);

    // Verify no egg fields exist in the model
    expect(updatedBlobbi).not.toHaveProperty('incubationTime');
    expect(updatedBlobbi).not.toHaveProperty('incubationProgress');
    expect(updatedBlobbi).not.toHaveProperty('eggTemperature');
    expect(updatedBlobbi).not.toHaveProperty('eggStatus');
    expect(updatedBlobbi).not.toHaveProperty('shellIntegrity');
  });
});