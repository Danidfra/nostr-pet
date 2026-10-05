/**
 * The two events an adoption produces, pinned against the kit's own
 * builders and parsers: canonical d and seed, incubating from the start with
 * the kit's hatch missions, `created_at` pinned, and a profile that is either
 * created from `buildBlobbonautTags` or updated with everything preserved.
 */
import { describe, expect, it } from 'vitest';
import {
  KIND_BLOBBI_STATE,
  KIND_BLOBBONAUT_PROFILE,
  NEW_BLOBBI_VISUAL_GENERATION,
  VISUAL_GENERATION_TAG,
  buildEggTags,
  deriveBlobbiSeedV1,
  getBlobbiVisualIdentity,
  getCanonicalBlobbiD,
  getTagValue,
  getTagValues,
  isModernBlobbiEvent,
  parseBlobbonautEvent,
  parseModernBlobbiEvent,
  type NostrEvent,
} from '@blobbi-kit/core';
import { HATCH_MISSIONS } from '@blobbi-kit/react';
import { PUBKEY, profileEvent } from '@/test/fixtures';
import { createBlobbiV3Identity, renderBlobbiSvg } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { ADOPTION_VISUAL_GENERATION, DEFAULT_EGG_NAME, adoptionEggOptions, eggTemplate, isOwnedBlobbiEvent, newEggPreview, normalizeBlobbiName, previewCompanion, profileTemplate, renamePreview } from './adoption-plan';

const NOW = 1_800_000_000;

