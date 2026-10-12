/**
 * The daily award, decided against the fresh profile: the kit's own event
 * (the same functions `useAwardDailyXp` uses, so the same tags and content),
 * and the one rule that keeps it from being paid twice: a profile already
 * holding today's missions all complete has been paid.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_BONUS_XP, DAILY_MISSION_POOL, createDailyMissionsContent, getTodayDateString, totalDailyXp } from '@blobbi-kit/react';
import { buildXpTagUpdates, parseBlobbonautEvent, parseProfileContent, serializeProfileContent, updateBlobbonautTags, type MissionsContent } from '@blobbi-kit/core';
import { PUBKEY, profileEvent } from '@/test/fixtures';
import { HOME_ACTIONS, doableHere, paidFor, planDailyAward } from './daily-xp';

const TODAY = getTodayDateString();

function complete(m: MissionsContent): MissionsContent {
  return { ...m, daily: m.daily.map((x) => ('count' in x ? { ...x, count: x.target } : { ...x, events: Array.from({ length: x.target }, (_, i) => `e${i}`) })) };
}

function profileWith(content: string, xp = 120) {
  const event = { ...profileEvent({ xp, has: ['blobbi-a'] }), content, tags: [...profileEvent({ xp, has: ['blobbi-a'] }).tags, ['inv', 'kept-by-island'], ['level', '2']] };
  return parseBlobbonautEvent(event)!;
}

describe('the daily award', () => {
  const today = complete(createDailyMissionsContent(TODAY, PUBKEY, ['baby']));

  it('is exactly the kit award: XP added to the fresh total, level from XP, every other tag and content key kept', () => {
    const fresh = profileWith(JSON.stringify({ room_layouts: { home: 1 } }));
    const decision = planDailyAward(fresh, today, TODAY);
    expect(decision.kind).toBe('award');
    if (decision.kind !== 'award') return;
    expect(decision.xp).toBe(totalDailyXp(today));
    expect(decision.xp).toBeGreaterThanOrEqual(DAILY_BONUS_XP);
    expect(decision.newTotal).toBe(120 + decision.xp);
    // The same as `useAwardDailyXp` builds from the same fresh event
    expect(decision.template.tags).toEqual(updateBlobbonautTags(fresh.event.tags, buildXpTagUpdates(120 + decision.xp)));
    expect(decision.template.content).toBe(serializeProfileContent(fresh.event.content, { missions: today }));
    expect(decision.template.prev).toBe(fresh.event);
    // Nothing of anyone else's was lost
    expect(decision.template.tags).toContainEqual(['inv', 'kept-by-island']);
    expect(decision.template.tags).toContainEqual(['has', 'blobbi-a']);
    expect(JSON.parse(decision.template.content).room_layouts).toEqual({ home: 1 });
    expect(parseProfileContent(decision.template.content).missions).toEqual(today);
  });

  it('is not paid twice: a fresh profile that already holds today finished (here, on another device, in another app)', () => {
    const paid = profileWith(serializeProfileContent('', { missions: today }), 300);
    expect(paidFor(paid, TODAY)).toBe(true);
    expect(planDailyAward(paid, today, TODAY)).toEqual({ kind: 'already-paid' });
  });

  it('a profile holding today unfinished (the kit persists progress), or yesterday finished, is not "paid" for today', () => {
    const unfinished = createDailyMissionsContent(TODAY, PUBKEY, ['baby']);
    expect(paidFor(profileWith(serializeProfileContent('', { missions: unfinished })), TODAY)).toBe(false);
    const yesterday = complete(createDailyMissionsContent('2000-01-01', PUBKEY, ['baby']));
    expect(paidFor(profileWith(serializeProfileContent('', { missions: yesterday })), TODAY)).toBe(false);
    expect(planDailyAward(profileWith(serializeProfileContent('', { missions: yesterday })), today, TODAY).kind).toBe('award');
  });

  it('pays nothing for missions not all done, for another day, or without a profile to write to', () => {
    const fresh = profileWith('');
    expect(planDailyAward(fresh, createDailyMissionsContent(TODAY, PUBKEY, ['baby']), TODAY)).toEqual({ kind: 'not-complete' });
    expect(planDailyAward(fresh, { ...today, date: '2000-01-01' }, TODAY)).toEqual({ kind: 'not-today' });
    expect(planDailyAward(null, today, TODAY)).toEqual({ kind: 'no-profile' });
  });

  it('a corrupt content still gets the award (the kit starts the content afresh, the tags keep everything)', () => {
    const fresh = profileWith('{not json');
    const decision = planDailyAward(fresh, today, TODAY);
    expect(decision.kind).toBe('award');
  });
});

describe('what this home can do', () => {
  it('care, food, soap, medicine and bedtime; not singing, music or photos (another app\'s, swappable)', () => {
    expect([...HOME_ACTIONS].sort()).toEqual(['clean', 'feed', 'interact', 'medicine', 'sleep']);
    for (const def of DAILY_MISSION_POOL) expect(doableHere(def.id)).toBe(HOME_ACTIONS.has(def.action));
    expect(doableHere('feed_1')).toBe(true);
    expect(doableHere('sleep_1')).toBe(true);
    expect(doableHere('sing_1')).toBe(false);
    expect(doableHere('take_photo_1')).toBe(false);
    expect(doableHere('no-such-mission')).toBe(false);
  });
});
