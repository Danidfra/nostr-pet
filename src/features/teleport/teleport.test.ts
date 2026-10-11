/**
 * The teleport core, renderer-free: the choreography goes the right way
 * (leaving dissolves top-down with motes rising; arriving forms bottom-up
 * with motes falling onto the forming edge), the face concentrates and then
 * is relieved, the squash is continuous, and the presence controller keeps
 * journeys single, reversible without a pop, cancellable, silent after
 * disposal, and quick and particle-free under reduced motion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARRIVE, CUES, DEPART, REDUCED, arriveCutAt, departCutAt, journeyDuration, journeyFrame } from './timeline';
import { BLOB_SILHOUETTE, MOTE_COUNT, motesAt } from './particles';
import { createPresenceController } from './presence';
import { outlineFromAlpha } from './silhouette2d';

describe('the choreography', () => {
  it('leaving: gathers (eyes shut, squeezed, glowing), then dissolves from the top down, then is gone', () => {
    const gather = journeyFrame('depart', DEPART.gather * 0.9);
    expect(gather).toMatchObject({ phase: 'gather', cut: 1, eyesClosed: true, face: 'concentrate' });
    expect(gather.sy).toBeLessThan(1);
    expect(gather.sx).toBeGreaterThan(1);
    expect(gather.glow).toBeGreaterThan(0.3);
    const cuts = [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => journeyFrame('depart', DEPART.gather + k * (DEPART.dissolve - DEPART.gather)).cut);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]).toBeLessThan(cuts[i - 1]);
    expect(journeyFrame('depart', DEPART.dissolve + 10)).toMatchObject({ phase: 'gone', cut: 0 });
    expect(journeyFrame('depart', DEPART.total + 1)).toMatchObject({ phase: 'done', cut: 0 });
  });

  it('arriving: motes come down first, then it forms from the bottom up with its eyes shut, holds, and opens them relieved', () => {
    expect(journeyFrame('arrive', ARRIVE.incoming * 0.5)).toMatchObject({ phase: 'incoming', cut: 0, eyesClosed: true });
    const cuts = [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => journeyFrame('arrive', ARRIVE.incoming + k * (ARRIVE.form - ARRIVE.incoming)).cut);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]).toBeGreaterThan(cuts[i - 1]);
    expect(journeyFrame('arrive', (ARRIVE.form + ARRIVE.hold) / 2)).toMatchObject({ phase: 'hold', cut: 1, eyesClosed: true, face: 'concentrate' });
    expect(journeyFrame('arrive', ARRIVE.hold + 50)).toMatchObject({ phase: 'open', cut: 1, eyesClosed: false, face: 'relieved' });
    // The "ta-da" cue is when the eyes open
    expect(CUES.arrive.find((c) => c.cue === 'tada')?.at).toBe(ARRIVE.hold);
  });

  it('the squash is continuous where gathering hands over to dissolving: no jump in the body', () => {
    const before = journeyFrame('depart', DEPART.gather - 1);
    const after = journeyFrame('depart', DEPART.gather + 1);
    expect(Math.abs(before.sy - after.sy)).toBeLessThan(0.01);
    expect(Math.abs(before.sx - after.sx)).toBeLessThan(0.01);
  });

  it('under reduced motion: a short fade each way, no motes, no squash; the eyes still close and open', () => {
    expect(journeyDuration('depart', true)).toBe(REDUCED.total);
    const mid = journeyFrame('depart', REDUCED.total / 2, true);
    expect(mid.motes).toBe(false);
    expect(mid.sx).toBe(1);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.eyesClosed).toBe(true);
    expect(journeyFrame('arrive', REDUCED.total + 1, true)).toMatchObject({ opacity: 1, face: 'relieved', eyesClosed: false });
  });
});

describe('the motes', () => {
  it('leaving, they are born on the dissolving edge and rise above it', () => {
    const t = DEPART.gather + (DEPART.dissolve - DEPART.gather) * 0.5;
    const cut = departCutAt(t);
    const motes = motesAt('depart', t, BLOB_SILHOUETTE);
    expect(motes.length).toBeGreaterThan(5);
    expect(motes.length).toBeLessThanOrEqual(MOTE_COUNT);
    // Every mote is at or above the edge's height minus a sliver: they go up from where the body is coming apart
    for (const m of motes) expect(m.y).toBeGreaterThanOrEqual(cut - 0.05);
    // And later, the same motes are higher
    const later = motesAt('depart', t + 150, BLOB_SILHOUETTE);
    const avg = (ms: { y: number }[]) => ms.reduce((a, m) => a + m.y, 0) / ms.length;
    expect(avg(later)).toBeGreaterThan(avg(motes) - 0.02);
  });

  it('arriving, they come down from above onto the forming edge, never below it', () => {
    const t = ARRIVE.incoming + (ARRIVE.form - ARRIVE.incoming) * 0.5;
    const cut = arriveCutAt(t);
    const motes = motesAt('arrive', t, BLOB_SILHOUETTE);
    expect(motes.length).toBeGreaterThan(5);
    for (const m of motes) expect(m.y).toBeGreaterThanOrEqual(cut - 1e-9);
    // Falling: the same moment a little later, the airborne ones are lower
    const high = motes.filter((m) => m.y > cut + 0.3);
    expect(high.length).toBeGreaterThan(0);
  });

  it('are drawn the same however often a moment is drawn (no randomness at draw time)', () => {
    expect(motesAt('depart', 1234, BLOB_SILHOUETTE)).toEqual(motesAt('depart', 1234, BLOB_SILHOUETTE));
  });

  it('read a drawing\'s outline from its pixels: the feet, the top, its width per height, its colour', () => {
    const size = 10;
    const data = new Uint8ClampedArray(size * size * 4);
    // A shape from row 2 to row 8, columns 3..6 (wider at the bottom), coloured (200, 100, 50)
    for (let y = 2; y <= 8; y++) for (let x = y > 5 ? 2 : 3; x <= (y > 5 ? 7 : 6); x++) data.set([200, 100, 50, 255], (y * size + x) * 4);
    const outline = outlineFromAlpha(data, size)!;
    expect(outline.bottom).toBeCloseTo(1 - 9 / 10, 6);
    expect(outline.top).toBeCloseTo(1 - 2 / 10, 6);
    expect(outline.tint).toBe('rgb(200, 100, 50)');
    const feet = outline.silhouette.span(0)!;
    const head = outline.silhouette.span(1)!;
    expect(feet.right - feet.left).toBeGreaterThan(head.right - head.left);
    expect(outlineFromAlpha(new Uint8ClampedArray(size * size * 4), size)).toBeNull();
  });
});

describe('the presence controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (over: Parameters<typeof createPresenceController>[0] = {}) => {
    const cues: string[] = [];
    const completed: string[] = [];
    const controller = createPresenceController({ clock: () => Date.now(), onCue: (c) => cues.push(c), onComplete: (s) => completed.push(s), ...over });
    return { controller, cues, completed };
  };

  it('leaves and arrives, each journey once, ending where it should, with its cues on time', () => {
    const { controller, cues, completed } = make();
    expect(controller.getState()).toBe('present');
    expect(controller.enter()).toBe(false);
    expect(controller.leave()).toBe(true);
    expect(controller.getState()).toBe('departing');
    expect(controller.leave()).toBe(false);
    vi.advanceTimersByTime(DEPART.total + 1);
    expect(controller.getState()).toBe('absent');
    expect(controller.leave()).toBe(false);
    expect(controller.enter()).toBe(true);
    vi.advanceTimersByTime(ARRIVE.total + 1);
    expect(controller.getState()).toBe('present');
    expect(cues).toEqual(['gather', 'rise', 'descend', 'tada']);
    expect(completed).toEqual(['absent', 'present']);
  });

  it('turned back mid-departure, it comes back from exactly what is still there; mid-arrival, it leaves from what has formed', () => {
    const { controller } = make();
    controller.leave();
    const t = DEPART.gather + (DEPART.dissolve - DEPART.gather) * 0.4;
    vi.advanceTimersByTime(t);
    const visible = departCutAt(t);
    controller.enter();
    expect(controller.getState()).toBe('arriving');
    const back = journeyFrame('arrive', controller.elapsed()!);
    expect(back.cut).toBeCloseTo(visible, 2);
    // and the other way
    vi.advanceTimersByTime(200);
    const formed = journeyFrame('arrive', controller.elapsed()!).cut;
    controller.leave();
    expect(journeyFrame('depart', controller.elapsed()!).cut).toBeCloseTo(formed, 2);
  });

  it('rapid triggers never stack journeys, and cancel ends any journey at once, present', () => {
    const { controller, completed } = make();
    for (let i = 0; i < 10; i++) {
      controller.leave();
      controller.enter();
    }
    controller.cancel();
    expect(controller.getState()).toBe('present');
    expect(controller.snapshot().journey).toBeNull();
    vi.advanceTimersByTime(10_000);
    // Nothing left over fires: the journeys that were replaced or cancelled never complete
    expect(completed).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('once disposed, nothing fires and nothing starts', () => {
    const { controller, cues, completed } = make();
    controller.leave();
    controller.dispose();
    vi.advanceTimersByTime(10_000);
    expect(cues).toEqual([]);
    expect(completed).toEqual([]);
    expect(controller.enter()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('under reduced motion each journey is the short fade, with only its key cue', () => {
    const { controller, cues } = make({ reducedMotion: () => true });
    controller.leave();
    expect(controller.snapshot().journey?.reduced).toBe(true);
    vi.advanceTimersByTime(REDUCED.total + 1);
    expect(controller.getState()).toBe('absent');
    controller.enter();
    vi.advanceTimersByTime(REDUCED.total + 1);
    expect(controller.getState()).toBe('present');
    expect(cues).toEqual(['rise', 'tada']);
  });

  it('completes on timers, not animation frames: a hidden tab still finishes its journey', () => {
    const { controller } = make();
    controller.leave();
    // No animation frame ever runs here
    vi.advanceTimersByTime(DEPART.total + 1);
    expect(controller.getState()).toBe('absent');
  });
});
