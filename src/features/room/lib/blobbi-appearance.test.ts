/**
 * The appearance preference: 2D unless 3D was chosen on this device, and
 * never a crash over what storage says or refuses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, parseAppearance, readAppearance, useBlobbiAppearance, writeAppearance } from './blobbi-appearance';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the Blobbi appearance preference', () => {
  it('is 2D by default, and for anything saved that is not a known choice', () => {
    expect(DEFAULT_APPEARANCE).toBe('2d');
    expect(readAppearance()).toBe('2d');
    for (const junk of ['3D', 'three', '', '{"v":1}', null, undefined, 3]) expect(parseAppearance(junk)).toBe('2d');
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'sideways');
    expect(readAppearance()).toBe('2d');
  });

  it('reads back what was chosen, under its namespaced key', () => {
    expect(writeAppearance('3d')).toBe(true);
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('3d');
    expect(APPEARANCE_STORAGE_KEY.startsWith('blobbi:')).toBe(true);
    expect(readAppearance()).toBe('3d');
  });

  it('falls back to 2D when storage throws on read, and reports a refused write instead of throwing', () => {
    expect(readAppearance({ getItem: () => { throw new Error('SecurityError'); } })).toBe('2d');
    expect(readAppearance(null)).toBe('2d');
    expect(writeAppearance('3d', { setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } })).toBe(false);
    expect(writeAppearance('3d', null)).toBe(false);
  });

  it('as state: starts from what was saved (a reload), and saves each choice', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, '3d');
    const { result } = renderHook(() => useBlobbiAppearance());
    expect(result.current[0]).toBe('3d');
    act(() => result.current[1]('2d'));
    expect(result.current[0]).toBe('2d');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('2d');
    // A second mount, as after a reload, reads the new choice
    expect(renderHook(() => useBlobbiAppearance()).result.current[0]).toBe('2d');
  });
});
