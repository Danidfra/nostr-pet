/**
 * The zoom preference: a number this device remembers (never published),
 * clamped to sensible limits, the default when absent or nonsense, forgotten
 * when back at the default; the hook steps it and resets it.
 *
 * M12.1: the player's 100% is the view that used to be 80% (the scene's 0.8);
 * the camera and its limits are unchanged; a preference saved before keeps
 * its framing.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BASELINE,
  DEFAULT_ZOOM,
  LEGACY_ZOOM_STORAGE_KEY,
  SCENE_ZOOM_MAX,
  SCENE_ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  ZOOM_STORAGE_KEY,
  clampZoom,
  fromScene,
  parseLegacyZoom,
  parseZoom,
  readZoom,
  toScene,
  useRoomZoom,
  writeZoom,
} from './room-zoom';

describe('the zoom preference', () => {
  it('parses and clamps what is stored, and falls back to the default for nonsense', () => {
    expect(parseZoom('1.5')).toBe(1.5);
    expect(parseZoom('9')).toBe(ZOOM_MAX);
    expect(parseZoom('0.1')).toBe(ZOOM_MIN);
    expect(parseZoom('abc')).toBe(DEFAULT_ZOOM);
    expect(parseZoom(null)).toBe(DEFAULT_ZOOM);
    expect(parseZoom('-2')).toBe(DEFAULT_ZOOM);
    expect(clampZoom(NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(1.2, 1.1)).toBe(1.1);
  });

  it('reads and writes localStorage under its own key, and clears it at the default', () => {
    expect(readZoom()).toBe(DEFAULT_ZOOM);
    expect(writeZoom(1.44)).toBe(true);
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBe('1.44');
    expect(readZoom()).toBe(1.44);
    writeZoom(DEFAULT_ZOOM);
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBeNull();
    expect(readZoom({ getItem: () => { throw new Error('blocked'); } })).toBe(DEFAULT_ZOOM);
    expect(writeZoom(1.2, null)).toBe(false);
  });

  it('the hook steps in and out within the limits, resets, and remembers each change', () => {
    const { result } = renderHook(() => useRoomZoom());
    expect(result.current.value).toBe(1);
    act(() => result.current.by(ZOOM_STEP));
    expect(result.current.value).toBeCloseTo(ZOOM_STEP, 5);
    expect(readZoom()).toBeCloseTo(ZOOM_STEP, 3);
    for (let i = 0; i < 10; i++) act(() => result.current.by(ZOOM_STEP));
    expect(result.current.value).toBe(ZOOM_MAX);
    for (let i = 0; i < 20; i++) act(() => result.current.by(1 / ZOOM_STEP));
    expect(result.current.value).toBe(ZOOM_MIN);
    act(() => result.current.set(1.37));
    expect(result.current.value).toBe(1.37);
    act(() => result.current.reset());
    expect(result.current.value).toBe(DEFAULT_ZOOM);
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBeNull();
  });
});

describe('the new 100% (M12.1)', () => {
  it('is the view that used to be 80%: the camera is given 0.8 by default, and the label says 100%', () => {
    expect(BASELINE).toBe(0.8);
    const { result } = renderHook(() => useRoomZoom());
    expect(result.current.value).toBe(1);
    expect(result.current.scene).toBeCloseTo(0.8, 10);
    expect(Math.round(result.current.value * 100)).toBe(100);
  });

  it('keeps the camera and its limits: the same scene range, labelled 75%..275%', () => {
    expect(toScene(ZOOM_MIN)).toBeCloseTo(SCENE_ZOOM_MIN, 10);
    expect(toScene(ZOOM_MAX)).toBeCloseTo(SCENE_ZOOM_MAX, 10);
    expect(SCENE_ZOOM_MIN).toBe(0.6);
    expect(SCENE_ZOOM_MAX).toBe(2.2);
    expect(Math.round(ZOOM_MIN * 100)).toBe(75);
    expect(Math.round(ZOOM_MAX * 100)).toBe(275);
    expect(fromScene(toScene(1.37))).toBeCloseTo(1.37, 10);
  });

  it('a pinch reports scene units; the player sees them in the new scale, and the camera gets back exactly what it reported', () => {
    const { result } = renderHook(() => useRoomZoom());
    act(() => result.current.setScene(1.2));
    expect(result.current.value).toBeCloseTo(1.5, 10);
    expect(result.current.scene).toBeCloseTo(1.2, 10);
    expect(Number(localStorage.getItem(ZOOM_STORAGE_KEY))).toBeCloseTo(1.5, 3);
  });

  it('a preference saved before keeps its framing: carried over once (old ÷ 0.8), under the new key, the old key removed', () => {
    // Old 1.2 was a little closer than the old default; it must stay exactly that view
    localStorage.setItem(LEGACY_ZOOM_STORAGE_KEY, '1.2');
    expect(readZoom()).toBeCloseTo(1.5, 10);
    expect(localStorage.getItem(LEGACY_ZOOM_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBe('1.5');
    expect(toScene(readZoom())).toBeCloseTo(1.2, 10);
    // A player who had chosen the old 80% lands on exactly the new 100%: nothing to store
    localStorage.clear();
    localStorage.setItem(LEGACY_ZOOM_STORAGE_KEY, '0.8');
    expect(readZoom()).toBeCloseTo(1, 10);
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_ZOOM_STORAGE_KEY)).toBeNull();
  });

  it('the new key wins over a leftover old one; an old value out of range or nonsense is clamped or ignored', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '1.25');
    localStorage.setItem(LEGACY_ZOOM_STORAGE_KEY, '2');
    expect(readZoom()).toBe(1.25);
    expect(parseLegacyZoom('5')).toBe(ZOOM_MAX);
    expect(parseLegacyZoom('0.1')).toBe(ZOOM_MIN);
    expect(parseLegacyZoom('abc')).toBeNull();
    expect(parseLegacyZoom(null)).toBeNull();
  });

  it('never saved anything: the new default, nothing written', () => {
    expect(readZoom()).toBe(DEFAULT_ZOOM);
    expect(localStorage.length).toBe(0);
  });
});
