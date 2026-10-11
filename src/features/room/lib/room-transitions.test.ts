/**
 * The room-change director and its scenes, without a renderer: the choice
 * (spectacle for a first visit, brisk otherwise, the gag only now and then,
 * nothing when hurried or under reduced motion), and the scenes' promises:
 * finite every moment, the room swapped inside the scene, the Blobbi ending
 * on the floor of the new room where it was going with its body at rest,
 * the jump leaving the view at its top, the gag's fall leaving it at the
 * bottom and its drop arriving from above, the look at the player held,
 * the walls covering it only while it is behind them.
 */
import { describe, expect, it } from 'vitest';
import { choreograph, chooseTransition, GAG_COOLDOWN, TRANSITION_KINDS, type TransitionContext, type TransitionKind } from './room-transitions';
import { ROOM_GRID } from './room-geometry';

const ctx = (): TransitionContext => ({ from: { x: 3.5, z: 4.5 }, to: { x: 5.5, z: 2.5 }, skyFrom: 9, skyTo: 10 });
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('choosing a transition', () => {
  const base = { firstVisit: false, reducedMotion: false, rapid: false, canAct: true, history: [] as TransitionKind[], random: () => 0.9 };
  it('reduced motion, or a Blobbi that cannot take part: no scene at all; a hurried player: the quick one', () => {
    expect(chooseTransition({ ...base, reducedMotion: true, firstVisit: true })).toBe('fade');
    expect(chooseTransition({ ...base, canAct: false })).toBe('fade');
    expect(chooseTransition({ ...base, rapid: true, firstVisit: true })).toBe('quick');
  });
  it('a first visit is a spectacle (the big jump, or watching from outside), never the same twice running', () => {
    expect(chooseTransition({ ...base, firstVisit: true, random: () => 0.1 })).toBe('big-jump');
    expect(chooseTransition({ ...base, firstVisit: true, random: () => 0.9 })).toBe('outside');
    expect(chooseTransition({ ...base, firstVisit: true, random: () => 0.1, history: ['big-jump'] })).toBe('outside');
  });
  it('a return is mostly quick, sometimes behind the wall (never twice running), rarely the gag (never within its cooldown)', () => {
    expect(chooseTransition({ ...base })).toBe('quick');
    expect(chooseTransition({ ...base, random: () => 0.2 })).toBe('behind-wall');
    expect(chooseTransition({ ...base, random: () => 0.2, history: ['behind-wall'] })).toBe('quick');
    expect(chooseTransition({ ...base, random: () => 0.05, history: ['quick', 'quick'] })).toBe('floor-gag');
    const recent: TransitionKind[] = ['floor-gag', ...Array(GAG_COOLDOWN - 2).fill('quick')];
    expect(chooseTransition({ ...base, random: () => 0.05, history: recent })).not.toBe('floor-gag');
    // Over many returns, the gag stays occasional
    const history: TransitionKind[] = [];
    const random = seq(...Array.from({ length: 97 }, (_, i) => ((i * 37) % 97) / 97));
    for (let i = 0; i < 200; i++) history.push(chooseTransition({ ...base, random, history }));
    expect(history.filter((k) => k === 'floor-gag').length).toBeLessThanOrEqual(200 / GAG_COOLDOWN);
    expect(history.filter((k) => k === 'quick').length).toBeGreaterThan(100);
  });
});

