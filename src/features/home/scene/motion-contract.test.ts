import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOBBI_MOTION_PHASES, BLOBBI_MOTION_STYLESHEET, blobbiMotionPhase } from '@blobbi-kit/renderer';
import { RENDERER_WALK_CYCLE_S } from './motion-contract';

describe('the renderer motion contract', () => {
  it('pins the walk cycle the shadow follows to the cycle the renderer animates', () => {
    const match = BLOBBI_MOTION_STYLESHEET.match(/blobbi-motion-walk\s+([\d.]+)s/);
    expect(match, 'the renderer stylesheet names its walk animation and duration').not.toBeNull();
    expect(Number(match![1])).toBe(RENDERER_WALK_CYCLE_S);
  });

  it('the renderer offsets the walk by --blobbi-motion-phase, a fraction of the cycle per instance', () => {
    expect(BLOBBI_MOTION_STYLESHEET).toContain('animation-delay:calc(var(--blobbi-motion-phase,0) * -');
    expect(BLOBBI_MOTION_STYLESHEET).toContain(`[data-blobbi-motion-phase="${BLOBBI_MOTION_PHASES - 1}"]{--blobbi-motion-phase:${(BLOBBI_MOTION_PHASES - 1) / BLOBBI_MOTION_PHASES};}`);
    const phase = blobbiMotionPhase('home-blobbi-aaaaaaaaaaaa-0000000001');
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(BLOBBI_MOTION_PHASES);
  });
});

describe('the shadow follows the gait the renderer draws', () => {
  const css = readFileSync(join(__dirname, '..', '..', '..', 'index.css'), 'utf8');

  it('the renderer has two walks on one cycle: the V1 bob and the V2 gait, and the home names no leg part', () => {
    expect(BLOBBI_MOTION_STYLESHEET).toContain('@keyframes blobbi-motion-walk-v2');
    expect(BLOBBI_MOTION_STYLESHEET).toContain('[data-blobbi-generation="v2"] [data-blobbi-motion="walking"] [data-part="left-leg"]');
    const v2Leg = BLOBBI_MOTION_STYLESHEET.match(/\[data-part="near-leg"\]\{animation:blobbi-motion-stride-near\s+([\d.]+)s/);
    expect(Number(v2Leg![1])).toBe(RENDERER_WALK_CYCLE_S);
    expect(css).not.toMatch(/data-part/);
  });

  it('the home keys the V2 walking shadow to the same clock, settling instead of pulsing, and never transforms the Blobbi itself', () => {
    expect(css).toContain(".scene-actor[data-motion='walking'][data-generation='v2'] .scene-actor__shadow");
    const rule = css.slice(css.indexOf(".scene-actor[data-motion='walking'][data-generation='v2']"));
    expect(rule).toMatch(/animation-name: actor-shadow-step/);
    expect(css).toMatch(/@keyframes actor-shadow-step \{[\s\S]*?scale\(0\.96, 0\.94\)/);
    // The generic walking rule sets the duration from the actor's --walk-cycle; the V2 rule changes only the shape.
    expect(css).toContain("animation: actor-shadow-walk calc(var(--walk-cycle, 0.56s) / 2)");
    expect(css).not.toMatch(/\.scene-actor\[data-motion='walking'\] \.scene-actor__box\s*\{/);
  });
});
