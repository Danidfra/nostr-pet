/**
 * A V3 BLOBBI'S IDENTITY IS DECIDED ONCE AND NEVER MOVES.
 *
 * The contract (blobbi-kit, `visual_algorithm = 1`): at creation the seed
 * decides the explicit identity (four colours, the kind of each trait); the
 * event states it; from then on every update PRESERVES what the event
 * states and derives nothing from the seed again. The seed stays for the
 * micro-geometry, under the frozen algorithm.
 *
 * The Blobbi here is deliberately NOT what its seed would have chosen (dark
 * navy with a yellow pattern, every trait on, a moon on its skin), so that
 * any path that quietly regenerates a field from the seed, or from a
 * default, shows up as a changed tag. Every production path this app has
 * that writes a kind 31124 is pushed through: adoption, each care action,
 * rest, an item, hatch, evolution, the tag repair every transition runs,
 * and a reload between each.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  BLOBBI_V3_ABSENT_TAG_NAMES,
  BLOBBI_V3_TAG_NAMES,
  KIND_BLOBBI_STATE,
  VISUAL_ALGORITHM_TAG,
  VISUAL_GENERATION_TAG,
  buildEggTags,
  canonicalBlobbiV3Seed,
  deriveBlobbiSeedV1,
  deriveSeedIdentity,
  getCanonicalBlobbiD,
  getTagValue,
  parseBlobbiV3Identity,
  parseModernBlobbiEvent,
  updateBlobbiTags,
  type BlobbiCompanion,
  type BlobbiV3Identity,
  type NostrEvent,
} from '@blobbi-kit/core';
import { validateAndRepairBlobbiTags } from '@blobbi-kit/core/blobbi-tag-schema';
import { parseGameItemDefinition } from '@nostr-games/inventory';
import { planHatchTransition } from '@blobbi-kit/react';
import { createBlobbiV3Identity, renderBlobbiSvg, resolveBlobbiV3Visual } from '@blobbi-kit/renderer';
import { CREATED_AT, PUBKEY } from '@/test/fixtures';
import { OFFICIAL_APPLE, OFFICIAL_SOAP, officialCareDefinition } from '@/test/inventory-fixtures';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { eggTemplate, newEggPreview } from '@/features/adoption/adoption-plan';
import { planCareAction } from '@/features/care/care-plan';
import { resolveHomeItem } from '@/features/inventory/item-model';
import { planItemUse } from '@/features/inventory/item-use-plan';
import { BlobbiActor } from '@/features/home/scene/BlobbiActor';
import type { BlobbiPresentation } from '@/features/home/scene/presentation';
import { V3_REFERENCE_BLOBBIS } from '@/dev/v3-reference';

const PET_ID = '00000000a7';
const D = getCanonicalBlobbiD(PUBKEY, PET_ID);
const SEED = deriveBlobbiSeedV1(PUBKEY, D, CREATED_AT);

/** Not what the seed would choose: every field differs from creation's answer, or is set where creation left it off. */
const UNUSUAL: BlobbiV3Identity = {
  seed: SEED,
  algorithm: 1,
  colors: { base: '#2b3a67', secondary: '#ffd23f', eye: '#e85d75', accent: '#7ad3f4' },
  traits: { antenna: 'double', horns: 'side', ears: 'pointed', tail: 'leaf', pattern: 'striped', specialMark: 'moon', belly: true, freckles: true },
};

const IDENTITY_TAGS = [VISUAL_GENERATION_TAG, 'seed', ...BLOBBI_V3_TAG_NAMES];
const identityTagsOf = (tags: readonly string[][]) => tags.filter((t) => IDENTITY_TAGS.includes(t[0]));
const reload = (event: NostrEvent): NostrEvent => JSON.parse(JSON.stringify(event));
const parse = (event: NostrEvent): BlobbiCompanion => {
  const companion = parseModernBlobbiEvent(event);
  if (!companion) throw new Error('must parse as a modern Blobbi');
  return companion;
};
const eventWith = (tags: string[][], at: number, content = ''): NostrEvent => ({ id: 'e'.repeat(64), pubkey: PUBKEY, created_at: at, kind: KIND_BLOBBI_STATE, tags, content, sig: '0'.repeat(128) });

/** The egg as adoption would publish it, had creation given this seed the unusual identity. */
function bornUnusual(): NostrEvent {
  const tags = buildEggTags(PUBKEY, PET_ID, CREATED_AT, 'Umber', { visualGeneration: 'v3', v3: (seed) => ({ ...UNUSUAL, seed }) });
  return eventWith(updateBlobbiTags(tags, { progression_state: 'incubating', progression_started_at: String(CREATED_AT) }), CREATED_AT);
}

