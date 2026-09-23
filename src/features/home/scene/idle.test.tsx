import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { FLOOR_BOUNDS } from './geometry';
import { IDLE_STROLL_RANGE, nextIdleDelay, planIdleAction, type IdleAction } from './idle';
import { useIdleBehavior } from './useIdleBehavior';

/** A scripted random source: returns the given numbers in order, then 0. */
function scripted(values: number[]) {
  const queue = [...values];
  return () => queue.shift() ?? 0;
}

describe('idle planning', () => {
  const at = { x: 0.5, y: 0.5 };

  it('mostly glances, sometimes turns, occasionally strolls, and sometimes just rests', () => {
    expect(planIdleAction(scripted([0.1, 0.5, 0.5, 0]), at, 'front')).toEqual({ type: 'glance', offset: { x: 0, y: 0 }, durationMs: 1_400 });
    expect(planIdleAction(scripted([0.5, 0]), at, 'front')).toEqual({ type: 'turn', facing: 'left' });
    expect(planIdleAction(scripted([0.5, 0.99]), at, 'left')).toEqual({ type: 'turn', facing: 'right' });
    const walk = planIdleAction(scripted([0.7, 1, 1]), at, 'front') as Extract<IdleAction, { type: 'walk' }>;
    expect(walk.type).toBe('walk');
    expect(walk.destination.x).toBeCloseTo(0.5 + IDLE_STROLL_RANGE);
    expect(planIdleAction(scripted([0.95]), at, 'front')).toEqual({ type: 'rest' });
  });

  it('never strolls off the floor', () => {
    const walk = planIdleAction(scripted([0.7, 1, 1]), { x: 0.95, y: 0.95 }, 'front') as Extract<IdleAction, { type: 'walk' }>;
    expect(walk.destination.x).toBeLessThanOrEqual(FLOOR_BOUNDS.maxX);
    expect(walk.destination.y).toBeLessThanOrEqual(FLOOR_BOUNDS.maxY);
  });

  it('a turn never picks the facing it already has', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const turn = planIdleAction(scripted([0.5, r]), at, 'right') as Extract<IdleAction, { type: 'turn' }>;
      expect(turn.facing).not.toBe('right');
    }
  });

  it('jitters the interval by up to half', () => {
    const timing = { inactivityMs: 100, intervalMs: 1_000 };
    expect(nextIdleDelay(() => 0, timing)).toBe(750);
    expect(nextIdleDelay(() => 1, timing)).toBe(1_250);
  });
});

describe('useIdleBehavior', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const timing = { inactivityMs: 1_000, intervalMs: 500 };

  it('does nothing until the inactivity period has passed, then performs one planned action per beat', () => {
    const perform = vi.fn();
    renderHook(() => useIdleBehavior({ enabled: true, timing, random: scripted([0.95, 0.5, 0.95, 0.5]), position: { x: 0.5, y: 0.5 }, facing: 'front', perform }));
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(perform).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenLastCalledWith({ type: 'rest' });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(perform).toHaveBeenCalledTimes(2);
  });

  it('user activity resets the clock', () => {
    const perform = vi.fn();
    const { result } = renderHook(() => useIdleBehavior({ enabled: true, timing, random: () => 0.95, position: { x: 0.5, y: 0.5 }, facing: 'front', perform }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => result.current.markActivity());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(perform).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('disabled means silent; re-enabling after the inactivity period has already passed beats at once', () => {
    const perform = vi.fn();
    const { rerender } = renderHook(({ enabled }: { enabled: boolean }) => useIdleBehavior({ enabled, timing, random: () => 0.95, position: { x: 0.5, y: 0.5 }, facing: 'front', perform }), {
      initialProps: { enabled: false },
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(perform).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    // Inactivity already elapsed before enabling: the first beat is due at once.
    expect(perform).toHaveBeenCalledTimes(1);
  });
});