describe('the scenes', () => {
  it.each(TRANSITION_KINDS)('%s: finite at every moment, swaps the room inside itself, and ends with the Blobbi on the new room\'s floor where it was going, at rest', (kind) => {
    const c = ctx();
    const scene = choreograph(kind, c);
    expect(scene.swapAtMs).toBeGreaterThanOrEqual(0);
    expect(scene.swapAtMs).toBeLessThanOrEqual(scene.durationMs);
    for (let t = 0; t <= scene.durationMs; t += 20) {
      const f = scene.frame(t, c);
      if (f.at) for (const v of [f.at.x, f.at.z, f.at.elev]) expect(Number.isFinite(v)).toBe(true);
      if (f.pose) for (const v of Object.values(f.pose)) expect(Number.isFinite(v)).toBe(true);
    }
    const end = scene.frame(scene.durationMs, c);
    if (end.at) {
      expect(end.at.x).toBeCloseTo(c.to.x, 6);
      expect(end.at.z).toBeCloseTo(c.to.z, 6);
      expect(end.at.elev).toBe(0);
    }
    expect(end.walking).toBe(false);
    expect(end.wallsCover).toBe(false);
    if (end.pose) {
      expect(end.pose.sx).toBeCloseTo(1, 1);
      expect(end.pose.sy).toBeCloseTo(1, 1);
    }
    // Ordinary changes stay quick; the theatre is longer but bounded
    if (kind === 'quick') expect(scene.durationMs).toBeLessThanOrEqual(600);
    expect(scene.durationMs).toBeLessThan(7000);
  });

  it('the big jump crouches first, leaves the top of the view, swaps the room while it is up there, and lands squashed', () => {
    const c = ctx();
    const s = choreograph('big-jump', c);
    expect(s.frame(150, c).pose!.sy).toBeLessThan(0.9);
    const peak = Math.max(...Array.from({ length: 100 }, (_, i) => s.frame((i / 100) * s.durationMs, c).at?.elev ?? 0));
    expect(peak).toBeGreaterThan(Math.max(c.skyFrom, c.skyTo));
    expect(s.frame(s.swapAtMs, c).at!.elev).toBeGreaterThan(0.5);
    expect(s.intro).toBe('build');
    expect(s.cues.map((q) => q.cue)).toEqual(['crouch', 'jump', 'land', 'happy']);
  });

  it('the invisible floor: out past the edge, a look down, a held look at the player, a fall out of the bottom, and a drop from above the top', () => {
    const c = ctx();
    const s = choreograph('floor-gag', c);
    const frames = Array.from({ length: 300 }, (_, i) => ({ t: (i / 300) * s.durationMs, f: s.frame((i / 300) * s.durationMs, c) }));
    // Standing past the edge of the floor, on nothing
    expect(frames.some(({ f }) => f.at && f.at.elev === 0 && (f.at.x > ROOM_GRID || f.at.z > ROOM_GRID))).toBe(true);
    // Looks down, then holds the player's eye, worried, for a good half second
    expect(frames.some(({ f }) => (f.gaze?.y ?? 0) > 0.9)).toBe(true);
    const held = frames.filter(({ f }) => f.face === 'worried' && f.gaze && Math.abs(f.gaze.y) < 0.1);
    expect(held.length * (s.durationMs / 300)).toBeGreaterThan(450);
    // Falls well below the floor before the room changes; comes down from above the top of the view after
    const beforeSwap = frames.filter(({ t }) => t < s.swapAtMs).map(({ f }) => f.at?.elev ?? 0);
    expect(Math.min(...beforeSwap)).toBeLessThan(-3);
    const afterSwap = frames.filter(({ t }) => t > s.swapAtMs).map(({ f }) => f.at?.elev ?? 0);
    expect(Math.max(...afterSwap)).toBeGreaterThan(c.skyTo);
    expect(s.cues.map((q) => q.cue)).toEqual(['surprise', 'fall', 'land', 'happy']);
  });

  it('behind the wall: the walls cover it only while it is behind one, and the room changes while it is out of sight', () => {
    const c = ctx();
    const s = choreograph('behind-wall', c);
    for (let t = 0; t <= s.durationMs; t += 10) {
      const f = s.frame(t, c);
      if (f.wallsCover) expect(f.at!.x < 0 || f.at!.z < 0).toBe(true);
    }
    expect(s.frame(s.swapAtMs, c).wallsCover).toBe(true);
    expect(s.durationMs).toBeLessThan(2400);
  });

  it('outside the room: off the floor\'s edge, turned to watch the room build, and back in', () => {
    const c = ctx();
    const s = choreograph('outside', c);
    const at = s.frame(s.swapAtMs, c).at!;
    expect(at.x > ROOM_GRID || at.z > ROOM_GRID).toBe(true);
    expect(s.intro).toBe('build');
  });
});
