/**
 * Care planning is a composition of kit primitives. These tests pin the
 * composition: which stats an action moves (the kit's per-action effect on
 * top of the kit's decay), that XP and streak come from the kit, that every
 * unmanaged tag survives, and which actions a stage/state offers.
 */
import { describe, expect, it } from 'vitest';
import {
  KIND_BLOBBI_STATE,
  applyBlobbiDecay,
  getTagValue,
  parseModernBlobbiEvent,
  statsToTagUpdates,
  type BlobbiCompanion,
} from '@blobbi-kit/core';
import { calculateInventoryActionXP } from '@blobbi-kit/react';
import { blobbiEvent } from '@/test/fixtures';
import { availableCareActions, planCareAction, planCareInteraction, planRestToggle, CARE_SOURCE } from './care-plan';

const NOW = 1_800_000_000;

function companion(options: Parameters<typeof blobbiEvent>[1] = {}): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(
    blobbiEvent('0000000042', { name: 'Brook', createdAt: NOW - 600, extra: [['custom_host_tag', 'keep-me']], ...options }),
  );
  if (!parsed) throw new Error('fixture must be modern');
  return parsed;
}

describe('availableCareActions', () => {
  it('offers feed, play, clean and rest to an awake baby', () => {
    const list = availableCareActions(companion({ stage: 'baby' }));
    expect(list.map((a) => [a.action, a.available, a.label])).toEqual([
      ['feed', true, 'Feed'],
      ['play', true, 'Play'],
      ['clean', true, 'Care'],
      ['rest', true, 'Rest'],
    ]);
  });

  it('only cleaning and resting for an egg', () => {
    const list = availableCareActions(companion({ stage: 'egg' }));
    expect(list.find((a) => a.action === 'feed')?.available).toBe(false);
    expect(list.find((a) => a.action === 'play')?.available).toBe(false);
    expect(list.find((a) => a.action === 'clean')?.available).toBe(true);
    expect(list.find((a) => a.action === 'rest')?.available).toBe(true);
  });

  it('a sleeping Blobbi can only be woken', () => {
    const list = availableCareActions(companion({ state: 'sleeping' }));
    for (const action of ['feed', 'play', 'clean'] as const) {
      const item = list.find((a) => a.action === action)!;
      expect(item.available).toBe(false);
      expect(item.reason).toMatch(/sleeping/i);
    }
    expect(list.find((a) => a.action === 'rest')).toMatchObject({ available: true, label: 'Wake' });
  });

  it('a hibernating Blobbi offers nothing', () => {
    const list = availableCareActions(companion({ state: 'hibernating' }));
    expect(list.every((a) => !a.available)).toBe(true);
  });
});

describe('planCareInteraction', () => {
  it('applies the kit decay and the kit care effect for the action, on the fresh event', () => {
    const c = companion({ set: { hunger: '40', happiness: '50', hygiene: '30', energy: '70' } });
    const decayed = applyBlobbiDecay({ stage: c.stage, state: c.state, stats: c.stats, lastDecayAt: c.lastDecayAt, now: NOW }).stats;

    const feed = planCareInteraction(c, 'feed', NOW);
    expect(feed.statsChanged).toEqual({ hunger: expect.any(Number) });
    expect(feed.statsChanged.hunger).toBeGreaterThan(0);
    expect(Number(getTagValue(feed.event.tags, 'hunger'))).toBe(decayed.hunger + feed.statsChanged.hunger!);

    const play = planCareInteraction(c, 'play', NOW);
    expect(play.statsChanged.happiness).toBeGreaterThan(0);
    expect(play.statsChanged.energy).toBeLessThan(0);

    const clean = planCareInteraction(c, 'clean', NOW);
    expect(Object.keys(clean.statsChanged)).toEqual(['hygiene']);
  });

  it('never moves a stat past the kit clamp', () => {
    const c = companion({ set: { hunger: '100' } });
    const feed = planCareInteraction(c, 'feed', NOW);
    expect(Number(getTagValue(feed.event.tags, 'hunger'))).toBeLessThanOrEqual(100);
  });

  it('adds the kit XP for the action and updates the streak through the kit', () => {
    const c = companion();
    const plan = planCareInteraction(c, 'feed', NOW);
    expect(plan.xpGained).toBe(calculateInventoryActionXP('feed', 1));
    expect(Number(getTagValue(plan.event.tags, 'experience'))).toBe((c.experience ?? 0) + plan.xpGained);
    expect(Number(getTagValue(plan.event.tags, 'care_streak'))).toBeGreaterThanOrEqual(1);
    expect(getTagValue(plan.event.tags, 'care_streak_last_day')).toBeTruthy();
  });

  it('stamps both timestamps the way the kit does and keeps every other tag', () => {
    const c = companion();
    const plan = planCareInteraction(c, 'clean', NOW);
    const stamps = statsToTagUpdates({ hunger: 1, happiness: 1, health: 1, hygiene: 1, energy: 1 }, NOW);
    for (const name of Object.keys(stamps).filter((k) => k.startsWith('last_'))) {
      expect(getTagValue(plan.event.tags, name)).toBe(String(NOW));
    }
    expect(getTagValue(plan.event.tags, 'custom_host_tag')).toBe('keep-me');
    expect(getTagValue(plan.event.tags, 'd')).toBe(c.d);
    expect(getTagValue(plan.event.tags, 'seed')).toBe(c.seed);
    expect(plan.event.kind).toBe(KIND_BLOBBI_STATE);
    expect(plan.event.prev).toBe(c.event);
    expect(plan.event.content).toBe(c.event.content);
  });

  it('emits an interaction for the same action from this app', () => {
    const plan = planCareInteraction(companion(), 'play', NOW);
    expect(plan.interaction).toMatchObject({ action: 'play', source: CARE_SOURCE, blobbiDTag: companion().d });
  });

  it('does not change the activity state', () => {
    expect(planCareInteraction(companion(), 'feed', NOW).nextState).toBe('active');
    expect(getTagValue(planCareInteraction(companion(), 'feed', NOW).event.tags, 'state')).toBe('active');
  });
});

describe('planRestToggle', () => {
  it('puts an awake Blobbi to sleep and wakes a sleeping one, with decay and timestamps', () => {
    const awake = companion();
    const rest = planRestToggle(awake, NOW);
    expect(rest.nextState).toBe('sleeping');
    expect(getTagValue(rest.event.tags, 'state')).toBe('sleeping');
    expect(getTagValue(rest.event.tags, 'last_decay_at')).toBe(String(NOW));
    expect(rest.statsChanged).toEqual({});
    expect(rest.interaction).toBeUndefined();

    const asleep = companion({ state: 'sleeping' });
    const wake = planRestToggle(asleep, NOW);
    expect(wake.nextState).toBe('active');
    expect(getTagValue(wake.event.tags, 'state')).toBe('active');
  });

  it('refuses to touch hibernation', () => {
    expect(() => planRestToggle(companion({ state: 'hibernating' }), NOW)).toThrow(/hibernating/i);
    expect(() => planCareAction(companion({ state: 'hibernating' }), 'rest', NOW)).toThrow();
  });

  it('is what planCareAction does for rest', () => {
    const c = companion();
    expect(planCareAction(c, 'rest', NOW).event.tags).toEqual(planRestToggle(c, NOW).event.tags);
  });
});
