/**
 * V3 (procedural) Blobbis in this app, end to end, and the two earlier
 * generations beside them.
 *
 * The kit owns what a V3 Blobbi is (identity on the event, the engine that
 * draws it) and tests that on its own. What is pinned HERE is this app's
 * part: that a V3 Blobbi's identity reaches the renderer through the one
 * seam (`toBlobbiVisual`), that it is the same individual after every
 * round trip an event makes (a relay, a reload, a care update, a hatch, an
 * evolution), that the home draws each generation with its own renderer
 * and its own gait, and that nothing about V1 and V2 moved.
 *
 * "Reload" is modelled as what a reload is to this app: the event leaves as
 * JSON, comes back as JSON, and is parsed again by code that remembers
 * nothing. No React state is involved in who a Blobbi is.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  BLOBBI_V3_TAG_NAMES,
  VISUAL_GENERATION_TAG,
  deriveSeedIdentity,
  getTagValue,
  parseModernBlobbiEvent,
  updateBlobbiTags,
  type BlobbiCompanion,
  type NostrEvent,
} from '@blobbi-kit/core';
import { planHatchTransition } from '@blobbi-kit/react';
import { BLOBBI_V3_MOTION_STYLESHEET, createBlobbiV3Identity, renderBlobbiSvg, type BlobbiVisual } from '@blobbi-kit/renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blobbiEvent } from '@/test/fixtures';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { BlobbiActor } from '@/features/home/scene/BlobbiActor';
import { RENDERER_V3_WALK_CYCLE_S, RENDERER_WALK_CYCLE_S, walkCycleFor } from '@/features/home/scene/motion-contract';
import type { BlobbiPresentation } from '@/features/home/scene/presentation';

const PET = '0000000042';
const parse = (event: NostrEvent): BlobbiCompanion => {
  const companion = parseModernBlobbiEvent(event);
  if (!companion) throw new Error('fixture must be modern');
  return companion;
};
/** What a relay and a reload do to an event: nothing survives but its JSON. */
const reload = (event: NostrEvent): NostrEvent => JSON.parse(JSON.stringify(event));
const born = (generation: 'v1' | 'v2' | 'v3', stage: 'egg' | 'baby' | 'adult' = 'egg') => blobbiEvent(PET, { name: 'Sprout', stage, visualGeneration: generation });
const draw = (visual: BlobbiVisual, more: Partial<Parameters<typeof renderBlobbiSvg>[0]> = {}) => renderBlobbiSvg({ ...visual, instanceId: 'same', ...more }).svg;
const withTags = (event: NostrEvent, tags: string[][]): NostrEvent => ({ ...event, tags });
const v3TagsOf = (event: NostrEvent) => event.tags.filter((t) => BLOBBI_V3_TAG_NAMES.includes(t[0]));

const standing: BlobbiPresentation = { position: { x: 0.5, y: 0.7 }, facing: 'front', motion: 'idle', eyeOffset: undefined, expression: 'neutral', isSleeping: false, gesture: null };
const rendererEl = () => document.querySelector('[data-blobbi-renderer]') as HTMLElement;
const bodyBox = () => document.querySelector('[data-blobbi-body-box]') as HTMLElement;
const svgEl = () => document.querySelector('[data-blobbi-body-box] svg') as SVGSVGElement;

