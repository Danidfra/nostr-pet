/**
 * Where an earlier version kept the toys a player set down in a room, on
 * this device, per player and Blobbi. Nothing writes it any more; the key is
 * kept so that removing a guest's Blobbi from this device also clears what an
 * older build may have left there (`guest-cleanup.ts`).
 */
export const TOY_STORAGE_PREFIX = 'blobbi:home:toys:v1:';

export function toyStorageKey(pubkey: string | undefined, blobbiD: string): string {
  return `${TOY_STORAGE_PREFIX}${pubkey ?? 'anon'}:${blobbiD}`;
}
