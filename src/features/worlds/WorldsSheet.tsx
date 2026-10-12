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
}

export function WorldsSheet({ open, onClose, blobbi, onTravel }: WorldsSheetProps) {
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
              <span className={`world-card__badge ${w.open ? 'world-card__badge--go' : ''}`}>{w.open ? 'Visit' : 'Coming soon'}</span>
            </>
          );
          return (
            <li key={w.id}>
              {w.open ? (
                <button type="button" className="world-card" onClick={() => onTravel(w)} data-testid={`world-${w.id}`} data-open="true" aria-label={`Visit ${w.name}. ${w.tagline}`}>
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
        Each world is its own app. Your key never travels: the other world asks you to sign in there, the way you signed in here.
      </p>
    </GameOverlay>
  );
}
