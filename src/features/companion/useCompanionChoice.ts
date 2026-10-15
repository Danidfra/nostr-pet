/**
 * The home's companion: this device's choice and the player's global one
 * (the profile's `current_companion`), put in order (`choice-order.ts`).
 *
 *  - A choice made here shows at once and is carried out to the other apps in
 *    the background (`companion-sync.ts`).
 *  - A newer choice from another app (this home on another device, Blobbi
 *    Pixel, Ditto) is shown as soon as no moment is on screen
 *    (`switch-hold.ts`): it is adopted into this device's record, never
 *    published again.
 *  - Two choices that cannot be ordered are put to the player (`ambiguity`).
 *
 * Nothing here publishes on its own: only `select`, `retry` and `resolve`
 * (the player's acts) start a write.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { BlobbonautProfile, NostrEvent } from '@blobbi-kit/core';
import { orderChoices, type ChoiceOrder, type GlobalChoiceFacts } from './choice-order';
import { choiceFacts, companionChoices, needsSync, type CompanionChoice } from './choice-store';
import { companionSync, type SyncEnv, type SyncStatus } from './companion-sync';
import { useCompanionSwitchHeld } from './switch-hold';

export interface CompanionChoiceState {
  /** The d the home shows (an owned Blobbi), or undefined to let the home pick. */
  shownD: string | undefined;
  /** What the player may be told about sharing their choice. */
  status: SyncStatus;
  /** Two choices that cannot be ordered: which Blobbi should it be? (null when there is no question, or a moment is on screen) */
  ambiguity: { local: string; global: string } | null;
  order: ChoiceOrder;
  select: (d: string) => void;
  retry: () => void;
  resolve: (which: 'local' | 'global') => void;
}

const NOTHING: ChoiceOrder = { winner: 'none', rule: 'nothing' };

/** The profile's choice, when it is usable: a valid profile naming one of the player's own Blobbis. */
export function globalChoiceOf(profile: BlobbonautProfile | null | undefined, owner: string | undefined, owned: ReadonlySet<string>): GlobalChoiceFacts | null {
  const e = profile?.event as NostrEvent | undefined;
  const d = profile?.currentCompanion;
  if (!e || !owner || e.pubkey !== owner || !d || !owned.has(d)) return null;
  return { d, id: e.id, createdAt: e.created_at };
}

const adopted = (account: string, g: GlobalChoiceFacts): CompanionChoice => ({ version: 1, account, d: g.d, at: g.createdAt * 1000, by: 'remote', synced: { id: g.id, createdAt: g.createdAt }, pending: null, note: null });

export function useCompanionChoice({ pubkey, ownedDs, profile, env, ready }: { pubkey: string | undefined; ownedDs: readonly string[]; profile: BlobbonautProfile | null | undefined; env: SyncEnv | null; ready: boolean }): CompanionChoiceState {
  const choice = useSyncExternalStore(companionChoices.subscribe, () => companionChoices.get(pubkey), () => companionChoices.get(pubkey));
  const syncStatus = useSyncExternalStore(companionSync.subscribe, () => companionSync.status(pubkey), () => companionSync.status(pubkey));
  const held = useCompanionSwitchHeld();
  const owned = useMemo(() => new Set(ownedDs), [ownedDs]);

  useEffect(() => {
    if (pubkey && env) companionSync.setEnv(pubkey, env);
  }, [pubkey, env]);

  const global = useMemo(() => globalChoiceOf(profile, pubkey, owned), [profile, pubkey, owned]);
  // The profile the player has been shown: a choice made now is made over it. The newest of the profile read and the
  // one this device's current choice was carried by or agreed with (a Blobbi met from another app, say).
  const seen = useMemo(() => {
    const e = profile?.event as NostrEvent | undefined;
    const read = e && e.pubkey === pubkey ? { id: e.id, createdAt: e.created_at, d: profile?.currentCompanion ?? null } : null;
    const own = choice?.synced && choice.synced.createdAt > 0 ? { ...choice.synced, d: choice.d } : null;
    if (!own) return read;
    if (!read) return own;
    return read.createdAt > own.createdAt || (read.createdAt === own.createdAt && read.id <= own.id) ? read : own;
  }, [profile, pubkey, choice]);
  const local = choice && owned.has(choice.d) ? choice : null;
  const order = useMemo(() => (ready ? orderChoices(choiceFacts(local), global, Date.now()) : NOTHING), [ready, local, global]);

  // A newer choice from elsewhere is adopted (not published) once no moment is on screen; the same Blobbi on both
  // sides makes a choice still waiting to be shared already shared.
  useEffect(() => {
    if (!pubkey || !ready || !global) return;
    if (order.winner === 'global' && !held) companionChoices.set(adopted(pubkey, global));
    else if (order.winner === 'agree' && local && needsSync(local)) companionChoices.set({ ...local, synced: { id: global.id, createdAt: global.createdAt }, pending: null, note: null });
  }, [pubkey, ready, global, order.winner, held, local]);

  const shownD = order.winner === 'global' && !held ? global?.d : (local?.d ?? global?.d);

  const select = useCallback(
    (d: string) => {
      if (!pubkey || !owned.has(d)) return;
      const now = companionChoices.get(pubkey);
      // The same Blobbi again is not a change: nothing to write
      if (now && now.d === d && owned.has(now.d)) return;
      companionChoices.set({ version: 1, account: pubkey, d, at: Date.now(), by: 'player', synced: null, pending: null, over: seen, note: null });
      if (env) void companionSync.start(pubkey);
    },
    [pubkey, owned, env, seen],
  );

  const retry = useCallback(() => {
    if (pubkey && env) void companionSync.retry(pubkey);
  }, [pubkey, env]);

  const resolve = useCallback(
    (which: 'local' | 'global') => {
      if (!pubkey) return;
      if (which === 'global' && global) companionChoices.set(adopted(pubkey, global));
      else if (which === 'local' && local) {
        // The player picked this device's Blobbi again, now: an explicit choice, carried out like any other
        companionChoices.set({ ...local, at: Date.now(), by: 'player', synced: null, pending: null, over: seen, note: null });
        if (env) void companionSync.start(pubkey);
      }
    },
    [pubkey, global, local, env, seen],
  );

  // After a reload a choice made here may still be unshared: the player is told, and may Try again (never automatic)
  const status: SyncStatus = syncStatus.kind === 'idle' && env && local && needsSync(local) && order.winner !== 'global' && order.winner !== 'ambiguous' ? (local.note === 'no-profile' ? { kind: 'device-only' } : { kind: 'waiting', reason: 'not-sent' }) : syncStatus;

  return {
    shownD,
    status,
    ambiguity: order.winner === 'ambiguous' && !held && local && global ? { local: local.d, global: global.d } : null,
    order,
    select,
    retry,
    resolve,
  };
}
