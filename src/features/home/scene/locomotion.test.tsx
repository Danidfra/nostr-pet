import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { FLOOR_BOUNDS, floorDistance } from './geometry';
import { arriveAt, beginWalk, standingAt, stepLocomotion, stopWalking, turnTo } from './locomotion';
import { useBlobbiLocomotion } from './useBlobbiLocomotion';

const FAKES = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] as const;

describe('locomotion model', () => {
  it('stands still until asked to walk', () => {
    const s = standingAt({ x: 0.5, y: 0.5 });
    expect(s.motion).toBe('idle');
    expect(stepLocomotion(s, 1).state).toBe(s);
  });

  it('beginWalk sets a clamped destination, faces the way it goes, and starts walking', () => {
    const s = beginWalk(standingAt({ x: 0.5, y: 0.5 }), { x: 2, y: 0.5 }, 'user');
    expect(s.motion).toBe('walking');
    expect(s.destination).toEqual({ x: FLOOR_BOUNDS.maxX, y: 0.5 });
    expect(s.facing).toBe('right');
    expect(s.source).toBe('user');
  });

  it('a walk to where it already stands changes nothing', () => {
    const s = standingAt({ x: 0.5, y: 0.5 });
    expect(beginWalk(s, { x: 0.5, y: 0.5 }, 'user')).toBe(s);
  });

  it('an idle walk never interrupts a user walk, but a user walk replaces an idle one', () => {
    const user = beginWalk(standingAt({ x: 0.5, y: 0.5 }), { x: 0.8, y: 0.5 }, 'user');
    expect(beginWalk(user, { x: 0.2, y: 0.5 }, 'idle')).toBe(user);
    const idle = beginWalk(standingAt({ x: 0.5, y: 0.5 }), { x: 0.8, y: 0.5 }, 'idle');
    const replaced = beginWalk(idle, { x: 0.2, y: 0.5 }, 'user');
    expect(replaced.destination).toEqual({ x: 0.2, y: 0.5 });
    expect(replaced.source).toBe('user');
    expect(replaced.facing).toBe('left');
  });

  it('steps at a constant speed and arrives exactly, keeping the arrival facing', () => {
    let s = beginWalk(standingAt({ x: 0.2, y: 0.5 }), { x: 0.6, y: 0.5 }, 'user');
    const r1 = stepLocomotion(s, 0.5, 0.2);
    expect(r1.arrived).toBe(false);
    expect(r1.state.position.x).toBeCloseTo(0.3);
    s = r1.state;
    const r2 = stepLocomotion(s, 10, 0.2);
    expect(r2.arrived).toBe(true);
    expect(r2.state.position).toEqual({ x: 0.6, y: 0.5 });
    expect(r2.state.motion).toBe('idle');
    expect(r2.state.destination).toBeNull();
    expect(r2.state.facing).toBe('right');
  });

  it('never steps backwards on a negative or zero dt', () => {
    const s = beginWalk(standingAt({ x: 0.2, y: 0.5 }), { x: 0.6, y: 0.5 }, 'user');
    expect(stepLocomotion(s, -1).state.position).toEqual(s.position);
    expect(stepLocomotion(s, 0).state.position).toEqual(s.position);
  });

  it('arriveAt jumps to the destination with the right facing (reduced motion)', () => {
    const s = arriveAt(standingAt({ x: 0.5, y: 0.5 }), { x: 0.1, y: 0.5 });
    expect(s.position).toEqual({ x: 0.1, y: 0.5 });
    expect(s.facing).toBe('left');
    expect(s.motion).toBe('idle');
  });

  it('stopWalking and turnTo', () => {
    const walking = beginWalk(standingAt({ x: 0.5, y: 0.5 }), { x: 0.8, y: 0.5 }, 'user');
    expect(stopWalking(walking).motion).toBe('idle');
    expect(turnTo(walking, 'left')).toBe(walking); // no turning mid-walk
    expect(turnTo(standingAt({ x: 0.5, y: 0.5 }), 'back').facing).toBe('back');
  });
});

describe('useBlobbiLocomotion', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: [...FAKES] }));
  afterEach(() => vi.useRealTimers());

  it('walks a destination in over frames and calls onArrive once, at arrival', () => {
    const { result } = renderHook(() => useBlobbiLocomotion({ initialPosition: { x: 0.2, y: 0.5 }, reducedMotion: false, speed: 0.4 }));
    const onArrive = vi.fn();
    act(() => {
      result.current.walkTo({ x: 0.6, y: 0.5 }, { onArrive });
    });
    expect(result.current.motion).toBe('walking');
    expect(result.current.facing).toBe('right');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const mid = result.current.position.x;
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.6);
    expect(onArrive).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.position).toEqual({ x: 0.6, y: 0.5 });
    expect(result.current.motion).toBe('idle');
    expect(result.current.facing).toBe('right');
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it('under reduced motion it arrives at once and still reports arrival', () => {
    const { result } = renderHook(() => useBlobbiLocomotion({ initialPosition: { x: 0.2, y: 0.5 }, reducedMotion: true }));
    const onArrive = vi.fn();
    act(() => {
      result.current.walkTo({ x: 0.7, y: 0.6 }, { onArrive });
    });
    expect(result.current.position).toEqual({ x: 0.7, y: 0.6 });
    expect(result.current.motion).toBe('idle');
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it('a new user destination replaces the walk and drops the old arrival callback', () => {
    const { result } = renderHook(() => useBlobbiLocomotion({ initialPosition: { x: 0.5, y: 0.5 }, reducedMotion: false, speed: 0.4 }));
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      result.current.walkTo({ x: 0.9, y: 0.5 }, { onArrive: first });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.walkTo({ x: 0.1, y: 0.5 }, { onArrive: second });
    });
    expect(result.current.facing).toBe('left');
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.position.x).toBeCloseTo(0.1);
  });

  it('user input overrides an idle walk; an idle walk cannot override the user', () => {
    const { result } = renderHook(() => useBlobbiLocomotion({ initialPosition: { x: 0.5, y: 0.5 }, reducedMotion: false, speed: 0.4 }));
    act(() => {
      result.current.walkTo({ x: 0.9, y: 0.5 }, { source: 'idle' });
    });
    expect(result.current.source).toBe('idle');
    let accepted = false;
    act(() => {
      accepted = result.current.walkTo({ x: 0.1, y: 0.5 }, { source: 'user' });
    });
    expect(accepted).toBe(true);
    expect(result.current.source).toBe('user');
    act(() => {
      accepted = result.current.walkTo({ x: 0.9, y: 0.5 }, { source: 'idle' });
    });
    expect(accepted).toBe(false);
    expect(result.current.destination).toEqual({ x: 0.1, y: 0.5 });
  });

  it('the loop does not run while standing still', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    renderHook(() => useBlobbiLocomotion({ initialPosition: { x: 0.5, y: 0.5 }, reducedMotion: false }));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });

  it('stop() halts the walk where it stands and drops the arrival callback', () => {
    const { result } = renderHook(() => useBlobbiLocomotion({ initialPosition: { x: 0.1, y: 0.5 }, reducedMotion: false, speed: 0.4 }));
    const onArrive = vi.fn();
    act(() => {
      result.current.walkTo({ x: 0.9, y: 0.5 }, { onArrive });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const mid = result.current.position;
    expect(floorDistance(mid, { x: 0.1, y: 0.5 })).toBeGreaterThan(0);
    act(() => {
      result.current.stop();
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.position).toEqual(mid);
    expect(result.current.motion).toBe('idle');
    expect(onArrive).not.toHaveBeenCalled();
  });
});
