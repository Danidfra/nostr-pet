/**
 * A small card over the room while the Blobbi is leaving for a world: where
 * it is going, and Stay (until the page has been asked to go). A navigation
 * that did not happen says so, with Try again.
 */
import type { DeparturePhase } from './useWorldDeparture';
import type { World } from './worlds';

interface DepartureCardProps {
  phase: DeparturePhase;
  world: World;
  name: string;
  onStay: () => void;
  onRetry: () => void;
}

export function DepartureCard({ phase, world, name, onStay, onRetry }: DepartureCardProps) {
  const failed = phase === 'failed';
  const text = failed ? `${world.name} did not open. ${name} is back home.` : phase === 'gone' ? `Opening ${world.name}…` : `${name} is off to ${world.name}…`;
  return (
    <div className={`departure-card ${failed ? 'departure-card--failed' : ''}`} role={failed ? 'alert' : 'status'} aria-live="polite" data-testid="departure-card" data-phase={phase}>
      <span className="departure-card__sky" style={{ background: `linear-gradient(135deg, ${world.colors[0]}, ${world.colors[1]})` }} aria-hidden />
      <p className="departure-card__text">{text}</p>
      <span className="departure-card__actions">
        {failed && (
          <button type="button" className="departure-card__btn departure-card__btn--go" onClick={onRetry} data-testid="departure-retry">
            Try again
          </button>
        )}
        {phase !== 'gone' && (
          <button type="button" className="departure-card__btn" onClick={onStay} data-testid="departure-stay">
            {failed ? 'OK' : 'Stay'}
          </button>
        )}
      </span>
    </div>
  );
}
