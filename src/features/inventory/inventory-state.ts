/**
 * The player's inventories as balances the home can rely on.
 *
 * A kind 31633 snapshot is never the balance: the owning game folds spends
 * into it on its own schedule, and a spend (kind 1416) the player signed
 * from any client debits it the moment it exists. So every balance here is
 * `resolveGameInventoryState(snapshot, folds, spends)`: the fold chain says
 * which spends the snapshot already incorporates, the rest apply in order,
 * and an overdraw is rejected in full. If the chain cannot be resolved (a
 * fold the relays did not return) there is NO balance: the inventory is shown
 * but nothing in it can be used. Guessing would let a player spend twice.
 *
 * The spends this device established but the relays have not yet served are
 * merged in as well, so an item does not appear to bounce back after use.
 */
import {
  parseGameInventory,
  resolveGameInventoryState,
  type GameInventory,
  type GameInventoryDerivedState,
  type NostrEvent,
} from '@nostr-games/inventory';
import { describeInventorySource, compareSources, type InventorySource } from './sources';

export interface InventoryBalance {
  source: InventorySource;
  inventory: GameInventory;
  /** `resolved`: `items` are effective quantities. `unresolved`: the fold chain is incomplete; nothing is usable. */
  resolution: 'resolved' | 'unresolved';
  /** Item address → effective quantity (resolved only; snapshot quantities otherwise, for display). */
  items: readonly { address: string; quantity: number }[];
  /** The derivation, for callers that need the applied/rejected detail. */
  derived: GameInventoryDerivedState | null;
}

export interface DeriveBalancesInput {
  /** Kind 31633 events the player authored (the latest per `d` wins). */
  inventories: readonly NostrEvent[];
  /** Kind 1416 events by the player, any inventory (the derivation ignores other addresses). */
  spends: readonly NostrEvent[];
  /** Kind 1417 events by the player. */
  folds: readonly NostrEvent[];
}

/** Keep only the newest snapshot per inventory `d` (a replaceable kind). */
export function latestInventories(events: readonly NostrEvent[]): GameInventory[] {
  const byId = new Map<string, GameInventory>();
  for (const event of events) {
    const parsed = parseGameInventory(event, { mode: 'permissive' });
    if (!parsed) continue;
    const current = byId.get(parsed.id);
    if (!current || current.event.created_at < parsed.event.created_at) byId.set(parsed.id, parsed);
  }
  return [...byId.values()];
}

/** Deduplicate events by id (relays and the local ledger may both hold one). */
export function uniqueEvents(...lists: readonly (readonly NostrEvent[])[]): NostrEvent[] {
  const seen = new Set<string>();
  const out: NostrEvent[] = [];
  for (const list of lists) {
    for (const event of list) {
      if (!event.id || seen.has(event.id)) continue;
      seen.add(event.id);
      out.push(event);
    }
  }
  return out;
}

export function deriveBalance(inventory: GameInventory, spends: readonly NostrEvent[], folds: readonly NostrEvent[]): InventoryBalance {
  const source = describeInventorySource(inventory.id);
  const resolution = resolveGameInventoryState({ inventory, folds, spends });
  if (resolution.status === 'unresolved') {
    return {
      source,
      inventory,
      resolution: 'unresolved',
      items: inventory.items.map((i) => ({ address: i.address, quantity: i.quantity })),
      derived: null,
    };
  }
  return {
    source,
    inventory,
    resolution: 'resolved',
    items: resolution.state.inventory.items.map((i) => ({ address: i.address, quantity: i.quantity })),
    derived: resolution.state,
  };
}

/** Every inventory the player owns, as balances, known games first. */
export function deriveBalances({ inventories, spends, folds }: DeriveBalancesInput): InventoryBalance[] {
  return latestInventories(inventories)
    .map((inventory) => deriveBalance(inventory, spends, folds))
    .sort((a, b) => compareSources(a.source, b.source));
}

/** Effective quantity of one item in one balance; 0 when unresolved or absent. */
export function effectiveQuantity(balance: InventoryBalance, itemAddress: string): number {
  if (balance.resolution !== 'resolved') return 0;
  return balance.items.find((i) => i.address === itemAddress)?.quantity ?? 0;
}

/** Every distinct item address across the balances, for definition lookup. */
export function itemAddressesOf(balances: readonly InventoryBalance[]): string[] {
  const set = new Set<string>();
  for (const balance of balances) for (const item of balance.items) set.add(item.address);
  return [...set];
}
