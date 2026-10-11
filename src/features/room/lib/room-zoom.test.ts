/**
 * The zoom preference: a number this device remembers (never published),
 * clamped to sensible limits, the default when absent or nonsense, forgotten
 * when back at the default; the hook steps it and resets it.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, ZOOM_STORAGE_KEY, clampZoom, parseZoom, readZoom, useRoomZoom, writeZoom } from './room-zoom';

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