describe('a V3 identity reaches the renderer through the one seam', () => {
  it('toBlobbiVisual carries exactly what the event states: the seed, the algorithm, the colours, the trait kinds', () => {
    const event = born('v3');
    // The seed is the address (no tag states it), resolved by the kit before the renderer sees it.
    expect(getTagValue(event.tags, 'seed')).toBeUndefined();
    const seed = parse(event).seed!;
    const visual = toBlobbiVisual(parse(event));
    expect(visual.visualGeneration).toBe('v3');
    // Exactly the kit's creation rule for this seed: nothing added on the way, nothing lost.
    expect(visual.v3).toEqual(createBlobbiV3Identity(seed));
    expect(visual.v3?.algorithm).toBe(1);
    // The plain colours are the creature's own: the event's colour tags, which on V3 are not the seed's mirrors.
    expect(visual.baseColor).toBe(visual.v3?.colors?.base);
    expect(getTagValue(event.tags, 'base_color')).toBe(visual.v3?.colors?.base);
    expect(getTagValue(event.tags, 'base_color')).not.toBe(deriveSeedIdentity(seed).baseColor);
  });

  it('for V1 and V2 there is no such identity, and what they are handed is what it always was', () => {
    for (const generation of ['v1', 'v2'] as const) {
      for (const stage of ['egg', 'baby', 'adult'] as const) {
        const visual = toBlobbiVisual(parse(born(generation, stage)));
        expect(visual.visualGeneration).toBe(generation);
        expect(visual.v3).toBeUndefined();
        // Byte for byte the drawing of a visual that never had the field.
        const before = { ...visual };
        delete before.v3;
        expect(draw(visual)).toBe(draw(before));
        expect(draw(visual)).not.toContain('data-rig');
      }
    }
  });

  it('an event that only CLAIMS a generation this app does not know is drawn as V1, never as V3', () => {
    const event = born('v3', 'adult');
    const claimed = withTags(event, event.tags.map((t) => (t[0] === VISUAL_GENERATION_TAG ? [VISUAL_GENERATION_TAG, 'v4'] : t)));
    // Read as V1 it has no seed tag, which V1 needs: not a modern Blobbi, so never drawn at all.
    expect(parseModernBlobbiEvent(claimed)).toBeUndefined();
    // With a seed stated, as a V1 event would have, it is drawn as V1, never as V3.
    const visual = toBlobbiVisual(parse(withTags(claimed, [...claimed.tags, ['seed', parse(event).seed!]])));
    expect(visual.visualGeneration).toBe('v1');
    expect(visual.v3).toBeUndefined();
    expect(renderBlobbiSvg({ ...visual, instanceId: 'x' }).artwork.generation).toBe('v1');
    // And V3 identity tags on a V2 event change nothing about it.
    const v2 = born('v2', 'adult');
    const decorated = withTags(v2, [...v2.tags, ...v3TagsOf(event)]);
    expect(draw(toBlobbiVisual(parse(decorated)))).toBe(draw(toBlobbiVisual(parse(v2))));
  });
});

