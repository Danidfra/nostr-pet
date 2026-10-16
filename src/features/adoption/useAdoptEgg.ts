/**
 * Adopting a first egg, at home. The write path, in this order:
 *
 *   preflight    a FRESH, lenient read of the player's kind 31124 events; if
 *                any Blobbi exists (egg, baby or adult; namespace or not)
 *                nothing is minted and the collection is refreshed instead
 *   profile      a fresh read of the kind 11125, so an existing profile is
 *                never clobbered by a cache miss
 *   egg          the kind 31124, `created_at` pinned to the preview
 *   profile      exactly one kind 11125 (created, or updated with `has` and
 *                `current_companion`), written by `writeProfileSafely`: built
 *                from a COMPLETE read of the profile (every relay every Blobbi
 *                app writes profiles to answered; asked twice before giving
 *                up), created only when that complete read finds none, never
 *                sent over a profile written meanwhile. An incomplete read
 *                writes no profile and is never taken for "no profile": the
 *                egg is real, and the choice waits on this device to be
 *                shared (`src/features/companion`); when no complete read
 *                ever found a profile, its Try again may create it then
 *                (`needs-profile`), on a complete read finding none
 *   local        the device pick and the caches (no re-read after a success:
 *                a relay a moment behind would answer "none")
 *
 * If the egg landed but the profile write failed, the egg is real and shown;
 * the profile can be repaired by any later selection (ownership is the 31124
 * collection, never the profile, as Ditto and Island both hold).
 */
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { KIND_BLOBBI_STATE, fetchFreshBlobbonautProfile, getSelectedBlobbiKey, getUnlocks, xpToLevel, parseBlobbonautEvent, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { canAskRelays, poolProfileRelays } from '@/features/companion/pool-relays';
import { readProfileCensus } from '@/features/companion/profile-write';
import { writeProfileSafely } from '@/features/companion/safe-profile-write';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { companionChoices } from '@/features/companion/choice-store';
import { timeoutSignal } from '@/lib/abort';
import { eggTemplate, isOwnedBlobbiEvent, profileTemplate, type EggPreview } from './adoption-plan';

export type AdoptionResult =
  | { kind: 'adopted'; egg: NostrEvent; profile: NostrEvent | null; profileError: string | null }
  | { kind: 'existing'; count: number }
  /** Another egg asked for, but the kit's unlock for the profile's level does not allow one more. */
  | { kind: 'limit'; count: number; max: number };

interface UseAdoptEggOptions {
  pubkey: string | undefined;
  /** The player's kind 0 name, for a brand-new profile. */
  suggestedName?: string;
  updateCompanionEvent: (event: NostrEvent) => void;
  /** Re-read the collection (and the profile) from the relays. */
  refresh: () => void;
  /**
   * Another egg for a player who already has Blobbis: allowed only while the
   * collection is under the kit's `getUnlocks(level).maxBlobbis` for the
   * level of a FRESH profile read (kind 11125 `xp`), checked again right
   * before signing. Without it (the first adoption), any Blobbi owned stops
   * the adoption, as before.
   */
  additional?: boolean;
}

const PREFLIGHT_TIMEOUT_MS = 6_000;
/** A second look at the profile, when a relay that must answer did not the first time. */
const PROFILE_SECOND_READ_MS = 12_000;

/**
 * The keys with an adoption on its way, for the whole page: a screen that is
 * unmounted and mounted again while the first adoption is out (a re-render
 * of the way in, a second tab of the same component) cannot begin a second
 * one. Cleared when it settles.
 */
const adoptingFor = new Set<string>();

export function useAdoptEgg({ pubkey, suggestedName, updateCompanionEvent, refresh, additional = false }: UseAdoptEggOptions) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const signedInRef = useRef(user?.pubkey);
  signedInRef.current = user?.pubkey;
  const inFlightRef = useRef(false);
  const [step, setStep] = useState<'idle' | 'checking' | 'egg' | 'profile'>('idle');

  const mutation = useMutation<AdoptionResult, Error, EggPreview>({
    mutationFn: async (preview) => {
      if (!pubkey) throw new Error('Sign in to adopt an egg.');
      if (preview.ownerPubkey !== pubkey) throw new Error('This egg was prepared for a different account.');

      setStep('checking');
      const owned = (await nostr.query([{ kinds: [KIND_BLOBBI_STATE], authors: [pubkey] }], { signal: timeoutSignal(PREFLIGHT_TIMEOUT_MS) })).filter(isOwnedBlobbiEvent);
      if (owned.length > 0 && !additional) {
        return { kind: 'existing', count: owned.length };
      }
      const profile = await fetchFreshBlobbonautProfile(nostr, pubkey);
      if (additional) {
        const max = getUnlocks(xpToLevel(profile?.xp ?? 0)).maxBlobbis;
        const count = new Set(owned.map((e) => e.tags.find(([n]) => n === 'd')?.[1])).size;
        if (count >= max) return { kind: 'limit', count, max };
      }

      setStep('egg');
      const egg = await publisher.publish(eggTemplate(preview));
      updateCompanionEvent(egg);
      try {
        window.localStorage.setItem(getSelectedBlobbiKey(pubkey), preview.d);
      } catch {
        /* the profile's current_companion carries the pick */
      }

      setStep('profile');
      let profileEvent: NostrEvent | null = null;
      let profileError: string | null = null;
      // The relays one by one (a signed-in player): the profile built on is the newest one there is, or none is written
      const networked = canAskRelays(nostr);
      let seen: NostrEvent | null = profile?.event ?? null;
      /** What a COMPLETE read found: the newest profile, null for none, undefined when no read was complete. */
      let confirmed: NostrEvent | null | undefined;
      const name = suggestedName ?? 'Blobbonaut';
      try {
        if (networked) {
          const relays = poolProfileRelays(nostr);
          // A relay a moment slow is asked once more (a read, nothing signed) before giving up
          let complete = (await readProfileCensus(relays, pubkey)).complete;
          if (!complete) complete = (await readProfileCensus(relays, pubkey, PROFILE_SECOND_READ_MS)).complete;
          if (!complete) throw new Error('your profile could not be reached right now');
          const out = await writeProfileSafely(
            { owner: pubkey, relays, sign: (t) => publisher.sign(t), stillAccount: () => signedInRef.current === pubkey },
            (base) => {
              confirmed = base;
              seen = base;
              return { template: profileTemplate({ ownerPubkey: pubkey, profile: base ? (parseBlobbonautEvent(base) ?? null) : null, d: preview.d, suggestedName: name }) };
            },
            { create: true },
          );
          if (out.kind !== 'sent') throw new Error(out.kind === 'failed' ? out.message : out.kind === 'stale' ? 'your profile changed while saving' : out.kind === 'wrong-account' ? 'the account changed' : 'your profile could not be reached right now');
          profileEvent = out.event;
        } else {
          profileEvent = await publisher.publish(profileTemplate({ ownerPubkey: pubkey, profile, d: preview.d, suggestedName: name, now: Math.floor(Date.now() / 1000) }));
        }
        const parsed = parseBlobbonautEvent(profileEvent);
        if (parsed) queryClient.setQueryData<BlobbonautProfile | null>(['blobbonaut-profile', pubkey], parsed);
      } catch (error) {
        profileError = error instanceof Error ? error.message : String(error);
      }
      // The new egg is the player's choice: shared with the other Blobbi apps by the profile just written, or waiting
      // on this device to be (Try again, or choosing it, writes it into the profile and lists it there)
      if (networked)
        companionChoices.set({
          version: 1,
          account: pubkey,
          d: preview.d,
          at: Date.now(),
          by: 'player',
          synced: profileEvent ? { id: profileEvent.id, createdAt: profileEvent.created_at } : null,
          pending: null,
          over: seen ? { id: seen.id, createdAt: seen.created_at, d: parseBlobbonautEvent(seen)?.currentCompanion ?? null } : null,
          // Not written, and no complete read ever found a profile: Try again may create it (on a complete read only)
          note: !profileEvent && !confirmed ? 'needs-profile' : null,
          profileName: !profileEvent && !confirmed ? name : null,
        });
      return { kind: 'adopted', egg, profile: profileEvent, profileError };
    },
    onSettled: (result, _error, preview) => {
      inFlightRef.current = false;
      adoptingFor.delete(preview.ownerPubkey);
      setStep('idle');
      // Adopted: the caches already hold the very events the relays accepted (the egg, the profile). A re-read straight
      // away may reach a relay that has not stored them yet and would replace the egg with "none", sending the player
      // back to the way in (M12.3); later reads catch up by themselves. Anything else re-reads.
      if (result?.kind === 'adopted') {
        if (!result.profile) queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile', pubkey] });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile', pubkey] });
      refresh();
    },
  });

  const { mutate } = mutation;
  /** Publish the egg for this preview unless an adoption is already running. Returns whether it started. */
  const adopt = useCallback(
    (preview: EggPreview): boolean => {
      if (inFlightRef.current || adoptingFor.has(preview.ownerPubkey)) return false;
      inFlightRef.current = true;
      adoptingFor.add(preview.ownerPubkey);
      mutate(preview);
      return true;
    },
    [mutate],
  );

  return { adopt, step, isPending: mutation.isPending, result: mutation.data, error: mutation.error, reset: mutation.reset };
}
