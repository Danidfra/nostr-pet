import { useCallback, useMemo, useState } from 'react';
import type { HomeInventoryItem } from '@/features/inventory';
import { clampToFloor, type FloorPoint } from '../scene/geometry';
import type { RoomId } from './rooms';
import { MAX_TOYS_PER_ROOM, readPlacedToys, toyKey, writePlacedToys, type PlacedToy } from './toy-store';

export interface ToyInRoom {
  key: string;
  toy: PlacedToy;
  /** The owned inventory line this toy is, from the verified read. */
  entry: HomeInventoryItem;
  position: FloorPoint;
}

export interface PlacedToysState {
  /** Toys lying in this room that the player still owns. */
  toys: readonly ToyInRoom[];
  /** Whether another toy may be set down here. */
  canPlace: boolean;
  place: (entry: HomeInventoryItem, at: FloorPoint) => boolean;
  pickUp: (key: string) => void;
}

/**
 * Toys set down in this room, joined with the inventory read: a toy is in
 * the room only while an owned line for it exists. Setting a toy down is
 * presentation and costs nothing; playing with it is the item use path.
 */
export function usePlacedToys({ pubkey, blobbiD, room, items }: { pubkey: string | undefined; blobbiD: string; room: RoomId; items: readonly HomeInventoryItem[] }): PlacedToysState {
  const [version, setVersion] = useState(0);
  const placed = useMemo(() => {
    void version;
    return readPlacedToys(pubkey, blobbiD, room);
  }, [pubkey, blobbiD, room, version]);

  const toys = useMemo<ToyInRoom[]>(() => {
    const out: ToyInRoom[] = [];
    for (const toy of placed) {
      const entry = items.find((i) => i.item.address === toy.address && i.inventoryAddress === toy.inventoryAddress && i.quantity > 0 && !i.unverified);
      if (!entry) continue;
      out.push({ key: toyKey(toy), toy, entry, position: { x: toy.x, y: toy.y } });
    }
    return out;
  }, [placed, items]);

  const place = useCallback(
    (entry: HomeInventoryItem, at: FloorPoint) => {
      if (entry.item.care?.action !== 'play') return false;
      const key = toyKey({ address: entry.item.address, inventoryAddress: entry.inventoryAddress });
      const rest = placed.filter((t) => toyKey(t) !== key);
      if (rest.length >= MAX_TOYS_PER_ROOM) return false;
      const p = clampToFloor(at);
      writePlacedToys(pubkey, blobbiD, room, [...rest, { address: entry.item.address, inventoryAddress: entry.inventoryAddress, x: p.x, y: p.y }]);
      setVersion((v) => v + 1);
      return true;
    },
    [placed, pubkey, blobbiD, room],
  );

  const pickUp = useCallback(
    (key: string) => {
      writePlacedToys(pubkey, blobbiD, room, placed.filter((t) => toyKey(t) !== key));
      setVersion((v) => v + 1);
    },
    [placed, pubkey, blobbiD, room],
  );

  return { toys, canPlace: placed.length < MAX_TOYS_PER_ROOM, place, pickUp };
}
