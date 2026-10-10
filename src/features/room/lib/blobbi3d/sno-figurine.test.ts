/**
 * The SNO proof of concept: a figurine in the room's furniture format, from
 * the same morphology, deterministic, in the same units as the real model.
 */
import { describe, expect, it } from 'vitest';
import { deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { buildSnoFigurine } from './sno-figurine';

describe('buildSnoFigurine', () => {
  it('builds a solid SNO payload from the morphology, the same every time', () => {
    const m = deriveMorphology(generateGenome('lab-1'), 'adult');
    const a = buildSnoFigurine(m);
    const b = buildSnoFigurine(m);
    expect(a.payload.v).toBe(2);
    expect(a.payload.mode).toBe('solid');
    expect(a.faces).toBeGreaterThan(100);
    expect(JSON.stringify(a.payload)).toBe(JSON.stringify(b.payload));
    const hex = (rgb: number[]) => `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    const colours = a.payload.palette.map(hex);
    expect(colours).toContain(m.palette.bodyMid);
    expect(colours).toContain(m.palette.footLight);
    expect(a.object.children.length).toBeGreaterThan(0);
  });
});
