/**
 * Eating's timing: food four bites and a drink two sips, one quick bite
 * under reduced motion, nothing for anything that is not eaten; each bite
 * the mouth open on it first, then closed, the body dipping into it.
 */
import { describe, expect, it } from 'vitest';
import { EAT, bitesFor } from './useRoomCare';
import { biteAt } from './useEatingPresentation';

describe('eating', () => {
  it('food is four bites, a drink two sips, one under reduced motion; a toy or soap is not eaten', () => {
    expect(bitesFor('feed', false)).toBe(4);
    expect(bitesFor('boost', false)).toBe(2);
    expect(bitesFor('feed', true)).toBe(1);
    expect(bitesFor('play', false)).toBe(0);
    expect(bitesFor('clean', false)).toBe(0);
  });

  it('each bite opens the mouth on it, then closes it, the dip deepest as the mouth opens wide', () => {
    for (let bite = 0; bite < EAT.food; bite++) {
      const at = bite * EAT.biteMs;
      expect(biteAt(at + 10).face).toBe('chewing');
      expect(biteAt(at + EAT.openMs + 20).face).toBe('munching');
      expect(biteAt(at + EAT.openMs - 1).dip).toBeGreaterThan(biteAt(at + 5).dip);
      expect(biteAt(at + EAT.biteMs - 1).dip).toBeLessThan(0.05);
    }
  });
});