describe('a V3 Blobbi is the same individual after every round trip', () => {
  const stages = ['egg', 'baby', 'adult'] as const;

  it('reload: the event as JSON, parsed again, draws the same picture at every stage and from every side', () => {
    for (const stage of stages) {
      const event = born('v3', stage);
      const before = toBlobbiVisual(parse(event));
      const after = toBlobbiVisual(parse(reload(event)));
      expect(after).toEqual(before);
      for (const facing of ['front', 'right', 'left', 'back'] as const) {
        expect(draw(after, { facing })).toBe(draw(before, { facing }));
      }
    }
  });

  it('two clients that have never met reconstruct the same Blobbi from the same event', () => {
    const wire = JSON.stringify(born('v3', 'adult'));
    const clientA = draw(toBlobbiVisual(parse(JSON.parse(wire))));
    const clientB = draw(toBlobbiVisual(parse(JSON.parse(wire))));
    expect(clientA).toBe(clientB);
    expect(clientA).toContain('data-blobbi-generation="v3"');
  });

  it('a care update keeps the identity: only the stats and the seed mirrors are rewritten', () => {
    const event = born('v3', 'baby');
    const cared = withTags(event, updateBlobbiTags(event.tags, { hunger: '77', last_interaction: String(event.created_at + 60) }));
    expect(v3TagsOf(cared)).toEqual(v3TagsOf(event));
    expect(toBlobbiVisual(parse(reload(cared)))).toEqual(toBlobbiVisual(parse(event)));
    expect(getTagValue(cared.tags, 'hunger')).toBe('77');
  });

  it('egg -> baby -> adult: one identity, three drawings, through the kit\'s own transitions and a reload at each', () => {
    const egg = reload(withTags(born('v3'), updateBlobbiTags(born('v3').tags, { progression_state: 'incubating', progression_started_at: '1757000000' })));
    const identity = toBlobbiVisual(parse(egg)).v3;

    // Hatch: the kit's plan, exactly as the app's lifecycle runs it.
    const eggCompanion = parse(egg);
    const hatch = planHatchTransition({ companion: eggCompanion, content: egg.content, allTags: eggCompanion.allTags, profileAllTags: [] }, egg.created_at + 3600);
    const baby = reload({ ...egg, tags: hatch.event.tags, content: hatch.event.content ?? '', created_at: egg.created_at + 3600 });
    expect(parse(baby).stage).toBe('baby');

    // Evolve: the stage change through the same tag pipeline every republish uses (it validates and repairs).
    const grown = updateBlobbiTags(baby.tags, { stage: 'adult', progression_state: 'none' });
    const adult = reload({ ...baby, tags: grown, created_at: baby.created_at + 3600 });
    expect(parse(adult).stage).toBe('adult');

    const drawings = [egg, baby, adult].map((event) => {
      const visual = toBlobbiVisual(parse(event));
      expect(visual.visualGeneration).toBe('v3');
      expect(visual.v3).toEqual(identity);
      expect(parse(event).v3Identity?.missing).toEqual([]);
      expect(v3TagsOf(event)).toEqual(v3TagsOf(egg));
      return draw(visual);
    });
    expect(new Set(drawings).size).toBe(3);
    expect(drawings[0]).toContain('data-blobbi-stage="egg"');
    expect(drawings[1]).toContain('data-blobbi-stage="baby"');
    expect(drawings[2]).toContain('data-blobbi-stage="adult"');
    // One palette from egg hint to adult: the colours were stated once, at birth, and are still those.
    expect(identity?.colors).toEqual(createBlobbiV3Identity(parse(egg).seed!).colors);
  });

  it('explicit colours and traits are the event\'s to state: changing a tag changes the Blobbi, and a republish keeps the change', () => {
    const event = born('v3', 'adult');
    const original = toBlobbiVisual(parse(event));
    const edited = withTags(
      event,
      event.tags.map((t) => (t[0] === 'base_color' ? ['base_color', '#d9534f'] : t[0] === 'tail' ? ['tail', original.v3?.traits?.tail === 'curl' ? 'leaf' : 'curl'] : t)),
    );
    const visual = toBlobbiVisual(parse(edited));
    expect(visual.v3?.colors?.base).toBe('#d9534f');
    expect(visual.v3?.seed).toBe(original.v3?.seed);
    expect(draw(visual)).not.toBe(draw(original));
    expect(draw(visual, { facing: 'right' })).toContain('data-part="tail"');
    // The seed did not change, so the body is the same body in other paint.
    const shapes = (svg: string) => svg.replace(/#[0-9a-f]{6}/g, '#');
    const sameTail = withTags(event, event.tags.map((t) => (t[0] === 'base_color' ? ['base_color', '#d9534f'] : t)));
    expect(shapes(draw(toBlobbiVisual(parse(sameTail))))).toBe(shapes(draw(original)));
    // A republish through the kit does not put the seed's colours back: on V3 `base_color` is not a mirror.
    const republished = withTags(edited, updateBlobbiTags(edited.tags, { hunger: '40' }));
    expect(getTagValue(republished.tags, 'base_color')).toBe('#d9534f');
    expect(toBlobbiVisual(parse(reload(republished))).v3).toEqual(visual.v3);
    // The same edit on a V2 Blobbi does not survive: there the tag IS a mirror, as it always was.
    const v2 = born('v2', 'adult');
    const v2Edited = updateBlobbiTags(v2.tags.map((t) => (t[0] === 'base_color' ? ['base_color', '#d9534f'] : t)), { hunger: '40' });
    expect(getTagValue(v2Edited, 'base_color')).toBe(getTagValue(v2.tags, 'base_color'));
  });

  it('an identity stating an algorithm version the renderer does not implement is flagged, never drawn as the one it has', () => {
    const event = born('v3', 'adult');
    const future = withTags(event, event.tags.map((t) => (t[0] === 'visual_algorithm' ? ['visual_algorithm', '2'] : t)));
    const visual = toBlobbiVisual(parse(reload(future)));
    expect(visual.v3?.algorithm).toBe(2);
    const rendered = renderBlobbiSvg({ ...visual, instanceId: 'same' });
    expect(rendered.artwork.unsupportedAlgorithm).toBe(2);
    expect(rendered.svg).toContain('data-blobbi-unsupported-algorithm="2"');
    expect(rendered.svg).not.toBe(draw(toBlobbiVisual(parse(event))));
    // The version it states survives a republish untouched.
    expect(getTagValue(updateBlobbiTags(future.tags, { hunger: '40' }), 'visual_algorithm')).toBe('2');
    // In the home: the actor's renderer says so too.
    render(<BlobbiActor blobbi={parse(future)} presentation={standing} />);
    expect(rendererEl()).toHaveAttribute('data-blobbi-unsupported-algorithm', '2');
  });

  it('an incomplete identity still draws, deterministically, and says what was missing', () => {
    const event = born('v3', 'adult');
    const partial = withTags(event, event.tags.filter((t) => t[0] !== 'eye_color' && t[0] !== 'horns'));
    const companion = parse(partial);
    expect(companion.v3Identity?.missing.sort()).toEqual(['eye_color', 'horns']);
    // A republish does not write the inferred values into the event.
    const again = updateBlobbiTags(partial.tags, { hunger: '40' });
    expect(getTagValue(again, 'eye_color')).toBeUndefined();
    expect(getTagValue(again, 'horns')).toBeUndefined();
    const visual = toBlobbiVisual(companion);
    expect(draw(visual)).toBe(draw(toBlobbiVisual(parse(reload(partial)))));
    // The gaps are filled from the seed under the frozen algorithm: here that is what creation stated anyway.
    expect(draw(visual)).toBe(draw(toBlobbiVisual(parse(event))));
  });
});

describe('the home draws each generation with its own renderer and its own gait', () => {
  const actor = (generation: 'v1' | 'v2' | 'v3', stage: 'egg' | 'baby' | 'adult', presentation: Partial<BlobbiPresentation> = {}) =>
    render(<BlobbiActor blobbi={parse(born(generation, stage))} presentation={{ ...standing, ...presentation }} />);

  it('V1, V2 and V3 adults stand in the same actor and the same box; only what is inside differs', () => {
    for (const generation of ['v1', 'v2', 'v3'] as const) {
      const { unmount } = actor(generation, 'adult');
      expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-generation', generation);
      expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-stage', 'adult');
      expect(rendererEl()).toHaveAttribute('data-blobbi-generation', generation);
      expect(rendererEl().style.width).toBe('100%');
      expect(svgEl().querySelector('[data-rig]') !== null).toBe(generation === 'v3');
      unmount();
    }
  });

  it('a V3 Blobbi is drawn at every stage: its egg, its baby (no limbs), its adult', () => {
    for (const stage of ['egg', 'baby', 'adult'] as const) {
      const { unmount } = actor('v3', stage);
      expect(svgEl()).toHaveAttribute('data-blobbi-stage', stage);
      expect(svgEl()).toHaveAttribute('data-blobbi-generation', 'v3');
      unmount();
    }
    actor('v3', 'baby');
    expect(svgEl().innerHTML).not.toMatch(/data-rig="(left|right|near|far)-(arm|leg)"/);
  });

  it('walking: V1 and V2 are moved by the wrapper, V3 by its own rig on its own cycle; the shadow follows whichever it is', () => {
    const walking = { motion: 'walking' as const, facing: 'right' as const };
    for (const generation of ['v1', 'v2'] as const) {
      const { unmount } = actor(generation, 'adult', walking);
      expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'walking');
      expect(svgEl().hasAttribute('data-blobbi-rig-motion')).toBe(false);
      expect(screen.getByTestId('blobbi-actor').style.getPropertyValue('--walk-cycle')).toBe(`${RENDERER_WALK_CYCLE_S}s`);
      unmount();
    }
    actor('v3', 'adult', walking);
    expect(bodyBox().hasAttribute('data-blobbi-motion')).toBe(false);
    expect(svgEl()).toHaveAttribute('data-blobbi-rig-motion', 'walking');
    expect(svgEl()).toHaveAttribute('data-blobbi-view', 'side');
    expect(svgEl()).toHaveAttribute('data-blobbi-direction', 'right');
    expect(document.querySelector('style[data-blobbi-rig-motion-styles]')).not.toBeNull();
    expect(screen.getByTestId('blobbi-actor').style.getPropertyValue('--walk-cycle')).toBe(`${RENDERER_V3_WALK_CYCLE_S}s`);
  });

  it('the V3 cycle the shadow follows is the cycle the renderer animates, and its phase is the instance\'s', () => {
    const cycle = BLOBBI_V3_MOTION_STYLESHEET.match(/animation:pb-walking-side-body\s+([\d.]+)s/);
    expect(cycle, 'the V3 stylesheet names its walk and its duration').not.toBeNull();
    expect(Number(cycle![1])).toBe(RENDERER_V3_WALK_CYCLE_S);
    expect(Number(BLOBBI_V3_MOTION_STYLESHEET.match(/animation:pb-walking-hop-body\s+([\d.]+)s/)![1])).toBe(RENDERER_V3_WALK_CYCLE_S);
    expect(walkCycleFor('v3')).toBe(RENDERER_V3_WALK_CYCLE_S);
    for (const other of ['v1', 'v2', 'v9', '']) expect(walkCycleFor(other)).toBe(RENDERER_WALK_CYCLE_S);
    // The drawing starts its cycle at the same fraction the actor hands its shadow.
    actor('v3', 'adult', { motion: 'walking', facing: 'right' });
    const phase = screen.getByTestId('blobbi-actor').style.getPropertyValue('--blobbi-motion-phase');
    const drawn = /--pb-phase:([\d.]+)/.exec(svgEl().getAttribute('style') ?? '')?.[1] ?? '0';
    expect(Number(drawn)).toBeCloseTo(Number(phase), 3);
  });

  it('the shadow settles under a V3 adult (it walks on its legs) and breathes under a V3 baby (it hops)', () => {
    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');
    expect(css).toContain(".scene-actor[data-motion='walking'][data-generation='v3'][data-stage='adult'] .scene-actor__shadow");
    expect(css).not.toMatch(/data-generation='v3'\]\[data-stage='baby'\]/);
    const rule = css.slice(css.indexOf(".scene-actor[data-motion='walking'][data-generation='v3'][data-stage='adult']"));
    expect(rule.slice(0, 200)).toMatch(/animation-name: actor-shadow-step/);
  });

  it('expression, sleep and gaze reach a V3 Blobbi through the same presentation as any other', () => {
    const neutral = actor('v3', 'adult');
    const face = bodyBox().innerHTML;
    neutral.unmount();
    const happy = actor('v3', 'adult', { expression: 'happy' });
    expect(bodyBox().innerHTML).not.toBe(face);
    expect(rendererEl()).toHaveAttribute('data-blobbi-expression-support', '');
    happy.unmount();
    const asleep = actor('v3', 'adult', { isSleeping: true, motion: 'still' });
    expect(svgEl().querySelector('[data-blobbi-eyes="closed"]')).not.toBeNull();
    asleep.unmount();
    actor('v3', 'adult', { eyeOffset: { x: 0.5, y: -0.25 } });
    expect(bodyBox().style.getPropertyValue('--blobbi-eye-x')).toBe('0.5');
    expect(svgEl().querySelectorAll('.blobbi-pupil').length).toBe(2);
  });
});
