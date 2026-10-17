/**
 * The player's choice about Active Presence (M16), per account on this device: off unless they turned it on. With it
 * on, the home signs a short-lived note (kind 21124, NIP-40, never stored by relays) at most once a minute while they
 * play here, so their other Blobbi worlds can tell the Blobbi is being played. And what became of it this session
 * (`on`, or paused because the signer asks each time, or refused), for the account sheet to say.
 */
import { useSyncExternalStore } from 'react';
import type { PresenceStatus } from '@blobbi-kit/core';

export const ACTIVE_PRESENCE_KEY = (pubkey: string) => `blobbi:active-presence:v1:${pubkey}`;

const listeners = new Set<() => void>();
const statuses = new Map<string, PresenceStatus>();
const notify = () => {
  for (const l of [...listeners]) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function activePresenceOn(pubkey: string | null | undefined): boolean {
  if (!pubkey) return false;
  try {
    return globalThis.localStorage?.getItem(ACTIVE_PRESENCE_KEY(pubkey)) === 'on';
  } catch {
    return false;
  }
}

export function setActivePresence(pubkey: string, on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(ACTIVE_PRESENCE_KEY(pubkey), 'on');
    else globalThis.localStorage?.removeItem(ACTIVE_PRESENCE_KEY(pubkey));
  } catch {
    /* not kept: it stays as it was */
  }
  notify();
}

/** The choice, re-rendered when it changes in this page. */
export function useActivePresenceChoice(pubkey: string | null | undefined): boolean {
  return useSyncExternalStore(subscribe, () => activePresenceOn(pubkey), () => false);
}

/** What the running session made of it (null: no session for this account in this page). */
export function reportPresenceStatus(pubkey: string, status: PresenceStatus | null): void {
  if ((statuses.get(pubkey) ?? null) === status) return;
  if (status) statuses.set(pubkey, status);
  else statuses.delete(pubkey);
  notify();
}

export function usePresenceStatus(pubkey: string | null | undefined): PresenceStatus | null {
  return useSyncExternalStore(subscribe, () => (pubkey ? (statuses.get(pubkey) ?? null) : null), () => null);
}
