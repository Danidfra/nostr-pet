/**
 * SNAPSHOT of the official Blobbi care-item definitions, for when the
 * definition relays do not answer. NOT LIVE NOSTR DATA.
 *
 * The live source is the set of kind 31632 events signed by the official
 * item issuer (`OFFICIAL_ITEM_ISSUER`, `issuers.ts`), read at runtime by
 * `useHomeInventory` through the trusted-issuer pipeline; every fetched
 * definition that passes issuer validation REPLACES the row below with the
 * same address. This file only lets the home draw and apply the items it
 * already knows when that read fails or is slow: it carries the immutable
 * minimum (identity, name, category, emoji, care action, stages, effects),
 * no event, no signature, and is marked `definitionSource: 'builtin'` in
 * the UI. It never grants ownership and never overrides a valid event.
 *
 * Only care consumables are kept (currencies, effects and cosmetics are
 * never starter-usable). Generated from a read-only REQ
 * (`kinds: [31632], authors: [official issuer]`) on 2026-09-25 against
 * relay.ditto.pub (19 of 39 official definitions were consumables);
 * `eventId` / `createdAt` say which revision each row mirrors.
 *
 * To refresh when the issuer publishes new items or revisions:
 *   node scripts/refresh-official-catalog.mjs > src/features/inventory/official-catalog-snapshot.ts
 * then review the diff (a new row is a new item; a changed row is a
 * revision; a vanished row is worth a question, not a silent removal).
 */
import type { BlobbiStage, CareItemEffect } from '@blobbi-kit/core';
import type { ItemAction } from './item-model';

export interface OfficialCatalogRow {
  /** The `d` of the official definition; the address is `31632:<official issuer>:<d>`. */
  d: string;
  name: string;
  category: 'food' | 'energy' | 'toy' | 'hygiene' | 'medicine';
  emoji: string;
  action: ItemAction;
  stages: readonly BlobbiStage[];
  effects: CareItemEffect;
  /** The revision this row mirrors, for the next refresh's diff. */
  eventId: string;
  createdAt: number;
}

export const OFFICIAL_CATALOG_SNAPSHOT_DATE = '2026-09-25';

