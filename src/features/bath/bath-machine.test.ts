/**
 * The care rituals' machine, rule by rule: the stage list walked in order,
 * each passed by its own rule and never by a tap; only visible body cells
 * count, as booleans, exactly what is drawn; the last few cells finish
 * themselves; the brush and the shower's column measured in px on a small
 * Blobbi; the shower reaching from above the head; nothing rubbed before
 * the outline is known; the one write after the last stage, a retry the
 * player's only, a cancel at any step with nothing committed; a landed wet
 * ritual shaking itself dry; and no input mutated.
 */
import { describe, expect, it } from 'vitest';
import {
  BATH_GRID,
  BATH_RULES,
  brushRadius,
  cellCenter,
  cellIndex,
  columnHalfWidth,
  createBath,
  currentStage,
  defaultMask,
  frameSource,
  guidanceFor,
  headFor,
  reduce,
  strokeSamples,
  toolFor,
  type BathEvent,
  type BathPoint,
  type BathState,
} from './bath-machine';
import { frameFromState, foamedCount } from './bath-frame';
import { RITUALS, type RitualDef } from './rituals';
import type { CancelReason } from '@/features/room/lib/room-interaction';

const FULL = new Array<boolean>(BATH_GRID * BATH_GRID).fill(true);

function run(state: BathState, events: BathEvent[]): BathState {
  return events.reduce(reduce, state);
}

/** A ritual begun and ready to rub (the outline known), optionally measured on screen. */
function begun(ritual: RitualDef = RITUALS.soap, body: readonly boolean[] = FULL, box?: { w: number; h: number }): BathState {
  let s = createBath(ritual, body);
  s = reduce(s, { type: 'begin' });
  s = reduce(s, { type: 'mask', body });
  if (box) s = reduce(s, { type: 'measure', box });
  return s;
}

/** A drag from one box point to another in a few moves. */
function drag(from: BathPoint, to: BathPoint, moves = 8): BathEvent[] {
  const events: BathEvent[] = [{ type: 'pointer-down', point: from }];
  for (let i = 1; i <= moves; i++) {
    const t = i / moves;
    events.push({ type: 'pointer-move', point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } });
  }
  events.push({ type: 'pointer-up' });
  return events;
}

/** Vertical strokes across the whole box, one per column. */
function strokesEverywhere(): BathEvent[] {
  const out: BathEvent[] = [];
  for (let col = 0; col < BATH_GRID; col++) out.push(...drag({ x: (col + 0.5) / BATH_GRID, y: 0.02 }, { x: (col + 0.5) / BATH_GRID, y: 0.98 }, 16));
  return out;
}

/** The shower held at a point for a while. */
function hold(at: BathPoint, ms: number, tick = 50): BathEvent[] {
  const events: BathEvent[] = [{ type: 'pointer-down', point: at }];
  for (let t = 0; t < ms; t += tick) events.push({ type: 'tick', dtMs: tick });
  events.push({ type: 'pointer-up' });
  return events;
}

const count = (values: readonly boolean[]) => values.filter(Boolean).length;

