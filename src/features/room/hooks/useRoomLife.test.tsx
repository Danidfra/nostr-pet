/**
 * The life controller over time: nothing while the player is busy or until
 * they have been quiet a while; then beats (a glance that ends by itself, a
 * stroll, a stretch); a touch holds it off and ends any glance; a hidden tab
 * skips beats; disabling or unmounting clears every timer. It never writes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRoomLife, type UseRoomLifeOptions } from './useRoomLife';

const TIMING = { quietMs: 1_000, intervalMs: 2_000 };

function setup(over: Partial<UseRoomLifeOptions> = {}, script: number[] = [0]) {
  let i = 0;
  const walkTo = vi.fn(async () => 'arrived' as const);
  const gesture = vi.fn();
  const props: UseRoomLifeOptions = { enabled: true, canWalk: true, position: () => ({ x: 4, z: 4 }), walkTo, gesture, random: () => script[i++ % script.length], timing: TIMING, ...over };
  const hook = renderHook((p: UseRoomLifeOptions) => useRoomLife(p), { initialProps: props });
  return { ...hook, walkTo, gesture, props };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

describe('a Blobbi\'s own life', () => {
  it('a glance comes once the player has been quiet, and ends by itself', () => {
    // The first draw is the wait (2 s); then 0.1: a glance, its offset and length (1.95 s); then a long wait (~3 s)
    const { result } = setup({}, [0.5, 0.1, 0.9, 0.5, 0.5, 0.99]);
    expect(result.current.glance).toBeNull();
    act(() => { vi.advanceTimersByTime(3_500); });
    expect(result.current.glance).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1_200); });
    expect(result.current.glance).toBeNull();
  });

  it('strolls (a walk, nothing else) and stretches (the home\'s stir)', () => {
    const strolling = setup({}, [0.5, 0.6, 0.25, 0.5]);
    act(() => { vi.advanceTimersByTime(3_500); });
    expect(strolling.walkTo).toHaveBeenCalled();
    strolling.unmount();
    const stretching = setup({}, [0.5, 0.8]);
    act(() => { vi.advanceTimersByTime(3_500); });
    expect(stretching.gesture).toHaveBeenCalledWith('stir');
  });

  it('a touch of the player\'s holds it off and ends a glance at once', () => {
    const { result, walkTo, gesture } = setup({}, [0.5, 0.1, 0.5, 0.5, 0.5]);
    act(() => { vi.advanceTimersByTime(3_500); });
    expect(result.current.glance).not.toBeNull();
    act(() => result.current.markActivity());
    expect(result.current.glance).toBeNull();
    // Keep touching: nothing happens
    for (let t = 0; t < 10; t++) {
      act(() => { vi.advanceTimersByTime(800); });
      act(() => result.current.markActivity());
    }
    expect(result.current.glance).toBeNull();
    expect(walkTo).not.toHaveBeenCalled();
    expect(gesture).not.toHaveBeenCalled();
  });

  it('disabled (busy, asleep, decorating) it does nothing, and disabling clears a glance in progress', () => {
    const { result, rerender, props, walkTo } = setup({}, [0.5, 0.1, 0.5, 0.5, 0.5]);
    act(() => { vi.advanceTimersByTime(3_500); });
    expect(result.current.glance).not.toBeNull();
    rerender({ ...props, enabled: false });
    expect(result.current.glance).toBeNull();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.glance).toBeNull();
    expect(walkTo).not.toHaveBeenCalled();
  });

  it('skips its beats while the tab is hidden, and leaves no timer behind when unmounted', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const { result, unmount, walkTo, gesture } = setup({}, [0.6, 0.3, 0.3]);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.glance).toBeNull();
    expect(walkTo).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(gesture).not.toHaveBeenCalled();
  });
});
