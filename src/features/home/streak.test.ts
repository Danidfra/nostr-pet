import { describe, expect, it } from 'vitest';
import { STREAK_MILESTONES, detectStreakIncrease, flameDays, streakLine } from './streak';

describe('streak detection', () => {
  it('notices only an increase between two authoritative values', () => {
    expect(detectStreakIncrease(undefined, undefined)).toBeNull();
    expect(detectStreakIncrease(undefined, 1)).toEqual({ from: 0, to: 1, milestone: false });
    expect(detectStreakIncrease(4, 5)).toEqual({ from: 4, to: 5, milestone: false });
    expect(detectStreakIncrease(5, 5)).toBeNull(); // the same day again
    expect(detectStreakIncrease(5, 1)).toBeNull(); // a reset is not a celebration
    expect(detectStreakIncrease(5, undefined)).toBeNull();
  });

  it('marks the milestone days', () => {
    for (const day of STREAK_MILESTONES) expect(detectStreakIncrease(day - 1, day)?.milestone).toBe(true);
    expect(detectStreakIncrease(3, 4)?.milestone).toBe(false);
  });

  it('has a line for each kind of moment', () => {
    expect(streakLine({ from: 0, to: 1, milestone: false })).toBe('A new streak begins.');
    expect(streakLine({ from: 1, to: 2, milestone: false })).toBe('2 days in a row.');
    expect(streakLine({ from: 6, to: 7, milestone: true })).toBe('7 days in a row!');
  });
});

describe('the flame (M14.1)', () => {
  it('hides a streak of 1 until real care was given, shows 2 or more always, and nothing for none', () => {
    expect(flameDays(1, false)).toBe(0);
    expect(flameDays(1, true)).toBe(1);
    expect(flameDays(2, false)).toBe(2);
    expect(flameDays(7, true)).toBe(7);
    expect(flameDays(undefined, true)).toBe(0);
    expect(flameDays(0, true)).toBe(0);
  });
});
