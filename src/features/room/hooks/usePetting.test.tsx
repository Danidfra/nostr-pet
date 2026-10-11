/**
 * Petting stopped from outside mid-stroke (the Blobbi falls asleep, care or
 * a room change begins) takes its contented face with it, and nothing of it
 * outlives the room.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePetting } from './usePetting';

function setup() {
  const o = { reducedMotion: false, showFace: vi.fn(), clearFace: vi.fn(), gesture: vi.fn(), play: vi.fn(), markActivity: vi.fn(), stop: vi.fn() };
  const hook = renderHook(({ enabled }) => usePetting({ enabled, ...o }), { initialProps: { enabled: true } });
  return { o, hook };
}

describe('petting', () => {
  it('stopped from outside mid-stroke clears its face', () => {
    const { o, hook } = setup();
    act(() => hook.result.current.onPet('start'));
    expect(o.showFace).toHaveBeenCalledWith('petting', 'affectionate', expect.anything());
    hook.rerender({ enabled: false });
    act(() => hook.result.current.onPet('end'));
    expect(o.clearFace).toHaveBeenCalledWith('petting');
    expect(hook.result.current.petting).toBe(false);
  });

  it('leaves no timer behind when the room goes away right after a stroke', () => {
    vi.useFakeTimers();
    try {
      const { o, hook } = setup();
      act(() => hook.result.current.onPet('start'));
      act(() => hook.result.current.onPet('end'));
      const shown = o.showFace.mock.calls.length;
      hook.unmount();
      vi.advanceTimersByTime(5000);
      expect(o.showFace).toHaveBeenCalledTimes(shown);
    } finally {
      vi.useRealTimers();
    }
  });
});
