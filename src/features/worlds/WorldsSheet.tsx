/**
 * The worlds a Blobbi can travel to, as cards over the room. An open world is
 * a button that starts the departure (the page goes only once the Blobbi has
 * left); an upcoming one is a card labelled "Coming soon", never a link. What
 * travels: nothing. The other app asks for its own sign-in.
 */
import { Globe2, Lock } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { worlds, type World } from './worlds';

interface WorldsSheetProps {
  open: boolean;
  onClose: () => void;
  blobbi: BlobbiCompanion;
  onTravel: (world: World & { open: boolean }) => void;
  /**
   * A guest's Blobbi (M14) exists on this device only: no world can know it
   * yet. The worlds are shown as what is to come, each card the way to save
   * (`onSave`), never a broken door.
   */
  guest?: boolean;
  onSave?: () => void;
  /** A departure is under way: no door opens a second one until it ends (or Stay ends it). */
  departing?: boolean;
}

export function WorldsSheet({ open, onClose, blobbi, onTravel, guest = false, onSave, departing = false }: WorldsSheetProps) {
  const list = worlds();
  return (
    <GameOverlay
      open={open}
      onClose={onClose}
      title="Worlds"
      testId="worlds-sheet"
      subtitle={`Where will ${blobbi.name} go today?`}
      lead={
        <span className="overlay-portrait" aria-hidden>
          <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`worlds-${blobbi.d}`} size="100%" transparent style={{ width: '100%', height: '100%' }} />
        </span>
      }
    >
      <ul className="worlds-list" data-testid="worlds-list">
        {list.map((w) => {
          const sky = { background: `linear-gradient(135deg, ${w.colors[0]}, ${w.colors[1]})` };
          const body = (
            <>
              <span className="world-card__sky" style={sky} aria-hidden>
                {w.open ? <Globe2 /> : <Lock />}
              </span>
              <span className="world-card__text">
                <span className="world-card__name">{w.name}</span>
                <span className="world-card__tagline">{w.tagline}</span>
              </span>
              <span className={`world-card__badge ${w.open && !guest ? 'world-card__badge--go' : ''}`}>{w.open ? (guest ? 'Save to visit' : 'Visit') : 'Coming soon'}</span>
            </>
          );
          return (
            <li key={w.id}>
              {w.open && guest ? (
                <button type="button" className="world-card world-card--guest" onClick={onSave} data-testid={`world-${w.id}`} data-open="false" data-guest="true" aria-label={`${w.name}: save your Blobbi to visit. ${w.tagline}`}>
                  {body}
                </button>
              ) : w.open ? (
                <button type="button" className="world-card" onClick={() => onTravel(w)} disabled={departing} aria-busy={departing || undefined} data-testid={`world-${w.id}`} data-open="true" aria-label={`Visit ${w.name}. ${w.tagline}`}>
                  {body}
                </button>
              ) : (
                <div className="world-card world-card--soon" data-testid={`world-${w.id}`} data-open="false" aria-label={`${w.name}, coming soon`}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="worlds-note" data-testid="worlds-note">
        {guest
          ? `${blobbi.name} lives only on this device for now, so no world has met it yet. Save ${blobbi.name} and these doors open for the very same Blobbi.`
          : 'Each world is its own app. Your key never travels: the other world asks you to sign in there, the way you signed in here.'}
      </p>
    </GameOverlay>
  );
}
