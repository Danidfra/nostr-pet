import { describe, expect, it } from 'vitest';
import { BEHAVIOR_MODES, BEHAVIOR_POLICY, policyFor, resolveBehaviorMode } from './behavior-mode';

describe('behaviour mode', () => {
  it('resolves in a fixed precedence: ceremony > sleeping > nested > user-walk > free', () => {
    expect(resolveBehaviorMode({ isSleeping: true, isUserWalking: true, isInCeremony: true, isEgg: true })).toBe('ceremony');
    expect(resolveBehaviorMode({ isSleeping: true, isUserWalking: true, isEgg: true })).toBe('sleeping');
    expect(resolveBehaviorMode({ isSleeping: true, isUserWalking: false })).toBe('sleeping');
    expect(resolveBehaviorMode({ isSleeping: false, isUserWalking: true, isEgg: true })).toBe('nested');
    expect(resolveBehaviorMode({ isSleeping: false, isUserWalking: true })).toBe('user-walk');
    expect(resolveBehaviorMode({ isSleeping: false, isUserWalking: false })).toBe('free');
  });

  it('a ceremony and an egg allow nothing; only the ceremony pins the body still', () => {
    expect(policyFor('ceremony')).toEqual({ walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'none' });
    expect(policyFor('nested')).toEqual({ walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'gesture' });
  });

  it('has a complete policy row for every mode', () => {
    for (const mode of BEHAVIOR_MODES) {
      const policy = policyFor(mode);
      expect(policy).toBe(BEHAVIOR_POLICY[mode]);
      expect(Object.keys(policy).sort()).toEqual(['floorTaps', 'forcedMotion', 'gaze', 'idle', 'pokes', 'reactions', 'walks']);
    }
  });

  it('sleeping allows nothing and pins the body still', () => {
    expect(policyFor('sleeping')).toEqual({ walks: [], idle: false, gaze: false, reactions: false, floorTaps: false, forcedMotion: 'still', pokes: 'gesture' });
  });

  it('a user walk keeps the user in charge: no idle, but taps, gaze and reactions stay on', () => {
    const p = policyFor('user-walk');
    expect(p.walks).toEqual(['user']);
    expect(p.idle).toBe(false);
    expect(p.floorTaps).toBe(true);
    expect(p.gaze).toBe(true);
    expect(p.reactions).toBe(true);
  });

  it('free lets both the user and idle walk', () => {
    expect(policyFor('free').walks).toEqual(['user', 'idle']);
    expect(policyFor('free').idle).toBe(true);
  });
});