describe('newEggPreview / eggTemplate', () => {
  it('is the kit egg: canonical d, seed from (pubkey, d, createdAt), incubating, hatch missions, created_at pinned', () => {
    const preview = newEggPreview(PUBKEY, 'Pip', NOW);
    expect(preview.d).toBe(getCanonicalBlobbiD(PUBKEY, preview.petId));
    expect(preview.d).toMatch(/^blobbi-[0-9a-f]{12}-[0-9a-f]{10}$/);
    expect(preview.seed).toBe(deriveBlobbiSeedV1(PUBKEY, preview.d, NOW));

    const template = eggTemplate(preview);
    expect(template.kind).toBe(KIND_BLOBBI_STATE);
    expect(template.created_at).toBe(NOW);
    expect(getTagValue(template.tags, 'd')).toBe(preview.d);
    expect(getTagValue(template.tags, 'seed')).toBe(preview.seed);
    expect(getTagValue(template.tags, 'name')).toBe('Pip');
    expect(getTagValue(template.tags, 'stage')).toBe('egg');
    expect(getTagValue(template.tags, 'state')).toBe('active');
    expect(getTagValue(template.tags, 'progression_state')).toBe('incubating');
    expect(getTagValue(template.tags, 'progression_started_at')).toBe(String(NOW));
    expect(getTagValue(template.tags, 'b')).toBe('blobbi:ecosystem:v1');
    // Born V3: this app's creation rule, one constant. The ecosystem default in the kit is still V2.
    expect(ADOPTION_VISUAL_GENERATION).toBe('v3');
    expect(NEW_BLOBBI_VISUAL_GENERATION).toBe('v2');
    expect(getTagValue(template.tags, VISUAL_GENERATION_TAG)).toBe('v3');

    const event: NostrEvent = { ...template, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) };
    expect(isModernBlobbiEvent(event)).toBe(true);
    const companion = parseModernBlobbiEvent(event)!;
    expect(companion.stage).toBe('egg');
    expect(companion.visualGeneration).toBe('v3');
    expect(previewCompanion(preview)?.visualGeneration).toBe('v3');
    expect(companion.progressionState).toBe('incubating');
    expect(companion.seed).toBe(preview.seed);
    expect(companion.evolution.map((m) => m.id).sort()).toEqual(HATCH_MISSIONS.map((m) => m.id).sort());
  });

  it('states the whole V3 identity at birth, from the kit\'s creation rule for the new seed, with nothing missing', () => {
    const preview = newEggPreview(PUBKEY, 'Pip', NOW);
    const template = eggTemplate(preview);
    const companion = parseModernBlobbiEvent({ ...template, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) })!;
    // Exactly what the renderer's creation rule gives this seed: nothing invented here, nothing dropped.
    const { missing, ...identity } = companion.v3Identity!;
    expect(missing).toEqual([]);
    expect(identity).toEqual(createBlobbiV3Identity(preview.seed));
    expect(identity.algorithm).toBe(1);
    for (const colour of [identity.colors.base, identity.colors.secondary, identity.colors.eye]) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    // The explicit identity is on the event itself, in plain, generation-independent tags.
    expect(getTagValue(template.tags, 'base_color')).toBe(identity.colors.base);
    expect(getTagValue(template.tags, 'secondary_color')).toBe(identity.colors.secondary);
    expect(getTagValue(template.tags, 'eye_color')).toBe(identity.colors.eye);
    expect(getTagValue(template.tags, 'accent_color')).toBe(identity.colors.accent);
    expect(getTagValue(template.tags, 'visual_algorithm')).toBe('1');
    for (const trait of ['antenna', 'horns', 'ears', 'tail'] as const) expect(getTagValue(template.tags, trait), trait).toBe(identity.traits[trait]);
    for (const mark of ['spots', 'belly', 'freckles'] as const) expect(getTagValue(template.tags, mark), mark).toBe(String(identity.traits[mark]));
    expect(template.tags.some((t) => t[0].startsWith('v3_'))).toBe(false);
    // On V3 the colour tags are the Blobbi's own, not the seed's mirrors (which is what a V2 egg of the same seed carries).
    const v2 = buildEggTags(PUBKEY, preview.petId, NOW, 'Pip', { visualGeneration: 'v2' });
    expect(getTagValue(v2, 'seed')).toBe(preview.seed);
    expect(getTagValue(template.tags, 'base_color')).not.toBe(getTagValue(v2, 'base_color'));
    // The incubation update eggTemplate applies on top did not put the mirrors back.
    expect(companion.visualTraits.baseColor).toBe(identity.colors.base);
  });

  it('the preview IS the egg: what the player sees before adopting is drawn from the event that is published', () => {
    const preview = newEggPreview(PUBKEY, 'Pip', NOW);
    const template = eggTemplate(preview);
    const published = parseModernBlobbiEvent({ ...template, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) })!;
    const draw = (companion: NonNullable<ReturnType<typeof previewCompanion>>) => {
      const visual = toBlobbiVisual(companion);
      return renderBlobbiSvg({ ...visual, stage: 'egg', instanceId: 'same' }).svg;
    };
    expect(draw(previewCompanion(preview)!)).toBe(draw(published));
    expect(getBlobbiVisualIdentity(published).v3).toEqual(getBlobbiVisualIdentity(previewCompanion(preview)!).v3);
  });

  it('can still be asked for the earlier generations, and then writes exactly what they always were', () => {
    expect(adoptionEggOptions('v2')).toEqual({ visualGeneration: 'v2' });
    expect(adoptionEggOptions('v1')).toEqual({ visualGeneration: 'v1' });
    const v2 = buildEggTags(PUBKEY, '0000000007', NOW, 'Pip', adoptionEggOptions('v2'));
    for (const name of ['visual_algorithm', 'accent_color', 'antenna', 'horns', 'ears', 'tail', 'spots', 'belly', 'freckles']) expect(getTagValue(v2, name), name).toBeUndefined();
    expect(getTagValue(v2, VISUAL_GENERATION_TAG)).toBe('v2');
  });

  it('two previews are two identities; renaming keeps the identity', () => {
    const a = newEggPreview(PUBKEY, DEFAULT_EGG_NAME, NOW);
    const b = newEggPreview(PUBKEY, DEFAULT_EGG_NAME, NOW);
    expect(a.d).not.toBe(b.d);
    const renamed = renamePreview(a, 'Mo');
    expect(renamed.d).toBe(a.d);
    expect(renamed.seed).toBe(a.seed);
    expect(getTagValue(eggTemplate(renamed).tags, 'name')).toBe('Mo');
  });

  it('the preview parses through the same parser as the real thing, so the renderer draws the same egg', () => {
    const preview = newEggPreview(PUBKEY, 'Pip', NOW);
    const companion = previewCompanion(preview)!;
    expect(companion.d).toBe(preview.d);
    expect(companion.visualTraits.baseColor).toBeTruthy();
  });
});