export const OFFICIAL_CATALOG_SNAPSHOT: readonly OfficialCatalogRow[] = [
  { d: 'blobbi:food:apple', name: "Apple", category: 'food', emoji: '🍎', action: 'feed', stages: ['baby', 'adult'], effects: { hunger: 25, hygiene: -2, energy: 5 }, eventId: 'de38ee53d72c3a9e894a3a03e0ff6923a4a879d713ad043a25cff1175d117e9d', createdAt: 1784848555 },
  { d: 'blobbi:food:burger', name: "Burger", category: 'food', emoji: '🍔', action: 'feed', stages: ['baby', 'adult'], effects: { hunger: 45, happiness: 10, hygiene: -8, energy: 8 }, eventId: '7e6597997971bd14ea2e0c3afc007f4150278cce0e64eff5a8ad4a0be1cb971f', createdAt: 1784848555 },
  { d: 'blobbi:food:cake', name: "Cake", category: 'food', emoji: '🎂', action: 'feed', stages: ['baby', 'adult'], effects: { hunger: 25, happiness: 30, hygiene: -10, energy: 10 }, eventId: '957d974c59fd6763bb1f351b35b8284519fc90a100c6dc00e3642c6bc60c6dc0', createdAt: 1784848555 },
  { d: 'blobbi:food:pizza', name: "Pizza", category: 'food', emoji: '🍕', action: 'feed', stages: ['baby', 'adult'], effects: { hunger: 40, happiness: 15, hygiene: -9, energy: 10 }, eventId: '7504bae36a9d59a09e2c19dcf2eecae48ece38bb88627e2e55178f2f96ffc18e', createdAt: 1784848555 },
  { d: 'blobbi:food:sushi', name: "Sushi", category: 'food', emoji: '🍣', action: 'feed', stages: ['baby', 'adult'], effects: { hunger: 35, health: 10, hygiene: -5, energy: 7 }, eventId: '8fc69410584014f428fb087412b57bd1b92d6f929917854c592e82efc679a344', createdAt: 1784848555 },
  { d: 'blobbi:energy:drink', name: "Energy Drink", category: 'energy', emoji: '🧃', action: 'boost', stages: ['baby', 'adult'], effects: { energy: 35, happiness: 5 }, eventId: '6ffce663f19591b6741335cd3c45aad2beaa0abce381a4e9ec2e9d1bc48ca2e7', createdAt: 1784848555 },
  { d: 'blobbi:toy:ball', name: "Ball", category: 'toy', emoji: '⚽', action: 'play', stages: ['baby', 'adult'], effects: { happiness: 25, energy: -10, hygiene: -5 }, eventId: '0211d6400d3adb66bb5571fbdd4a2ed5c0f085989e9eec759d8edb9bccafccf7', createdAt: 1784848555 },
  { d: 'blobbi:toy:blocks', name: "Building Blocks", category: 'toy', emoji: '🧱', action: 'play', stages: ['baby', 'adult'], effects: { happiness: 30, energy: -10 }, eventId: '7fa49b96e146b9cd34a16215c21af64092d709e36424d8194807a4fd9a53a7cd', createdAt: 1784848555 },
  { d: 'blobbi:toy:teddy', name: "Teddy Bear", category: 'toy', emoji: '🧸', action: 'play', stages: ['baby', 'adult'], effects: { happiness: 45, energy: -5 }, eventId: '751c5aa8a4bc53437d99cd55368e1dd0d0761a3ee62b1c051df2fb5e5ef92a3d', createdAt: 1784848555 },
  { d: 'blobbi:hygiene:bubble-bath', name: "Bubble Bath", category: 'hygiene', emoji: '🛁', action: 'clean', stages: ['egg', 'baby', 'adult'], effects: { hygiene: 70, happiness: 25 }, eventId: '17a290405d91d3b78724d1b6c96f9be415f3b5abfc88618049424681814ecb28', createdAt: 1784848555 },
  { d: 'blobbi:hygiene:shampoo', name: "Shampoo", category: 'hygiene', emoji: '🧴', action: 'clean', stages: ['egg', 'baby', 'adult'], effects: { hygiene: 50, happiness: 10 }, eventId: 'a54db24ec4957fca916f63733e180ff681136c7a8387d3813aa9e87d64d7d37c', createdAt: 1784848555 },
  { d: 'blobbi:hygiene:soap', name: "Soap", category: 'hygiene', emoji: '🧼', action: 'clean', stages: ['egg', 'baby', 'adult'], effects: { hygiene: 25 }, eventId: 'd1ba69273098f5c3b7ca4eec4bbb0e6aa7a5972e2f28ebde2390fe7406ecf93e', createdAt: 1784848555 },
  { d: 'blobbi:hygiene:soft-towel', name: "Soft Towel", category: 'hygiene', emoji: '🏖️', action: 'clean', stages: ['egg', 'baby', 'adult'], effects: { hygiene: 25, happiness: 5 }, eventId: '79d8299e08f644de19dc9689c3b0a45245b734672f099b447adc62cfa1028f52', createdAt: 1784848555 },
  { d: 'blobbi:medicine:bandage', name: "Bandage", category: 'medicine', emoji: '🩹', action: 'medicine', stages: ['egg', 'baby', 'adult'], effects: { health: 25 }, eventId: 'f574c3057d4c339669a8d38db955933981928bc49e4c7b7d78fcb008f6f169b6', createdAt: 1784848555 },
  { d: 'blobbi:medicine:calcium', name: "Calcium Supplement", category: 'medicine', emoji: '🦴', action: 'medicine', stages: ['egg', 'baby', 'adult'], effects: { health: 35 }, eventId: 'e9560057c391f66b2cba873e5c4a7521111f7deb1911a15686da77b1b1fa6483', createdAt: 1784848555 },
  { d: 'blobbi:medicine:health-elixir', name: "Health Elixir", category: 'medicine', emoji: '🧪', action: 'medicine', stages: ['egg', 'baby', 'adult'], effects: { health: 75, happiness: 20, energy: 10 }, eventId: 'f9b2fef93976538475eeff018d72cec30ba983a4350ca13806de3443c04b03f7', createdAt: 1784848555 },
  { d: 'blobbi:medicine:shell-repair-kit', name: "Shell Repair Kit", category: 'medicine', emoji: '🥚', action: 'medicine', stages: ['egg'], effects: { health: 30 }, eventId: 'a0df1cfa72dcf1129c7a6401b6117c5ea10975bce31fb58933100c250a089811', createdAt: 1784848555 },
  { d: 'blobbi:medicine:super', name: "Super Medicine", category: 'medicine', emoji: '💉', action: 'medicine', stages: ['egg', 'baby', 'adult'], effects: { health: 50, energy: 20, happiness: -10 }, eventId: '6a4ed3a0a164c19eb88ee326e8c2253dfd3304cc076575ddacdace7681fa5329', createdAt: 1784848555 },
  { d: 'blobbi:medicine:vitamins', name: "Vitamins", category: 'medicine', emoji: '💊', action: 'medicine', stages: ['egg', 'baby', 'adult'], effects: { health: 25, energy: 5 }, eventId: 'a5cb4e43b9ab73981dee9d8e5020cf152476f18fc745cbad47787df0810a9d83', createdAt: 1784848555 },
];
