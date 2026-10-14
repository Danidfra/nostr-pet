/**
 * The bath machine's rules, pinned: no stage passes on a tap, each passes by
 * covering the body, the shower works with time under its head, the write
 * is reached only after the last stage, a cancel never reaches the write,
 * a retry is the player's and counted, and a write on its way is not cancelled.
 */
import { describe, expect, it } from 'vitest';
import { BATH_GRID, BATH_RULES, cellCenter, createBath, defaultMask, guidanceFor, isBathActive, reduce, strokeSamples, toolFor, type BathPoint, type BathState } from './bath-machine';

const fresh = (inPlace = false): BathState => reduce(createBath(defaultMask()), { type: 'begin', inPlace });
const inTub = (): BathState => reduce(fresh(), { type: 'entered' });

/** A drag from `a` to `b` in one move. */
const drag = (s: BathState, a: BathPoint, b: BathPoint): BathState => {
  let next = reduce(s, { type: 'pointer-down', point: a });
  next = reduce(next, { type: 'pointer-move', point: b });
  return reduce(next, { type: 'pointer-up' });
};

/** Rub the whole body: vertical strokes across the box, until the stage passes. */
function rubAll(s: BathState, maxStrokes = 40): BathState {
  let next = s;
  const start = next.status;
  for (let i = 0; i < maxStrokes && next.status === start; i++) {
    const x = ((i % 6) + 0.5) / 6;
    next = drag(next, { x, y: 0.05 }, { x, y: 0.95 });
  }
  return next;
}

/** Hold the shower in columns across the body until the stage passes. */
function showerAll(s: BathState, maxColumns = 20): BathState {
  let next = s;
  for (let i = 0; i < maxColumns && next.status === 'rinse'; i++) {
    const x = ((i % 7) + 0.5) / 7;
    next = reduce(next, { type: 'pointer-down', point: { x, y: 0.98 } });
    for (let t = 0; t < 20 && next.status === 'rinse'; t++) next = reduce(next, { type: 'tick', dtMs: 50 });
    next = reduce(next, { type: 'pointer-up' });
  }
  return next;
}

const body = (s: BathState) => s.mask.filter(Boolean).length;
const foamed = (s: BathState) => s.foam.filter((v, i) => s.mask[i] && v > 0).length;

describe('the body grid', () => {
  it('is 8 by 8 with an egg-ish body in the middle, row 0 at the bottom, and a mask must fit it', () => {
    const mask = defaultMask();
    expect(mask).toHaveLength(BATH_GRID * BATH_GRID);
    expect(body(createBath(mask))).toBeGreaterThan(20);
    expect(body(createBath(mask))).toBeLessThan(50);
    // The corners are air, the middle is body
    expect(mask[0]).toBe(false);
    expect(mask[BATH_GRID * BATH_GRID - 1]).toBe(false);
    expect(mask[4 * BATH_GRID + 4]).toBe(true);
    expect(cellCenter(BATH_GRID, 0)).toEqual({ x: 0.5 / 8, y: 0.5 / 8 });
    expect(() => createBath([true])).toThrow(/64 cells/);
  });

  it('a stroke is sampled every third of a cell; a stroke of no length lays no samples', () => {
    expect(strokeSamples({ x: 0.5, y: 0 }, { x: 0.5, y: 1 })).toHaveLength(Math.floor(1 / BATH_RULES.sampleStep));
    expect(strokeSamples({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 })).toEqual([]);
    expect(strokeSamples({ x: 0, y: 0 }, { x: 0.01, y: 0 })).toHaveLength(1);
  });
});