describe('profileTemplate', () => {
  it('creates a profile from the kit base tags with a name, has and current_companion', () => {
    const template = profileTemplate({ ownerPubkey: PUBKEY, profile: null, d: 'blobbi-aaaaaaaaaaaa-0000000001', suggestedName: 'Dana' });
    expect(template.kind).toBe(KIND_BLOBBONAUT_PROFILE);
    expect(template.content).toBe('');
    const event: NostrEvent = { ...template, id: 'p'.repeat(64), pubkey: PUBKEY, created_at: NOW, sig: '0'.repeat(128) };
    const parsed = parseBlobbonautEvent(event)!;
    expect(parsed.name).toBe('Dana');
    expect(parsed.has).toEqual(['blobbi-aaaaaaaaaaaa-0000000001']);
    expect(parsed.currentCompanion).toBe('blobbi-aaaaaaaaaaaa-0000000001');
    expect(getTagValue(template.tags, 'b')).toBe('blobbi:ecosystem:v1');
    expect(getTagValue(template.tags, 'blobbi_onboarding_done')).toBe('false');
  });

  it('updates an existing profile: has merged, current_companion set, unknown tags and content kept, prev carried', () => {
    const existing = profileEvent({ has: ['blobbi-aaaaaaaaaaaa-0000000009'], currentCompanion: 'blobbi-aaaaaaaaaaaa-0000000009', xp: 120 });
    existing.tags.push(['room', 'attic'], ['custom_unknown', 'keep']);
    existing.content = '{"missions":{"daily":[]}}';
    const profile = parseBlobbonautEvent(existing)!;
    const template = profileTemplate({ ownerPubkey: PUBKEY, profile, d: 'blobbi-aaaaaaaaaaaa-0000000001', suggestedName: 'ignored' });
    expect(getTagValues(template.tags, 'has').sort()).toEqual(['blobbi-aaaaaaaaaaaa-0000000001', 'blobbi-aaaaaaaaaaaa-0000000009']);
    expect(template.tags.filter(([n]) => n === 'current_companion')).toEqual([['current_companion', 'blobbi-aaaaaaaaaaaa-0000000001']]);
    expect(getTagValue(template.tags, 'xp')).toBe('120');
    expect(getTagValue(template.tags, 'room')).toBe('attic');
    expect(getTagValue(template.tags, 'custom_unknown')).toBe('keep');
    expect(getTagValue(template.tags, 'name')).toBe('Tester');
    expect(template.content).toBe('{"missions":{"daily":[]}}');
    expect(template.prev).toBe(existing);
  });
});

describe('normalizeBlobbiName', () => {
  it('trims, collapses spaces, strips control characters, defaults when empty, caps the length', () => {
    expect(normalizeBlobbiName('')).toEqual({ ok: true, name: DEFAULT_EGG_NAME });
    expect(normalizeBlobbiName('   ')).toEqual({ ok: true, name: DEFAULT_EGG_NAME });
    expect(normalizeBlobbiName('  Pip   Pop ')).toEqual({ ok: true, name: 'Pip Pop' });
    expect(normalizeBlobbiName('Pi p​')).toEqual({ ok: true, name: 'Pip' });
    expect(normalizeBlobbiName('x'.repeat(25)).ok).toBe(false);
    expect(normalizeBlobbiName('🍎 Apple')).toEqual({ ok: true, name: '🍎 Apple' });
  });
});

describe('isOwnedBlobbiEvent', () => {
  it('counts any 31124 with a d and a stage, namespace or not; nothing else', () => {
    const base = { id: 'x'.repeat(64), pubkey: PUBKEY, created_at: NOW, content: '', sig: '0'.repeat(128) };
    expect(isOwnedBlobbiEvent({ ...base, kind: KIND_BLOBBI_STATE, tags: [['d', 'anything'], ['stage', 'baby']] })).toBe(true);
    expect(isOwnedBlobbiEvent({ ...base, kind: KIND_BLOBBI_STATE, tags: [['d', 'anything'], ['stage', 'larva']] })).toBe(false);
    expect(isOwnedBlobbiEvent({ ...base, kind: KIND_BLOBBI_STATE, tags: [['stage', 'egg']] })).toBe(false);
    expect(isOwnedBlobbiEvent({ ...base, kind: 1, tags: [['d', 'a'], ['stage', 'egg']] })).toBe(false);
  });
});
