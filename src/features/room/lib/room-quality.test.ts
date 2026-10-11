/**
 * The room's rendering quality: a conservative first guess only from signals
 * that say a device is constrained (never "every phone is slow"), lowered
 * only by sustained measured slowness, a step at a time with a cooldown,
 * never raised by itself; the player's choice is kept on this device and
 * never overridden. What it changes never touches the Blobbi.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { COOLDOWN_MS, MONITOR_MIN_FRAMES, QUALITY, QUALITY_STORAGE_KEY, createQualityMonitor, initialQuality, lowerQuality, parseQualityPreference } from './room-quality';
import { summarizeFrames, throttled } from './frame-stats';
import { QUALITY_LEARNED_KEY, useRoomQuality } from '../hooks/useRoomQuality';
import type { MemoryStorage } from './room-memory';

function memoryStorage(seed: Record<string, string> = {}): MemoryStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('the first guess', () => {
  it('is high when nothing says the device is constrained, a modern phone included', () => {
    expect(initialQuality({})).toBe('high');
    expect(initialQuality({ memoryGb: 8, cores: 8, screenPixels: 1170 * 2532, gpu: 'Apple GPU' })).toBe('high');
    expect(initialQuality({ memoryGb: 8, cores: 8, gpu: 'Adreno (TM) 740' })).toBe('high');
  });

  it('is balanced for one constrained signal, and low for a clearly weak device', () => {
    expect(initialQuality({ memoryGb: 4 })).toBe('balanced');
    expect(initialQuality({ cores: 4 })).toBe('balanced');
    expect(initialQuality({ gpu: 'Mali-G57 MC2' })).toBe('balanced');
    expect(initialQuality({ screenPixels: 3840 * 2160 * 1.5 })).toBe('balanced');
    expect(initialQuality({ memoryGb: 2 })).toBe('low');
    expect(initialQuality({ cores: 2 })).toBe('low');
    expect(initialQuality({ saveData: true })).toBe('low');
    expect(initialQuality({ gpu: 'Mali-G52' })).toBe('low');
    expect(initialQuality({ gpu: 'Google SwiftShader' })).toBe('low');
  });

  it('only ever lowers, whatever the order of the signals', () => {
    expect(initialQuality({ memoryGb: 2, cores: 8, gpu: 'Apple GPU' })).toBe('low');
    expect(initialQuality({ memoryGb: 4, gpu: 'Mali-G52' })).toBe('low');
  });
});

describe('the levels', () => {
  it('step down one at a time and stop at low', () => {
    expect(lowerQuality('high')).toBe('balanced');
    expect(lowerQuality('balanced')).toBe('low');
    expect(lowerQuality('low')).toBe('low');
  });

  it('spend less on each step down, and never less than a whole room', () => {
    expect(QUALITY.high.maxPixelRatio).toBeGreaterThan(QUALITY.balanced.maxPixelRatio);
    expect(QUALITY.balanced.maxPixelRatio).toBeGreaterThan(QUALITY.low.maxPixelRatio);
    expect(QUALITY.low.maxPixelRatio).toBeGreaterThanOrEqual(1);
    expect(QUALITY.low.lamps).toBeGreaterThanOrEqual(1);
    expect(QUALITY.low.moteDensity).toBeGreaterThan(0);
    expect(QUALITY.low.idleFps).toBeGreaterThanOrEqual(15);
  });

  it('read a stored preference, anything else is auto', () => {
    expect(parseQualityPreference('low')).toBe('low');
    expect(parseQualityPreference('ultra')).toBe('auto');
    expect(parseQualityPreference(null)).toBe('auto');
  });
});

describe('the monitor', () => {
  /** Feed `count` busy frames of `ms` each from `start`; true if it asked to step down. */
  function feed(monitor: ReturnType<typeof createQualityMonitor>, start: number, ms: number, count: number, busy = true) {
    let at = start;
    let slow = false;
    for (let i = 0; i < count && !slow; i++) {
      at += ms;
      if (monitor.frame(ms, busy, at)) slow = true;
    }
    return { slow, at };
  }

  it('says nothing about a smooth room', () => {
    expect(feed(createQualityMonitor(0), 0, 16.7, 2000).slow).toBe(false);
  });

  it('steps down on sustained slowness, once, then waits out the cooldown', () => {
    const monitor = createQualityMonitor(0);
    const first = feed(monitor, 0, 50, 200);
    expect(first.slow).toBe(true);
    // Still slow right after the step down: nothing more until the cooldown has passed
    let at = first.at;
    let more = 0;
    while (at < first.at + COOLDOWN_MS - 1000) {
      at += 50;
      if (monitor.frame(50, true, at)) more++;
    }
    expect(more).toBe(0);
    expect(feed(monitor, at, 50, 400).slow).toBe(true);
  });

  it('ignores idle frames (drawn slowly on purpose), pauses and passing hiccups', () => {
    expect(feed(createQualityMonitor(0), 0, 66, 1000, false).slow).toBe(false);
    const monitor = createQualityMonitor(0);
    for (let i = 0, at = 0; i < 400; i++) {
      at += 16.7;
      // one long pause (a hidden tab) and a hitch every tenth frame
      const ms = i === 200 ? 5000 : i % 10 === 0 ? 60 : 16.7;
      expect(monitor.frame(ms, true, at)).toBe(false);
    }
  });

  it('needs enough frames before it decides', () => {
    const monitor = createQualityMonitor(0);
    expect(feed(monitor, COOLDOWN_MS, 50, MONITOR_MIN_FRAMES - 1).slow).toBe(false);
  });
});

