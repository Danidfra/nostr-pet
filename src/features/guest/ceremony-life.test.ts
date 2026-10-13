import { describe, expect, it } from 'vitest';
import { PRIORITY } from '@/features/expression/controller';
import { CEREMONY_AT_REST, MOMENTS, MOVE_MS, SURPRISE_MS, momentFor, nextBlinkIn, nextIdleIn, planIdleMoment } from './ceremony-life';

describe('the ceremony Blobbi\'s moments (M14.2)', () => {
  it('watching the player type is a lasting, low-priority curiosity that "quiet" takes back; a reaction interrupts it and gives it back', () => {
    const typing = momentFor('typing');
    expect(typing.face).toBe('curious');
    expect(typing.faceMs).toBeNull();
    expect(typing.source).toBe('attention');
    expect(typing.priority).toBe(PRIORITY.life);
    expect(typing.move).toBeNull();
    const quiet = momentFor('quiet');
    expect(quiet.face).toBeNull();
    expect(quiet.source).toBe('attention');
    for (const r of ['named', 'skipped', 'advance', 'displeased'] as const) {
      expect(MOMENTS[r].priority).toBeGreaterThan(typing.priority);
      expect(MOMENTS[r].faceMs).toBeGreaterThan(0);
      expect(MOMENTS[r].source).toBe('reaction');
    }
  });

  it('a step passed is a joyful hop with a few hearts; the account made is the bigger celebration that lasts until the scene ends', () => {
    const advance = momentFor('advance');
    expect(advance.face).toBe('excited');
    expect(advance.move).toBe('hop');
    expect(advance.effects.map((e) => e.id)).toEqual(['love-burst']);
    expect(advance.effectsMs).toBeGreaterThan(1_000);
    const complete = momentFor('complete');
    expect(complete.face).toBe('excited');
    expect(complete.faceMs).toBeNull();
    expect(complete.priority).toBeGreaterThan(advance.priority);
    expect(complete.move).toBe('cheer');
    expect(complete.effects.map((e) => e.id)).toEqual(['golden-sparkles', 'celestial-aura']);
    expect(MOVE_MS.cheer).toBeGreaterThan(MOVE_MS.hop);
  });

  it('an unfriendly word is a short surprised-then-displeased face and a flinch, never long, and a skipped step is a small easy face', () => {
    const displeased = momentFor('displeased');
    expect(displeased.face).toBe('upset');
    expect(displeased.faceMs).toBeLessThan(2_000);
    expect(SURPRISE_MS).toBeLessThan(displeased.faceMs!);
    expect(displeased.move).toBe('flinch');
    expect(displeased.effects).toEqual([]);
    const skipped = momentFor('skipped');
    expect(skipped.face).toBe('relieved');
    expect(skipped.move).toBeNull();
    expect(skipped.effects).toEqual([]);
  });

  it('left alone it glances or smiles now and then, never moves, and waits six to eleven seconds between', () => {
    const seq = (values: number[]) => {
      let i = 0;
      return () => values[i++ % values.length];
    };
    expect(planIdleMoment(seq([0.1, 0.5, 0.5, 0.5]))).toEqual({ type: 'glance', offset: { x: 0, y: 0 }, durationMs: 1_700 });
    expect(planIdleMoment(seq([0.6]))).toEqual({ type: 'face', name: 'curious', durationMs: 1_400 });
    expect(planIdleMoment(seq([0.75]))).toEqual({ type: 'face', name: 'happy', durationMs: 1_300 });
    expect(planIdleMoment(seq([0.95]))).toEqual({ type: 'rest' });
    expect(nextIdleIn(() => 0)).toBe(6_000);
    expect(nextIdleIn(() => 0.999)).toBeLessThanOrEqual(11_000);
    expect(nextBlinkIn(() => 0)).toBe(2_600);
    expect(nextBlinkIn(() => 0.999)).toBeLessThan(6_000);
  });

  it('its face at rest is glad, eyes open', () => {
    expect(CEREMONY_AT_REST).toEqual({ eyes: 'open', mouth: 'smile', brows: 'neutral', blush: 'soft' });
  });
});
