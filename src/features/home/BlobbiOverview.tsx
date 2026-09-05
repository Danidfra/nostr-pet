import { useProjectedBlobbiState } from '@blobbi-kit/react';
import {
  getStatStatus,
  getVisibleStats,
  xpProgress,
  xpToLevel,
  xpToNextLevel,
  type BlobbiCompanion,
  type BlobbonautProfile,
} from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { Moon, Sparkles, Flame, Snowflake } from 'lucide-react';

import { formatRelativeTime } from '@/lib/format';
import { BlobbiHero } from './BlobbiHero';
import { BlobbiStatusPanel, type StatItem } from './BlobbiStatusPanel';
import { EnterIslandButton } from './EnterIslandButton';

interface BlobbiOverviewProps {
  blobbi: BlobbiCompanion;
  profile: BlobbonautProfile | null | undefined;
}

const STAGE_LABEL: Record<BlobbiCompanion['stage'], string> = {
  egg: 'Egg',
  baby: 'Baby',
  adult: 'Adult',
};

function StateBadge({ blobbi }: { blobbi: BlobbiCompanion }) {
  if (blobbi.state === 'sleeping') {
    return (
      <Badge tone="indigo" testId="state-badge">
        <Moon className="h-3.5 w-3.5" /> Sleeping
      </Badge>
    );
  }
  if (blobbi.state === 'hibernating') {
    return (
      <Badge tone="sky" testId="state-badge">
        <Snowflake className="h-3.5 w-3.5" /> Hibernating
      </Badge>
    );
  }
  return (
    <Badge tone="emerald" testId="state-badge">
      Awake
    </Badge>
  );
}

function Badge({ children, tone, testId }: { children: ReactNode; tone: 'indigo' | 'sky' | 'emerald' | 'purple' | 'amber'; testId?: string }) {
  const tones = {
    indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  } as const;
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Everything the home says about the current Blobbi: the canonical drawing,
 * stage and activity state, the care stats after projected decay, streak and
 * XP, and the way out to the Island. Every value is read from shared parsed
 * state; nothing here computes decay, thresholds or levels itself.
 */
export function BlobbiOverview({ blobbi, profile }: BlobbiOverviewProps) {
  const projected = useProjectedBlobbiState(blobbi);
  // Every stat the stage shows, after projected decay, with the kit's own
  // warning/critical thresholds. (The kit's `visibleStats` is its "needs
  // attention" list and hides healthy stats; the home shows the whole picture.)
  const statItems: StatItem[] = projected
    ? getVisibleStats(blobbi.stage).map((stat) => ({
        stat,
        value: projected.stats[stat],
        status: getStatStatus(blobbi.stage, stat, projected.stats[stat]),
      }))
    : [];
  const playerXp = profile?.xp;
  const playerLevel = playerXp === undefined ? undefined : xpToLevel(playerXp);
  const levelProgress = playerXp === undefined ? undefined : Math.round(xpProgress(playerXp) * 100);
  const toNext = playerXp === undefined ? undefined : xpToNextLevel(playerXp);

  return (
    <div className="flex flex-col items-center gap-8">
      <BlobbiHero blobbi={blobbi} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone="purple" testId="stage-badge">
          {STAGE_LABEL[blobbi.stage]}
        </Badge>
        <StateBadge blobbi={blobbi} />
        {blobbi.progressionState !== 'none' && (
          <Badge tone="amber" testId="progression-badge">
            <Sparkles className="h-3.5 w-3.5" />
            {blobbi.progressionState === 'incubating' ? 'Incubating' : 'Evolving'}
          </Badge>
        )}
        {blobbi.careStreak !== undefined && blobbi.careStreak > 0 && (
          <Badge tone="amber" testId="streak-badge">
            <Flame className="h-3.5 w-3.5" /> {blobbi.careStreak}-day streak
          </Badge>
        )}
      </div>

      <BlobbiStatusPanel items={statItems} />

      <dl className="grid w-full max-w-md grid-cols-2 gap-3 text-center text-sm">
        {blobbi.experience !== undefined && (
          <div className="rounded-xl border border-border bg-card/70 p-3">
            <dt className="text-xs text-muted-foreground">Blobbi XP</dt>
            <dd className="font-semibold" data-testid="blobbi-xp">
              {blobbi.experience}
            </dd>
          </div>
        )}
        {playerLevel !== undefined && (
          <div className="rounded-xl border border-border bg-card/70 p-3">
            <dt className="text-xs text-muted-foreground">Blobbonaut level</dt>
            <dd className="font-semibold" data-testid="player-level">
              {playerLevel}
              {toNext !== undefined && toNext > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">({levelProgress}% to next)</span>
              )}
            </dd>
          </div>
        )}
        <div className="col-span-2 rounded-xl border border-border bg-card/70 p-3">
          <dt className="text-xs text-muted-foreground">Last cared for</dt>
          <dd className="font-semibold" data-testid="last-interaction">
            {formatRelativeTime(blobbi.lastInteraction)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col items-center gap-2">
        <EnterIslandButton />
        <p className="text-xs text-muted-foreground">Your Blobbi lives here. The Island is where you go out into the world.</p>
      </div>
    </div>
  );
}
