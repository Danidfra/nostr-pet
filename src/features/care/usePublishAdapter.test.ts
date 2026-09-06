import { describe, expect, it } from 'vitest';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_BLOBBI_INTERACTION } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { CLIENT_NAME, finalizeTemplate, isReplaceableKind } from './usePublishAdapter';

describe('finalizeTemplate', () => {
  it('stamps the client tag once and keeps a caller-provided one', () => {
    const a = finalizeTemplate({ kind: KIND_BLOBBI_INTERACTION, tags: [['a', 'x']] }, 100);
    expect(a.tags.filter(([n]) => n === 'client')).toEqual([['client', CLIENT_NAME]]);
    const b = finalizeTemplate({ kind: KIND_BLOBBI_INTERACTION, tags: [['client', 'Other']] }, 100);
    expect(b.tags.filter(([n]) => n === 'client')).toEqual([['client', 'Other']]);
  });

  it('preserves published_at from prev on a replaceable republish', () => {
    const prev = blobbiEvent('0000000001', { extra: [['published_at', '123']] });
    const out = finalizeTemplate({ kind: KIND_BLOBBI_STATE, tags: [['d', 'x']], prev }, 500);
    expect(out.tags).toContainEqual(['published_at', '123']);
    expect(out.created_at).toBe(500);
    expect('prev' in out).toBe(false);
  });

  it('sets published_at to created_at on a first publish of a replaceable kind', () => {
    const out = finalizeTemplate({ kind: KIND_BLOBBONAUT_PROFILE, tags: [] }, 777);
    expect(out.tags).toContainEqual(['published_at', '777']);
  });

  it('leaves regular kinds without published_at', () => {
    expect(isReplaceableKind(KIND_BLOBBI_INTERACTION)).toBe(false);
    expect(isReplaceableKind(KIND_BLOBBI_STATE)).toBe(true);
    expect(isReplaceableKind(KIND_BLOBBONAUT_PROFILE)).toBe(true);
    const out = finalizeTemplate({ kind: KIND_BLOBBI_INTERACTION, tags: [] }, 1);
    expect(out.tags.some(([n]) => n === 'published_at')).toBe(false);
  });
});
