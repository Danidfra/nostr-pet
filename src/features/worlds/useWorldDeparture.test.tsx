/**
 * Leaving for a world: the goodbye in order, the page asked to go exactly
 * once and only after the Blobbi has gone, repeated taps ignored, Stay at
 * any moment before, reduced motion without the wiggle, an immediate go when
 * the Blobbi cannot act, and a navigation that never happened brought back.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DEPARTURE, useWorldDeparture } from './useWorldDeparture';
import { worldById } from './worlds';

const island = worldById('island')!;
const pixel = worldById('pixel')!;

function setup({ canAct = true, reducedMotion = false, leaveWorks = true } = {}) {
  const navigate = vi.fn();
  const gesture = vi.fn();
  const play = vi.fn();
  const showFace = vi.fn();
  const clearFace = vi.fn();
  const calls = { leave: 0, enter: 0, cancel: 0 };
  const hook = renderHook(() => {
    const [state, setState] = useState<'present' | 'departing' | 'absent' | 'arriving'>('present');
    const presence = {
      state,
      leave: () => {
        calls.leave += 1;
        if (!leaveWorks) return false;
        setState('departing');
        setTimeout(() => setState('absent'), 700);
        return true;
      },
      enter: () => {
        calls.enter += 1;
        setState('present');
        return true;
      },
      cancel: () => {
        calls.cancel += 1;
        setState('present');
      },
    };
    return { d: useWorldDeparture({ presence, canAct, reducedMotion, showFace, clearFace, gesture, play, navigate }), state };
  });
  return { hook, navigate, gesture, play, showFace, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = async (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

describe('leaving for another world', () => {
  it('notices, waves, dissolves, and only then asks the page to go: once', async () => {
    const { hook, navigate, gesture, showFace, calls } = setup();
    act(() => void hook.result.current.d.go(island));
    expect(hook.result.current.d.phase).toBe('noticing');
    expect(showFace).toHaveBeenCalledWith('departure', 'surprised', expect.anything());
    await tick(DEPARTURE.noticeMs);
    expect(hook.result.current.d.phase).toBe('waving');
    expect(gesture).toHaveBeenCalledWith('wiggle');
    expect(navigate).not.toHaveBeenCalled();
    await tick(DEPARTURE.waveMs);
    expect(hook.result.current.d.phase).toBe('leaving');
    expect(calls.leave).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
    await tick(700);
    expect(hook.result.current.state).toBe('absent');
    expect(hook.result.current.d.phase).toBe('gone');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(island.url);
    await tick(1_000);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('repeated taps, and a tap on another world, start nothing more', async () => {
    const { hook, navigate, calls } = setup();
    let second = true;
    act(() => {
      hook.result.current.d.go(island);
      second = hook.result.current.d.go(island);
    });
    expect(second).toBe(false);
    await tick(DEPARTURE.noticeMs);
    act(() => void hook.result.current.d.go(worldById('farm')!));
    await tick(DEPARTURE.waveMs + 700);
    expect(calls.leave).toBe(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(island.url);
  });

  it('a world that is not open is refused', () => {
    const { hook, navigate } = setup();
    let started = true;
    act(() => void (started = hook.result.current.d.go(pixel)));
    expect(started).toBe(false);
    expect(hook.result.current.d.phase).toBe('idle');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([['noticing', 100], ['waving', DEPARTURE.noticeMs + 100], ['leaving', DEPARTURE.noticeMs + DEPARTURE.waveMs + 100]])('Stay while %s: here again, the page never goes', async (_phase, at) => {
    const { hook, navigate, calls } = setup();
    act(() => void hook.result.current.d.go(island));
    await tick(at);
    act(() => hook.result.current.d.cancel());
    expect(hook.result.current.d.phase).toBe('idle');
    expect(hook.result.current.state).toBe('present');
    expect(calls.cancel).toBe(1);
    await tick(5_000);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reduced motion: no wiggle, a shorter notice, the same order', async () => {
    const { hook, navigate, gesture } = setup({ reducedMotion: true });
    act(() => void hook.result.current.d.go(island));
    await tick(DEPARTURE.reducedNoticeMs);
    expect(hook.result.current.d.phase).toBe('leaving');
    expect(gesture).not.toHaveBeenCalled();
    await tick(700);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('a Blobbi that cannot act (an egg, asleep, away) does not perform: the page goes at once', () => {
    const { hook, navigate, calls } = setup({ canAct: false });
    act(() => void hook.result.current.d.go(island));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(calls.leave).toBe(0);
  });

  it('a departure that cannot play goes at once rather than hanging', async () => {
    const { hook, navigate } = setup({ leaveWorks: false });
    act(() => void hook.result.current.d.go(island));
    await tick(DEPARTURE.noticeMs + DEPARTURE.waveMs);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('still here long after the page was asked to go: back home, says so, and can try again', async () => {
    const { hook, navigate, calls } = setup();
    act(() => void hook.result.current.d.go(island));
    await tick(DEPARTURE.noticeMs + DEPARTURE.waveMs + 700);
    expect(navigate).toHaveBeenCalledTimes(1);
    await tick(DEPARTURE.failMs);
    expect(hook.result.current.d.phase).toBe('failed');
    expect(calls.enter).toBe(1);
    expect(hook.result.current.state).toBe('present');
    act(() => void hook.result.current.d.go(island));
    expect(hook.result.current.d.phase).toBe('noticing');
  });

  it('a navigation that throws is a failure, not a crash', () => {
    const { hook, navigate } = setup({ canAct: false });
    navigate.mockImplementation(() => {
      throw new Error('blocked');
    });
    act(() => void hook.result.current.d.go(island));
    expect(hook.result.current.d.phase).toBe('failed');
  });
});
