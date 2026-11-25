/**
 * One write at a time per Blobbi, on this page: the kind 31124 republishes
 * of care, an item's effect, a starter item and a rename run in turn. Each
 * reads the Blobbi fresh INSIDE its turn, so a rename after a care builds on
 * the care's result and a care after a rename on the new name: two writes
 * started together can no longer both build on the same old revision and
 * have the second undo the first.
 *
 * This orders the writes of this page only. Another device or another app
 * writing the same Blobbi at the same moment is not ordered by anything:
 * kind 31124 is replaceable, the newest write wins, and no write across apps
 * is atomic.
 */
const tails = new Map<string, Promise<void>>();

export function serializeBlobbiWrite<T>(pubkey: string, d: string, work: () => Promise<T>): Promise<T> {
  const key = `${pubkey}:${d}`;
  const before = tails.get(key) ?? Promise.resolve();
  const run = before.then(work);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