describe('the stage list', () => {
  it('a wash is lather then rinse then the write; a towel one dry-rub; a soak jump in, play, jump out', () => {
    expect(RITUALS.soap.stages.map((s) => [s.id, s.kind])).toEqual([['lather', 'rub'], ['rinse', 'rinse']]);
    expect(RITUALS.towel.stages.map((s) => [s.id, s.kind])).toEqual([['dry', 'dry-rub']]);
    expect(RITUALS.soak.stages.map((s) => [s.id, s.kind])).toEqual([['jump-in', 'script'], ['play', 'timed'], ['jump-out', 'script']]);
  });

  it('begin enters the first stage; the tool is the stage’s', () => {
    const s = begun();
    expect(s.status).toBe('stage');
    expect(currentStage(s)?.id).toBe('lather');
    expect(toolFor(s)).toBe('soap');
  });

  it('a wash played end to end: lather, rinse, then committing with one attempt; landed, the shake, then dry and done', () => {
    let s = run(begun(), strokesEverywhere());
    expect(currentStage(s)?.id).toBe('rinse');
    for (let i = 0; i < 30 && s.status === 'stage'; i++) s = run(s, hold({ x: ((i % 8) + 0.5) / 8, y: 0.9 }, 600));
    expect(s.status).toBe('committing');
    expect(s.attempts).toBe(1);
    expect(s.completed).toEqual(['lather', 'rinse']);
    expect(s.cues.map((c) => c.kind)).toEqual(['rinse']);
    s = reduce(s, { type: 'landed' });
    expect(s.status).toBe('done');
    expect(s.cues.map((c) => c.kind)).toEqual(['rinse', 'shake']);
    expect(s.wetness).toBe(1);
    s = reduce(s, { type: 'shaken' });
    expect(s.wetness).toBe(0);
    expect(count(s.wet)).toBe(0);
    expect(s.cues.map((c) => c.kind)).toEqual(['rinse', 'shake', 'done']);
    expect(new Set(s.cues.map((c) => c.id)).size).toBe(3);
  });

  it('a towel: dry-rubbed to the write; dry all over; landed straight to done (it was never wet: no shake)', () => {
    let s = run(begun(RITUALS.towel), strokesEverywhere());
    expect(s.status).toBe('committing');
    expect(count(s.dry)).toBe(count(s.visible));
    s = reduce(s, { type: 'landed' });
    expect(s.cues.map((c) => c.kind)).toEqual(['done']);
  });

  it('a soak: the script stages pass only by script-done, the play by time; wet from the jump in; the write only after the jump out', () => {
    let s = begun(RITUALS.soak);
    expect(currentStage(s)?.id).toBe('jump-in');
    // Time and the pointer do nothing to a script stage
    s = run(s, [{ type: 'tick', dtMs: 5_000 }, ...drag({ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 })]);
    expect(currentStage(s)?.id).toBe('jump-in');
    s = reduce(s, { type: 'script-done' });
    expect(currentStage(s)?.id).toBe('play');
    expect(s.wetness).toBe(1);
    expect(s.cues.map((c) => c.kind)).toEqual(['splash-in']);
    // The play passes with time, and only with time
    s = run(s, drag({ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }));
    expect(s.progress).toBe(0);
    for (let t = 0; t < RITUALS.soak.stages[1].durationMs! - 100; t += 100) s = reduce(s, { type: 'tick', dtMs: 100 });
    expect(currentStage(s)?.id).toBe('play');
    s = reduce(s, { type: 'tick', dtMs: 200 });
    expect(currentStage(s)?.id).toBe('jump-out');
    // Still in the water: no write yet
    expect(s.status).toBe('stage');
    expect(s.attempts).toBe(0);
    s = reduce(s, { type: 'script-done' });
    expect(s.status).toBe('committing');
    expect(s.cues.map((c) => c.kind)).toEqual(['splash-in', 'splash-out']);
    s = reduce(s, { type: 'landed' });
    // The shake follows the landed write, never before it
    expect(s.cues.map((c) => c.kind)).toEqual(['splash-in', 'splash-out', 'shake']);
  });

  it('the shake is never cued without a landed write: a failed write leaves the Blobbi wet, no shake, until a retry lands', () => {
    let s = begun(RITUALS.soak);
    s = run(s, [{ type: 'script-done' }, { type: 'tick', dtMs: 10_000 }, { type: 'script-done' }, { type: 'failed', error: 'offline' }]);
    expect(s.status).toBe('failed');
    expect(s.cues.some((c) => c.kind === 'shake')).toBe(false);
    s = run(s, [{ type: 'retry' }, { type: 'landed' }]);
    expect(s.cues[s.cues.length - 1].kind).toBe('shake');
    expect(s.attempts).toBe(2);
  });
});

