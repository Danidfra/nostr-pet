/**
 * The bar above the room (the shell's `header`): whose room this is, in the
 * middle of the screen, display only (M14.1); on the right the streak, the
 * connection dot or chip and the menu; on the left a word from the home (a
 * guest's status). Ditto keeps its navigation above the room too, on its
 * sub-header's downward arc (`SubHeaderBar`, `ArcBackground variant="down"`),
 * and leaves the dock to the room's own bar; so does this. Everything about
 * the Blobbi is the dock's Blobbi button; the worlds are the menu's.
 */
import { Flame, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { ArcBackground } from './ArcBackground';
import { ConnectionChip } from '@/features/home/shell/ConnectionChip';
import type { HealthLevel } from '@/lib/relay-health';

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

interface RoomHeaderProps {
  name: string;
  stage: BlobbiCompanion['stage'];
  /** The game menu (the account, the room's settings, sound, lighting, the worlds). */
  onOpenMenu?: () => void;
  /** Connection health; the chip shows only when it is not healthy. */
  connection?: { level: HealthLevel; online: boolean; onRetry: () => void };
  /** The care streak, when there is one. */
  streak?: { days: number; bumpKey: number };
  /** Something small on the left (the guest's "On this device", the saved mark). */
  leading?: ReactNode;
}

export function RoomHeader({ name, stage, onOpenMenu, connection, streak, leading }: RoomHeaderProps) {
  return (
    <div className="room-header relative z-10" data-testid="room-header">
      <ArcBackground variant="down" />
      <div className="relative flex min-h-[3.25em] items-center justify-between gap-[0.5em] px-3 pb-[0.4em] pt-[0.25em]">
        <span className="flex min-w-[2.25em] shrink-0 items-center">{leading}</span>
        {/* The name in the middle of the screen, whatever stands at the sides: absolute, so the sides never push it */}
        <p className="room-header-name" data-testid="room-header-name" aria-live="polite">
          <span className="room-header-name__text">{name}</span>
          <span className="room-header-name__stage"> · {STAGE_WORD[stage]}</span>
        </p>
        <span className="flex shrink-0 items-center gap-[0.35em]">
          {connection && <ConnectionChip level={connection.level} online={connection.online} onRetry={connection.onRetry} />}
          {streak && streak.days > 0 && (
            <span key={streak.bumpKey} className={`streak-pill ${streak.bumpKey > 0 ? 'streak-pill--bump' : ''}`} aria-label={`Care streak: ${streak.days} day${streak.days === 1 ? '' : 's'}`} title="Care streak" data-testid="room-streak-pill" data-days={streak.days}>
              <Flame className="h-4 w-4" aria-hidden />
              <span className="streak-pill__days">{streak.days}</span>
            </span>
          )}
          {onOpenMenu ? (
            <button type="button" onClick={onOpenMenu} className="room-header-back touch-hit" aria-label="Menu" title="Menu" data-testid="room-menu">
              <Menu />
            </button>
          ) : (
            <span className="size-[2.25em] shrink-0" aria-hidden />
          )}
        </span>
      </div>
    </div>
  );
}