describe('useRoomQuality', () => {
  it('keeps the player\'s choice on this device, and measured slowness never overrides it', () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useRoomQuality(storage));
    expect(result.current.preference).toBe('auto');
    act(() => result.current.setPreference('high'));
    expect(storage.data.get(QUALITY_STORAGE_KEY)).toBe('high');
    act(() => result.current.onSlow());
    expect(result.current.level).toBe('high');
    expect(result.current.reason).toBe('chosen');

    const again = renderHook(() => useRoomQuality(storage));
    expect(again.result.current.preference).toBe('high');
    expect(again.result.current.settings).toBe(QUALITY.high);
  });

  it('in auto, steps down when the room is slow, remembers it, and starts there next time', () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useRoomQuality(storage));
    const start = result.current.level;
    act(() => result.current.onSlow());
    expect(result.current.level).toBe(lowerQuality(start));
    expect(result.current.reason).toBe('measured');
    expect(storage.data.get(QUALITY_LEARNED_KEY)).toBe(lowerQuality(start));

    const again = renderHook(() => useRoomQuality(storage));
    expect(again.result.current.level).toBe(lowerQuality(start));
  });

  it('lets a GPU known to be slow lower the guess, but never raises it', () => {
    const storage = memoryStorage({ [QUALITY_LEARNED_KEY]: 'balanced' });
    const { result } = renderHook(() => useRoomQuality(storage));
    act(() => result.current.onGpu('Apple GPU'));
    expect(result.current.level).toBe('balanced');
    act(() => result.current.onGpu('Mali-G52'));
    expect(result.current.level).toBe('low');
  });

  it('works without storage, and over a corrupted value', () => {
    const none = renderHook(() => useRoomQuality(null));
    act(() => none.result.current.setPreference('low'));
    expect(none.result.current.level).toBe('low');
    const broken = renderHook(() => useRoomQuality(memoryStorage({ [QUALITY_STORAGE_KEY]: '{"x":', [QUALITY_LEARNED_KEY]: 'ultra' })));
    expect(broken.result.current.preference).toBe('auto');
  });

  it('a storage that throws is not fatal', () => {
    const throwing: MemoryStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    const { result } = renderHook(() => useRoomQuality(throwing));
    act(() => result.current.setPreference('balanced'));
    expect(result.current.level).toBe('balanced');
  });
});

describe('the performance overlay\'s frame summary', () => {
  it('measures frames per second, percentiles and spikes', () => {
    const s = summarizeFrames([...Array(95).fill(16), ...Array(5).fill(80)]);
    expect(s.fps).toBeCloseTo(100_000 / (95 * 16 + 5 * 80), 3);
    expect(s.p50Ms).toBe(16);
    expect(s.p99Ms).toBe(80);
    expect(s.spikes).toBe(5);
    expect(s.worstMs).toBe(80);
    expect(summarizeFrames([]).fps).toBe(0);
  });

  it('flags a hidden or throttled tab as not representative', () => {
    expect(throttled(true, 16)).toBe(true);
    expect(throttled(false, 1000)).toBe(true);
    expect(throttled(false, 16)).toBe(false);
  });
});