describe('coverage, never a tap', () => {
  it('a press, or a press that moves within a tap’s slop, lays nothing', () => {
    let s = begun();
    s = run(s, [{ type: 'pointer-down', point: { x: 0.5, y: 0.5 } }, { type: 'pointer-move', point: { x: 0.504, y: 0.5 } }, { type: 'pointer-up' }]);
    expect(count(s.foamed)).toBe(0);
    expect(s.progress).toBe(0);
  });

  it('the slop is measured in px on screen: a 4 px wobble on a 34 px Blobbi is still a tap', () => {
    let s = begun(RITUALS.soap, FULL, { w: 34, h: 34 });
    s = run(s, [{ type: 'pointer-down', point: { x: 0.5, y: 0.5 } }, { type: 'pointer-move', point: { x: 0.5 + 4 / 34, y: 0.5 } }, { type: 'pointer-up' }]);
    expect(count(s.foamed)).toBe(0);
  });

  it('nothing is rubbed before the outline is known (a pointer waits for the mask)', () => {
    let s = reduce(createBath(RITUALS.soap, FULL), { type: 'begin' });
    expect(s.maskReady).toBe(false);
    s = run(s, drag({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }));
    expect(count(s.foamed)).toBe(0);
    s = reduce(s, { type: 'mask', body: FULL });
    s = run(s, drag({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }));
    expect(count(s.foamed)).toBeGreaterThan(0);
  });

  it('the mask arrives once: a later one is ignored (what was laid is never thrown away)', () => {
    let s = run(begun(), drag({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }));
    const laid = count(s.foamed);
    s = reduce(s, { type: 'mask', body: defaultMask() });
    expect(count(s.foamed)).toBe(laid);
    expect(s.body).toBe(FULL);
  });

  it('scribbling in one spot saturates it and goes no further', () => {
    let s = begun();
    for (let i = 0; i < 20; i++) s = run(s, drag({ x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }));
    expect(s.status).toBe('stage');
    expect(currentStage(s)?.id).toBe('lather');
    expect(s.progress).toBeLessThan(BATH_RULES.rubDone);
  });

  it('foam is laid on visible body cells only', () => {
    const body = defaultMask();
    let s = createBath(RITUALS.soap, body);
    s = run(s, [{ type: 'begin', hiddenBelow: 0.4 }, { type: 'mask', body }]);
    s = run(s, drag({ x: 0, y: 0.05 }, { x: 1, y: 0.95 }, 30));
    s.foamed.forEach((f, i) => {
      if (f) expect(s.visible[i]).toBe(true);
    });
    // The hidden rows are not body the player can reach: never visible, never counted
    for (let i = 0; i < body.length; i++) if (cellCenter(BATH_GRID, i).y < 0.4) expect(s.visible[i]).toBe(false);
  });

  it('the stage passes at the share (about three quarters) and the rest of the lather finishes itself', () => {
    let s = begun();
    let before = s;
    for (const e of strokesEverywhere()) {
      before = s;
      s = reduce(s, e);
      if (s.stageIndex !== before.stageIndex) break;
    }
    expect(currentStage(s)?.id).toBe('rinse');
    const share = count(before.foamed) / count(before.visible);
    const left = count(before.visible) - count(before.foamed);
    // It passed on the stroke that reached the share, or with only the last few cells left
    expect(share >= 0.6 || left <= BATH_RULES.autoFinish + 20).toBe(true);
    // Every visible cell is foamed now: what is drawn is all of it
    expect(count(s.foamed)).toBe(count(s.visible));
  });

  it('the last two cells finish themselves (no hunt for a cell nobody can find)', () => {
    let s = begun();
    // Foam everything but the two corner cells, by hand
    const foamed = s.visible.map((_v, i) => i !== 0 && i !== 63);
    s = { ...s, foamed };
    s = run(s, drag({ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 }));
    expect(currentStage(s)?.id).toBe('rinse');
    expect(count(s.foamed)).toBe(64);
  });
});

