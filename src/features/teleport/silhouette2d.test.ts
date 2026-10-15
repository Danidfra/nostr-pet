/**
 * An outline as rows, and rows as a closed path (M15 care: the bath's
 * effects clipped to the body). No canvas: the plain blob's silhouette.
 */
import { describe, expect, it } from 'vitest';
import { BLOB_SILHOUETTE } from './particles';
import { outlineRows, rowsPath } from './silhouette2d';

describe('outlineRows', () => {
  it('gives one row per height, feet to top, each with the body’s edges there in box x', () => {
    const rows = outlineRows({ silhouette: BLOB_SILHOUETTE, bottom: 0.1, top: 0.9 }, 8);
    // The blob comes to a point at its very top (no span there): seven of the eight heights have one
    expect(rows.length).toBe(7);
    expect(rows[0].y).toBeCloseTo(0.1);
    expect(rows[rows.length - 1].y).toBeCloseTo(0.1 + (6 / 7) * 0.8);
    for (let i = 1; i < rows.length; i++) expect(rows[i].y).toBeGreaterThan(rows[i - 1].y);
    for (const r of rows) {
      expect(r.left).toBeLessThan(r.right);
      // The blob is symmetric about the box's middle
      expect(r.left + r.right).toBeCloseTo(1, 5);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(1);
    }
    // The blob is widest below its middle and narrows toward the top
    const widths = rows.map((r) => r.right - r.left);
    expect(Math.max(...widths)).toBeGreaterThan(widths[widths.length - 1]);
  });

  it('skips a height with no span and gives nothing for a body too thin for a row', () => {
    const none = { span: () => null };
    expect(outlineRows({ silhouette: none, bottom: 0.1, top: 0.9 }, 6)).toEqual([]);
    const half = { span: (h: number) => (h < 0.5 ? { left: -0.2, right: 0.2 } : null) };
    expect(outlineRows({ silhouette: half, bottom: 0, top: 1 }, 6).length).toBe(3);
  });
});

describe('rowsPath', () => {
  it('closes a rounded path through the rows in the 100 × 100 viewBox, y down, grown by the pad', () => {
    const rows = outlineRows({ silhouette: BLOB_SILHOUETTE, bottom: 0.1, top: 0.9 }, 6);
    const d = rowsPath(rows, 0.02);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect((d.match(/ C /g) ?? []).length).toBe(rows.length * 2 + 2);
    // Every point of the path lies in the box (the pad is small), the feet near the bottom, the top near the top
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = numbers.filter((_v, i) => i % 2 === 1);
    // (the spline rounds the ends and may overshoot a touch)
    expect(Math.max(...ys)).toBeLessThanOrEqual(94);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(8);
    // Grown: the padded path's rightmost x is further right than the plain one's
    const plain = rowsPath(rows, 0).match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_v, i) => i % 2 === 0);
    const padded = numbers.filter((_v, i) => i % 2 === 0);
    expect(Math.max(...padded)).toBeGreaterThan(Math.max(...plain));
  });

  it('is empty for fewer than two rows, and the same for the same rows in any order', () => {
    expect(rowsPath([], 0)).toBe('');
    expect(rowsPath([{ y: 0.5, left: 0.3, right: 0.7 }], 0)).toBe('');
    const a = [{ y: 0.2, left: 0.3, right: 0.7 }, { y: 0.8, left: 0.4, right: 0.6 }];
    expect(rowsPath([a[1], a[0]], 0)).toBe(rowsPath(a, 0));
  });
});
