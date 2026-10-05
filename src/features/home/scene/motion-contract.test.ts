import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOBBI_MOTION_PHASES, BLOBBI_MOTION_STYLESHEET, blobbiMotionPhase } from '@blobbi-kit/renderer';
import { RENDERER_V3_WALK_CYCLE_S, RENDERER_WALK_CYCLE_S, TRAVEL_PER_WALK_CYCLE, apparentTravelPerCycle, travelPerCycleFor, walkCycleFor, walkSpeedFor } from './motion-contract';
import { DEPTH_WEIGHT, FLOOR_DEPTH, placeOnFloor } from './geometry';
import { DEFAULT_WALK_SPEED, beginWalk, standingAt, stepLocomotion } from './locomotion';
import { ROOM_ASPECT } from '../space/room-space';

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

describe('one walk cycle covers a set amount of ground', () => {
  const STAGES = ['baby', 'adult'] as const;
  const GENERATIONS = ['v1', 'v2', 'v3'] as const;

  it('the pace is the travel per cycle over the cycle the renderer plays: never a speed chosen on its own', () => {
    for (const generation of GENERATIONS) {
      for (const stage of STAGES) {
        const travel = travelPerCycleFor(stage, generation);
        expect(travel).toBe(TRAVEL_PER_WALK_CYCLE[generation][stage]);
        expect(walkSpeedFor(stage, generation)).toBeCloseTo(travel / walkCycleFor(generation), 12);
        // In one cycle of its animation it covers exactly its travel.
        expect(walkSpeedFor(stage, generation) * walkCycleFor(generation)).toBeCloseTo(travel, 12);
      }
    }
    // A V3 Blobbi walks on a cycle of its own, and its travel is stated for that cycle.
    expect(walkCycleFor('v3')).toBe(RENDERER_V3_WALK_CYCLE_S);
    expect(walkCycleFor('v1')).toBe(RENDERER_WALK_CYCLE_S);
    expect(walkCycleFor('v2')).toBe(RENDERER_WALK_CYCLE_S);
  });

  it('keeps the walk that already read right in profile: 0.28 floor widths a second, for every stage and generation', () => {
    for (const generation of GENERATIONS) for (const stage of STAGES) expect(walkSpeedFor(stage, generation), `${generation} ${stage}`).toBeCloseTo(DEFAULT_WALK_SPEED, 2);
  });

  it('an unknown stage or generation walks as the oldest artwork does, never faster', () => {
    expect(walkSpeedFor('egg', 'v9')).toBe(walkSpeedFor('baby', 'v1'));
    expect(travelPerCycleFor('adult', '')).toBe(TRAVEL_PER_WALK_CYCLE.v1.adult);
  });

  it('what a view changes is how the same ground LOOKS: all of it in profile, foreshortened up and down the floor', () => {
    for (const generation of GENERATIONS) {
      for (const stage of STAGES) {
        const side = apparentTravelPerCycle(stage, generation, 'side');
        const front = apparentTravelPerCycle(stage, generation, 'front');
        const back = apparentTravelPerCycle(stage, generation, 'back');
        expect(side).toBe(travelPerCycleFor(stage, generation));
        expect(front).toBe(back);
        expect(front).toBeCloseTo((side * DEPTH_WEIGHT) / FLOOR_DEPTH, 12);
        // A walk toward or away from the viewer moves about a third as far on screen per cycle as one across:
        // it was the same distance on screen before, which is what made the body slide down the floor.
        expect(front / side).toBeGreaterThan(0.25);
        expect(front / side).toBeLessThan(0.4);
      }
    }
  });

  it('measured on the floor: one cycle of walking moves the Blobbi its travel, across the room and up or down it alike', () => {
    for (const generation of GENERATIONS) {
      for (const stage of STAGES) {
        const speed = walkSpeedFor(stage, generation);
        const cycle = walkCycleFor(generation);
        const from = standingAt({ x: 0.5, y: 0.45 });
        const after = (to: { x: number; y: number }) => stepLocomotion(beginWalk(from, to, 'user'), cycle, speed).state.position;
        const travel = travelPerCycleFor(stage, generation);
        expect(after({ x: 0.9, y: 0.45 }).x - 0.5).toBeCloseTo(travel, 9);
        expect(0.5 - after({ x: 0.1, y: 0.45 }).x).toBeCloseTo(travel, 9);
        expect((after({ x: 0.5, y: 0.82 }).y - 0.45) * FLOOR_DEPTH).toBeCloseTo(travel, 9);
        expect((0.45 - after({ x: 0.5, y: 0.05 }).y) * FLOOR_DEPTH).toBeCloseTo(travel, 9);
        // On screen that depthwise cycle is the foreshortened distance, in scene widths.
        const screenDrop = placeOnFloor(after({ x: 0.5, y: 0.82 }));
        const screenFrom = placeOnFloor(from.position);
        const scenes = ((parseFloat(screenDrop.top) - parseFloat(screenFrom.top)) / 100) * (1 / ROOM_ASPECT);
        expect(scenes).toBeCloseTo(apparentTravelPerCycle(stage, generation, 'front'), 2);
      }
    }
  });
});
