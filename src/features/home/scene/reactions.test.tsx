import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { REACTION_DURATION_MS, baselineExpression, reactionForCare } from './reactions';
import { useReactionPolicy } from './useReactionPolicy';

describe('reaction policy', () => {
  it('maps care results onto faces', () => {
    expect(reactionForCare('feed', 'active')).toBe('happy');
    expect(reactionForCare('play', 'active')).toBe('excited');
    expect(reactionForCare('clean', 'active')).toBe('happy');
    expect(reactionForCare('rest', 'active')).toBe('happy'); // woke up
    expect(reactionForCare('rest', 'sleeping')).toBeNull(); // fell asleep: sleeping wins anyway
  });

  it('baseline is neutral unless something is critical, and restrained even then', () => {
    const baby = { stage: 'baby' as const, state: 'active' as const };
    const fine = { hunger: 80, happiness: 80, hygiene: 80, energy: 80, health: 90 };
    expect(baselineExpression(baby, fine)).toBe('neutral');
    expect(baselineExpression(baby, { ...fine, hunger: 40 })).toBe('neutral'); // warning only
    expect(baselineExpression(baby, { ...fine, hunger: 5 })).toBe('sad');
    expect(baselineExpression(baby, { ...fine, energy: 5 })).toBe('sleepy');
    expect(baselineExpression(baby, { ...fine, energy: 5, hunger: 5 })).toBe('sad');
    expect(baselineExpression(baby, undefined)).toBe('neutral');
    expect(baselineExpression({ stage: 'baby', state: 'sleeping' }, { ...fine, hunger: 5 })).toBe('neutral');
  });
});

describe('useReactionPolicy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a reaction for its duration, then returns to the baseline (null)', () => {
    const { result } = renderHook(() => useReactionPolicy());
    expect(result.current.reaction).toBeNull();
    act(() => result.current.react('happy'));
    expect(result.current.reaction).toBe('happy');
    act(() => {
      vi.advanceTimersByTime(REACTION_DURATION_MS - 1);
    });
    expect(result.current.reaction).toBe('happy');
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.reaction).toBeNull();
  });

  it('a new reaction replaces the old one and restarts the clock; null clears at once', () => {
    const { result } = renderHook(() => useReactionPolicy());
    act(() => result.current.react('happy', 1_000));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => result.current.react('excited', 1_000));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.reaction).toBe('excited');
    act(() => result.current.react(null));
    expect(result.current.reaction).toBeNull();
  });
});