describe('the brush and the shower, measured on screen', () => {
  it('the brush is never under 24 px across: on a 34 px Blobbi it reaches 12 px round the finger', () => {
    const s = begun(RITUALS.soap, FULL, { w: 34, h: 34 });
    const { rx, ry } = brushRadius(s);
    expect(rx * 34).toBeGreaterThanOrEqual(11.99);
    expect(ry * 34).toBeGreaterThanOrEqual(11.99);
    // Bigger on a big Blobbi (a cell's worth)
    const big = begun(RITUALS.soap, FULL, { w: 160, h: 160 });
    expect(brushRadius(big).rx * 160).toBeCloseTo(20, 5);
  });

  it('one stroke across a 34 px Blobbi lathers a band at least 22 px tall', () => {
    let s = begun(RITUALS.soap, FULL, { w: 34, h: 34 });
    s = run(s, drag({ x: 0.05, y: 0.5 }, { x: 0.95, y: 0.5 }, 12));
    const rows = new Set<number>();
    s.foamed.forEach((f, i) => f && rows.add(Math.floor(i / BATH_GRID)));
    expect(rows.size * (34 / BATH_GRID)).toBeGreaterThanOrEqual(22 * 0.75);
    expect(rows.size).toBeGreaterThanOrEqual(5);
  });

  it('the shower’s column is never under 18 px across', () => {
    const s = begun(RITUALS.soap, FULL, { w: 34, h: 34 });
    expect(columnHalfWidth(s) * 2 * 34).toBeGreaterThanOrEqual(18);
    const big = begun(RITUALS.soap, FULL, { w: 160, h: 160 });
    expect(columnHalfWidth(big)).toBe(BATH_RULES.columnHalf);
  });

  it('the shower’s head is a little above the finger', () => {
    let s = run(begun(RITUALS.soap, FULL, { w: 100, h: 100 }), strokesEverywhere());
    expect(toolFor(s)).toBe('shower');
    s = reduce(s, { type: 'pointer-down', point: { x: 0.5, y: 0.5 } });
    expect(headFor(s, s.pointer)!.y).toBeCloseTo(0.5 + BATH_RULES.showerLiftPx / 100, 5);
    expect(frameSource(s).head!.y).toBeCloseTo(0.76, 5);
  });

  it('held well above the head the shower still rinses (the top row too, the finger nowhere near the face)', () => {
    let s = run(begun(RITUALS.soap, FULL, { w: 40, h: 40 }), strokesEverywhere());
    const top = cellIndex(BATH_GRID, 4, BATH_GRID - 1);
    expect(s.foamed[top]).toBe(true);
    // The finger just above the box: the head higher still (above the finger), the face uncovered
    s = run(s, hold({ x: (4 + 0.5) / BATH_GRID, y: 1.05 }, 500));
    expect(s.foamed[top]).toBe(false);
    expect(s.wet[top]).toBe(true);
  });

  it('a finger still down when the lather passes goes on as the shower: no new press needed, and lifting it still ends the stroke', () => {
    // One long press that zigzags over the whole body until the lather passes, then simply stays down
    let s = begun(RITUALS.soap, FULL, { w: 40, h: 40 });
    s = reduce(s, { type: 'pointer-down', point: { x: 0.06, y: 0.02 } });
    for (let col = 0; col < BATH_GRID && currentStage(s)?.kind === 'rub'; col++) {
      for (let k = 0; k <= 16 && currentStage(s)?.kind === 'rub'; k++) {
        const y = col % 2 === 0 ? 0.02 + 0.96 * (k / 16) : 0.98 - 0.96 * (k / 16);
        s = reduce(s, { type: 'pointer-move', point: { x: (col + 0.5) / BATH_GRID, y } });
      }
    }
    expect(currentStage(s)?.kind).toBe('rinse');
    expect(s.pointer).not.toBeNull();
    expect(s.stroke).not.toBeNull();
    // Held over the head with no new press: the water runs
    s = reduce(s, { type: 'pointer-move', point: { x: 0.5, y: 1.05 } });
    const before = count(s.foamed);
    s = run(s, Array.from({ length: 20 }, () => ({ type: 'tick', dtMs: 50 }) as BathEvent));
    expect(count(s.foamed)).toBeLessThan(before);
    s = reduce(s, { type: 'pointer-up' });
    expect(s.stroke).toBeNull();
    const after = count(s.foamed);
    s = run(s, Array.from({ length: 20 }, () => ({ type: 'tick', dtMs: 50 }) as BathEvent));
    expect(count(s.foamed)).toBe(after);
  });

  it('on a 34 px Blobbi a finger anywhere in the margin above the box still rinses (the reach covers the lift and the margin)', () => {
    let s = run(begun(RITUALS.soap, FULL, { w: 34, h: 34 }), strokesEverywhere());
    const top = cellIndex(BATH_GRID, 4, BATH_GRID - 1);
    // The finger at the top of the margin: 24 px above the box; its head 26 px higher still
    s = run(s, hold({ x: (4 + 0.5) / BATH_GRID, y: 1 + 24 / 34 }, 600));
    expect(s.foamed[top]).toBe(false);
  });

  it('too far above (more than about 0.8 box over the body) the water no longer reaches', () => {
    let s = run(begun(RITUALS.soap, FULL, { w: 40, h: 40 }), strokesEverywhere());
    const before = count(s.foamed);
    s = run(s, hold({ x: 0.5, y: 3 }, 1_000));
    expect(count(s.foamed)).toBe(before);
  });

  it('a cell under the middle of the column rinses in about a third of a second, and not before', () => {
    let s = run(begun(RITUALS.soap, FULL, { w: 160, h: 160 }), strokesEverywhere());
    const i = cellIndex(BATH_GRID, 3, 3);
    const x = cellCenter(BATH_GRID, i).x;
    s = run(s, hold({ x, y: 0.6 }, 300));
    expect(s.foamed[i]).toBe(true);
    s = run(s, hold({ x, y: 0.6 }, 100));
    expect(s.foamed[i]).toBe(false);
  });

  it('the shower works with time, never by moving it alone; a tap rinses nothing', () => {
    let s = run(begun(), strokesEverywhere());
    const before = count(s.foamed);
    s = run(s, [{ type: 'pointer-down', point: { x: 0.2, y: 0.9 } }, ...[0.3, 0.5, 0.7, 0.9].map((x) => ({ type: 'pointer-move' as const, point: { x, y: 0.9 } })), { type: 'pointer-up' }]);
    expect(count(s.foamed)).toBe(before);
  });

  it('the rinse passes at about 0.85 and washes off the rest, the whole body wet', () => {
    let s = run(begun(), strokesEverywhere());
    for (let i = 0; i < 40 && s.status === 'stage'; i++) s = run(s, hold({ x: ((i % 8) + 0.5) / 8, y: 0.9 }, 300));
    expect(s.status).toBe('committing');
    expect(count(s.foamed)).toBe(0);
    expect(count(s.wet)).toBe(count(s.body));
  });
});

