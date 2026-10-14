import { describe, expect, it } from 'vitest';
import { LOOK_GUIDE_DOCK_MS, LOOK_GUIDE_LINE, LOOK_GUIDE_SHEET_MS, LOOK_GUIDE_STORAGE_KEY, LOOK_OPTIONS, guideAfterIntro, guideOnSheetOpen, lookTitle, previewNote3d, readLookGuideShown, shownLook, writeLookGuideShown } from './look-guide';

describe('finding the Blobbi\'s look (M14.3)', () => {
  it('the two looks are Classic and 3D Model, the second said to be experimental, and the words have no semicolon', () => {
    expect(LOOK_OPTIONS.map((o) => [o.value, o.title])).toEqual([
      ['2d', 'Classic'],
      ['3d', '3D Model'],
    ]);
    expect(LOOK_OPTIONS[1].detail).toMatch(/experimental/);
    for (const o of LOOK_OPTIONS) expect(o.detail).not.toContain(';');
    expect(LOOK_GUIDE_LINE).toBe('Want to try another look?');
    expect(lookTitle('2d')).toBe('Classic');
    expect(lookTitle('3d')).toBe('3D Model');
  });

  it('what the room draws is 3D only where this Blobbi has a model', () => {
    expect(shownLook('3d', null)).toBe('3d');
    expect(shownLook('3d', 'An egg is always drawn in 2D.')).toBe('2d');
    expect(shownLook('2d', null)).toBe('2d');
  });

  it('the 3D card says why there is no model: an egg first, then the Blobbi\'s own reason, then the browser; nothing when there is one', () => {
    expect(previewNote3d({ name: 'Pip', stage: 'egg' }, null, true)).toBe('The 3D model is ready once Pip hatches.');
    expect(previewNote3d({ name: 'Pip', stage: 'adult' }, 'The 3D model is only for the newest Blobbi art (V3).', true)).toBe('The 3D model is only for the newest Blobbi art (V3).');
    expect(previewNote3d({ name: 'Pip', stage: 'adult' }, null, false)).toMatch(/cannot draw 3D/);
    expect(previewNote3d({ name: 'Pip', stage: 'baby' }, null, true)).toBeNull();
  });

  it('the guide follows the introduction once (the dock), moves into the sheet when the Blobbi button is tapped, and goes nowhere otherwise', () => {
    expect(guideAfterIntro(false)).toBe('dock');
    expect(guideAfterIntro(true)).toBeNull();
    expect(guideOnSheetOpen('dock')).toBe('sheet');
    expect(guideOnSheetOpen('sheet')).toBeNull();
    expect(guideOnSheetOpen(null)).toBeNull();
    expect(LOOK_GUIDE_DOCK_MS).toBeGreaterThan(LOOK_GUIDE_SHEET_MS);
    expect(LOOK_GUIDE_SHEET_MS).toBeGreaterThanOrEqual(2_000);
  });

  it('is remembered under the room\'s own key, and a storage that refuses loses nothing but the memory', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(LOOK_GUIDE_STORAGE_KEY).toMatch(/^blobbi:room:/);
    expect(readLookGuideShown(storage)).toBe(false);
    writeLookGuideShown(storage);
    expect(store.get(LOOK_GUIDE_STORAGE_KEY)).toBe('shown');
    expect(readLookGuideShown(storage)).toBe(true);
    const refusing = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    };
    expect(() => writeLookGuideShown(refusing)).not.toThrow();
    expect(readLookGuideShown(refusing)).toBe(false);
    expect(readLookGuideShown(null)).toBe(false);
  });
});
