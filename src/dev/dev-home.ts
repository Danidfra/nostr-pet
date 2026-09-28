import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BlobbiCompanion, BlobbiProgressionState, BlobbonautProfile } from '@blobbi-kit/core';
import type { NostrEvent } from '@nostrify/nostrify';
import { useLifecycle, type Lifecycle } from '@/features/lifecycle';
import type { Facing } from '@/features/home/scene';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import type { FixtureController } from './fixture-controller';
export { specFromCompanion } from './fixture-world';

/**
 * What every dev surface needs from the running home, and the wiring that
 * lets a fixture rewrite reach it the way a published event does. Hooks and
 * helpers only (no components), so the section components can hot-reload.
 */

export const FACINGS: readonly Facing[] = ['front', 'left', 'right', 'back'];
export const PROGRESSIONS: readonly BlobbiProgressionState[] = ['none', 'incubating', 'evolving'];

export interface DevHome {
  blobbi: BlobbiCompanion;
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
}

/**
 * The home's own data hook plus the wiring that lets a rewrite reach the
 * running app the way a published event does (the collection cache first,
 * then the task queries that read the missions). Re-renders the caller on
 * every fixture change.
 */
export function useDevHome(controller: FixtureController) {
  const home = useHomeBlobbi();
  const queryClient = useQueryClient();
  const [, bump] = useState(0);
  const { updateCompanionEvent } = home;
  useEffect(
    () =>
      controller.subscribe((change) => {
        if (change.kind === 'blobbi') {
          updateCompanionEvent(change.event);
          void queryClient.invalidateQueries({ queryKey: ['hatch-tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['evolve-tasks'] });
        }
        if (change.kind === 'reset') void queryClient.invalidateQueries();
        bump((n) => n + 1);
      }),
    [controller, updateCompanionEvent, queryClient],
  );
  return home;
}

export const summaryOf = (blobbi: BlobbiCompanion | undefined, status: string) =>
  blobbi ? `${blobbi.name} · ${blobbi.stage} · ${blobbi.visualGeneration.toUpperCase()} · ${blobbi.state}${blobbi.progressionState !== 'none' ? ` · ${blobbi.progressionState}` : ''}` : status;

/** The kit's lifecycle over the fixture pool: exactly the hook the home runs. What it accepts or refuses is shown, never faked. */
export function useDevLifecycle(home: DevHome): Lifecycle {
  return useLifecycle({ blobbi: home.blobbi, profile: home.profile, pubkey: home.pubkey, updateCompanionEvent: home.updateCompanionEvent, invalidate: home.refresh });
}
