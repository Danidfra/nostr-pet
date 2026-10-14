/**
 * One blocking layer at a time (M15).
 *
 * A blocking layer is anything that takes the whole game surface and the
 * player's attention until it is answered: a sheet rising over the world
 * (`GameOverlay`), the room's introduction, the word about a guest Blobbi
 * when another account signs in. Before M15 each of them decided for itself
 * whether to be open, so two could stand on top of each other: the conflict
 * sheet over the room's first-visit introduction, the sign-in sheet still
 * closing while the conflict opened over it.
 *
 * This module is the one queue they all pass through. A layer that wants to
 * be open CLAIMS a place; the oldest claim HOLDS the surface and is the only
 * one rendered; the others wait, unrendered, in the order they asked, and
 * each is shown when the ones before it have closed. A layer that stops
 * wanting to be open before its turn simply leaves the queue. Nothing is
 * ever dismissed on another layer's behalf: the player answers one thing at
 * a time, and every layer is still answered.
 *
 * Claims are made in layout effects, so a "close this, open that" done in
 * one render hands the surface over inside the same commit (the closing
 * layer's cleanup runs before the opening layer's effect), and nothing
 * flickers.
 *
 * Module state, not context: the layers live on different pages and above
 * them (`GuestLayers`), and there is exactly one game surface. Tests reset
 * it between cases through `resetBlockingLayers`.
 */
import { useId, useLayoutEffect, useSyncExternalStore } from 'react';

const queue: string[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The id holding the surface right now, or null when nothing blocks. */
export function blockingHolder(): string | null {
  return queue[0] ?? null;
}

/** True while any layer holds the surface: the moment is not quiet, so nothing else should ask for attention. */
export function isBlockingLayerOpen(): boolean {
  return queue.length > 0;
}

/** Ask for the surface; the place is kept until released. Asking twice with the same id is one claim. */
export function claimBlockingLayer(id: string): void {
  if (queue.includes(id)) return;
  queue.push(id);
  emit();
}

export function releaseBlockingLayer(id: string): void {
  const at = queue.indexOf(id);
  if (at < 0) return;
  queue.splice(at, 1);
  emit();
}

/** Tests only: forget every claim. */
export function resetBlockingLayers(): void {
  if (queue.length === 0) return;
  queue.length = 0;
  emit();
}

const holderSnapshot = () => blockingHolder();

/**
 * Hold the one blocking surface while `wanted`. Returns true when this layer
 * holds it (so it should render) and false while it waits or does not want
 * it. The claim is made in a layout effect and released when `wanted` turns
 * false or the component unmounts.
 */
export function useBlockingLayer(wanted: boolean): boolean {
  const id = useId();
  const holder = useSyncExternalStore(subscribe, holderSnapshot, holderSnapshot);
  useLayoutEffect(() => {
    if (!wanted) return;
    claimBlockingLayer(id);
    return () => releaseBlockingLayer(id);
  }, [wanted, id]);
  return wanted && holder === id;
}

/** Whether any blocking layer is open, re-rendering as that changes: what the invitation and other quiet moments read. */
export function useBlockingLayerOpen(): boolean {
  const holder = useSyncExternalStore(subscribe, holderSnapshot, holderSnapshot);
  return holder !== null;
}
