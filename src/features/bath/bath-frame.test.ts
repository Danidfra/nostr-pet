/**
 * The render model: what a renderer may read, made by one pure function.
 * Drawn equals counted (only visible body cells can be foamed), the stage
 * and the tool by the ritual, the progress 1 from the write on, the cues
 * as the machine played them, nothing mutated.
 */
import { describe, expect, it } from 'vitest';
import { BATH_GRID, createBath, frameSource, reduce } from './bath-machine';
import { cuesAfter, foamedCount, frameFromState, TOOL_RESTING, type FrameSource } from './bath-frame';
import { RITUALS } from './rituals';

const CELLS = BATH_GRID * BATH_GRID;
const OUTLINE = { bottom: 0.08, top: 0.92 };

function source(over: Partial<FrameSource> = {}): FrameSource {
  const none = new Array<boolean>(CELLS).fill(false);
  return { status: 'stage', stageIndex: 0, progress: 0.4, grid: BATH_GRID, body: new Array<boolean>(CELLS).fill(true), visible: new Array<boolean>(CELLS).fill(true), foamed: none, wet: none, dry: none, head: null, wetness: 0, cues: [], revision: 3, ...over };
}

describe('frameFromState', () => {
  it('the ritual, its look, its place, the stage and its tool (resting while nothing is pressed)', () => {
    const f = frameFromState(source(), { key: 7, ritual: RITUALS.shampoo, outline: OUTLINE, reducedMotion: false });
    expect(f).toMatchObject({ key: 7, ritual: 'wash', style: 'shampoo', place: 'in-place', status: 'stage', progress: 0.4, grid: BATH_GRID, revision: 3 });
    expect(f.stage).toEqual({ id: 'lather', kind: 'rub', index: 0, count: 2 });
    expect(f.tool).toEqual({ kind: 'soap', at: TOOL_RESTING.soap, pressed: false });
    const pressed = frameFromState(source({ stageIndex: 1, head: { x: 0.3, y: 1.2 } }), { key: 7, ritual: RITUALS.soap, outline: OUTLINE, reducedMotion: true });
    expect(pressed.tool).toEqual({ kind: 'shower', at: { x: 0.3, y: 1.2 }, pressed: true });
    expect(pressed.reducedMotion).toBe(true);
  });

  it('a soak played where there is no tub says so (the renderers draw no tub)', () => {
    expect(frameFromState(source(), { key: 1, ritual: RITUALS.soak, outline: OUTLINE, reducedMotion: false }).place).toBe('tub');
    expect(frameFromState(source(), { key: 1, ritual: RITUALS.soak, place: 'in-place', outline: OUTLINE, reducedMotion: false }).place).toBe('in-place');
  });

  it('only a visible body cell is drawn foamed; wet and dry only on the body', () => {
    const body = Array.from({ length: CELLS }, (_v, i) => i % 2 === 0);
    const visible = Array.from({ length: CELLS }, (_v, i) => i % 2 === 0 && i >= 16);
    const all = new Array<boolean>(CELLS).fill(true);
    const f = frameFromState(source({ body, visible, foamed: all, wet: all, dry: all }), { key: 1, ritual: RITUALS.soap, outline: OUTLINE, reducedMotion: false });
    expect(foamedCount(f)).toBe(visible.filter(Boolean).length);
    f.cells.forEach((c, i) => {
      expect(c.body).toBe(body[i]);
      expect(c.visible).toBe(visible[i]);
      expect(c.foamed).toBe(visible[i]);
      expect(c.wet).toBe(body[i]);
      expect(c.dry).toBe(body[i]);
    });
  });

  it('no stage and no tool from the write on; the progress is full', () => {
    for (const status of ['committing', 'done'] as const) {
      const f = frameFromState(source({ status, stageIndex: 2, progress: 0.2 }), { key: 1, ritual: RITUALS.soap, outline: OUTLINE, reducedMotion: false });
      expect(f.stage).toBeNull();
      expect(f.tool).toBeNull();
      expect(f.progress).toBe(1);
    }
  });

  it('the cues as the machine played them, each once by id', () => {
    let s = reduce(createBath(RITUALS.soak, new Array<boolean>(CELLS).fill(true), { ready: true }), { type: 'begin' });
    s = [{ type: 'script-done' }, { type: 'tick', dtMs: 60_000 }, { type: 'script-done' }, { type: 'landed' }, { type: 'shaken' }].reduce((a, e) => reduce(a, e as never), s);
    const f = frameFromState(frameSource(s), { key: 1, ritual: s.ritual, outline: OUTLINE, reducedMotion: false });
    expect(f.cues.map((c) => c.kind)).toEqual(['splash-in', 'splash-out', 'shake', 'done']);
    expect(cuesAfter(f, 2).map((c) => c.kind)).toEqual(['shake', 'done']);
    expect(cuesAfter(f, f.cues[f.cues.length - 1].id)).toEqual([]);
    expect(f.wetness).toBe(0);
  });

  it('pure: the source is not touched, and the same source gives an equal frame', () => {
    const src = source({ head: { x: 0.5, y: 0.5 } });
    const before = JSON.stringify(src);
    const a = frameFromState(src, { key: 1, ritual: RITUALS.soap, outline: OUTLINE, reducedMotion: false });
    const b = frameFromState(src, { key: 1, ritual: RITUALS.soap, outline: OUTLINE, reducedMotion: false });
    expect(JSON.stringify(src)).toBe(before);
    expect(a).toEqual(b);
  });
});
