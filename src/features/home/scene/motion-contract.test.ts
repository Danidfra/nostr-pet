import { describe, expect, it } from 'vitest';
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
