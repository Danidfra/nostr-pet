import { describe, expect, it } from 'vitest';
import { parseGameItemDefinition } from '@nostr-games/inventory';
import { describeItemUse, isSafeImageUrl, itemUsability, resolveHomeItem, safeEmoji, PARTNER_PRODUCE_HUNGER } from './item-model';
import {
  FARM_CARROT,
  OFFICIAL_APPLE,
  OFFICIAL_COIN,
  OFFICIAL_GLASSES,
  OFFICIAL_SOAP,
  STRANGER_ITEM,
  farmProduceDefinition,
  officialCareDefinition,
  officialCosmeticDefinition,
  officialCurrencyDefinition,
} from '@/test/inventory-fixtures';

const def = (event: Parameters<typeof parseGameItemDefinition>[0]) => parseGameItemDefinition(event, { mode: 'permissive' })!;
const baby = { stage: 'baby' as const, state: 'active', name: 'Brook' };

describe('resolveHomeItem: official definitions', () => {
  it('reads a care consumable: action, effects and stages from the content, the emoji as its glyph', () => {
    const apple = resolveHomeItem(OFFICIAL_APPLE, def(officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25, hygiene: -2, energy: 5 }, { emoji: '🍎' })));
    expect(apple.kind).toBe('care');
    expect(apple.name).toBe('Apple');
    expect(apple.issuer?.role).toBe('blobbi');
    expect(apple.care).toEqual({ action: 'feed', effects: { hunger: 25, hygiene: -2, energy: 5 }, stages: ['baby', 'adult'] });
    expect(apple.glyph).toEqual({ type: 'emoji', text: '🍎' });
    expect(apple.consumable).toBe(true);
    expect(apple.equippable).toBe(false);
    expect(describeItemUse(apple, 'Brook')).toBe('Brook will eat it.');
  });

  it('reads a cosmetic: an allow-listed image, equippable, not a care item', () => {
    const glasses = resolveHomeItem(OFFICIAL_GLASSES, def(officialCosmeticDefinition('blobbi:cosmetic:stargazer-glasses', 'Stargazer Glasses', 'eyewear')));
    expect(glasses.kind).toBe('cosmetic');
    expect(glasses.care).toBeNull();
    expect(glasses.equippable).toBe(true);
    expect(glasses.glyph).toEqual({ type: 'image', url: 'https://blossom.primal.net/abc.webp' });
    expect(glasses.description).toBe('A Stargazer Glasses.');
    expect(glasses.rarity).toBe('rare');
    expect(itemUsability(glasses, baby)).toEqual({ ok: false, reason: 'Equip it on the Island.' });
  });

  it('reads a currency: shown, never usable at home', () => {
    const coin = resolveHomeItem(OFFICIAL_COIN, def(officialCurrencyDefinition()));
    expect(coin.kind).toBe('currency');
    expect(itemUsability(coin, baby).reason).toMatch(/Island/);
  });

  it('ignores numbers that are not finite and actions it does not know', () => {
    const odd = officialCareDefinition('blobbi:food:odd', 'Odd', 'food', 'feed', { hunger: 10 });
    odd.content = JSON.stringify({ effects: { 'game:blobbi': { hunger: 'lots', energy: Number.NaN, happiness: 5 } }, metadata: { action: 'feed', stages: ['baby'] } });
    const item = resolveHomeItem(`31632:${odd.pubkey}:blobbi:food:odd`, def(odd));
    expect(item.care).toEqual({ action: 'feed', effects: { happiness: 5 }, stages: ['baby'] });

    const weird = officialCareDefinition('blobbi:food:weird', 'Weird', 'food', 'feed', { hunger: 10 });
    weird.content = JSON.stringify({ effects: { 'game:blobbi': { hunger: 10 } }, metadata: { action: 'explode' } });
    expect(resolveHomeItem(`31632:${weird.pubkey}:blobbi:food:weird`, def(weird)).care).toBeNull();
  });
});

