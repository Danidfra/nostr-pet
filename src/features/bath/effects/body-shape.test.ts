/**
 * The body's shape from the frame alone (M15 care, the 2D effects): the
 * rows, the columns' ends, the streams and the drops are read off the cells
 * and the outline, never guessed beside them.
 */
import { describe, expect, it } from 'vitest';
import { BATH_GRID } from '../bath-machine';
import { bodyCells, BODY, makeFrame } from '@/test/bath-frames';
import { bodyColumns, columnSpan, dropletPlans, EDGE_INSET, isDry, isWetNotDry, landingUnder, rowsOf, shapePath, streamPlans } from './body-shape';

const frame = makeFrame();
const rowHas = (row: number) => BODY.slice(row * BATH_GRID, (row + 1) * BATH_GRID).some(Boolean);

describe('rowsOf', () => {
  it('one row per grid row with a body cell, from the leftmost cell to the rightmost, drawn in from their outer edges', () => {
    const rows = rowsOf(frame);
    const bodyRows = Array.from({ length: BATH_GRID }, (_v, r) => r).filter(rowHas);
    expect(rows.length).toBe(bodyRows.length);
    rows.forEach((row, k) => {
      const r = bodyRows[k];
      const cols = Array.from({ length: BATH_GRID }, (_v, c) => c).filter((c) => BODY[r * BATH_GRID + c]);
      expect(row.left).toBeCloseTo((cols[0] + EDGE_INSET) / BATH_GRID);
      expect(row.right).toBeCloseTo((cols[cols.length - 1] + 1 - EDGE_INSET) / BATH_GRID);
    });
  });

  it('the body’s lowest row stands at the outline’s feet and its highest at the outline’s top', () => {
    const rows = rowsOf(makeFrame({ outline: { bottom: 0.03, top: 0.97 } }));
    expect(rows[0].y).toBeCloseTo(0.03);
    expect(rows[rows.length - 1].y).toBeCloseTo(0.97);
  });

  it('a part of the body (the wet cells) keeps its cells’ own bounds; none picked, no rows and no path', () => {
    const wet = makeFrame({ wet: (i, body) => body && Math.floor(i / BATH_GRID) === 3 });
    const rows = rowsOf(wet, isWetNotDry);
    expect(rows.length).toBe(1);
    expect(rows[0].y).toBeCloseTo(3.5 / BATH_GRID);
    expect(shapePath(wet, isWetNotDry).length).toBeGreaterThan(0);
    expect(rowsOf(frame, isDry)).toEqual([]);
    expect(shapePath(frame, isDry)).toBe('');
  });
});

describe('columns, streams, drops', () => {
  it('a column’s span is its lowest and highest body cell; a column beside the body has none', () => {
    const columns = bodyColumns(frame);
    expect(columns.length).toBeGreaterThan(2);
    for (const col of columns) {
      const span = columnSpan(frame, col)!;
      const rows = Array.from({ length: BATH_GRID }, (_v, r) => r).filter((r) => BODY[r * BATH_GRID + col]);
      expect(span.bottom).toBeCloseTo(rows[0] / BATH_GRID);
      expect(span.top).toBeCloseTo((rows[rows.length - 1] + 1) / BATH_GRID);
    }
    const empty = Array.from({ length: BATH_GRID }, (_v, c) => c).find((c) => !columns.includes(c));
    if (empty !== undefined) expect(columnSpan(frame, empty)).toBeNull();
  });

  it('four streams, each a path from the body’s top to its feet', () => {
    const streams = streamPlans(frame);
    expect(streams.length).toBe(4);
    for (const s of streams) {
      expect(s.d.startsWith('M ')).toBe(true);
      expect(s.length).toBeGreaterThan(20);
      const ys = s.d.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_v, i) => i % 2 === 1);
      expect(ys[0]).toBeLessThan(ys[ys.length - 1]);
    }
  });

  it('every drop starts on the body in its column, lets go where that column ends and falls to the feet; the same frame plans the same drops', () => {
    const plans = dropletPlans(frame, 6);
    expect(plans.length).toBe(6);
    for (const d of plans) {
      const col = Math.floor(d.x * BATH_GRID);
      const span = columnSpan(frame, col)!;
      expect(span).not.toBeNull();
      expect(d.start).toBeLessThanOrEqual(span.top);
      expect(d.start).toBeGreaterThan(span.bottom);
      expect(d.release).toBeGreaterThanOrEqual(d.ground);
      expect(d.release).toBeCloseTo(Math.max(span.bottom, frame.outline.bottom));
      expect(d.slideMs).toBeGreaterThan(0);
    }
    expect(dropletPlans(makeFrame(), 6)).toEqual(plans);
    expect(dropletPlans(frame, 0)).toEqual([]);
  });

  it('the shower’s drops land on the body’s top under them, nowhere beside it', () => {
    const col = bodyColumns(frame)[0];
    expect(landingUnder(frame, (col + 0.5) / BATH_GRID)).toBeCloseTo(columnSpan(frame, col)!.top);
    const first = bodyCells()[0] % BATH_GRID;
    if (first > 0) expect(landingUnder(frame, 0.01)).toBeNull();
  });
});
