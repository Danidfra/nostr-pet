/**
 * The current Blobbi's equipment, read-only: the kind 31634 document the
 * player authored that targets this Blobbi (`31124:<owner>:<d>`), resolved
 * against the definitions and balances the inventory read already holds.
 * Nothing here publishes; the home draws what the Island dressed. The read
 * reaches the Island's relays through the pool's read hints (`relay-hints.ts`)
 * and is gated exactly as before (`equipment.ts`).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { normalizeAccessoryPlacements, type BlobbiVisualEffect, type NormalizedAccessoryPlacement } from '@blobbi-kit/renderer';
import { buildGameItemPlacementFilter, parseGameItemPlacement, type GameItemDefinition, type GameItemPlacement } from '@nostr-games/inventory';
import { timeoutSignal } from '@/lib/abort';
import { NO_EQUIPMENT, blobbiTargetAddress, resolveWornEquipment, toAccessoryInput, type Facing, type WornEquipment } from './equipment';
import { asNostrFilters, type HomeInventoryItem } from './useHomeInventory';

export const EQUIPMENT_QUERY_KEY = 'blobbi-equipment';
const READ_TIMEOUT_MS = 6_000;

export interface UseWornEquipmentOptions {
  pubkey: string | undefined;
  blobbi: Pick<BlobbiCompanion, 'd' | 'stage'>;
  /** The inventory read's items: definitions and effective quantities. */
  items: readonly HomeInventoryItem[];
}

export interface WornEquipmentView extends WornEquipment {
  /** Renderer-ready placements for a facing; memoized per call site. */
  accessoriesFor: (facing: Facing) => NormalizedAccessoryPlacement[];
  effects: readonly BlobbiVisualEffect[];
}

/** Newest valid document among what the relays returned. */
export function pickNewestPlacement(events: readonly { created_at: number; kind: number; tags: string[][]; content: string; pubkey: string; id: string; sig: string }[]): GameItemPlacement | null {
  let best: GameItemPlacement | null = null;
  for (const event of events) {
    const parsed = parseGameItemPlacement(event, { mode: 'permissive' });
    if (parsed && (!best || best.event.created_at < parsed.event.created_at)) best = parsed;
  }
  return best;
}

export function useWornEquipment({ pubkey, blobbi, items }: UseWornEquipmentOptions): WornEquipmentView {
  const { nostr } = useNostr();
  const target = pubkey ? blobbiTargetAddress(pubkey, blobbi.d) : undefined;

  const placement = useQuery({
    queryKey: [EQUIPMENT_QUERY_KEY, pubkey, blobbi.d],
    enabled: !!pubkey,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      if (!pubkey || !target) return null;
      const events = await nostr.query(asNostrFilters([buildGameItemPlacementFilter({ authors: [pubkey], addresses: [target] })]), { signal: timeoutSignal(READ_TIMEOUT_MS, signal) });
      return pickNewestPlacement(events);
    },
  });

  const worn = useMemo<WornEquipment>(() => {
    if (!pubkey || !placement.data) return NO_EQUIPMENT;
    const definitionsByAddress = new Map<string, GameItemDefinition>();
    const quantityByAddress = new Map<string, number>();
    for (const item of items) {
      if (item.item.definition) definitionsByAddress.set(item.item.address, item.item.definition);
      if (!item.unverified) quantityByAddress.set(item.item.address, (quantityByAddress.get(item.item.address) ?? 0) + item.quantity);
    }
    return resolveWornEquipment({ placement: placement.data, ownerPubkey: pubkey, blobbiD: blobbi.d, stage: blobbi.stage, definitionsByAddress, quantityByAddress });
  }, [pubkey, placement.data, items, blobbi.d, blobbi.stage]);

  const accessoriesFor = useMemo(() => {
    const cache = new Map<Facing, NormalizedAccessoryPlacement[]>();
    return (facing: Facing) => {
      const hit = cache.get(facing);
      if (hit) return hit;
      const inputs = worn.wearables.map((w) => toAccessoryInput(w, facing)).filter((i): i is NonNullable<typeof i> => i !== null);
      const normalized = normalizeAccessoryPlacements(inputs, { facing });
      cache.set(facing, normalized);
      return normalized;
    };
  }, [worn]);

  return { ...worn, accessoriesFor };
}