/** Everything that must still be true of an event carrying the unusual Blobbi. */
function expectUnchanged(event: NostrEvent, label: string) {
  const companion = parse(reload(event));
  expect(companion.visualGeneration, label).toBe('v3');
  expect(companion.v3Identity, label).toEqual({ ...UNUSUAL, missing: [] });
  expect(toBlobbiVisual(companion).v3, label).toEqual(UNUSUAL);
  expect(identityTagsOf(event.tags), label).toEqual(identityTagsOf(bornUnusual().tags));
  for (const name of BLOBBI_V3_ABSENT_TAG_NAMES) expect(getTagValue(event.tags, name), `${label} ${name}`).toBeUndefined();
  expect(getTagValue(event.tags, 'spots'), label).toBeUndefined();
  // The genealogical generation is not the visual one, and is untouched by any of this.
  expect(getTagValue(event.tags, 'generation'), label).toBe('1');
  expect(companion.generation, label).toBe(1);
}

describe('creation: the seed decides once, the event states it', () => {
  it('the real adoption path: a canonical seed, algorithm 1, exactly the V3 contract, and nothing V3 does not have', () => {
    const preview = newEggPreview(PUBKEY, 'Sprout', CREATED_AT);
    const { tags } = eggTemplate(preview);
    const seed = getTagValue(tags, 'seed')!;
    expect(seed).toBe(preview.seed);
    expect(seed).toBe(deriveBlobbiSeedV1(PUBKEY, preview.d, CREATED_AT));
    expect(canonicalBlobbiV3Seed(seed)).toBe(seed);
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(getTagValue(tags, VISUAL_GENERATION_TAG)).toBe('v3');
    expect(getTagValue(tags, VISUAL_ALGORITHM_TAG)).toBe('1');
    // Exactly what the kit's creation rule gives this seed: the four colours and the kind of each trait.
    const own = createBlobbiV3Identity(seed);
    const parsed = parseBlobbiV3Identity(tags);
    expect(parsed).toEqual({ ...own, missing: [] });
    expect(parsed.seed).toBe(seed);
    expect(parsed.algorithm).toBe(1);
    const written = tags.filter((t) => BLOBBI_V3_TAG_NAMES.includes(t[0])).map((t) => t[0]);
    const expected = BLOBBI_V3_TAG_NAMES.filter((name) => name !== 'accent_color' || own.colors.accent !== undefined);
    expect([...written].sort()).toEqual([...expected].sort());
    expect(new Set(written).size).toBe(written.length);
    // The three colour tags are the identity's, not the seed's old mirrors.
    expect(getTagValue(tags, 'base_color')).toBe(own.colors.base);
    expect(getTagValue(tags, 'base_color')).not.toBe(deriveSeedIdentity(seed).baseColor);
    // Nothing a V3 Blobbi does not have.
    for (const name of ['spots', 'size', 'adult_type']) expect(getTagValue(tags, name), name).toBeUndefined();
    // The rest of the protocol is there as for any new egg.
    for (const name of ['d', 'name', 'stage', 'state', 'generation', 'hunger', 'happiness', 'health', 'hygiene', 'energy', 'experience', 'progression_state']) expect(getTagValue(tags, name), name).toBeDefined();
    expect(getTagValue(tags, 'stage')).toBe('egg');
    expect(getTagValue(tags, 'generation')).toBe('1');
  });

  it('a seed in another letter case is the same Blobbi, and a value that is not a seed is refused at birth', () => {
    const upper = SEED.toUpperCase();
    const born = buildEggTags(PUBKEY, PET_ID, CREATED_AT, 'Umber', { visualGeneration: 'v3', v3: { ...UNUSUAL, seed: upper } });
    expect(getTagValue(born, 'seed')).toBe(SEED);
    expect(parseBlobbiV3Identity(born)).toEqual({ ...UNUSUAL, missing: [] });
    expect(() => createBlobbiV3Identity('a text seed')).toThrow(TypeError);
    expect(() => buildEggTags(PUBKEY, PET_ID, CREATED_AT, 'Umber', { visualGeneration: 'v3', v3: { ...UNUSUAL, seed: 'a text seed' } })).toThrow(/Invalid V3 identity/);
  });

  it('the unusual Blobbi really is unusual: creation would have chosen otherwise', () => {
    const own = createBlobbiV3Identity(SEED);
    expect(UNUSUAL.colors).not.toEqual(own.colors);
    expect(UNUSUAL.traits).not.toEqual(own.traits);
    expectUnchanged(bornUnusual(), 'born');
  });
});

