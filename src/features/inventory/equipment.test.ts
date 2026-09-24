/**
 * What the home draws from an Island equipment document, gate by gate: the
 * same refusals Island applies, so a Blobbi never wears at home what it
 * could not wear there.
 */
import { describe, expect, it } from 'vitest';
import { parseGameItemDefinition, parseGameItemPlacement, type GameItemDefinition, type GameItemPlacementEntry } from '@nostr-games/inventory';
import { artworkSourcesFor, blobbiTargetAddress, resolveWornEquipment, toAccessoryInput } from './equipment';
import { PUBKEY } from '@/test/fixtures';
import { OFFICIAL_CAP, OFFICIAL_GLASSES, OFFICIAL_SPARKLES, officialCosmeticDefinition, officialEffectDefinition, placementEvent } from '@/test/inventory-fixtures';

const D = 'blobbi-aaaaaaaaaaaa-0000000001';
const def = (e: Parameters<typeof parseGameItemDefinition>[0]) => parseGameItemDefinition(e, { mode: 'permissive' })!;
const glasses = def(officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear'));
const cap = def(officialCosmeticDefinition('blobbi:cosmetic:block-builder-cap', 'Block Builder Cap', 'headwear'));
const sparkles = def(officialEffectDefinition());

const defs = new Map<string, GameItemDefinition>([
  [OFFICIAL_GLASSES, glasses],
  [OFFICIAL_CAP, cap],
  [OFFICIAL_SPARKLES, sparkles],
]);
const owned = new Map<string, number>([
  [OFFICIAL_GLASSES, 1],
  [OFFICIAL_CAP, 1],
  [OFFICIAL_SPARKLES, 1],
]);

const equip = (item: string, slot: string, extra: Partial<GameItemPlacementEntry> = {}): GameItemPlacementEntry => ({ id: slot, item, mode: 'equip', slot, ...extra });

function resolve(entries: GameItemPlacementEntry[], over: Partial<Parameters<typeof resolveWornEquipment>[0]> = {}, placementOptions: Parameters<typeof placementEvent>[2] = {}) {
  const placement = parseGameItemPlacement(placementEvent(D, entries, placementOptions), { mode: 'permissive' });
  return resolveWornEquipment({ placement, ownerPubkey: PUBKEY, blobbiD: D, stage: 'baby', definitionsByAddress: defs, quantityByAddress: owned, ...over });
}

describe('resolveWornEquipment', () => {
  it('draws owned official wearables in their declared slot and turns effect items into renderer effects', () => {
    const worn = resolve([equip(OFFICIAL_GLASSES, 'eyewear', { position: { x: 50.8, y: 46.9 }, scale: { x: 1.2, y: 1.2 } }), equip(OFFICIAL_CAP, 'headwear'), equip(OFFICIAL_SPARKLES, 'ambient-particles')]);
    expect(worn.wearables.map((w) => w.slot).sort()).toEqual(['eyewear', 'headwear']);
    expect(worn.effects).toEqual([{ id: 'golden-sparkles' }]);
    expect([...worn.wornAddresses].sort()).toEqual([OFFICIAL_CAP, OFFICIAL_SPARKLES, OFFICIAL_GLASSES].sort());
    const input = toAccessoryInput(worn.wearables.find((w) => w.slot === 'eyewear')!, 'front')!;
    expect(input).toMatchObject({ code: OFFICIAL_GLASSES, slot: 'eyewear', x: 50.8, y: 46.9, scale: 1.2, rot: 0, flipX: false, url: 'https://blossom.primal.net/abc.webp' });
    expect(toAccessoryInput(worn.wearables.find((w) => w.slot === 'headwear')!, 'front')).toMatchObject({ x: 50, y: 50, scale: 1 });
  });

  it('refuses what Island refuses: mode, slot mismatch, unknown definition, not owned, wrong form, 3D, odd rotation', () => {
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear', { mode: 'place' })]).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'headwear')]).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], { definitionsByAddress: new Map() }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], { quantityByAddress: new Map() }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], { stage: 'egg' }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear', { position: { x: 1, y: 2, z: 3 } })]).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear', { rotation: { type: 'quaternion', x: 0, y: 0, z: 0, w: 1 } })]).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_SPARKLES, 'aura')]).effects).toEqual([]);
  });

  it('refuses a document by someone else, for another Blobbi, or in a frame the renderer cannot place', () => {
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], {}, { owner: 'c'.repeat(64) }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], { ownerPubkey: 'c'.repeat(64) }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], {}, { target: 'other' }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], {}, { reference: '3d' }).wearables).toEqual([]);
    expect(resolve([equip(OFFICIAL_GLASSES, 'eyewear')], {}, { reference: 'none', target: 'none' }).wearables).toHaveLength(1);
  });

  it('a stranger cannot dress the Blobbi by publishing a look-alike definition', () => {
    const forged = officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Evil Glasses', 'eyewear', 'https://evil.example/x.webp');
    forged.pubkey = 'b'.repeat(64);
    const address = `31632:${'b'.repeat(64)}:blobbi:cosmetic:stargazer-glasses`;
    const worn = resolve([equip(address, 'eyewear')], { definitionsByAddress: new Map([[address, def(forged)]]), quantityByAddress: new Map([[address, 5]]) });
    expect(worn.wearables).toEqual([]);
  });

  it('last entry wins a slot', () => {
    const cap2 = def(officialCosmeticDefinition('blobbi:cosmetic:other-cap', 'Other Cap', 'headwear'));
    const other = `31632:${cap2.issuer}:blobbi:cosmetic:other-cap`;
    const worn = resolve([equip(OFFICIAL_CAP, 'headwear'), equip(other, 'headwear')], { definitionsByAddress: new Map([...defs, [other, cap2]]), quantityByAddress: new Map([...owned, [other, 1]]) });
    expect(worn.wearables.map((w) => w.address)).toEqual([other]);
  });
});

describe('artworkSourcesFor', () => {
  it('orders images per facing and drops anything not allow-listed', () => {
    const multi = officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear');
    multi.tags.push(['image', 'https://blossom.primal.net/left.webp', 'side-left'], ['image', 'https://blossom.primal.net/right.webp', 'side-right'], ['image', 'https://evil.example/back.webp', 'back']);
    const d = def(multi);
    expect(artworkSourcesFor(d, 'front')).toEqual(['https://blossom.primal.net/abc.webp']);
    expect(artworkSourcesFor(d, 'left')).toEqual(['https://blossom.primal.net/left.webp', 'https://blossom.primal.net/abc.webp']);
    expect(artworkSourcesFor(d, 'right')).toEqual(['https://blossom.primal.net/right.webp', 'https://blossom.primal.net/abc.webp']);
    expect(artworkSourcesFor(d, 'back')).toEqual(['https://blossom.primal.net/abc.webp']);
  });

  it('a wearable with no safe artwork produces no accessory', () => {
    const bad = def(officialCosmeticDefinition('blobbi:cosmetic:x', 'X', 'headwear', 'https://evil.example/x.webp'));
    const address = `31632:${bad.issuer}:blobbi:cosmetic:x`;
    const worn = resolve([equip(address, 'headwear')], { definitionsByAddress: new Map([[address, bad]]), quantityByAddress: new Map([[address, 1]]) });
    expect(worn.wearables).toHaveLength(1);
    expect(toAccessoryInput(worn.wearables[0], 'front')).toBeNull();
  });
});

describe('blobbiTargetAddress', () => {
  it('is the Blobbi kind 31124 address', () => {
    expect(blobbiTargetAddress(PUBKEY, D)).toBe(`31124:${PUBKEY}:${D}`);
  });
});
