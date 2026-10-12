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
 *                `current_companion`)
 *   local        the device pick, the caches, a refetch
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

export function useAdoptEgg({ pubkey, suggestedName, updateCompanionEvent, refresh, additional = false }: UseAdoptEggOptions) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
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
      try {
        profileEvent = await publisher.publish(profileTemplate({ ownerPubkey: pubkey, profile, d: preview.d, suggestedName: suggestedName ?? 'Blobbonaut' }));
        const parsed = parseBlobbonautEvent(profileEvent);
        if (parsed) queryClient.setQueryData<BlobbonautProfile | null>(['blobbonaut-profile', pubkey], parsed);
      } catch (error) {
        profileError = error instanceof Error ? error.message : String(error);
      }
      return { kind: 'adopted', egg, profile: profileEvent, profileError };
    },
    onSettled: () => {
      inFlightRef.current = false;
      setStep('idle');
      queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile', pubkey] });
      refresh();
    },
  });

  const { mutate } = mutation;
  /** Publish the egg for this preview unless an adoption is already running. Returns whether it started. */
  const adopt = useCallback(
    (preview: EggPreview): boolean => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      mutate(preview);
      return true;
    },
    [mutate],
  );

  return { adopt, step, isPending: mutation.isPending, result: mutation.data, error: mutation.error, reset: mutation.reset };
}
