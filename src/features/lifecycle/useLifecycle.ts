import { useCallback, useMemo, useState } from 'react';
import type { BlobbiCompanion, BlobbonautProfile, NostrEvent } from '@blobbi-kit/core';
import {
  useBlobbiEvolve,
  useBlobbiHatch,
  useEvolveTasks,
  useFreshBlobbiBeforeAction,
  useHatchTasks,
  useStartEvolution,
  useStartIncubation,
  useStopEvolution,
  useStopIncubation,
} from '@blobbi-kit/react';

import { usePublishAdapter } from '@/features/care';
import { DITTO_URL } from '@/config/ecosystem';
import { buildLifecycleView, type LifecycleView } from './lifecycle-view';
import { withNewbornStats } from './newborn';

export type LifecycleAction = 'start-incubation' | 'stop-incubation' | 'hatch' | 'start-evolution' | 'stop-evolution' | 'evolve';

export interface UseLifecycleOptions {
  blobbi: BlobbiCompanion;
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  /** The collection's cache updater: a published transition becomes the shown state at once. */
  updateCompanionEvent: (event: NostrEvent) => void;
  /** Relay-backed refetch after a transition settles. */
  invalidate: () => void;
}

export interface Lifecycle {
  view: LifecycleView;
  /** The action in flight, if any. One at a time. */
  pending: LifecycleAction | null;
  error: Error | null;
  clearError: () => void;
  startIncubation: () => Promise<boolean>;
  stopIncubation: () => Promise<boolean>;
  startEvolution: () => Promise<boolean>;
  stopEvolution: () => Promise<boolean>;
  /** The egg → baby transition. Resolves true when the publish landed. */
  hatch: () => Promise<boolean>;
  /** The baby → adult transition. Resolves true when the publish landed. */
  evolve: () => Promise<boolean>;
}

/**
 * The lifecycle of one Blobbi, on the kit's own hooks:
 *
 *   incubation   useStartIncubation / useStopIncubation   (kind 31124 progression tags + hatch missions)
 *   hatch gate   useHatchTasks                            (the canonical missions; time is irrelevant)
 *   hatch        useBlobbiHatch                           (egg → baby, same d, same seed)
 *   evolution    useStartEvolution / useStopEvolution / useEvolveTasks / useBlobbiEvolve
 *
 * The standalone adds only wiring: the publish adapter (sign + relays), the
 * fresh-read step, cache updates and one view. Eligibility is the kit's;
 * whether to respect it is the caller's (a ceremony respects it, a dev tool
 * may not). Every transition is a deliberate action; nothing here runs on
 * its own.
 */
export function useLifecycle({ blobbi, profile, pubkey, updateCompanionEvent, invalidate }: UseLifecycleOptions): Lifecycle {
  const publisher = usePublishAdapter();
  const { fetchFreshBlobbiBeforeAction } = useFreshBlobbiBeforeAction(pubkey);
  const [pending, setPending] = useState<LifecycleAction | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const hatchTasks = useHatchTasks(blobbi, pubkey);
  const evolveTasks = useEvolveTasks(blobbi, pubkey);

  const view = useMemo(
    () => buildLifecycleView({ companion: blobbi, hatch: hatchTasks, evolve: evolveTasks, dittoUrl: DITTO_URL }),
    [blobbi, hatchTasks, evolveTasks],
  );

  const ensureCanonicalBeforeAction = useCallback(async () => {
    if (!profile) return null;
    return fetchFreshBlobbiBeforeAction({ companion: blobbi, profile, updateProfileEvent: () => {}, updateCompanionEvent });
  }, [blobbi, profile, fetchFreshBlobbiBeforeAction, updateCompanionEvent]);

  const shared = {
    companion: blobbi,
    profile: profile ?? null,
    pubkey,
    publish: publisher.publish,
    ensureCanonicalBeforeAction,
    updateCompanionEvent,
  };

  const startIncubationMutation = useStartIncubation(shared);
  const stopIncubationMutation = useStopIncubation(shared);
  const startEvolutionMutation = useStartEvolution(shared);
  const stopEvolutionMutation = useStopEvolution(shared);
  // A newborn starts healthy but not full (`newborn.ts`): the kit's plan, this app's first needs, the same publish
  const { publish } = publisher;
  const hatchPublish = useCallback<typeof publish>((template) => publish(withNewbornStats(template)), [publish]);
  const hatchMutation = useBlobbiHatch({ ...shared, publish: hatchPublish });
  const evolveMutation = useBlobbiEvolve(shared);

  const run = useCallback(
    async (action: LifecycleAction, go: () => Promise<unknown>): Promise<boolean> => {
      if (pending) return false;
      if (!pubkey) {
        setError(new Error('Sign in first.'));
        return false;
      }
      if (!profile) {
        setError(new Error('Your Blobbonaut profile was not found on the relays, so the lifecycle cannot change yet.'));
        return false;
      }
      setPending(action);
      setError(null);
      try {
        await go();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setPending(null);
        invalidate();
      }
    },
    [pending, pubkey, profile, invalidate],
  );

  return {
    view,
    pending,
    error,
    clearError: () => setError(null),
    startIncubation: () => run('start-incubation', () => startIncubationMutation.mutateAsync({ mode: 'start' })),
    stopIncubation: () => run('stop-incubation', () => stopIncubationMutation.mutateAsync()),
    startEvolution: () => run('start-evolution', () => startEvolutionMutation.mutateAsync()),
    stopEvolution: () => run('stop-evolution', () => stopEvolutionMutation.mutateAsync()),
    hatch: () => run('hatch', () => hatchMutation.mutateAsync()),
    evolve: () => run('evolve', () => evolveMutation.mutateAsync()),
  };
}
