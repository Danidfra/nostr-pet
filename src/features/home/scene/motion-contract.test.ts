import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOBBI_MOTION_PHASES, BLOBBI_MOTION_STYLESHEET, BLOBBI_V3_MOTION_STYLESHEET, blobbiMotionPhase, createBlobbiV3Identity, describeBlobbiArtwork, renderBlobbiSvg } from '@blobbi-kit/renderer';
import { ACTOR_BOX_WIDTH, GAITS, RENDERER_V3_WALK_CYCLE_S, RENDERER_WALK_CYCLE_S, WALK_TEMPO, apparentTravelPerCycle, gaitFor, paceFor, playedWalkCycleFor, walkCycleFor, walkTempoFor } from './motion-contract';
import { DEPTH_WEIGHT, depthScale } from './geometry';
import { DEFAULT_WALK_SPEED, beginWalk, standingAt, stepLocomotion, walkSeconds } from './locomotion';

/** A real (canonical) V3 seed: the renderer takes no other kind. */
const GAIT_SEED = '8f2d6c1e9b7a40f3a5d2c8e1b6f4937d0a1c5e7f2b9d4a6c8e0f1a3b5c7d9e2f';

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

describe('the gaits: one walk cycle covers a set amount of ground', () => {
  const STAGES = ['baby', 'adult'] as const;
  const GENERATIONS = ['v1', 'v2', 'v3'] as const;
  const css = readFileSync(join(__dirname, '..', '..', '..', 'index.css'), 'utf8');

  it('the actor\'s box is the stylesheet\'s: a stride measured in the drawing is a distance on the floor through it', () => {
    expect(css).toMatch(/\.scene-actor \{\s*width: 44%;/);
    expect(ACTOR_BOX_WIDTH).toBe(0.44);
  });

  it('the V3 adult\'s stride is the rig\'s own: a foot planted for half the cycle, carried back at a constant speed, twice a cycle', () => {
    const frames = [...BLOBBI_V3_MOTION_STYLESHEET.match(/@keyframes pb-walking-side-near-leg\{(.*)\}\n/)![1].matchAll(/([\d.]+)%\{transform:translate\(calc\(var\(--pb-scale,1\)\*(-?[\d.]+)px\),calc\(var\(--pb-scale,1\)\*(-?[\d.]+)px\)\)/g)].map((m) => ({
      at: Number(m[1]) / 100,
      x: Number(m[2]),
      y: Number(m[3]),
    }));
    expect(frames.length).toBeGreaterThan(8);
    // CONTACT: the first half of the cycle. The foot is on the ground (no lift) and goes back in a straight line.
    const planted = frames.filter((f) => f.at <= 0.5);
    for (const f of planted) expect(f.y).toBe(0);
    const [first, last] = [planted[0], planted[planted.length - 1]];
    expect(first.at).toBe(0);
    expect(last.at).toBe(0.5);
    const perCycleFraction = (first.x - last.x) / (last.at - first.at);
    for (const f of planted) expect(f.x, `at ${f.at}`).toBeCloseTo(first.x - perCycleFraction * f.at, 2);
    // SWING: the other half, lifted and brought forward.
    expect(Math.min(...frames.filter((f) => f.at > 0.5 && f.at < 1).map((f) => f.y))).toBeLessThan(-20);
    // The far leg is the same step half a cycle later, so there is always exactly one foot planted.
    expect(BLOBBI_V3_MOTION_STYLESHEET).toMatch(/@keyframes pb-walking-side-far-leg\{0%\{transform:translate\(calc\(var\(--pb-scale,1\)\*-27px\)/);
    // The drawing is as many root units square as its viewBox is tall, under the document's own scale.
    const svg = renderBlobbiSvg({ visualGeneration: 'v3', v3: createBlobbiV3Identity(GAIT_SEED), stage: 'adult', facing: 'right' }).svg;
    const scale = Number(/matrix\(([\d.]+),0,0,/.exec(svg)![1]);
    const { viewBox } = describeBlobbiArtwork({ visualGeneration: 'v3', v3: createBlobbiV3Identity(GAIT_SEED), stage: 'adult' });
    const box = Math.max(viewBox.width, viewBox.height) / scale;
    const stridePerStep = first.x - last.x;
    expect(stridePerStep).toBe(54);
    expect(box).toBeCloseTo(900, 0);
    expect(GAITS.v3.adult.stride).toBeCloseTo((2 * stridePerStep) / box, 4);
    // And its cycle is the one the home divides by.
    expect(BLOBBI_V3_MOTION_STYLESHEET).toContain(`animation:pb-walking-side-near-leg ${RENDERER_V3_WALK_CYCLE_S}s linear infinite`);
  });

  it('the V2 adult\'s stride is its stylesheet\'s: planted from the front of the step to the back, twice a cycle', () => {
    const near = BLOBBI_MOTION_STYLESHEET.match(/@keyframes blobbi-motion-stride-near\{([^@]*)\}/)![1];
    const at = (pct: number) => new RegExp(`\\b${pct}%\\{transform:translate\\((-?[\\d.]+)(?:px)?,(-?[\\d.]+)(?:px)?\\);`).exec(near)!.slice(1).map(Number);
    // Forward and lifted from 0% to 50%; planted (a touch below rest) and carried back from 50% to 100%.
    expect(at(25)[1]).toBeLessThan(0);
    expect(at(75)[1]).toBeGreaterThanOrEqual(0);
    const stridePerStep = at(50)[0] - at(100)[0];
    expect(stridePerStep).toBe(14);
    const box = describeBlobbiArtwork({ visualGeneration: 'v2', stage: 'adult', facing: 'right' }).viewBox.height;
    expect(GAITS.v2.adult.stride).toBeCloseTo((2 * stridePerStep) / box, 4);
  });

  it('across the room the floor passes under the body exactly as fast as the planted foot goes back: no slide, at any depth, at the played tempo', () => {
    for (const [stage, generation] of [['adult', 'v3'], ['adult', 'v2']] as const) {
      const gait = gaitFor(stage, generation);
      // The cycle the CSS plays: the kit's over the stage's tempo (M14.2). One played cycle covers one stride.
      const cycle = playedWalkCycleFor(stage, generation);
      expect(cycle).toBeCloseTo(walkCycleFor(generation) / walkTempoFor(stage), 12);
      for (const y of [0.05, 0.4, 0.82, 1]) {
        const pace = paceFor(stage, generation, y);
        // The actor's box at this depth, in scene widths, and the floor covered in one played cycle, in those boxes.
        const boxWidth = ACTOR_BOX_WIDTH * depthScale(y);
        const boxesPerCycle = (pace.side * cycle) / boxWidth;
        expect(boxesPerCycle, `${generation} at ${y}`).toBeCloseTo(gait.stride, 12);
      }
      // At the kit's own cycle it was a crawl (0.28 floor widths a second whatever the drawing did was three times it);
      // the tempo brings an adult to about a fifth of the floor a second: the floor's width in about four seconds.
      const atKitCycle = paceFor(stage, generation, 1).side / walkTempoFor(stage);
      expect(DEFAULT_WALK_SPEED / atKitCycle).toBeGreaterThan(2.8);
      if (generation === 'v3') {
        expect(0.8 / paceFor(stage, generation, 1).side).toBeGreaterThan(3.5);
        expect(0.8 / paceFor(stage, generation, 1).side).toBeLessThan(4.5);
      }
    }
  });

  it('the tempo (M14.2): the baby plays quicker than the adult, both well above the kit\'s cycle, and the played cycle is the kit\'s over it', () => {
    expect(WALK_TEMPO.adult).toBe(2.35);
    expect(WALK_TEMPO.baby).toBeGreaterThan(WALK_TEMPO.adult);
    expect(walkTempoFor('baby')).toBe(WALK_TEMPO.baby);
    expect(walkTempoFor('adult')).toBe(WALK_TEMPO.adult);
    expect(walkTempoFor('egg')).toBe(WALK_TEMPO.baby);
    for (const generation of GENERATIONS) for (const stage of STAGES) expect(playedWalkCycleFor(stage, generation)).toBeCloseTo(walkCycleFor(generation) / walkTempoFor(stage), 12);
    // About four hops a second for the baby, not a blur
    expect(WALK_TEMPO.baby / RENDERER_V3_WALK_CYCLE_S).toBeLessThan(5);
    expect(WALK_TEMPO.baby / RENDERER_V3_WALK_CYCLE_S).toBeGreaterThan(3.5);
    // The 2D home's stylesheet plays the kit's two walks over the same variable the actor sets
    expect(css).toMatch(/\.scene-actor \[data-blobbi-generation='v3'\]\[data-blobbi-rig-motion='walking'\] \[data-rig\] \{\s*animation-duration: calc\(0\.62s \/ var\(--walk-tempo, 1\)\) !important;/);
    expect(css).toMatch(/\.scene-actor \[data-blobbi-motion='walking'\],\s*\.scene-actor \[data-blobbi-motion='walking'\] \* \{\s*animation-duration: calc\(0\.56s \/ var\(--walk-tempo, 1\)\) !important;/);
  });

  it('a V3 baby hops a little farther per cycle than an adult steps (a hop, not a shuffle); the bobs keep the adults\' pace; nothing of theirs touches the floor', () => {
    expect(GAITS.v3.baby.stride).toBeCloseTo(0.14, 6);
    expect(GAITS.v3.baby.stride).toBeGreaterThan(GAITS.v3.adult.stride);
    expect(GAITS.v3.baby.stride / GAITS.v3.adult.stride).toBeLessThan(1.25);
    expect(GAITS.v1.baby.stride).toBe(GAITS.v1.adult.stride);
    expect(GAITS.v2.baby).toBe(GAITS.v1.baby);
    for (const generation of ['v1', 'v2'] as const) for (const stage of STAGES) expect(Math.abs(gaitFor(stage, generation).stride - 0.12)).toBeLessThan(0.005);
    // The V3 baby has no leg to plant: its walk is the hop, which has no leg keyframes at all, and lifts the body a little
    expect(BLOBBI_V3_MOTION_STYLESHEET).toContain('@keyframes pb-walking-hop-body');
    expect(BLOBBI_V3_MOTION_STYLESHEET).not.toMatch(/pb-walking-hop-(near|far|left|right)-leg/);
    // In the 2D home the baby (the same box as the adult) is quicker on the floor; the adult crosses in about four seconds
    expect(paceFor('baby', 'v3').side).toBeGreaterThan(paceFor('adult', 'v3').side);
    expect(0.8 / paceFor('baby', 'v3').side).toBeGreaterThan(2.5);
    expect(0.8 / paceFor('baby', 'v3').side).toBeLessThan(3.5);
  });

  it('up and down the floor: the calibration at the kit\'s cycle is kept, and the tempo quickens it with the steps', () => {
    for (const stage of STAGES) {
      const gait = gaitFor(stage, 'v3');
      // The calibration, at the kit's own cycle: 0.28 floor depths a second was the first; this is a fifth quicker, not more.
      const atKitCycle = gait.depth / walkCycleFor('v3');
      expect(atKitCycle / 0.28).toBeGreaterThan(1.1);
      expect(atKitCycle / 0.28).toBeLessThan(1.35);
      // On screen (foreshortened) that is well under half the original 0.28 screen widths a second
      const screenPerSecond = atKitCycle * DEPTH_WEIGHT;
      expect(screenPerSecond / 0.28).toBeLessThan(0.45);
      expect(screenPerSecond / 0.28).toBeGreaterThan(0.3);
      // One cycle of stepping in place brings it this much of the floor's depth: a fifth, give or take.
      expect(gait.depth).toBeCloseTo(0.21, 6);
      // Played: the tempo quickens the depth travel exactly as it quickens the steps, so the rhythm holds
      expect(paceFor(stage, 'v3').depth).toBeCloseTo(atKitCycle * walkTempoFor(stage), 12);
      // And on screen the depth travel per second stays close to the travel across (the same rhythm either way)
      const across = paceFor(stage, 'v3', 1).side;
      const down = paceFor(stage, 'v3').depth * DEPTH_WEIGHT;
      expect(down / across).toBeGreaterThan(0.8);
      expect(down / across).toBeLessThan(1.4);
    }
    // Every gait is walked both ways at one pace up and one pace down: the table has one depth per gait.
    for (const generation of GENERATIONS) for (const stage of STAGES) expect(paceFor(stage, generation).depth).toBeCloseTo(gaitFor(stage, generation).depth / playedWalkCycleFor(stage, generation), 12);
  });

  it('an unknown stage or generation walks as the oldest artwork does', () => {
    expect(gaitFor('egg', 'v9')).toBe(GAITS.v1.baby);
    expect(gaitFor('adult', '')).toBe(GAITS.v1.adult);
  });

  it('what is seen per cycle: the stride in profile, the foreshortened depth from the front or from behind', () => {
    for (const generation of GENERATIONS) {
      for (const stage of STAGES) {
        const gait = gaitFor(stage, generation);
        expect(apparentTravelPerCycle(stage, generation, 'side')).toBeCloseTo(gait.stride * ACTOR_BOX_WIDTH, 12);
        expect(apparentTravelPerCycle(stage, generation, 'side', 0)).toBeCloseTo(gait.stride * ACTOR_BOX_WIDTH * depthScale(0), 12);
        expect(apparentTravelPerCycle(stage, generation, 'front')).toBe(apparentTravelPerCycle(stage, generation, 'back'));
        expect(apparentTravelPerCycle(stage, generation, 'front')).toBeCloseTo(gait.depth * DEPTH_WEIGHT, 12);
      }
    }
  });

  it('measured on the floor: one played cycle of walking moves the Blobbi its stride across the room, and its depth travel up or down it', () => {
    for (const generation of GENERATIONS) {
      for (const stage of STAGES) {
        const cycle = playedWalkCycleFor(stage, generation);
        const gait = gaitFor(stage, generation);
        const from = standingAt({ x: 0.5, y: 0.45 });
        const pace = paceFor(stage, generation, from.position.y);
        const after = (to: { x: number; y: number }) => stepLocomotion(beginWalk(from, to, 'user'), cycle, pace).state.position;
        const across = gait.stride * ACTOR_BOX_WIDTH * depthScale(0.45);
        expect(after({ x: 0.9, y: 0.45 }).x - 0.5).toBeCloseTo(across, 9);
        expect(0.5 - after({ x: 0.1, y: 0.45 }).x).toBeCloseTo(across, 9);
        expect(after({ x: 0.5, y: 0.82 }).y - 0.45).toBeCloseTo(gait.depth, 9);
        expect(0.45 - after({ x: 0.5, y: 0.05 }).y).toBeCloseTo(gait.depth, 9);
        // A diagonal is not a shortcut: it takes as long as its two components together demand.
        const to = { x: 0.7, y: 0.75 };
        expect(walkSeconds(from.position, to, pace)).toBeCloseTo(Math.hypot(0.2 / pace.side, 0.3 / pace.depth), 9);
        expect(walkSeconds(from.position, to, pace)).toBeGreaterThanOrEqual(Math.max(0.2 / pace.side, 0.3 / pace.depth));
      }
    }
  });
});
