/**
 * A V3 BLOBBI IS ITS ADDRESS, AND NOTHING ELSE CAN SAY WHO IT IS.
 *
 * The contract (blobbi-kit; V3 is Algorithm 1): the kit derives the
 * seed from (owner, d), and Algorithm 1 derives everything the Blobbi is
 * from that seed: its colours, anatomy, pattern, mark, belly, freckles and
 * every proportion. The event states only `visual_generation`. Every
 * production path this app has that writes a kind
 * 31124 is pushed through (adoption, each care action, rest, an item, hatch,
 * evolution, the tag repair every transition runs, a reload between each),
 * and every intrinsic tag a replacement event might forge is tried: the
 * resolved Blobbi and its picture never move.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  BLOBBI_V3_ABSENT_TAG_NAMES,
  KIND_BLOBBI_STATE,
  VISUAL_ALGORITHM_TAG,
  VISUAL_GENERATION_TAG,
  buildEggTags,
  canonicalBlobbiV3Seed,
  deriveBlobbiSeedV1,
  deriveBlobbiV3Seed,
  getCanonicalBlobbiD,
  getTagValue,
  parseBlobbiV3Identity,
  parseModernBlobbiEvent,
  updateBlobbiTags,
  type BlobbiCompanion,
  type NostrEvent,
} from '@blobbi-kit/core';
import { validateAndRepairBlobbiTags } from '@blobbi-kit/core/blobbi-tag-schema';
import { parseGameItemDefinition } from '@nostr-games/inventory';
import { planHatchTransition } from '@blobbi-kit/react';
import { createBlobbiV3Identity, normalizeBlobbiV3Visual, renderBlobbiSvg, resolveBlobbiV3Visual } from '@blobbi-kit/renderer';
import { CREATED_AT, PUBKEY } from '@/test/fixtures';
import { OFFICIAL_APPLE, OFFICIAL_SOAP, officialCareDefinition } from '@/test/inventory-fixtures';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { adoptionEggOptions, eggTemplate, newEggPreview, previewCompanion } from '@/features/adoption/adoption-plan';
import { planCareAction } from '@/features/care/care-plan';
import { resolveHomeItem } from '@/features/inventory/item-model';
import { planItemUse } from '@/features/inventory/item-use-plan';
import { BlobbiActor } from '@/features/home/scene/BlobbiActor';
import type { BlobbiPresentation } from '@/features/home/scene/presentation';
import { V3_REFERENCE_BLOBBIS } from '@/dev/v3-reference';

const PET_ID = '00000000a7';
const D = getCanonicalBlobbiD(PUBKEY, PET_ID);
/** The Blobbi's seed: its address, hashed. */
const SEED = deriveBlobbiV3Seed(PUBKEY, D);
/** Who this Blobbi is: Algorithm 1's function of its address. Nothing on the event states any of it. */
const OWN = createBlobbiV3Identity(SEED);

/** The only identity tags a V3 event carries. */
const IDENTITY_TAGS = [VISUAL_GENERATION_TAG, VISUAL_ALGORITHM_TAG];
const identityTagsOf = (tags: readonly string[][]) => tags.filter((t) => IDENTITY_TAGS.includes(t[0]));
const reload = (event: NostrEvent): NostrEvent => JSON.parse(JSON.stringify(event));
const parse = (event: NostrEvent): BlobbiCompanion => {
  const companion = parseModernBlobbiEvent(event);
  if (!companion) throw new Error('must parse as a modern Blobbi');
  return companion;
};
const eventWith = (tags: string[][], at: number, content = ''): NostrEvent => ({ id: 'e'.repeat(64), pubkey: PUBKEY, created_at: at, kind: KIND_BLOBBI_STATE, tags, content, sig: '0'.repeat(128) });
/** What the renderer resolves the app's visual to: the Blobbi as drawn. */
const resolvedOf = (event: NostrEvent) => normalizeBlobbiV3Visual(toBlobbiVisual(parse(reload(event))).v3);

