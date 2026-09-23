import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import { getStatStatus, getVisibleStats, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';
import { Moon, Snowflake, Sparkles } from 'lucide-react';

import { availableCareActions, useCareActions, type CareAction, type CareResult } from '@/features/care';
import type { NostrEvent } from '@blobbi-kit/core';
import { BlobbiSelector } from './BlobbiSelector';
import { BlobbiStatusPanel, type StatItem } from './BlobbiStatusPanel';
import { CareDock } from './CareDock';
import { CareError, CareFeedback } from './CareFeedback';
import { EnterIslandButton } from './EnterIslandButton';
import { ProgressionStrip } from './ProgressionStrip';
import { describeMood } from './mood';
import { BED_SLEEP_SPOT, Bed, BED_POSITION, BlobbiActor, HomeScene, useBlobbiPresentation } from './scene';

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
 * The home of one Blobbi: the place it lives (scene, floor, bed, the Blobbi
 * itself), the care dock, its condition, then progression and the way out
 * to the Island. Every value is read from shared parsed state; nothing here
 * computes decay, thresholds, levels or effects. Movement, gaze, facing and
 * reactions are local presentation state and never publish.
 */
export function BlobbiOverview(props: BlobbiOverviewProps) {
  // The scene is per Blobbi: switching Blobbis starts the newcomer at home.
  return <BlobbiHome key={props.blobbi.d} {...props} />;
}

function BlobbiHome({ blobbi, companions, profile, pubkey, onSelect, updateCompanionEvent, refresh }: BlobbiOverviewProps) {
  const projected = useProjectedBlobbiState(blobbi);
  const care = useCareActions({ pubkey, updateCompanionEvent, invalidate: refresh });

  const sceneRef = useRef<HTMLElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const scene = useBlobbiPresentation({ blobbi, stats: projected?.stats, sceneRef, actorRef });

  const statItems: StatItem[] = projected
    ? getVisibleStats(blobbi.stage).map((stat) => ({
        stat,
        value: projected.stats[stat],
        status: getStatStatus(blobbi.stage, stat, projected.stats[stat]),
      }))
    : [];

  const actions = useMemo(() => availableCareActions(blobbi), [blobbi]);
  const mood = describeMood(blobbi, projected?.stats);

  // A hop, fresh chips and a face each time a care action lands.
  const [resultKey, setResultKey] = useState(0);
  const lastResult = care.lastResult;
  const { reactToCare } = scene;
  useEffect(() => {
    if (!lastResult) return;
    setResultKey((k) => k + 1);
    reactToCare(lastResult as CareResult);
  }, [lastResult, reactToCare]);

  // Rest is walk-then-sleep: the protocol action runs on arrival at the bed,
  // never before. The walk is awaited, and the decision to sleep is taken
  // with LIVE state after it ends: only an `arrived` walk counts (a tap
  // elsewhere replaces it), and only if the Blobbi is still awake by then
  // (a relay refresh may have said otherwise while it walked). `perform`
  // itself checks a live in-flight flag, so nothing captured when Rest was
  // pressed can be stale. Under reduced motion arrival is immediate.
  const [walkingToBed, setWalkingToBed] = useState(false);
  const liveBlobbi = useRef(blobbi);
  useEffect(() => {
    liveBlobbi.current = blobbi;
  }, [blobbi]);
  const perform = care.perform;
  const walkTo = scene.walkTo;
  const onAction = useCallback(
    (action: CareAction) => {
      if (action === 'rest' && blobbi.state === 'active') {
        setWalkingToBed(true);
        void walkTo(BED_SLEEP_SPOT).then((outcome) => {
          setWalkingToBed(false);
          if (outcome !== 'arrived') return;
          if (liveBlobbi.current.state !== 'active') return;
          perform(liveBlobbi.current.d, 'rest');
        });
        return;
      }
      perform(blobbi.d, action);
    },
    [blobbi.d, blobbi.state, perform, walkTo],
  );

  const pendingAction: CareAction | null = care.pendingAction ?? (walkingToBed ? 'rest' : null);
  const sleeping = blobbi.state === 'sleeping';

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <HomeScene
        ref={sceneRef}
        className="-mx-6 min-h-[70svh] px-4 pb-8 pt-4 sm:mx-0 sm:min-h-[560px] sm:rounded-[2rem] sm:px-8"
        label={`${blobbi.name}'s home`}
        floorLabel={sleeping ? `${blobbi.name} is asleep` : `Call ${blobbi.name} here`}
        onFloorTap={sleeping ? undefined : scene.onFloorTap}
        pointerHandlers={scene.scenePointerHandlers}
        topBar={
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
        }
        objects={<Bed occupied={sleeping} onTap={sleeping ? undefined : () => void scene.walkTo(BED_POSITION)} />}
        actor={
          <BlobbiActor ref={actorRef} blobbi={blobbi} presentation={scene.presentation} mood={mood} happyKey={resultKey} onPoke={scene.poke}>
            <CareFeedback result={care.lastResult} resultKey={resultKey} />
          </BlobbiActor>
        }
        foreground={
          <div className="absolute inset-x-4 top-14 sm:top-16">
            <CareError error={care.error} />
          </div>
        }
      />

      {/* One dock: under the thumb on small screens, just under the scene on larger ones (never over the floor). */}
      <div className="dock-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 px-2 pt-2 backdrop-blur sm:relative sm:z-10 sm:-mt-2 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
        <CareDock actions={actions} pendingAction={pendingAction} onAction={onAction} />
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
