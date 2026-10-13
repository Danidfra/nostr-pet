import { Flame, Menu } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { ConnectionChip } from './ConnectionChip';
import type { HealthLevel } from '@/lib/relay-health';

interface HudTopProps {
  /** The current Blobbi, when one is shown: its name stands in the middle of the top. */
  blobbi?: BlobbiCompanion;
  /** The streak, and whether it just went up (animates). */
  streak?: { days: number; bumpKey: number };
  onOpenMenu: () => void;
  /** Connection health; the chip shows only when it is not healthy. */
  connection?: { level: HealthLevel; online: boolean; onRetry: () => void };
  /** Something small on the left (the guest's "On this device", the saved mark). */
  leading?: ReactNode;
}

/**
 * The top of the HUD (M14.1): the Blobbi's name in the middle of the screen,
 * display only, readable over any room; on the right the streak, when there
 * is one, the connection dot or chip, and the menu; on the left whatever the
 * home wants to say in a word (a guest's status). Everything about the
 * Blobbi (its numbers, its stage, the other Blobbis, its lifecycle) is the
 * dock's Blobbi button, bottom left, so nothing up here is a door to it.
 * Root is pointer-transparent; only the controls take taps.
 */
export function HudTop({ blobbi, streak, onOpenMenu, connection, leading }: HudTopProps) {
  return (
    <header className="hud-top" data-testid="hud-top">
      <span className="hud-top__left">{leading}</span>
      {blobbi ? (
        <p className="hud-name" data-testid="hud-name" aria-live="polite">
          <span className="hud-name__text">{blobbi.name}</span>
        </p>
      ) : (
        <a href="/" className="hud-name hud-name--logo" aria-label="Blobbi home">
          <img src="/blobbilogo.svg" alt="Blobbi" className="h-7 w-auto" />
        </a>
      )}
      <span className="hud-top__right">
        {connection && <ConnectionChip level={connection.level} online={connection.online} onRetry={connection.onRetry} />}
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
