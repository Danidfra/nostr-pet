/**
 * The body's shape from the frame alone (M15 care, the 2D effects): the
 * rows, the columns' ends, the streams and the drops are read off the cells
 * and the outline, never guessed beside them.
 */
import { describe, expect, it } from 'vitest';
import { BATH_GRID } from '../bath-machine';
import { bodyCells, BODY, makeFrame } from '@/test/bath-frames';
import { maskFromOutline } from '../body-mask';
import { outlineRows, rowsPath } from '@/features/teleport/silhouette2d';
import { bodyColumns, bodyPath, FOAM_EDGE_MARGIN, insideOutline, columnSpan, OUTLINE_CLIP_ROWS, dropletPlans, EDGE_INSET, isDry, isWetNotDry, landingUnder, rowsOf, shapePath, streamPlans } from './body-shape';

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

describe('bodyPath (the clip: the drawing’s own outline when it is the one the cells came from)', () => {
  // A pear: narrow head, wide bottom, so its edge is nothing like the cells' 8 rounded rows
  const pear = {
    silhouette: { span: (h: number) => { const half = 0.12 + 0.26 * (1 - h) * Math.sqrt(Math.max(0, 1 - ((h - 0.5) / 0.52) ** 2)); return { left: -half, right: half }; } },
    bottom: 0.1,
    top: 0.88,
  };
  const shapeFor = (outline: typeof pear) => {
    const body = maskFromOutline(outline, BATH_GRID);
    return { grid: BATH_GRID, cells: body.map((b) => ({ body: b, visible: b, foamed: false, wet: false, dry: false })), outline: { bottom: outline.bottom, top: outline.top } };
  };

  it('follows the drawing’s edge, finer than the cells, when the outline gives exactly the frame’s body cells', () => {
    const shape = shapeFor(pear);
    const d = bodyPath(shape, pear);
    expect(d).toBe(rowsPath(outlineRows(pear, OUTLINE_CLIP_ROWS)));
    expect(d).not.toBe(shapePath(shape, undefined, 0));
  });

  it('keeps the cells when there is no outline, or one the cells were not read from (the plain body stood in)', () => {
    const shape = shapeFor(pear);
    expect(bodyPath(shape)).toBe(shapePath(shape, undefined, 0));
    const tiny = { ...pear, silhouette: { span: () => ({ left: -0.01, right: 0.01 }) } };
    expect(bodyPath(shape, tiny)).toBe(shapePath(shape, undefined, 0));
    expect(bodyPath(frame, pear)).toBe(shapePath(frame, undefined, 0));
  });

  it('keeps an edge cell’s bubble just inside the drawing’s edge, and leaves a cell well inside where it is', () => {
    const height = pear.top - pear.bottom;
    for (const [i, body] of maskFromOutline(pear, BATH_GRID).entries()) {
      if (!body) continue;
      const at = { x: ((i % BATH_GRID) + 0.5) / BATH_GRID, y: (Math.floor(i / BATH_GRID) + 0.5) / BATH_GRID };
      const p = insideOutline(at, pear);
      const span = pear.silhouette.span((p.y - pear.bottom) / height);
      expect(p.x).toBeGreaterThanOrEqual(span.left + 0.5 + FOAM_EDGE_MARGIN - 1e-9);
      expect(p.x).toBeLessThanOrEqual(span.right + 0.5 - FOAM_EDGE_MARGIN + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(pear.bottom + FOAM_EDGE_MARGIN - 1e-9);
      expect(p.y).toBeLessThanOrEqual(pear.top - FOAM_EDGE_MARGIN + 1e-9);
    }
    expect(insideOutline({ x: 0.5, y: 0.45 }, pear)).toEqual({ x: 0.5, y: 0.45 });
  });
});
