import { xpProgress, xpToLevel, xpToNextLevel, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';
import { Flame, Sparkles, Star } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';

interface ProgressionStripProps {
  blobbi: BlobbiCompanion;
  profile: BlobbonautProfile | null | undefined;
}

/**
 * Progression, kept secondary: Blobbi XP, the player's Blobbonaut level with
 * its bar, the streak, and when the Blobbi was last cared for. Every number
 * is the kit's (`xpToLevel`, `xpProgress`, `xpToNextLevel`, `careStreak`).
 */
export function ProgressionStrip({ blobbi, profile }: ProgressionStripProps) {
  const playerXp = profile?.xp;
  const level = playerXp === undefined ? undefined : xpToLevel(playerXp);
  const progress = playerXp === undefined ? undefined : Math.round(xpProgress(playerXp) * 100);
  const toNext = playerXp === undefined ? undefined : xpToNextLevel(playerXp);

  return (
    <dl className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
      {blobbi.experience !== undefined && (
        <div className="flex items-center gap-1.5" title="Blobbi experience">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <dt className="sr-only">Blobbi XP</dt>
          <dd className="font-semibold" data-testid="blobbi-xp">
            {blobbi.experience}
            <span className="ml-1 text-xs font-normal text-muted-foreground">XP</span>
          </dd>
        </div>
      )}
      {level !== undefined && (
        <div className="flex items-center gap-2" title={toNext !== undefined && toNext > 0 ? `${toNext} XP to the next level` : 'Max level'}>
          <Star className="h-4 w-4 text-amber-500" aria-hidden />
          <dt className="sr-only">Blobbonaut level</dt>
          <dd className="flex items-center gap-2 font-semibold" data-testid="player-level">
            {level}
            {progress !== undefined && toNext !== undefined && toNext > 0 && (
              <span
                className="block h-1.5 w-16 overflow-hidden rounded-full bg-foreground/10"
                role="progressbar"
                aria-label="Progress to next level"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </span>
            )}
          </dd>
        </div>
      )}
      {blobbi.careStreak !== undefined && blobbi.careStreak > 0 && (
        <div className="flex items-center gap-1.5" title="Care streak">
          <Flame className="h-4 w-4 text-orange-500" aria-hidden />
          <dt className="sr-only">Care streak</dt>
          <dd className="font-semibold" data-testid="streak-badge">
            {blobbi.careStreak}
            <span className="ml-1 text-xs font-normal text-muted-foreground">day{blobbi.careStreak === 1 ? '' : 's'}</span>
          </dd>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <dt>Last cared for</dt>
        <dd data-testid="last-interaction">{formatRelativeTime(blobbi.lastInteraction)}</dd>
      </div>
    </dl>
  );
}
