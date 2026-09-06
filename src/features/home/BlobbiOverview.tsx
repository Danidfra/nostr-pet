import { useEffect, useMemo, useState } from 'react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import { getStatStatus, getVisibleStats, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';
import { Moon, Snowflake, Sparkles } from 'lucide-react';

import { availableCareActions, useCareActions, type CareAction } from '@/features/care';
import type { NostrEvent } from '@blobbi-kit/core';
import { BlobbiHero } from './BlobbiHero';
import { BlobbiSelector } from './BlobbiSelector';
import { BlobbiStatusPanel, type StatItem } from './BlobbiStatusPanel';
import { CareDock } from './CareDock';
import { CareFeedback } from './CareFeedback';
import { EnterIslandButton } from './EnterIslandButton';
import { ProgressionStrip } from './ProgressionStrip';
import { describeMood } from './mood';

interface BlobbiOverviewProps {
  blobbi: BlobbiCompanion;
  companions: readonly BlobbiCompanion[];
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  onSelect: (d: string) => void;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
}

const STAGE_LABEL: Record<BlobbiCompanion['stage'], string> = {
  egg: 'Egg',
  baby: 'Baby',
  adult: 'Adult',
};

function Chip({ children, testId, tone = 'neutral' }: { children: React.ReactNode; testId?: string; tone?: 'neutral' | 'sleep' | 'cold' | 'grow' }) {
  const tones = {
    neutral: 'bg-card/80 text-foreground',
    sleep: 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200',
    cold: 'bg-sky-500/20 text-sky-900 dark:text-sky-200',
    grow: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  } as const;
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * The home of one Blobbi, top to bottom by importance: the Blobbi in its
 * environment, its name and how it feels, the care dock, its condition, then
 * progression and the way out to the Island. Every value is read from shared
 * parsed state; nothing here computes decay, thresholds, levels or effects.
 */
export function BlobbiOverview({ blobbi, companions, profile, pubkey, onSelect, updateCompanionEvent, refresh }: BlobbiOverviewProps) {
  const projected = useProjectedBlobbiState(blobbi);
  const care = useCareActions({ pubkey, updateCompanionEvent, invalidate: refresh });

  const statItems: StatItem[] = projected
    ? getVisibleStats(blobbi.stage).map((stat) => ({
        stat,
        value: projected.stats[stat],
        status: getStatStatus(blobbi.stage, stat, projected.stats[stat]),
      }))
    : [];

  const actions = useMemo(() => availableCareActions(blobbi), [blobbi]);
  const mood = describeMood(blobbi, projected?.stats);

  // A hop and fresh chips each time a care action lands.
  const [resultKey, setResultKey] = useState(0);
  const lastResult = care.lastResult;
  useEffect(() => {
    if (lastResult) setResultKey((k) => k + 1);
  }, [lastResult]);

  const onAction = (action: CareAction) => care.perform(blobbi.d, action);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <section className="home-scene -mx-6 flex min-h-[70svh] flex-col px-4 pb-8 pt-4 sm:mx-0 sm:min-h-[560px] sm:rounded-[2rem] sm:px-8 sm:pb-36" aria-label={`${blobbi.name}'s home`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Chip testId="stage-badge">{STAGE_LABEL[blobbi.stage]}</Chip>
            {blobbi.state === 'sleeping' && (
              <Chip tone="sleep" testId="state-badge">
                <Moon className="h-3.5 w-3.5" aria-hidden /> Sleeping
              </Chip>
            )}
            {blobbi.state === 'hibernating' && (
              <Chip tone="cold" testId="state-badge">
                <Snowflake className="h-3.5 w-3.5" aria-hidden /> Hibernating
              </Chip>
            )}
            {blobbi.state === 'active' && <Chip testId="state-badge">Awake</Chip>}
            {blobbi.progressionState !== 'none' && (
              <Chip tone="grow" testId="progression-badge">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {blobbi.progressionState === 'incubating' ? 'Incubating' : 'Evolving'}
              </Chip>
            )}
          </div>
          <BlobbiSelector companions={companions} currentD={blobbi.d} onSelect={onSelect} />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center py-6">
          <CareFeedback result={care.lastResult} error={care.error} resultKey={resultKey} />
          <BlobbiHero blobbi={blobbi} mood={mood} happyKey={resultKey} />
        </div>

      </section>

      {/* One dock: under the thumb on small screens, inside the scene on larger ones. */}
      <div className="dock-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 px-2 pt-2 backdrop-blur sm:relative sm:z-10 sm:-mt-32 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
        <CareDock actions={actions} pendingAction={care.pendingAction} onAction={onAction} />
      </div>

      <section className="home-glass mx-auto w-full max-w-2xl rounded-3xl px-4 py-4 sm:px-6" aria-label="Condition and progress">
        <BlobbiStatusPanel items={statItems} />
        <div className="mt-4 border-t border-border/60 pt-3">
          <ProgressionStrip blobbi={blobbi} profile={profile} />
        </div>
      </section>

      <div className="flex flex-col items-center gap-2 pb-24 sm:pb-4">
        <EnterIslandButton />
        <p className="text-xs text-muted-foreground">Your Blobbi lives here. The Island is where you go out into the world.</p>
      </div>
    </div>
  );
}