describe('every update preserves the identity the event states', () => {
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
    const baby = hatch(bornUnusual(), CREATED_AT + 3600);
    const adult = evolve(baby, CREATED_AT + 7200);
    for (const [label, start] of [['baby', baby], ['adult', adult]] as const) {
      let event = start;
      let now = event.created_at + 600;
      for (const action of ['feed', 'play', 'clean', 'rest', 'rest', 'feed'] as const) {
        const plan = planCareAction(parse(reload(event)), action, now);
        event = eventWith(plan.event.tags, now, plan.event.content);
        expectUnchanged(event, `${label} ${action}`);
        now += 600;
      }
      expect(parse(event).stage).toBe(label);
    }
  });

  it('an egg can be cleaned: the care republish of an incubating egg keeps its identity', () => {
    const egg = bornUnusual();
    const plan = planCareAction(parse(egg), 'clean', CREATED_AT + 60);
    expectUnchanged(eventWith(plan.event.tags, CREATED_AT + 60, plan.event.content), 'egg clean');
  });

  it('an item used on it', () => {
    const baby = hatch(bornUnusual(), CREATED_AT + 3600);
    let event = baby;
    for (const [item, at] of [[apple, CREATED_AT + 4000], [soap, CREATED_AT + 4600]] as const) {
      const plan = planItemUse(parse(reload(event)), item, 's'.repeat(64), at);
      event = eventWith(plan.event.tags, at, plan.event.content);
      expectUnchanged(event, `item ${item.name}`);
    }
  });

  it('hatch: the same individual, now a baby', () => {
    const egg = bornUnusual();
    const baby = hatch(egg, CREATED_AT + 3600);
    expect(parse(baby).stage).toBe('baby');
    expectUnchanged(baby, 'hatched');
    expect(getTagValue(baby.tags, 'd')).toBe(getTagValue(egg.tags, 'd'));
  });

  it('evolution: the same individual, now an adult, with no adult form taken from the seed', () => {
    const adult = evolve(hatch(bornUnusual(), CREATED_AT + 3600), CREATED_AT + 7200);
    expect(parse(adult).stage).toBe('adult');
    expectUnchanged(adult, 'evolved');
    expect(parse(adult).adultType).toBeUndefined();
  });

  it('a generic republish, and the tag repair every transition runs, with and without a previous event', () => {
    const adult = evolve(hatch(bornUnusual(), CREATED_AT + 3600), CREATED_AT + 7200);
    expectUnchanged(eventWith(updateBlobbiTags(adult.tags, { happiness: '12', last_interaction: String(CREATED_AT + 8000) }), CREATED_AT + 8000), 'republish');
    expectUnchanged(eventWith(validateAndRepairBlobbiTags(adult.tags, adult.tags).tags, CREATED_AT + 8000), 'repair with previous');
    expectUnchanged(eventWith(validateAndRepairBlobbiTags(adult.tags).tags, CREATED_AT + 8000), 'repair alone');
    // Nor does a repair put back what V3 does not have, even when an older event carried it.
    const legacy = [...adult.tags, ['size', 'large'], ['adult_type', 'bloomi'], ['spots', 'true']];
    const repaired = validateAndRepairBlobbiTags(adult.tags, legacy).tags;
    expectUnchanged(eventWith(repaired, CREATED_AT + 8000), 'repair against a legacy previous');
  });

  it('through the whole life: egg, baby, adult, and twenty updates later, one picture per stage', () => {
    let event = bornUnusual();
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
    expectUnchanged(event, 'after twenty updates');
    expect(renderBlobbiSvg({ ...toBlobbiVisual(parse(event)), instanceId: 'life' }).svg).toBe(adultDrawing);
    expect(new Set([eggDrawing, babyDrawing, adultDrawing]).size).toBe(3);
    for (const drawing of [eggDrawing, babyDrawing, adultDrawing]) expect(drawing).toContain('data-blobbi-generation="v3"');
  });
});

describe('rendering is the kit\'s', () => {
  const standing: BlobbiPresentation = { position: { x: 0.5, y: 0.7 }, facing: 'front', motion: 'idle', eyeOffset: undefined, expression: 'neutral', isSleeping: false, gesture: null };

  it('the home\'s actor draws the unusual Blobbi with the kit renderer, as the identity states it', () => {
    const adult = eventWith(updateBlobbiTags(bornUnusual().tags, { stage: 'adult', progression_state: 'none' }), CREATED_AT + 7200);
    render(<BlobbiActor blobbi={parse(adult)} presentation={standing} />);
    const svg = document.querySelector('[data-blobbi-body-box] svg')!;
    expect(svg.getAttribute('data-blobbi-generation')).toBe('v3');
    expect(svg.getAttribute('data-blobbi-stage')).toBe('adult');
    // Its own paint and its own traits, straight from the event: the stated pattern colour, the moon, the antennae, the leaf tail from behind.
    const markup = svg.outerHTML;
    expect(markup).toContain(UNUSUAL.colors.secondary);
    expect(markup).toContain('data-mark="moon"');
    expect(markup).toContain('data-part="antenna"');
    expect(markup).toContain('data-pattern="striped"');
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
