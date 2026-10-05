import { describe, expect, it } from 'vitest';
import { decideFirstBlobbi, hasHatchedBlobbi, holdsBlobbi, type OwnedBlobbi } from './first-blobbi';
import { EARLIER_D, blobbiEvent, earlierBlobbiEvent, legacyMarkerEvent, legacyShapeEvent, profileEvent } from '@/test/fixtures';

const egg: OwnedBlobbi = { d: 'egg-1', stage: 'egg' };
const other = (stage: OwnedBlobbi['stage'], d = `other-${stage}`): OwnedBlobbi => ({ d, stage });

describe('the first-Blobbi rule', () => {
  it('a fresh account: its only egg is its first Blobbi', () => {
    expect(decideFirstBlobbi(egg, [egg])).toEqual({ first: true });
    // The collection may not hold the egg yet (a cache that is a beat behind): still the first.
    expect(decideFirstBlobbi(egg, [])).toEqual({ first: true });
  });

  it('an account that raised a Blobbi before: a later egg keeps the normal rules', () => {
    expect(decideFirstBlobbi(egg, [egg, other('baby')])).toEqual({ first: false, reason: 'has-hatched-blobbi' });
    expect(decideFirstBlobbi(egg, [other('adult'), egg])).toEqual({ first: false, reason: 'has-hatched-blobbi' });
  });

  it('only eggs: no Blobbi was ever raised, so the egg in hand still qualifies (and the rule ends itself once it hatches)', () => {
    const second = other('egg', 'egg-2');
    expect(decideFirstBlobbi(egg, [egg, second])).toEqual({ first: true });
    // The first one hatched: the same collection, one stage later, and the other egg is a later egg.
    expect(decideFirstBlobbi(second, [{ ...egg, stage: 'baby' }, second])).toEqual({ first: false, reason: 'has-hatched-blobbi' });
  });

  it('only an egg can be a first hatch, and a Blobbi never disqualifies itself', () => {
    expect(decideFirstBlobbi({ d: 'b', stage: 'baby' }, [{ d: 'b', stage: 'baby' }])).toEqual({ first: false, reason: 'not-an-egg' });
    expect(decideFirstBlobbi({ d: 'a', stage: 'adult' }, [])).toEqual({ first: false, reason: 'not-an-egg' });
    // A stale copy of the same `d` at another stage is the same Blobbi, not an earlier one.
    expect(decideFirstBlobbi(egg, [{ d: egg.d, stage: 'baby' }])).toEqual({ first: true });
  });

  it('reads stages only: the visual generation is not part of the rule', () => {
    for (const visualGeneration of ['v1', 'v2', 'v3'] as const) {
      const event = blobbiEvent('0000000001', { stage: 'egg', visualGeneration });
      const d = event.tags.find(([n]) => n === 'd')![1];
      expect(decideFirstBlobbi({ d, stage: 'egg' }, [{ d, stage: 'egg' }])).toEqual({ first: true });
    }
  });
});

describe('the relay read that confirms it', () => {
  const eggEvent = blobbiEvent('0000000001', { stage: 'egg' });
  const eggD = eggEvent.tags.find(([n]) => n === 'd')![1];

  it('finds a hatched Blobbi among raw events, modern or legacy, and ignores the egg itself and other kinds', () => {
    expect(hasHatchedBlobbi([eggEvent], eggD)).toBe(false);
    expect(hasHatchedBlobbi([eggEvent, blobbiEvent('0000000002', { stage: 'egg' })], eggD)).toBe(false);
    expect(hasHatchedBlobbi([eggEvent, earlierBlobbiEvent()], eggD)).toBe(true);
    expect(hasHatchedBlobbi([eggEvent, blobbiEvent('0000000003', { stage: 'baby' })], eggD)).toBe(true);
    // Legacy shapes the home's collection drops still mean "this account raised a Blobbi".
    expect(hasHatchedBlobbi([eggEvent, legacyMarkerEvent('0000000007')], eggD)).toBe(true);
    expect(hasHatchedBlobbi([eggEvent, legacyShapeEvent()], eggD)).toBe(true);
    // The profile says nothing about it, and neither does a 31124 without a `d` or a stage.
    expect(hasHatchedBlobbi([eggEvent, profileEvent({ has: [EARLIER_D] })], eggD)).toBe(false);
    const noStage = blobbiEvent('0000000004', { without: ['stage'] });
    expect(hasHatchedBlobbi([eggEvent, noStage], eggD)).toBe(false);
  });

  it('the same Blobbi already hatched elsewhere is not an EARLIER Blobbi', () => {
    const hatchedElsewhere = blobbiEvent('0000000001', { stage: 'baby' });
    expect(hasHatchedBlobbi([hatchedElsewhere], eggD)).toBe(false);
    expect(hasHatchedBlobbi([hatchedElsewhere])).toBe(true);
  });

  it('knows whether a read answered about this account at all', () => {
    expect(holdsBlobbi([eggEvent], eggD)).toBe(true);
    expect(holdsBlobbi([], eggD)).toBe(false);
    expect(holdsBlobbi([earlierBlobbiEvent(), profileEvent()], eggD)).toBe(false);
  });
});
