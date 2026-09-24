/**
 * Inventory fixtures built with `@nostr-games/inventory`'s own builders, so
 * the wire shapes (kinds 31632, 31633, 1416, 1417) are never re-described
 * here. Every event gets a fake id and signature; parsers accept them because
 * hex checks are off by default.
 */
import {
  buildGameInventoryEvent,
  buildGameInventoryFoldEvent,
  buildGameInventorySpendEvent,
  buildGameItemAddress,
  buildGameItemDefinitionEvent,
  buildGameInventoryAddress,
  type BuildGameItemDefinitionInput,
} from '@nostr-games/inventory';
import type { NostrEvent } from '@blobbi-kit/core';
import { FARM_ITEM_ISSUER, OFFICIAL_ITEM_ISSUER } from '@/features/inventory/issuers';
import { PUBKEY, CREATED_AT } from './fixtures';

let counter = 0;
function fakeId(prefix: string): string {
  counter += 1;
  return `${prefix}${String(counter).padStart(4, '0')}`.padEnd(64, 'f');
}

export function resetInventoryFixtureIds(): void {
  counter = 0;
}

function finish(template: { kind: number; content: string; tags: string[][] }, pubkey: string, createdAt: number, id?: string): NostrEvent {
  return { ...template, pubkey, created_at: createdAt, id: id ?? fakeId('d'), sig: '0'.repeat(128) };
}

/** An official care consumable, shaped exactly like the relays serve them (no image, emoji in metadata). */
export function officialCareDefinition(
  d: string,
  name: string,
  category: 'food' | 'toy' | 'hygiene' | 'medicine' | 'energy',
  action: 'feed' | 'play' | 'clean' | 'medicine' | 'boost',
  effects: Record<string, number>,
  options: { stages?: string[]; emoji?: string; createdAt?: number } = {},
): NostrEvent {
  const input: BuildGameItemDefinitionInput = {
    id: d,
    name,
    type: 'consumable',
    category,
    contexts: ['game:blobbi'],
    topics: [category === 'food' ? 'edible' : category, category],
    version: '1',
    alt: `Game item definition: ${name}`,
    content: {
      effects: { 'game:blobbi': effects },
      metadata: { itemId: d.replace(/[^a-z]/g, '_'), action, stages: options.stages ?? ['baby', 'adult'], emoji: options.emoji ?? '🍎', stackable: true },
    },
  };
  return finish(buildGameItemDefinitionEvent(input), OFFICIAL_ITEM_ISSUER, options.createdAt ?? CREATED_AT);
}

/** An official cosmetic with a blossom image and a slot. */
export function officialCosmeticDefinition(d: string, name: string, slot: string, image = 'https://blossom.primal.net/abc.webp'): NostrEvent {
  return finish(
    buildGameItemDefinitionEvent({
      id: d,
      name,
      type: 'cosmetic',
      category: slot,
      image,
      symbol: '👓',
      rarity: 'rare',
      maxStack: '1',
      contexts: ['game:blobbi', 'game:blobbi-island'],
      topics: ['equipable', 'wearable', 'cosmetic', slot],
      content: { description: `A ${name}.`, visual: { slot, forms: ['baby', 'adult'] } },
    }),
    OFFICIAL_ITEM_ISSUER,
    CREATED_AT,
  );
}

export function officialCurrencyDefinition(d = 'blobbi:currency:coin', name = 'Blobbi Coin'): NostrEvent {
  return finish(
    buildGameItemDefinitionEvent({ id: d, name, type: 'currency', category: 'currency', image: 'https://blossom.primal.net/coin.webp', topics: ['currency', 'coin'], contexts: ['game:blobbi'] }),
    OFFICIAL_ITEM_ISSUER,
    CREATED_AT,
  );
}

/** Farm produce, as Farm publishes it: no effects, `edible` topic, blossom image. */
export function farmProduceDefinition(d = 'farm:produce:carrot', name = 'Carrot', image = 'https://blossom.primal.net/carrot.webp'): NostrEvent {
  return finish(
    buildGameItemDefinitionEvent({
      id: d,
      name,
      type: 'consumable',
      category: 'food',
      image,
      topics: ['edible', 'vegetable', 'crop', 'farm-produce'],
      contexts: ['game:farm'],
      content: { description: 'Fresh from the field.' },
    }),
    FARM_ITEM_ISSUER,
    CREATED_AT,
  );
}

export const OFFICIAL_APPLE = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, 'blobbi:food:apple');
export const OFFICIAL_SOAP = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, 'blobbi:hygiene:soap');
export const OFFICIAL_BALL = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, 'blobbi:toy:ball');
export const OFFICIAL_COIN = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, 'blobbi:currency:coin');
export const OFFICIAL_GLASSES = buildGameItemAddress(OFFICIAL_ITEM_ISSUER, 'blobbi:cosmetic:stargazer-glasses');
export const FARM_CARROT = buildGameItemAddress(FARM_ITEM_ISSUER, 'farm:produce:carrot');
export const STRANGER = 'b'.repeat(64);
export const STRANGER_ITEM = buildGameItemAddress(STRANGER, 'weird:thing');

export const ISLAND_INVENTORY = buildGameInventoryAddress(PUBKEY, 'blobbi:island');
export const FARM_INVENTORY = buildGameInventoryAddress(PUBKEY, 'farm:main');

/** A kind 31633 snapshot owned by the test player. */
export function inventoryEvent(
  d: string,
  items: Record<string, number>,
  options: { name?: string; fold?: string; revision?: number; createdAt?: number; owner?: string; id?: string } = {},
): NostrEvent {
  const template = buildGameInventoryEvent({
    id: d,
    name: options.name,
    items: Object.entries(items).map(([address, quantity]) => ({ address, quantity })),
    fold: options.fold ? { eventId: options.fold } : undefined,
    revision: options.revision,
  });
  return finish(template, options.owner ?? PUBKEY, options.createdAt ?? CREATED_AT, options.id);
}

/** A kind 1416 spend by the player against one of their inventories. */
export function spendEvent(inventoryAddress: string, itemAddress: string, options: { quantity?: number; createdAt?: number; id?: string; owner?: string; nonce?: string } = {}): NostrEvent {
  const template = buildGameInventorySpendEvent({
    inventoryAddress,
    itemAddress,
    quantity: options.quantity ?? 1,
    purpose: 'feed:blobbi',
    client: 'test',
    nonce: options.nonce ?? fakeId('n').slice(0, 8),
  });
  return finish(template, options.owner ?? PUBKEY, options.createdAt ?? CREATED_AT + 10, options.id ?? fakeId('5'));
}

/** A kind 1417 fold by the player. */
export function foldEvent(inventoryAddress: string, spendIds: string[], options: { previous?: string; createdAt?: number; id?: string } = {}): NostrEvent {
  const template = buildGameInventoryFoldEvent({
    inventoryAddress,
    previous: options.previous ? { eventId: options.previous } : undefined,
    spends: spendIds.map((eventId) => ({ eventId })),
  });
  return finish(template, PUBKEY, options.createdAt ?? CREATED_AT + 20, options.id ?? fakeId('7'));
}
