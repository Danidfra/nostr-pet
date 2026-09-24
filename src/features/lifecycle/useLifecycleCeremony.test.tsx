import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ceremonyPresentation, useLifecycleCeremony, type CeremonyState } from './useLifecycleCeremony';

const flush = () => act(async () => {});

describe('ceremonyPresentation', () => {
  const at = (partial: Partial<CeremonyState>): CeremonyState => ({ kind: 'hatch', phase: 'building', step: 0, error: null, ...partial });

  it('idle and failed are not exclusive and change nothing', () => {
    expect(ceremonyPresentation(at({ kind: null, phase: 'idle' }))).toEqual({ eggCrack: null, effects: [], exclusive: false });
    expect(ceremonyPresentation(at({ phase: 'failed' })).exclusive).toBe(false);
    expect(ceremonyPresentation(at({ phase: 'failed' })).eggCrack).toBeNull();
  });

  it('a hatch build cracks the shell step by step under a warm glow and stays exclusive through publishing', () => {
    expect(ceremonyPresentation(at({ step: 0 }))).toMatchObject({ eggCrack: 'none', exclusive: true });
    expect(ceremonyPresentation(at({ step: 1 })).eggCrack).toBe('light');
    expect(ceremonyPresentation(at({ step: 2 })).eggCrack).toBe('medium');
    expect(ceremonyPresentation(at({ step: 3, phase: 'publishing' }))).toMatchObject({ eggCrack: 'heavy', exclusive: true });
    expect(ceremonyPresentation(at({ step: 3 })).effects[0]).toMatchObject({ id: 'solar-radiance' });
  });

  it('an evolve build gathers an aura, and every reveal sparkles without exclusivity', () => {
    expect(ceremonyPresentation(at({ kind: 'evolve', step: 2 })).effects[0]).toMatchObject({ id: 'celestial-aura' });
    expect(ceremonyPresentation(at({ kind: 'evolve', step: 2 })).eggCrack).toBeNull();
    expect(ceremonyPresentation(at({ kind: 'evolve', phase: 'revealing', step: 3 }))).toMatchObject({ exclusive: false, effects: [{ id: 'golden-sparkles', intensity: 1.2 }] });
  });
});

describe('useLifecycleCeremony', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const timings = { stepMs: 100, revealMs: 300 };

  it('builds, publishes once at the end of the build, reveals when the write landed, then goes idle', async () => {
    const perform = vi.fn(async () => true);
    const onReveal = vi.fn();
    const { result } = renderHook(() => useLifecycleCeremony({ perform, reducedMotion: false, timings, onReveal }));
    act(() => result.current.start('hatch'));
    expect(result.current.phase).toBe('building');
    expect(result.current.presentation.exclusive).toBe(true);
    expect(perform).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.step).toBe(2);
    expect(perform).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await flush();
    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledWith('hatch');
    expect(result.current.phase).toBe('revealing');
    expect(result.current.presentation.exclusive).toBe(false);
    expect(onReveal).toHaveBeenCalledWith('hatch');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.kind).toBeNull();
  });

  it('a write that did not land fails the ceremony, never reveals, and can be dismissed', async () => {
    const perform = vi.fn(async () => false);
    const onReveal = vi.fn();
    const { result } = renderHook(() => useLifecycleCeremony({ perform, reducedMotion: false, timings, onReveal }));
    act(() => result.current.start('evolve'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await flush();
    expect(result.current.phase).toBe('failed');
    expect(result.current.error?.message).toMatch(/did not reach/);
    expect(result.current.presentation.exclusive).toBe(false);
    expect(onReveal).not.toHaveBeenCalled();
    act(() => result.current.dismiss());
    expect(result.current.phase).toBe('idle');
  });

  it('a second start during a ceremony is ignored: one write, ever', async () => {
    const perform = vi.fn(async () => true);
    const { result } = renderHook(() => useLifecycleCeremony({ perform, reducedMotion: false, timings }));
    act(() => result.current.start('hatch'));
    act(() => result.current.start('hatch'));
    act(() => result.current.start('evolve'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await flush();
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('reduced motion shortens the build without skipping the write', async () => {
    const perform = vi.fn(async () => true);
    const { result } = renderHook(() => useLifecycleCeremony({ perform, reducedMotion: true }));
    act(() => result.current.start('hatch'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await flush();
    expect(perform).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('revealing');
  });
});
