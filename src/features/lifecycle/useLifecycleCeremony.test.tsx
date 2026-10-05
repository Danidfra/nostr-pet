import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ceremonyPresentation, hatchOnScreen, useLifecycleCeremony, type CeremonyState } from './useLifecycleCeremony';

const flush = () => act(async () => {});

describe('ceremonyPresentation', () => {
  const at = (partial: Partial<CeremonyState>): CeremonyState => ({ kind: 'hatch', phase: 'building', step: 0, error: null, ...partial });

  it('idle and failed are not exclusive and change nothing', () => {
    expect(ceremonyPresentation(at({ kind: null, phase: 'idle' }))).toEqual({ eggCrack: null, effects: [], exclusive: false, hatch: null });
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

  it('a hatch is a story: the shell stirs, cracks, breaks, light bursts out for the write, and clears off the baby', () => {
    const beat = (partial: Partial<CeremonyState>) => ceremonyPresentation(at(partial)).hatch;
    expect(beat({ step: 0 })).toEqual({ beat: 'stirring', rock: 1, burst: 'none' });
    expect(beat({ step: 1 })).toEqual({ beat: 'cracking', rock: 2, burst: 'none' });
    expect(beat({ step: 2 })).toEqual({ beat: 'cracking', rock: 3, burst: 'none' });
    expect(beat({ step: 3 })).toEqual({ beat: 'breaking', rock: 4, burst: 'none' });
    expect(beat({ step: 3, phase: 'publishing' })).toEqual({ beat: 'hatching', rock: 4, burst: 'in' });
    expect(beat({ step: 3, phase: 'revealing' })).toEqual({ beat: 'hatched', rock: 0, burst: 'out' });
    // The rocking never goes down before the shell gives, and the shell never un-cracks.
    const build = [0, 1, 2, 3].map((step) => ceremonyPresentation(at({ step })));
    expect(build.map((p) => p.hatch!.rock)).toEqual([1, 2, 3, 4]);
    expect(build.map((p) => p.eggCrack)).toEqual(['none', 'light', 'medium', 'heavy']);
    // An evolution has no hatch story, and neither has a failed hatch.
    expect(ceremonyPresentation(at({ kind: 'evolve', step: 2 })).hatch).toBeNull();
    expect(ceremonyPresentation(at({ kind: 'evolve', phase: 'revealing', step: 3 })).hatch).toBeNull();
    expect(beat({ phase: 'failed' })).toBeNull();
  });

  it('the baby beat is only shown with the baby: while the shell is still on screen the story is still hatching', () => {
    const hatched = ceremonyPresentation(at({ step: 3, phase: 'revealing' })).hatch;
    expect(hatchOnScreen(hatched, 'egg')).toEqual({ beat: 'hatching', rock: 4, burst: 'in' });
    expect(hatchOnScreen(hatched, 'baby')).toBe(hatched);
    const cracking = ceremonyPresentation(at({ step: 2 })).hatch;
    expect(hatchOnScreen(cracking, 'egg')).toBe(cracking);
    expect(hatchOnScreen(null, 'egg')).toBeNull();
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
    act(() => result.current.start('evolve'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await flush();
    expect(perform).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('revealing');
  });

  it('a hatch walks its whole story in order, holds the last crack, writes once, and ends on the baby', async () => {
    let land: (ok: boolean) => void = () => {};
    const perform = vi.fn(() => new Promise<boolean>((resolve) => (land = resolve)));
    const hatch = { stepMs: 100, revealMs: 300, leadMs: 250, finalMs: 150, burstMs: 200 };
    const seen: string[] = [];
    const { result } = renderHook(() => {
      const ceremony = useLifecycleCeremony({ perform, reducedMotion: false, timings: hatch });
      const beat = ceremony.presentation.hatch?.beat ?? 'none';
      if (seen[seen.length - 1] !== beat) seen.push(beat);
      return ceremony;
    });
    const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
    act(() => result.current.start('hatch'));
    expect(result.current.presentation).toMatchObject({ eggCrack: 'none', hatch: { beat: 'stirring' } });
    await advance(240); // the lead is its own, longer beat: still the intact shell
    expect(result.current.presentation.eggCrack).toBe('none');
    await advance(10);
    expect(result.current.presentation).toMatchObject({ eggCrack: 'light', hatch: { beat: 'cracking', rock: 2 } });
    await advance(100);
    expect(result.current.presentation).toMatchObject({ eggCrack: 'medium', hatch: { beat: 'cracking', rock: 3 } });
    await advance(100);
    expect(result.current.presentation).toMatchObject({ eggCrack: 'heavy', hatch: { beat: 'breaking' } });
    expect(perform).not.toHaveBeenCalled(); // the last crack holds before anything is written
    await advance(150);
    expect(result.current.phase).toBe('publishing');
    expect(result.current.presentation.hatch).toMatchObject({ beat: 'hatching', burst: 'in' });
    expect(perform).toHaveBeenCalledTimes(1);
    // The write lands at once, but the light is given its moment before the reveal.
    await act(async () => land(true));
    expect(result.current.phase).toBe('publishing');
    await advance(200);
    expect(result.current.phase).toBe('revealing');
    expect(result.current.presentation.hatch).toMatchObject({ beat: 'hatched', burst: 'out' });
    await advance(300);
    expect(result.current.phase).toBe('idle');
    expect(seen).toEqual(['none', 'stirring', 'cracking', 'breaking', 'hatching', 'hatched', 'none']);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('a hatch whose write fails never shows the baby beat, and reduced motion keeps every beat while staying short', async () => {
    const failing = vi.fn(async () => false);
    const failed = renderHook(() => useLifecycleCeremony({ perform: failing, reducedMotion: false, timings: { stepMs: 10, revealMs: 10 } }));
    act(() => failed.result.current.start('hatch'));
    await act(async () => void (await vi.advanceTimersByTimeAsync(100)));
    await flush();
    expect(failed.result.current.phase).toBe('failed');
    expect(failed.result.current.presentation.hatch).toBeNull();

    // A write takes a moment, as a relay does (reduced motion adds no hold of its own to it).
    const perform = vi.fn(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 40)));
    const seen: string[] = [];
    const { result } = renderHook(() => {
      const ceremony = useLifecycleCeremony({ perform, reducedMotion: true });
      const beat = ceremony.presentation.hatch?.beat ?? 'none';
      if (seen[seen.length - 1] !== beat) seen.push(beat);
      return ceremony;
    });
    act(() => result.current.start('hatch'));
    // In small steps, so every beat is a render of its own (as it is on screen).
    for (let elapsed = 0; elapsed < 1_100; elapsed += 20) await act(async () => void (await vi.advanceTimersByTimeAsync(20)));
    await flush();
    expect(perform).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('revealing');
    expect(seen).toEqual(['none', 'stirring', 'cracking', 'breaking', 'hatching', 'hatched']);
  });
});