describe('resolveHomeItem: partners and strangers', () => {
  it('turns Farm produce into food by home policy, never by the partner numbers', () => {
    const carrot = resolveHomeItem(FARM_CARROT, def(farmProduceDefinition()));
    expect(carrot.kind).toBe('care');
    expect(carrot.issuer?.label).toBe('Nostr Farm');
    expect(carrot.care).toEqual({ action: 'feed', effects: { hunger: PARTNER_PRODUCE_HUNGER }, stages: ['baby', 'adult'] });
    expect(carrot.glyph).toEqual({ type: 'image', url: 'https://blossom.primal.net/carrot.webp' });
  });

  it('a partner item that is not raw produce is shown but not usable', () => {
    const tool = farmProduceDefinition('farm:tool:hoe', 'Hoe');
    tool.tags = tool.tags.map((t) => (t[0] === 'category' ? ['category', 'tool'] : t)).filter((t) => !(t[0] === 't' && t[1] === 'edible'));
    const item = resolveHomeItem(`31632:${tool.pubkey}:farm:tool:hoe`, def(tool));
    expect(item.kind).toBe('unknown');
    expect(item.name).toBe('Hoe');
    expect(itemUsability(item, baby).ok).toBe(false);
  });

  it('an untrusted issuer is unknown even with a definition, and gets no artwork', () => {
    const forged = officialCareDefinition('weird:thing', 'Free Cake', 'food', 'feed', { hunger: 100 });
    forged.pubkey = 'b'.repeat(64);
    forged.tags.push(['image', 'https://blossom.primal.net/cake.webp']);
    const item = resolveHomeItem(STRANGER_ITEM, def(forged));
    expect(item.kind).toBe('unknown');
    expect(item.name).toBe('Unknown item');
    expect(item.issuer).toBeNull();
    expect(item.glyph).toEqual({ type: 'category', category: 'unknown' });
    expect(item.care).toBeNull();
  });

  it('a definition from a different issuer than the address names is not believed', () => {
    const apple = def(officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }));
    const item = resolveHomeItem(FARM_CARROT, apple);
    expect(item.kind).toBe('unknown');
    expect(item.name).toBe('Unknown Nostr Farm item');
  });

  it('no definition at all: unknown, named by its issuer when trusted', () => {
    expect(resolveHomeItem(OFFICIAL_APPLE, undefined).name).toBe('Unknown Blobbi item');
    expect(resolveHomeItem('not-an-address', undefined).name).toBe('Unknown item');
  });
});

describe('artwork safety', () => {
  it('accepts only https on an allow-listed host, raster only', () => {
    expect(isSafeImageUrl('https://blossom.primal.net/a.webp')).toBe(true);
    expect(isSafeImageUrl('https://assets.blobbi.pet/items/x.png')).toBe(true);
    expect(isSafeImageUrl('http://blossom.primal.net/a.webp')).toBe(false);
    expect(isSafeImageUrl('https://evil.example/a.webp')).toBe(false);
    expect(isSafeImageUrl('https://blossom.primal.net.evil.example/a.webp')).toBe(false);
    expect(isSafeImageUrl('https://user:pw@blossom.primal.net/a.webp')).toBe(false);
    expect(isSafeImageUrl('https://blossom.primal.net/a.svg')).toBe(false);
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
    expect(isSafeImageUrl(undefined)).toBe(false);
  });

  it('falls back from an unsafe image to the emoji, then to a category glyph', () => {
    const shady = officialCosmeticDefinition('blobbi:cosmetic:shady', 'Shady Hat', 'headwear', 'https://evil.example/hat.webp');
    const item = resolveHomeItem(`31632:${shady.pubkey}:blobbi:cosmetic:shady`, def(shady));
    expect(item.glyph).toEqual({ type: 'emoji', text: '👓' });
    const plain = officialCosmeticDefinition('blobbi:cosmetic:plain', 'Plain Hat', 'headwear', 'https://evil.example/hat.webp');
    plain.tags = plain.tags.filter((t) => t[0] !== 'symbol');
    expect(resolveHomeItem(`31632:${plain.pubkey}:blobbi:cosmetic:plain`, def(plain)).glyph).toEqual({ type: 'category', category: 'headwear' });
  });

  it('takes only a short, markup-free emoji', () => {
    expect(safeEmoji('🍎')).toBe('🍎');
    expect(safeEmoji(' 🧼 ')).toBe('🧼');
    expect(safeEmoji('<img src=x>')).toBeNull();
    expect(safeEmoji('apple')).toBeNull();
    expect(safeEmoji('🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎')).toBeNull();
    expect(safeEmoji('')).toBeNull();
    expect(safeEmoji(42)).toBeNull();
  });
});

describe('itemUsability', () => {
  const apple = resolveHomeItem(OFFICIAL_APPLE, def(officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 })));
  const soap = resolveHomeItem(OFFICIAL_SOAP, def(officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { stages: ['egg', 'baby', 'adult'], emoji: '🧼' })));

  it('gates by the definition stages: an egg may be cleaned, not fed', () => {
    const egg = { stage: 'egg' as const, state: 'active', name: 'Egg' };
    expect(itemUsability(apple, egg)).toEqual({ ok: false, reason: 'Not until it hatches.' });
    expect(itemUsability(soap, egg)).toEqual({ ok: true });
  });

  it('gates by activity state', () => {
    expect(itemUsability(apple, { ...baby, state: 'sleeping' }).reason).toMatch(/Sleeping/);
    expect(itemUsability(apple, { ...baby, state: 'hibernating' }).reason).toMatch(/Hibernating/);
    expect(itemUsability(apple, baby)).toEqual({ ok: true });
  });
});