/** The egg as adoption publishes it at this address. */
function born(): NostrEvent {
  const tags = buildEggTags(PUBKEY, PET_ID, CREATED_AT, 'Umber', adoptionEggOptions());
  return eventWith(updateBlobbiTags(tags, { progression_state: 'incubating', progression_started_at: String(CREATED_AT) }), CREATED_AT);
}

/** Every intrinsic tag a replacement event might try to restate, each with a value this Blobbi does not have. */
const FORGERIES: string[][] = [
  ['seed', 'f'.repeat(64)],
  ['base_color', '#000000'],
  ['secondary_color', '#ffffff'],
  ['eye_color', '#ff0000'],
  ['accent_color', '#00ff00'],
  ['antenna', OWN.traits.antenna === 'double' ? 'none' : 'double'],
  ['horns', OWN.traits.horns === 'side' ? 'none' : 'side'],
  ['ears', OWN.traits.ears === 'pointed' ? 'none' : 'pointed'],
  ['tail', OWN.traits.tail === 'leaf' ? 'none' : 'leaf'],
  ['pattern', OWN.traits.pattern === 'striped' ? 'solid' : 'striped'],
  ['special_mark', OWN.traits.specialMark === 'moon' ? 'none' : 'moon'],
  ['belly', String(!OWN.traits.belly)],
  ['freckles', String(!OWN.traits.freckles)],
  ['visual_algorithm', '1'],
  ['visual_algorithm', '2'],
  ['visual_algorithm', 'two'],
];

/** Everything that must still be true of an event at this address. */
function expectSameBlobbi(event: NostrEvent, label: string) {
  const companion = parse(reload(event));
  expect(companion.visualGeneration, label).toBe('v3');
  expect(companion.seed, label).toBe(SEED);
  expect(companion.v3Identity, label).toEqual({ seed: SEED, algorithm: 1, missing: [] });
  expect(toBlobbiVisual(companion).v3, label).toEqual({ seed: SEED, algorithm: 1 });
  expect(resolvedOf(event), label).toEqual(OWN);
  expect(identityTagsOf(event.tags), label).toEqual([[VISUAL_GENERATION_TAG, 'v3']]);
  for (const name of BLOBBI_V3_ABSENT_TAG_NAMES) expect(getTagValue(event.tags, name), `${label} ${name}`).toBeUndefined();
  expect(getTagValue(event.tags, 'spots'), label).toBeUndefined();
  // The genealogical generation is not the visual one, and is untouched by any of this.
  expect(getTagValue(event.tags, 'generation'), label).toBe('1');
  expect(companion.generation, label).toBe(1);
}

describe('creation: the address is the Blobbi; the event states only the version', () => {
  it('the real adoption path: the address seed, algorithm 1, and no colour, trait or seed tag', () => {
    const preview = newEggPreview(PUBKEY, 'Sprout', CREATED_AT);
    const { tags } = eggTemplate(preview);
    expect(getTagValue(tags, 'seed')).toBeUndefined();
    const seed = parse(eventWith(tags, CREATED_AT)).seed!;
    expect(seed).toBe(preview.seed);
    expect(seed).toBe(deriveBlobbiV3Seed(PUBKEY, preview.d));
    expect(seed).not.toBe(deriveBlobbiSeedV1(PUBKEY, preview.d, CREATED_AT));
    expect(canonicalBlobbiV3Seed(seed)).toBe(seed);
    expect(identityTagsOf(tags)).toEqual([[VISUAL_GENERATION_TAG, 'v3']]);
    for (const name of [...BLOBBI_V3_ABSENT_TAG_NAMES, 'spots']) expect(getTagValue(tags, name), name).toBeUndefined();
    expect(parseBlobbiV3Identity(eventWith(tags, CREATED_AT))).toEqual({ seed, algorithm: 1, missing: [] });
    // Who it is: exactly what Algorithm 1 gives its address, as the renderer resolves it from the app's visual.
    expect(resolvedOf(eventWith(tags, CREATED_AT))).toEqual(createBlobbiV3Identity(seed));
    // The preview is the published egg: the same parse, the same drawing.
    const preview_ = previewCompanion(preview)!;
    expect(toBlobbiVisual(preview_)).toEqual(toBlobbiVisual(parse(eventWith(tags, CREATED_AT))));
    // The rest of the protocol is there as for any new egg.
    for (const name of ['d', 'name', 'stage', 'state', 'generation', 'hunger', 'happiness', 'health', 'hygiene', 'energy', 'experience', 'progression_state']) expect(getTagValue(tags, name), name).toBeDefined();
    expect(getTagValue(tags, 'stage')).toBe('egg');
    expect(getTagValue(tags, 'generation')).toBe('1');
  });

  it('this Blobbi is Algorithm 1\'s for its address', () => {
    expectSameBlobbi(born(), 'born');
  });
});

