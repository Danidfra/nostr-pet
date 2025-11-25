import { describe, it, expect } from 'vitest';
import { mergeBlobbiStateTags } from '@/lib/blobbi-state-merge';

describe('mergeBlobbiStateTags - Incubation/Evolution Tag Preservation', () => {
  it('should preserve all tags when starting incubation', () => {
    // Original egg state event tags
    const originalTags: string[][] = [
      ['t', 'blobbi'],
      ['b', 'blobbi:ecosystem:v1'],
      ['source', 'auto'],
      ['d', 'blobbi-as'],
      ['stage', 'egg'],
      ['generation', '1'],
      ['breeding_ready', 'false'],
      ['last_interaction', '1764071973'],
      ['is_sleeping', 'false'],
      ['state', 'active'],
      ['base_color', '#ccffcc'],
      ['pattern', 'speckled'],
      ['size', 'small'],
      ['egg_temperature', '96'],
      ['shell_integrity', '98'],
      ['egg_status', 'warm'],
      ['last_check', '1763987521'],
      ['in_party', 'false'],
      ['visible_to_others', 'true'],
      ['client', 'blobbi'],
      ['hunger', '5'],
      ['happiness', '0'],
      ['health', '5'],
      ['hygiene', '0'],
      ['energy', '5'],
      ['experience', '5'],
      ['care_streak', '0'],
    ];

    // Merge with only startIncubation option
    const mergedTags = mergeBlobbiStateTags(originalTags, {
      startIncubation: 1764072135,
    });

    // Convert to a map for easier checking
    const tagMap = new Map<string, string>();
    mergedTags.forEach(([name, value]) => {
      tagMap.set(name, value);
    });

    // Verify all original tags are preserved
    expect(tagMap.get('d')).toBe('blobbi-as');
    expect(tagMap.get('stage')).toBe('egg');
    expect(tagMap.get('generation')).toBe('1');
    expect(tagMap.get('breeding_ready')).toBe('false');
    expect(tagMap.get('last_interaction')).toBe('1764071973');
    expect(tagMap.get('is_sleeping')).toBe('false');
    expect(tagMap.get('state')).toBe('active');
    expect(tagMap.get('base_color')).toBe('#ccffcc');
    expect(tagMap.get('pattern')).toBe('speckled');
    expect(tagMap.get('size')).toBe('small');
    expect(tagMap.get('egg_temperature')).toBe('96');
    expect(tagMap.get('shell_integrity')).toBe('98');
    expect(tagMap.get('egg_status')).toBe('warm');
    expect(tagMap.get('last_check')).toBe('1763987521');
    expect(tagMap.get('in_party')).toBe('false');
    expect(tagMap.get('visible_to_others')).toBe('true');
    expect(tagMap.get('client')).toBe('blobbi');

    // Verify all stat tags are preserved
    expect(tagMap.get('hunger')).toBe('5');
    expect(tagMap.get('happiness')).toBe('0');
    expect(tagMap.get('health')).toBe('5');
    expect(tagMap.get('hygiene')).toBe('0');
    expect(tagMap.get('energy')).toBe('5');
    expect(tagMap.get('experience')).toBe('5');
    expect(tagMap.get('care_streak')).toBe('0');

    // Verify ecosystem tags are preserved
    expect(tagMap.get('b')).toBe('blobbi:ecosystem:v1');
    expect(mergedTags.some(([name, value]) => name === 't' && value === 'blobbi')).toBe(true);

    // Verify start_incubation was added
    expect(tagMap.get('start_incubation')).toBe('1764072135');

    // Verify tag count (should be original + 1 new tag)
    // Note: We might have 2 't' tags, so the count might be original + 1
    expect(mergedTags.length).toBeGreaterThanOrEqual(originalTags.length);
  });

  it('should preserve all tags when starting evolution', () => {
    // Original baby state event tags
    const originalTags: string[][] = [
      ['t', 'blobbi'],
      ['b', 'blobbi:ecosystem:v1'],
      ['d', 'blobbi-baby-123'],
      ['stage', 'baby'],
      ['generation', '1'],
      ['breeding_ready', 'false'],
      ['last_interaction', '1764071973'],
      ['is_sleeping', 'false'],
      ['state', 'active'],
      ['base_color', '#ffccaa'],
      ['body', 'round'],
      ['face', 'happy'],
      ['hunger', '65'],
      ['happiness', '80'],
      ['health', '90'],
      ['hygiene', '75'],
      ['energy', '70'],
      ['experience', '150'],
      ['care_streak', '5'],
    ];

    // Merge with only startEvolution option
    const mergedTags = mergeBlobbiStateTags(originalTags, {
      startEvolution: 1764072200,
    });

    // Convert to a map for easier checking
    const tagMap = new Map<string, string>();
    mergedTags.forEach(([name, value]) => {
      tagMap.set(name, value);
    });

    // Verify all stat tags are preserved
    expect(tagMap.get('hunger')).toBe('65');
    expect(tagMap.get('happiness')).toBe('80');
    expect(tagMap.get('health')).toBe('90');
    expect(tagMap.get('hygiene')).toBe('75');
    expect(tagMap.get('energy')).toBe('70');
    expect(tagMap.get('experience')).toBe('150');
    expect(tagMap.get('care_streak')).toBe('5');

    // Verify visual tags are preserved
    expect(tagMap.get('base_color')).toBe('#ffccaa');
    expect(tagMap.get('body')).toBe('round');
    expect(tagMap.get('face')).toBe('happy');

    // Verify ecosystem tags are preserved
    expect(tagMap.get('b')).toBe('blobbi:ecosystem:v1');

    // Verify start_evolution was added
    expect(tagMap.get('start_evolution')).toBe('1764072200');

    // Verify other metadata is preserved
    expect(tagMap.get('stage')).toBe('baby');
    expect(tagMap.get('last_interaction')).toBe('1764071973');
  });

  it('should handle removeTags option correctly', () => {
    const originalTags: string[][] = [
      ['d', 'blobbi-123'],
      ['stage', 'egg'],
      ['hunger', '50'],
      ['start_incubation', '1234567890'],
      ['temp_tag', 'temporary'],
    ];

    // Remove a specific tag
    const mergedTags = mergeBlobbiStateTags(originalTags, {
      removeTags: ['temp_tag'],
    });

    const tagMap = new Map<string, string>();
    mergedTags.forEach(([name, value]) => {
      tagMap.set(name, value);
    });

    // Verify temp_tag was removed
    expect(tagMap.has('temp_tag')).toBe(false);

    // Verify other tags are preserved
    expect(tagMap.get('d')).toBe('blobbi-123');
    expect(tagMap.get('stage')).toBe('egg');
    expect(tagMap.get('hunger')).toBe('50');
    expect(tagMap.get('start_incubation')).toBe('1234567890');
  });

  it('should handle removeStartIncubation flag correctly', () => {
    const originalTags: string[][] = [
      ['d', 'blobbi-123'],
      ['stage', 'baby'],
      ['hunger', '50'],
      ['start_incubation', '1234567890'],
    ];

    // Remove start_incubation tag
    const mergedTags = mergeBlobbiStateTags(originalTags, {
      removeStartIncubation: true,
    });

    const tagMap = new Map<string, string>();
    mergedTags.forEach(([name, value]) => {
      tagMap.set(name, value);
    });

    // Verify start_incubation was removed
    expect(tagMap.has('start_incubation')).toBe(false);

    // Verify other tags are preserved
    expect(tagMap.get('d')).toBe('blobbi-123');
    expect(tagMap.get('stage')).toBe('baby');
    expect(tagMap.get('hunger')).toBe('50');
  });

  it('should update existing start_incubation timestamp', () => {
    const originalTags: string[][] = [
      ['d', 'blobbi-123'],
      ['stage', 'egg'],
      ['hunger', '50'],
      ['start_incubation', '1234567890'], // Old timestamp
    ];

    // Update start_incubation with new timestamp
    const mergedTags = mergeBlobbiStateTags(originalTags, {
      startIncubation: 9999999999, // New timestamp
    });

    const tagMap = new Map<string, string>();
    mergedTags.forEach(([name, value]) => {
      tagMap.set(name, value);
    });

    // Verify start_incubation was updated (not duplicated)
    expect(tagMap.get('start_incubation')).toBe('9999999999');
    
    // Verify only one start_incubation tag exists
    const startIncubationTags = mergedTags.filter(([name]) => name === 'start_incubation');
    expect(startIncubationTags.length).toBe(1);

    // Verify other tags are preserved
    expect(tagMap.get('hunger')).toBe('50');
  });

  it('should add ecosystem tags if missing', () => {
    const originalTags: string[][] = [
      ['d', 'blobbi-123'],
      ['stage', 'egg'],
      ['hunger', '50'],
    ];

    const mergedTags = mergeBlobbiStateTags(originalTags, {
      startIncubation: 1234567890,
    });

    // Verify ecosystem tags were added
    expect(mergedTags.some(([name, value]) => name === 'b' && value === 'blobbi:ecosystem:v1')).toBe(true);
    expect(mergedTags.some(([name, value]) => name === 't' && value === 'blobbi')).toBe(true);

    // Verify original tags are preserved
    const tagMap = new Map<string, string>();
    mergedTags.forEach(([name, value]) => {
      tagMap.set(name, value);
    });
    expect(tagMap.get('hunger')).toBe('50');
  });
});
