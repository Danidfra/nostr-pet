import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseBlobbiFromStateEvent,
  registerAutoRepairCallback,
  clearRepairedBlobbisCache,
  BLOBBI_EVENT_KINDS,
} from '@/lib/blobbi-events';
import { NostrEvent } from '@nostrify/nostrify';

describe('Blobbi Auto-Repair', () => {
  let publishedEvents: Array<Omit<NostrEvent, 'id' | 'sig'>> = [];

  beforeEach(() => {
    publishedEvents = [];
    clearRepairedBlobbisCache();

    // Register a mock publish callback
    registerAutoRepairCallback(async (event) => {
      publishedEvents.push(event);
    });
  });

  afterEach(() => {
    registerAutoRepairCallback(null);
    clearRepairedBlobbisCache();
  });

  it('should auto-publish corrected event when stat tags are missing', async () => {
    const incompleteEvent: NostrEvent = {
      id: 'test-event-1',
      kind: BLOBBI_EVENT_KINDS.STATE,
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      content: 'Test Blobbi is an egg Blobbi.',
      tags: [
        ['d', 'blobbi-testblobbi'],
        ['stage', 'egg'],
        ['breeding_ready', 'false'],
        ['generation', '1'],
        ['experience', '0'],
        ['care_streak', '0'],
        ['b', 'blobbi:ecosystem:v1'],
        ['t', 'blobbi'],
        // Missing: hunger, happiness, health, hygiene, energy
      ],
      sig: 'test-signature',
    };

    const parsedBlobbi = parseBlobbiFromStateEvent(incompleteEvent);

    expect(parsedBlobbi).toBeTruthy();
    expect(parsedBlobbi!.stats).toBeDefined();
    expect(parsedBlobbi!.stats.hunger).toBeGreaterThanOrEqual(0);
    expect(parsedBlobbi!.stats.hunger).toBeLessThanOrEqual(100);

    // Wait for async publish
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(publishedEvents).toHaveLength(1);
    const correctedEvent = publishedEvents[0];

    expect(correctedEvent.kind).toBe(BLOBBI_EVENT_KINDS.STATE);
    expect(correctedEvent.pubkey).toBe('test-pubkey');

    // Verify all stat tags are present
    const tags = correctedEvent.tags;
    const hungerTag = tags.find(([name]) => name === 'hunger');
    const happinessTag = tags.find(([name]) => name === 'happiness');
    const healthTag = tags.find(([name]) => name === 'health');
    const hygieneTag = tags.find(([name]) => name === 'hygiene');
    const energyTag = tags.find(([name]) => name === 'energy');

    expect(hungerTag).toBeDefined();
    expect(happinessTag).toBeDefined();
    expect(healthTag).toBeDefined();
    expect(hygieneTag).toBeDefined();
    expect(energyTag).toBeDefined();

    // Verify stat values are valid
    expect(parseInt(hungerTag![1])).toBeGreaterThanOrEqual(0);
    expect(parseInt(hungerTag![1])).toBeLessThanOrEqual(100);
  });

  it('should not publish duplicate corrections for the same Blobbi', async () => {
    const incompleteEvent: NostrEvent = {
      id: 'test-event-2',
      kind: BLOBBI_EVENT_KINDS.STATE,
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      content: 'Test Blobbi is an egg Blobbi.',
      tags: [
        ['d', 'blobbi-duplicate'],
        ['stage', 'egg'],
        ['breeding_ready', 'false'],
        ['generation', '1'],
        ['experience', '0'],
        ['care_streak', '0'],
        ['b', 'blobbi:ecosystem:v1'],
        ['t', 'blobbi'],
      ],
      sig: 'test-signature',
    };

    // Parse the same event twice
    parseBlobbiFromStateEvent(incompleteEvent);
    await new Promise(resolve => setTimeout(resolve, 100));

    parseBlobbiFromStateEvent(incompleteEvent);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should only publish once
    expect(publishedEvents).toHaveLength(1);
  });

  it('should not publish when all stat tags are present', async () => {
    const completeEvent: NostrEvent = {
      id: 'test-event-3',
      kind: BLOBBI_EVENT_KINDS.STATE,
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      content: 'Test Blobbi is an egg Blobbi.',
      tags: [
        ['d', 'blobbi-complete'],
        ['stage', 'egg'],
        ['breeding_ready', 'false'],
        ['generation', '1'],
        ['experience', '0'],
        ['care_streak', '0'],
        ['hunger', '85'],
        ['happiness', '80'],
        ['health', '90'],
        ['hygiene', '75'],
        ['energy', '70'],
        ['b', 'blobbi:ecosystem:v1'],
        ['t', 'blobbi'],
      ],
      sig: 'test-signature',
    };

    const parsedBlobbi = parseBlobbiFromStateEvent(completeEvent);

    expect(parsedBlobbi).toBeTruthy();
    expect(parsedBlobbi!.stats.hunger).toBe(85);
    expect(parsedBlobbi!.stats.happiness).toBe(80);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not publish any correction
    expect(publishedEvents).toHaveLength(0);
  });

  it('should preserve all original tags in corrected event', async () => {
    const incompleteEvent: NostrEvent = {
      id: 'test-event-4',
      kind: BLOBBI_EVENT_KINDS.STATE,
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      content: 'Test Blobbi is a baby Blobbi.',
      tags: [
        ['d', 'blobbi-preserve'],
        ['stage', 'baby'],
        ['breeding_ready', 'false'],
        ['generation', '1'],
        ['experience', '50'],
        ['care_streak', '3'],
        ['base_color', '#FF5733'],
        ['pattern', 'spots'],
        ['eye_color', '#000000'],
        ['personality', 'playful'],
        ['trait', 'energetic'],
        ['b', 'blobbi:ecosystem:v1'],
        ['t', 'blobbi'],
        // Missing: hunger, happiness, health, hygiene, energy
      ],
      sig: 'test-signature',
    };

    parseBlobbiFromStateEvent(incompleteEvent);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(publishedEvents).toHaveLength(1);
    const correctedEvent = publishedEvents[0];

    const tags = correctedEvent.tags;

    // Verify original tags are preserved
    expect(tags.find(([name]) => name === 'd')?.[1]).toBe('blobbi-preserve');
    expect(tags.find(([name]) => name === 'stage')?.[1]).toBe('baby');
    expect(tags.find(([name]) => name === 'base_color')?.[1]).toBe('#FF5733');
    expect(tags.find(([name]) => name === 'pattern')?.[1]).toBe('spots');
    expect(tags.find(([name]) => name === 'eye_color')?.[1]).toBe('#000000');
    expect(tags.find(([name]) => name === 'personality')?.[1]).toBe('playful');
    expect(tags.find(([name]) => name === 'trait')?.[1]).toBe('energetic');

    // Verify stat tags are added
    expect(tags.find(([name]) => name === 'hunger')).toBeDefined();
    expect(tags.find(([name]) => name === 'happiness')).toBeDefined();
    expect(tags.find(([name]) => name === 'health')).toBeDefined();
    expect(tags.find(([name]) => name === 'hygiene')).toBeDefined();
    expect(tags.find(([name]) => name === 'energy')).toBeDefined();
  });
});