describe('a replacement event cannot restate who it is', () => {
  it.each(FORGERIES.map((f) => [f[0], f[1]] as const))('%s = %s, inserted at any stage, changes neither the resolved Blobbi nor its picture', (name, value) => {
    let event = born();
    for (const stage of ['egg', 'baby', 'adult'] as const) {
      if (stage === 'baby') event = eventWith(updateBlobbiTags(event.tags, { stage: 'baby', progression_state: 'none' }), CREATED_AT + 3600);
      if (stage === 'adult') event = eventWith(updateBlobbiTags(event.tags, { stage: 'adult', progression_state: 'none' }), CREATED_AT + 7200);
      const forged = eventWith([...event.tags, [name, value]], event.created_at + 1);
      expect(resolvedOf(forged), stage).toEqual(OWN);
      expect(renderBlobbiSvg({ ...toBlobbiVisual(parse(forged)), instanceId: 'f' }).svg, stage).toBe(renderBlobbiSvg({ ...toBlobbiVisual(parse(event)), instanceId: 'f' }).svg);
      // And the next write through the app drops it.
      const cared = planCareAction(parse(forged), 'clean', forged.created_at + 60);
      expect(getTagValue(cared.event.tags, name), stage).toBeUndefined();
    }
  });

  it('several algorithm versions at once, or none, still draw Algorithm 1 for this address', () => {
    const plain = born();
    const several = eventWith([...plain.tags, ['visual_algorithm', '2'], ['visual_algorithm', '1'], ['visual_algorithm', '7']], CREATED_AT + 1);
    expect(resolvedOf(several)).toEqual(OWN);
    expect(toBlobbiVisual(parse(several)).v3).toEqual({ seed: SEED, algorithm: 1 });
    expect(renderBlobbiSvg({ ...toBlobbiVisual(parse(several)), instanceId: 'a' }).svg).toBe(renderBlobbiSvg({ ...toBlobbiVisual(parse(plain)), instanceId: 'a' }).svg);
    expect(getTagValue(plain.tags, 'visual_algorithm')).toBeUndefined();
  });

  it('all of them at once, too', () => {
    const forged = eventWith([...born().tags, ...FORGERIES], CREATED_AT + 1);
    expect(resolvedOf(forged)).toEqual(OWN);
    expectSameBlobbi(eventWith(planCareAction(parse(forged), 'clean', CREATED_AT + 60).event.tags, CREATED_AT + 60), 'after a care write');
  });
});