describe('the write and the ways out', () => {
  it('nothing reaches committing before the last stage; a retry only after a failure, the player’s, counted', () => {
    let s = run(begun(RITUALS.towel), strokesEverywhere());
    expect(s.status).toBe('committing');
    expect(reduce(s, { type: 'retry' })).toBe(s);
    s = reduce(s, { type: 'failed', error: 'no relay' });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('no relay');
    s = reduce(s, { type: 'retry' });
    expect(s.status).toBe('committing');
    expect(s.attempts).toBe(2);
  });

  it('a cancel is refused while the write is out (the session holds it) and after the end', () => {
    const committing = run(begun(RITUALS.towel), strokesEverywhere());
    expect(reduce(committing, { type: 'cancel', reason: 'stopped' })).toBe(committing);
    const done = reduce(committing, { type: 'landed' });
    expect(reduce(done, { type: 'cancel', reason: 'stopped' })).toBe(done);
  });

  const reasons: CancelReason[] = ['stopped', 'room', 'teleport', 'hidden', 'unmount'];
  for (const ritual of [RITUALS.soap, RITUALS.shampoo, RITUALS.towel, RITUALS.soak]) {
    it(`${ritual.style}: a cancel at every stage ends it with no attempt and nothing committed`, () => {
      for (let index = 0; index < ritual.stages.length; index++) {
        let s = begun(ritual);
        // Walk to the stage
        for (let k = 0; k < index; k++) {
          const stage = currentStage(s)!;
          if (stage.kind === 'script') s = reduce(s, { type: 'script-done' });
          else if (stage.kind === 'timed') s = reduce(s, { type: 'tick', dtMs: 60_000 });
          else if (stage.kind === 'rinse') for (let i = 0; i < 40 && currentStage(s)?.kind === 'rinse'; i++) s = run(s, hold({ x: ((i % 8) + 0.5) / 8, y: 0.9 }, 300));
          else s = run(s, strokesEverywhere());
        }
        expect(currentStage(s)?.id).toBe(ritual.stages[index].id);
        const reason = reasons[index % reasons.length];
        const cancelled = reduce(s, { type: 'cancel', reason });
        expect(cancelled.status).toBe('cancelled');
        expect(cancelled.reason).toBe(reason);
        expect(cancelled.attempts).toBe(0);
        // Nothing moves a cancelled ritual on
        expect(run(cancelled, [{ type: 'landed' }, { type: 'retry' }, { type: 'script-done' }, { type: 'tick', dtMs: 9_999 }]).status).toBe('cancelled');
      }
    });
  }

  it('a failed write can be cancelled (Stop), and nothing was committed', () => {
    const failed = run(begun(RITUALS.towel), [...strokesEverywhere(), { type: 'failed', error: 'x' }]);
    expect(reduce(failed, { type: 'cancel', reason: 'stopped' }).status).toBe('cancelled');
  });
});

