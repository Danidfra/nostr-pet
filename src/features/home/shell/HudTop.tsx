import { Menu } from 'lucide-react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

interface HudTopProps {
  /** The current Blobbi, when one is shown. */
  blobbi?: BlobbiCompanion;
  /** One short line: the mood. */
  mood?: string;
  onOpenBlobbi?: () => void;
  onOpenMenu: () => void;
}

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

/**
 * The top of the HUD: on the left, the Blobbi's chip (portrait, name, one
 * line of mood) that opens its sheet; on the right, the menu. Nothing else
 * lives up here, so the scene keeps the screen. Root is pointer-transparent;
 * only the two controls take taps.
 */
export function HudTop({ blobbi, mood, onOpenBlobbi, onOpenMenu }: HudTopProps) {
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
          </span>
        </button>
      ) : (
        <a href="/" className="blobbi-chip" aria-label="Blobbi home">
          <img src="/blobbilogo.svg" alt="Blobbi" className="h-7 w-auto" />
        </a>
      )}
      <button type="button" className="hud-icon-button" onClick={onOpenMenu} aria-label="Menu" data-testid="menu-button">
        <Menu className="h-5 w-5" aria-hidden />
      </button>
    </header>
  );
}