describe('every update keeps the same Blobbi', () => {
  const apple = resolveHomeItem(OFFICIAL_APPLE, parseGameItemDefinition(officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25, hygiene: -2, energy: 5 }), { mode: 'permissive' }));
  const soap = resolveHomeItem(OFFICIAL_SOAP, parseGameItemDefinition(officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'] }), { mode: 'permissive' }));

  /** The kit's own hatch plan, as the app's lifecycle runs it. */
  const hatch = (egg: NostrEvent, at: number): NostrEvent => {
    const companion = parse(egg);
    const plan = planHatchTransition({ companion, content: egg.content, allTags: companion.allTags, profileAllTags: [] }, at);
    return eventWith(plan.event.tags, at, plan.event.content ?? '');
  };
  /** The kit's evolve, step for step as `useBlobbiEvolve` builds its event: merge, repair with task cleanup, close the progression. */
  const evolve = (baby: NostrEvent, at: number): NostrEvent => {
    const companion = parse(baby);
    const merged = updateBlobbiTags(companion.allTags, { stage: 'adult', state: 'active', last_interaction: String(at), last_decay_at: String(at) });
    const repair = validateAndRepairBlobbiTags(merged, companion.allTags, { cleanupTaskTags: true });
    expect(repair.errors).toEqual([]);
    return eventWith(updateBlobbiTags(repair.tags, { progression_state: 'none' }), at);
  };

  it('care: feeding, playing, cleaning, resting and waking, each on a baby and on an adult, through the app\'s own plans', () => {
    const baby = hatch(born(), CREATED_AT + 3600);
    const adult = evolve(baby, CREATED_AT + 7200);
    for (const [label, start] of [['baby', baby], ['adult', adult]] as const) {
      let event = start;
      let now = event.created_at + 600;
      for (const action of ['feed', 'play', 'clean', 'rest', 'rest', 'feed'] as const) {
        const plan = planCareAction(parse(reload(event)), action, now);
        event = eventWith(plan.event.tags, now, plan.event.content);
        expectSameBlobbi(event, `${label} ${action}`);
        now += 600;
      }
      expect(parse(event).stage).toBe(label);
    }
  });

  it('an egg can be cleaned: the care republish of an incubating egg keeps its identity', () => {
    const egg = born();
    const plan = planCareAction(parse(egg), 'clean', CREATED_AT + 60);
    expectSameBlobbi(eventWith(plan.event.tags, CREATED_AT + 60, plan.event.content), 'egg clean');
  });

  it('an item used on it', () => {
    const baby = hatch(born(), CREATED_AT + 3600);
    let event = baby;
    for (const [item, at] of [[apple, CREATED_AT + 4000], [soap, CREATED_AT + 4600]] as const) {
      const plan = planItemUse(parse(reload(event)), item, 's'.repeat(64), at);
      event = eventWith(plan.event.tags, at, plan.event.content);
      expectSameBlobbi(event, `item ${item.name}`);
    }
  });

  it('hatch: the same individual, now a baby', () => {
    const egg = born();
    const baby = hatch(egg, CREATED_AT + 3600);
    expect(parse(baby).stage).toBe('baby');
    expectSameBlobbi(baby, 'hatched');
    expect(getTagValue(baby.tags, 'd')).toBe(getTagValue(egg.tags, 'd'));
  });

  it('evolution: the same individual, now an adult, with no adult form taken from the seed', () => {
    const adult = evolve(hatch(born(), CREATED_AT + 3600), CREATED_AT + 7200);
    expect(parse(adult).stage).toBe('adult');
    expectSameBlobbi(adult, 'evolved');
    expect(parse(adult).adultType).toBeUndefined();
  });

  it('a generic republish, and the tag repair every transition runs, with and without a previous event', () => {
    const adult = evolve(hatch(born(), CREATED_AT + 3600), CREATED_AT + 7200);
    expectSameBlobbi(eventWith(updateBlobbiTags(adult.tags, { happiness: '12', last_interaction: String(CREATED_AT + 8000) }), CREATED_AT + 8000), 'republish');
    expectSameBlobbi(eventWith(validateAndRepairBlobbiTags(adult.tags, adult.tags).tags, CREATED_AT + 8000), 'repair with previous');
    expectSameBlobbi(eventWith(validateAndRepairBlobbiTags(adult.tags).tags, CREATED_AT + 8000), 'repair alone');
    // Nor does a repair put back what V3 does not have, even when an older event carried it.
    const legacy = [...adult.tags, ['size', 'large'], ['adult_type', 'bloomi'], ['spots', 'true']];
    const repaired = validateAndRepairBlobbiTags(adult.tags, legacy).tags;
    expectSameBlobbi(eventWith(repaired, CREATED_AT + 8000), 'repair against a legacy previous');
  });

  it('through the whole life: egg, baby, adult, and twenty updates later, one picture per stage', () => {
    let event = born();
    const eggDrawing = renderBlobbiSvg({ ...toBlobbiVisual(parse(event)), instanceId: 'life' }).svg;
    event = hatch(event, CREATED_AT + 3600);
    const babyDrawing = renderBlobbiSvg({ ...toBlobbiVisual(parse(event)), instanceId: 'life' }).svg;
    event = evolve(event, CREATED_AT + 7200);
    const adultDrawing = renderBlobbiSvg({ ...toBlobbiVisual(parse(event)), instanceId: 'life' }).svg;
    let now = CREATED_AT + 8000;
    for (let i = 0; i < 20; i++) {
      const plan = planCareAction(parse(reload(event)), (['feed', 'play', 'clean', 'rest'] as const)[i % 4], now);
      event = eventWith(plan.event.tags, now, plan.event.content);
      now += 900;
    }
    expectSameBlobbi(event, 'after twenty updates');
    expect(renderBlobbiSvg({ ...toBlobbiVisual(parse(event)), instanceId: 'life' }).svg).toBe(adultDrawing);
    expect(new Set([eggDrawing, babyDrawing, adultDrawing]).size).toBe(3);
    for (const drawing of [eggDrawing, babyDrawing, adultDrawing]) expect(drawing).toContain('data-blobbi-generation="v3"');
  });
});

