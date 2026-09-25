import { Flame, Menu } from 'lucide-react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import type { StatItem } from '../BlobbiStatusPanel';

interface HudTopProps {
  /** The current Blobbi, when one is shown. */
  blobbi?: BlobbiCompanion;
  /** One short line: the mood. */
  mood?: string;
  /** The stage's stats with their status, for the condition dots. */
  statItems?: readonly StatItem[];
  /** The streak, and whether it just went up (animates). */
  streak?: { days: number; bumpKey: number };
  onOpenBlobbi?: () => void;
  onOpenMenu: () => void;
}

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };
const STAT_WORD: Record<StatItem['stat'], string> = { hunger: 'food', happiness: 'joy', hygiene: 'clean', energy: 'energy', health: 'health' };

/**
 * The top of the HUD: on the left the Blobbi's chip (portrait, name, stage
 * and mood, and one small dot per stat coloured by the kit's status) that
 * opens its sheet with the exact numbers; on the right the streak, when
 * there is one, and the menu. Nothing else lives up here, so the room
 * keeps the screen. Root is pointer-transparent; only the controls take
 * taps.
 */
export function HudTop({ blobbi, mood, statItems = [], streak, onOpenBlobbi, onOpenMenu }: HudTopProps) {
  return (
    <header className="hud-top" data-testid="hud-top">
      {blobbi ? (
        <button type="button" className="blobbi-chip" onClick={onOpenBlobbi} data-testid="blobbi-chip" aria-label={`${blobbi.name}: ${STAGE_WORD[blobbi.stage]}${mood ? `, ${mood}` : ''}. Open details`}>
          <span className="blobbi-chip__portrait" aria-hidden>
            <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`chip-${blobbi.d}`} size={30} isSleeping={blobbi.state === 'sleeping'} transparent />
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-bold leading-tight">{blobbi.name}</span>
            <span className="block truncate text-[11px] leading-tight text-foreground/70">
              {STAGE_WORD[blobbi.stage]}
              {mood ? ` · ${mood}` : ''}
            </span>
            {statItems.length > 0 && (
              <span className="cond-dots" aria-hidden data-testid="condition-dots">
                {statItems.map((item) => (
                  <span key={item.stat} className={`cond-dot cond-dot--${item.status}`} title={`${STAT_WORD[item.stat]} ${Math.round(item.value)}`} data-stat={item.stat} data-status={item.status} />
                ))}
              </span>
            )}
          </span>
        </button>
      ) : (
        <a href="/" className="blobbi-chip" aria-label="Blobbi home">
          <img src="/blobbilogo.svg" alt="Blobbi" className="h-7 w-auto" />
        </a>
      )}
      <span className="hud-top__right">
        {streak && streak.days > 0 && (
          <span key={streak.bumpKey} className={`streak-pill ${streak.bumpKey > 0 ? 'streak-pill--bump' : ''}`} aria-label={`Care streak: ${streak.days} day${streak.days === 1 ? '' : 's'}`} title="Care streak" data-testid="streak-pill" data-days={streak.days}>
            <Flame className="h-4 w-4" aria-hidden />
            <span className="streak-pill__days">{streak.days}</span>
          </span>
        )}
        <button type="button" className="hud-icon-button" onClick={onOpenMenu} aria-label="Menu" data-testid="menu-button">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </span>
    </header>
  );
}
