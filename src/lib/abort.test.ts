import { afterEach, describe, expect, it, vi } from 'vitest';
import { timeoutSignal } from './abort';

afterEach(() => vi.useRealTimers());

describe('timeoutSignal', () => {
  it('aborts with a TimeoutError after its time', () => {
    vi.useFakeTimers();
    const signal = timeoutSignal(1_000);
    vi.advanceTimersByTime(999);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });

  it('aborts with the parent, with the parent’s reason, and stops its timer', () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const signal = timeoutSignal(1_000, parent.signal);
    parent.abort('gone');
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('gone');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is aborted at once under a parent already aborted', () => {
    const parent = new AbortController();
    parent.abort('before');
    const signal = timeoutSignal(1_000, parent.signal);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('before');
  });

  it('lets go of a long-lived parent once its own time is up', () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const add = vi.spyOn(parent.signal, 'addEventListener');
    const remove = vi.spyOn(parent.signal, 'removeEventListener');
    const signal = timeoutSignal(1_000, parent.signal);
    vi.advanceTimersByTime(1_000);
    expect(signal.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
    // The parent's later abort reaches nothing and changes nothing
    parent.abort('later');
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });
});