describe('the stages', () => {
  it('begins by entering, and the soap is in hand once it is in the tub; an in-place bath skips the entering', () => {
    const s = fresh();
    expect(s.status).toBe('entering');
    expect(toolFor(s.status)).toBeNull();
    expect(inTub().status).toBe('soap');
    expect(toolFor('soap')).toBe('soap');
    expect(fresh(true).status).toBe('soap');
    expect(fresh(true).completed).toEqual(['entering']);
    // Only an idle machine begins
    expect(reduce(inTub(), { type: 'begin' }).status).toBe('soap');
  });

  it('a tap lays no foam and passes nothing; pressing before the tub is entered does nothing', () => {
    const pressedEarly = reduce(fresh(), { type: 'pointer-down', point: { x: 0.5, y: 0.5 } });
    expect(pressedEarly.stroke).toBeNull();
    let s = inTub();
    s = reduce(s, { type: 'pointer-down', point: { x: 0.5, y: 0.5 } });
    s = reduce(s, { type: 'pointer-up' });
    expect(foamed(s)).toBe(0);
    expect(s.progress).toBe(0);
    // A move within the tap slop is still a tap
    s = drag(s, { x: 0.5, y: 0.5 }, { x: 0.504, y: 0.5 });
    expect(foamed(s)).toBe(0);
    expect(s.status).toBe('soap');
  });

  it('dragging the soap lays foam where it went, only on the body, and the stage passes by covering most of it', () => {
    let s = inTub();
    s = drag(s, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
    expect(foamed(s)).toBeGreaterThan(0);
    expect(foamed(s)).toBeLessThan(body(s));
    // Nothing off the body
    expect(s.foam.some((v, i) => !s.mask[i] && v > 0)).toBe(false);
    expect(s.progress).toBeGreaterThan(0);
    expect(s.progress).toBeLessThan(BATH_RULES.soapDone);
    expect(s.status).toBe('soap');
    // Scribbling in one spot saturates it and goes no further
    for (let i = 0; i < 20; i++) s = drag(s, { x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 });
    expect(s.status).toBe('soap');
    const stuck = s.progress;
    s = drag(s, { x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 });
    expect(s.progress).toBe(stuck);
    s = rubAll(s);
    expect(s.status).toBe('rinse');
    expect(s.completed).toEqual(['entering', 'soap']);
    expect(s.progress).toBe(0);
    // Into the water: everything is wet, and the foam is what there is to rinse
    expect(s.wet.filter((v, i) => s.mask[i] && v === 1).length).toBe(body(s));
    expect(s.startAmount).toBeGreaterThan(0);
  });

  it('the shower rinses with time under its head, moving it only aims it, and the stage passes once nearly all the foam is gone', () => {
    let s = rubAll(inTub());
    expect(s.status).toBe('rinse');
    const before = s.foam.reduce((a, b) => a + b, 0);
    // A drag alone takes nothing off
    s = drag(s, { x: 0.2, y: 0.9 }, { x: 0.8, y: 0.9 });
    expect(s.foam.reduce((a, b) => a + b, 0)).toBe(before);
    // Held: the column under it washes off, elsewhere stays
    s = reduce(s, { type: 'pointer-down', point: { x: 0.5, y: 0.95 } });
    s = reduce(s, { type: 'tick', dtMs: 300 });
    const after = s.foam.reduce((a, b) => a + b, 0);
    expect(after).toBeLessThan(before);
    const far = s.foam.filter((_v, i) => s.mask[i] && Math.abs(cellCenter(s.grid, i).x - 0.5) > 0.15);
    expect(far.some((v) => v > 0)).toBe(true);
    // Released: time does nothing
    s = reduce(s, { type: 'pointer-up' });
    s = reduce(s, { type: 'tick', dtMs: 1000 });
    expect(s.foam.reduce((a, b) => a + b, 0)).toBe(after);
    s = showerAll(s);
    expect(s.status).toBe('dry');
    expect(s.foam.every((v) => v === 0)).toBe(true);
    expect(s.completed).toEqual(['entering', 'soap', 'rinse']);
  });

  it('the towel dries where it is rubbed, and the last stage passes into the write with the body dry', () => {
    let s = showerAll(rubAll(inTub()));
    expect(s.status).toBe('dry');
    const wetBefore = s.wet.reduce((a, b) => a + b, 0);
    s = drag(s, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
    expect(s.wet.reduce((a, b) => a + b, 0)).toBeLessThan(wetBefore);
    expect(s.status).toBe('dry');
    s = rubAll(s);
    expect(s.status).toBe('committing');
    expect(s.attempts).toBe(1);
    expect(s.progress).toBe(1);
    expect(s.completed).toEqual(['entering', 'soap', 'rinse', 'dry']);
    // Only the write's own events move it on
    expect(reduce(s, { type: 'pointer-down', point: { x: 0.5, y: 0.5 } }).stroke).toBeNull();
    expect(reduce(s, { type: 'cancel', reason: 'stopped' }).status).toBe('committing');
    expect(reduce(s, { type: 'landed' }).status).toBe('done');
    expect(isBathActive(reduce(s, { type: 'landed' }).status)).toBe(false);
  });

  it('a failed write waits for Retry, counted; nothing retries by itself; a failed bath can be stopped', () => {
    const committing = rubAll(showerAll(rubAll(inTub())));
    const failed = reduce(committing, { type: 'failed', error: 'The relays refused it.' });
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('The relays refused it.');
    expect(isBathActive(failed.status)).toBe(true);
    expect(reduce(failed, { type: 'tick', dtMs: 5000 })).toBe(failed);
    const again = reduce(failed, { type: 'retry' });
    expect(again.status).toBe('committing');
    expect(again.attempts).toBe(2);
    expect(again.error).toBeNull();
    expect(reduce(failed, { type: 'cancel', reason: 'stopped' }).status).toBe('cancelled');
    // A retry is only for a failed write
    expect(reduce(committing, { type: 'retry' }).attempts).toBe(1);
  });

  it('a cancel at any stage before the write ends the bath, with its reason, and nothing was committed', () => {
    for (const s of [fresh(), inTub(), rubAll(inTub()), showerAll(rubAll(inTub()))]) {
      const ended = reduce(s, { type: 'cancel', reason: 'room' });
      expect(ended.status).toBe('cancelled');
      expect(ended.reason).toBe('room');
      expect(ended.attempts).toBe(0);
      expect(ended.pointer).toBeNull();
    }
    // Done and cancelled are final; idle has nothing to cancel
    expect(reduce(reduce(rubAll(showerAll(rubAll(inTub()))), { type: 'landed' }), { type: 'cancel', reason: 'unmount' }).status).toBe('done');
    expect(reduce(createBath(defaultMask()), { type: 'cancel', reason: 'unmount' }).status).toBe('idle');
  });

  it('never mutates the state it is given', () => {
    const s = inTub();
    const foam = [...s.foam];
    const next = drag(s, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
    expect(s.foam).toEqual(foam);
    expect(next).not.toBe(s);
    expect(s.status).toBe('soap');
  });

  it('says what to do in a child\'s words, naming the Blobbi, with no semicolons', () => {
    for (const status of ['entering', 'soap', 'rinse', 'dry', 'committing', 'done', 'failed'] as const) {
      const line = guidanceFor(status, 'Lupa');
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toMatch(/;/);
      if (status !== 'failed') expect(line).toMatch(/Lupa/);
    }
    expect(guidanceFor('idle', 'Lupa')).toBe('');
  });
});
