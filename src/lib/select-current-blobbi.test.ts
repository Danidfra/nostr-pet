import { describe, expect, it } from 'vitest';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { selectCurrentBlobbi } from './select-current-blobbi';

function companion(petId: string, lastInteraction: number, name = 'Pet'): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(blobbiEvent(petId, { name, set: { last_interaction: String(lastInteraction) } }));
  if (!parsed) throw new Error('fixture must be modern');
  return parsed;
}

const OLD = companion('0000000001', 1_000, 'Old');
const NEW = companion('0000000002', 2_000, 'New');
const MID = companion('0000000003', 1_500, 'Mid');

describe('selectCurrentBlobbi', () => {
  it('selects nothing from an empty collection', () => {
    expect(selectCurrentBlobbi([])).toBeUndefined();
    expect(selectCurrentBlobbi([], ['blobbi-anything'])).toBeUndefined();
  });

  it('selects the only Blobbi naturally, whatever the preferences say', () => {
    expect(selectCurrentBlobbi([OLD])).toBe(OLD);
    expect(selectCurrentBlobbi([OLD], ['not-owned'])).toBe(OLD);
  });

  it('prefers the first preference that names an owned Blobbi', () => {
    expect(selectCurrentBlobbi([OLD, NEW, MID], [undefined, MID.d])).toBe(MID);
    expect(selectCurrentBlobbi([OLD, NEW, MID], ['not-owned', OLD.d, NEW.d])).toBe(OLD);
  });

  it('falls back to the most recently cared-for Blobbi', () => {
    expect(selectCurrentBlobbi([OLD, NEW, MID])).toBe(NEW);
    expect(selectCurrentBlobbi([OLD, MID, NEW], ['not-owned'])).toBe(NEW);
  });

  it('breaks a last-interaction tie by d-tag so the pick is stable', () => {
    const a = companion('0000000009', 5_000, 'A');
    const b = companion('0000000008', 5_000, 'B');
    expect(selectCurrentBlobbi([a, b])).toBe(b);
    expect(selectCurrentBlobbi([b, a])).toBe(b);
  });

  it('does not mutate the collection', () => {
    const list = [OLD, NEW, MID];
    selectCurrentBlobbi(list);
    expect(list).toEqual([OLD, NEW, MID]);
  });
});