describe('rendering is the kit\'s', () => {
  const standing: BlobbiPresentation = { position: { x: 0.5, y: 0.7 }, facing: 'front', motion: 'idle', eyeOffset: undefined, expression: 'neutral', isSleeping: false, gesture: null };

  it('the home\'s actor draws the Blobbi of this address with the kit renderer', () => {
    const adult = eventWith(updateBlobbiTags(born().tags, { stage: 'adult', progression_state: 'none' }), CREATED_AT + 7200);
    render(<BlobbiActor blobbi={parse(adult)} presentation={standing} />);
    const svg = document.querySelector('[data-blobbi-body-box] svg')!;
    expect(svg.getAttribute('data-blobbi-generation')).toBe('v3');
    expect(svg.getAttribute('data-blobbi-stage')).toBe('adult');
    // Its own paint and pattern: Algorithm 1's for its address.
    const markup = svg.outerHTML;
    expect(markup).toContain(`data-pattern="${OWN.traits.pattern}"`);
    if (OWN.traits.specialMark !== 'none') expect(markup).toContain(`data-mark="${OWN.traits.specialMark}"`);
    // The picture is the kit's for this identity, byte for byte, under the actor's own instance id and state (the
    // rig's stylesheet is mounted by the component rather than inlined, so it is left out of the comparison).
    const asDom = (text: string) => {
      const host = document.createElement('div');
      host.innerHTML = text.replace(/<style[\s\S]*?<\/style>/, '');
      return host.innerHTML;
    };
    expect(asDom(markup)).toBe(asDom(renderBlobbiSvg({ ...toBlobbiVisual(parse(adult)), instanceId: `home-${parse(adult).d}`, facing: 'front', motion: 'idle' }).svg));
  });

  it('the kit\'s twelve reference Blobbis resolve, as copied here, to exactly themselves', () => {
    expect(V3_REFERENCE_BLOBBIS).toHaveLength(12);
    for (const { name, identity } of V3_REFERENCE_BLOBBIS) {
      expect(canonicalBlobbiV3Seed(identity.seed), name).toBe(identity.seed);
      expect(identity.algorithm, name).toBe(1);
      expect(resolveBlobbiV3Visual(identity), name).toEqual({ status: 'individual', identity, inferred: [] });
    }
  });
});
