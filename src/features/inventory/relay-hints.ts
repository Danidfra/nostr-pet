/**
 * Where the rest of the ecosystem writes what the home reads. Read hints,
 * never write targets, never a statement of trust.
 *
 * Audited 2026-09-24 against the sibling checkouts:
 *
 *  - **Blobbi Island** (`src/App.tsx` presets, `NostrProvider`): one
 *    selected relay for every read and write, chosen from relay.ditto.pub
 *    (default) and relay.primal.net. Its kind 31633 `blobbi:island`, kind
 *    31634 `blobbi-island:character:<d>:equipment` and kind 1416 spends land
 *    on that one relay. A custom relay typed into Island's selector is
 *    unknowable from here and is not chased.
 *  - **Nostr Farm** (`src/hooks/farm/inventory-relays.ts`): kind 31633
 *    `farm:main`, its kind 1416 spends and kind 1417 folds are offered to
 *    relay.primal.net and relay.ditto.pub, and read back from the same set.
 *  - **Item definitions** (kind 31632): per trusted issuer, on
 *    `TrustedIssuer.relays` (`issuers.ts`), the table Island keeps too.
 *
 * Live check the same day: relay.ditto.pub served every kind above;
 * relay.primal.net served none of them (it is a caching relay that does not
 * index these kinds), so the Farm's primal hint is carried for fidelity to
 * its producer, not because it answers; relay.dreamith.to served the
 * official definitions only.
 *
 * Adding a relay here is a source change and a review, like adding an
 * issuer. Nothing reads this table but the pool's read router.
 */
import type { ReadHint } from '@/lib/relay-routing';
import { KIND_GAME_INVENTORY, KIND_GAME_INVENTORY_FOLD, KIND_GAME_INVENTORY_SPEND, KIND_GAME_ITEM_DEFINITION, KIND_GAME_ITEM_PLACEMENT } from '@nostr-games/inventory';
import { TRUSTED_ISSUERS } from './issuers';

/** Blobbi Island's preset relays: the player's Island writes are on one of them. */
export const ISLAND_RELAYS: readonly string[] = ['wss://relay.ditto.pub', 'wss://relay.primal.net'];

/** Nostr Farm's `INVENTORY_RELAYS`: `farm:main`, its spends and its folds. */
export const FARM_INVENTORY_RELAYS: readonly string[] = ['wss://relay.primal.net', 'wss://relay.ditto.pub'];

/** Relay hints per known inventory source (`sources.ts` ids), for the journal and tests. */
export const SOURCE_RELAYS: Readonly<Record<string, readonly string[]>> = {
  'blobbi:island': ISLAND_RELAYS,
  'farm:main': FARM_INVENTORY_RELAYS,
};

export const ECOSYSTEM_READ_HINTS: readonly ReadHint[] = [
  // Issuer relays: only a request that names the issuer is routed there.
  ...TRUSTED_ISSUERS.map<ReadHint>((issuer) => ({
    label: `${issuer.label} item definitions`,
    kinds: [KIND_GAME_ITEM_DEFINITION],
    authors: [issuer.pubkey],
    relays: issuer.relays,
  })),
  // Source relays: inventories, spends and folds by anyone (the filters
  // already name the player), and the Island's equipment documents.
  {
    label: 'Blobbi Island inventories, spends and equipment',
    kinds: [KIND_GAME_INVENTORY, KIND_GAME_INVENTORY_SPEND, KIND_GAME_INVENTORY_FOLD, KIND_GAME_ITEM_PLACEMENT],
    relays: ISLAND_RELAYS,
  },
  {
    label: 'Nostr Farm inventories, spends and folds',
    kinds: [KIND_GAME_INVENTORY, KIND_GAME_INVENTORY_SPEND, KIND_GAME_INVENTORY_FOLD],
    relays: FARM_INVENTORY_RELAYS,
  },
];
