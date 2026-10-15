/**
 * The ritual table: which game each cleaning item is, where it is played,
 * its stages in order, and the safe default for an item it does not know.
 */
import { describe, expect, it } from 'vitest';
import { OFFICIAL_CATALOG_SNAPSHOT } from '@/features/inventory/official-catalog-snapshot';
import { RITUALS, ritualFor, stageAt } from './rituals';

describe('ritualFor', () => {
  it('Soap and Shampoo are a wash in place (the same game, their own look); Soft Towel a towelling in place; Bubble Bath the soak in the tub', () => {
    expect(ritualFor('blobbi:hygiene:soap')).toMatchObject({ id: 'wash', style: 'soap', place: 'in-place' });
    expect(ritualFor('blobbi:hygiene:shampoo')).toMatchObject({ id: 'wash', style: 'shampoo', place: 'in-place' });
    expect(ritualFor('blobbi:hygiene:soft-towel')).toMatchObject({ id: 'towel', style: 'towel', place: 'in-place' });
    expect(ritualFor('blobbi:hygiene:bubble-bath')).toMatchObject({ id: 'soak', style: 'bubbles', place: 'tub' });
    expect(ritualFor('blobbi:hygiene:shampoo').stages.map((s) => s.kind)).toEqual(ritualFor('blobbi:hygiene:soap').stages.map((s) => s.kind));
  });

  it('any other cleaning item (unknown, future, missing) is the plain wash in place: the safe default', () => {
    for (const d of ['blobbi:hygiene:sponge', '', null, undefined]) expect(ritualFor(d)).toBe(RITUALS.soap);
  });

  it('every official cleaning item has a ritual of its own; only the soak goes to the tub', () => {
    const cleaning = OFFICIAL_CATALOG_SNAPSHOT.filter((i) => i.action === 'clean');
    expect(cleaning.map((i) => i.d).sort()).toEqual(['blobbi:hygiene:bubble-bath', 'blobbi:hygiene:shampoo', 'blobbi:hygiene:soap', 'blobbi:hygiene:soft-towel']);
    for (const item of cleaning) expect(ritualFor(item.d).place === 'tub').toBe(item.d === 'blobbi:hygiene:bubble-bath');
  });

  it('the stages a renderer and the bar read: tools, guidance, the play’s length', () => {
    expect(RITUALS.soap.stages.map((s) => s.tool)).toEqual(['soap', 'shower']);
    expect(RITUALS.towel.stages.map((s) => s.tool)).toEqual(['towel']);
    expect(RITUALS.soak.stages.map((s) => s.tool)).toEqual([null, null, null]);
    expect(RITUALS.soak.stages[1].durationMs).toBeGreaterThan(2_000);
    for (const r of Object.values(RITUALS)) for (const s of r.stages) expect(s.guidance('Lupa')).toContain('Lupa');
    expect(stageAt(RITUALS.soap, 2)).toBeNull();
    expect(stageAt(RITUALS.soap, -1)).toBeNull();
  });
});
