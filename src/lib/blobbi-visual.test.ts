import { describe, expect, it } from 'vitest';
import { classifyBlobbiEvent, isModernBlobbiEvent, parseModernBlobbiEvent } from '@blobbi-kit/core';
import { blobbiEvent, legacyMarkerEvent, legacyShapeEvent } from '@/test/fixtures';
import { toBlobbiVisual } from './blobbi-visual';

function visualOf(event: ReturnType<typeof blobbiEvent>) {
  const companion = parseModernBlobbiEvent(event);
  if (!companion) throw new Error('fixture must be modern');
  return toBlobbiVisual(companion);
}

describe('modern kind 31124 policy', () => {
  it('accepts a current producer event', () => {
    const event = blobbiEvent('0000000001');
    expect(classifyBlobbiEvent(event)).toBe('modern');
    expect(isModernBlobbiEvent(event)).toBe(true);
    expect(parseModernBlobbiEvent(event)?.name).toBe('Pet');
  });

  it('identifies and ignores legacy events instead of migrating them', () => {
    expect(classifyBlobbiEvent(legacyMarkerEvent('0000000002'))).toBe('legacy');
    expect(parseModernBlobbiEvent(legacyMarkerEvent('0000000002'))).toBeUndefined();
    expect(classifyBlobbiEvent(legacyShapeEvent())).toBe('legacy');
    expect(parseModernBlobbiEvent(legacyShapeEvent())).toBeUndefined();
  });
});

describe('toBlobbiVisual: persistent visual identity', () => {
  it('missing visual_generation renders as v1', () => {
    expect(visualOf(blobbiEvent('0000000001')).visualGeneration).toBe('v1');
  });

  it('v1 stays v1', () => {
    expect(visualOf(blobbiEvent('0000000001', { extra: [['visual_generation', 'v1']] })).visualGeneration).toBe('v1');
  });

  it('v2 stays v2', () => {
    expect(visualOf(blobbiEvent('0000000001', { extra: [['visual_generation', 'v2']] })).visualGeneration).toBe('v2');
  });

  it('an invalid value falls back to v1', () => {
    expect(visualOf(blobbiEvent('0000000001', { extra: [['visual_generation', 'v9']] })).visualGeneration).toBe('v1');
    expect(visualOf(blobbiEvent('0000000001', { extra: [['visual_generation', '']] })).visualGeneration).toBe('v1');
  });

  it('carries stage, form, colours and name straight from the shared projection', () => {
    const visual = visualOf(
      blobbiEvent('0000000001', { stage: 'adult', name: 'Elder', extra: [['adult_type', 'catti'], ['visual_generation', 'v2']] }),
    );
    // The adult form is whatever the domain resolved (seed-derived, with the
    // tag as a compatibility input); the standalone never second-guesses it.
    expect(visual).toMatchObject({ stage: 'adult', name: 'Elder', visualGeneration: 'v2' });
    expect(typeof visual.adultType).toBe('string');
    expect(visual.adultType).not.toBe('');
    expect(visual.baseColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(visual.eyeColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('never invents an adult form for a baby', () => {
    expect(visualOf(blobbiEvent('0000000001', { stage: 'baby' })).adultType).toBeUndefined();
  });
});