describe('purity and the words', () => {
  it('reduce mutates nothing', () => {
    const s = begun();
    const frozen = JSON.stringify(s);
    run(s, [...strokesEverywhere(), ...hold({ x: 0.5, y: 0.9 }, 400), { type: 'cancel', reason: 'stopped' }]);
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('strokeSamples steps a third of a cell and includes the end', () => {
    const samples = strokeSamples({ x: 0, y: 0 }, { x: 0.5, y: 0 });
    expect(samples.length).toBe(Math.floor(0.5 / BATH_RULES.sampleStep));
    expect(samples[samples.length - 1]).toEqual({ x: 0.5, y: 0 });
    expect(strokeSamples({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 })).toEqual([]);
  });

  it('the guidance names the Blobbi and the tool, by the ritual', () => {
    expect(guidanceFor(begun(RITUALS.soap), 'Lupa')).toBe('Rub the soap all over Lupa.');
    expect(guidanceFor(begun(RITUALS.shampoo), 'Lupa')).toBe('Rub the shampoo all over Lupa.');
    expect(guidanceFor(begun(RITUALS.towel), 'Lupa')).toContain('soft towel');
    expect(guidanceFor(begun(RITUALS.soak), 'Lupa')).toContain('bubbles');
  });

  it('drawn equals counted: the frame’s foamed cells are the machine’s, and the progress is made of the same count', () => {
    let s = begun(RITUALS.soap, FULL, { w: 34, h: 34 });
    s = run(s, drag({ x: 0.1, y: 0.3 }, { x: 0.9, y: 0.3 }));
    const frame = frameFromState(frameSource(s), { key: 1, ritual: s.ritual, outline: { bottom: 0.08, top: 0.92 }, reducedMotion: false });
    expect(foamedCount(frame)).toBe(count(s.foamed));
    expect(s.progress).toBeCloseTo(foamedCount(frame) / count(s.visible), 5);
  });
});
