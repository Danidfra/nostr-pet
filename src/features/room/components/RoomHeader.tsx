/**
 * The bar above the room (the shell's `header`): the way back to the home
 * and whose room this is. Ditto keeps its navigation above the room too, on
 * its sub-header's downward arc (`SubHeaderBar`, `ArcBackground variant="down"`),
 * and leaves the dock to the room's own bar; so does this.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Globe2, Map as MapIcon, Menu } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { ArcBackground } from './ArcBackground';
import { ConnectionChip } from '@/features/home/shell/ConnectionChip';
import type { HealthLevel } from '@/lib/relay-health';
import type { FromRoomState } from '@/lib/home-experience';

/** The way back says where it came from, so a player who opens in the room is not sent straight back to it. */
const BACK_HOME: FromRoomState = { fromRoom: true };

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

interface RoomHeaderProps {
  name: string;
  stage: BlobbiCompanion['stage'];
  /** The name opens the Blobbi's details (its numbers, its lifecycle, the other Blobbis, the items). */
  onOpenBlobbi?: () => void;
  /** The game menu (sound, lighting, the account, the way to the classic home). */
  onOpenMenu?: () => void;
  /** Connection health; the chip shows only when it is not healthy. */
  connection?: { level: HealthLevel; online: boolean; onRetry: () => void };
  /** The care streak, when there is one. */
  streak?: { days: number; bumpKey: number };
  /** The worlds this Blobbi can travel to. */
  onOpenWorlds?: () => void;
  /** The journey: the chapters and what to do next. */
  onOpenJourney?: () => void;
  /** Show the old way back to the classic home (legacy; the menu has it otherwise). */
  onBack?: boolean;
}

export function RoomHeader({ name, stage, onOpenBlobbi, onOpenMenu, onOpenWorlds, onOpenJourney, connection, streak, onBack = false }: RoomHeaderProps) {
  const label = (
    <>
      <span>{name}</span>
      <span className="font-normal text-foreground/60"> · {STAGE_WORD[stage]}</span>
    </>
  );
  return (
    <div className="room-header relative z-10" data-testid="room-header">
      <ArcBackground variant="down" />
      <div className="relative flex min-h-[3.25em] items-center gap-[0.5em] px-3 pb-[0.4em] pt-[0.25em]">
        {onBack ? (
          <Link to="/" state={BACK_HOME} className="room-header-back touch-hit" aria-label="Classic home" title="Classic home" data-testid="room-back">
            <ArrowLeft />
          </Link>
        ) : onOpenWorlds ? (
          <button type="button" onClick={onOpenWorlds} className="room-header-back touch-hit" aria-label="Worlds" title="Worlds" data-testid="room-worlds">
            <Globe2 />
          </button>
        ) : (
          // The room is the home: no way "back"; the menu keeps the classic home. The size of the menu button keeps the name centred.
          <span className="size-[2.25em] shrink-0" aria-hidden />
        )}
        {onOpenBlobbi ? (
          <button type="button" onClick={onOpenBlobbi} className="room-header-name min-w-0 flex-1 truncate text-center text-[0.95em] font-semibold" aria-label={`${name}, ${STAGE_WORD[stage]}. Open details`} data-testid="room-header-name">
            {label}
          </button>
        ) : (
          <p className="min-w-0 flex-1 truncate text-center text-[0.95em] font-semibold" data-testid="room-header-name">
            {label}
          </p>
        )}
        <span className="flex shrink-0 items-center gap-[0.35em]">
          {connection && <ConnectionChip level={connection.level} online={connection.online} onRetry={connection.onRetry} />}
          {streak && streak.days > 0 && (
            <span key={streak.bumpKey} className={`streak-pill ${streak.bumpKey > 0 ? 'streak-pill--bump' : ''}`} aria-label={`Care streak: ${streak.days} day${streak.days === 1 ? '' : 's'}`} title="Care streak" data-testid="room-streak-pill" data-days={streak.days}>
              <Flame className="h-4 w-4" aria-hidden />
              <span className="streak-pill__days">{streak.days}</span>
            </span>
          )}
          {onOpenJourney && (
            <button type="button" onClick={onOpenJourney} className="room-header-back touch-hit" aria-label="Journey" title="Journey" data-testid="room-journey">
              <MapIcon />
            </button>
          )}
          {onOpenMenu ? (
            <button type="button" onClick={onOpenMenu} className="room-header-back touch-hit" aria-label="Menu" title="Menu" data-testid="room-menu">
              <Menu />
            </button>
          ) : (
            // The size of the back button, so the name stays centred
            <span className="size-[2.25em] shrink-0" aria-hidden />
          )}
        </span>
      </div>
    </div>
  );
}
