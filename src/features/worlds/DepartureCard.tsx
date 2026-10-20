/**
 * A small card over the room while the Blobbi is leaving for a world: where
 * it is going, and Stay (until the page has been asked to go: nothing is
 * signed or published before then). A navigation that did not happen says
 * so, with Try again; once the Blobbi has been moved to that world (`left`)
 * it says that instead, and offers Dismiss rather than anything that would
 * read as undoing the trip.
 */
import type { DeparturePhase } from './useWorldDeparture';
import type { World } from './worlds';

interface DepartureCardProps {
  phase: DeparturePhase;
  world: World;
  name: string;
  onStay: () => void;
  onRetry: () => void;
  /** The player's signer is being asked to let the Blobbi travel along (the page goes once it answers). */
  signing?: boolean;
  /** The Blobbi has been moved to the world already (published): a failed navigation did not undo that. */
  left?: boolean;
  /** Dismiss, after a failed navigation with `left`: the card goes, the Blobbi stays where it is. */
  onDismiss?: () => void;
}

export function DepartureCard({ phase, world, name, onStay, onRetry, signing = false, left = false, onDismiss }: DepartureCardProps) {
  const failed = phase === 'failed';
  const text = failed
    ? left
      ? `${name} has left for ${world.name}, but it did not open.`
      : `${world.name} did not open. ${name} is back home.`
    : phase === 'gone'
      ? signing
        ? `Approve the trip in your signer so ${name} comes along…`
        : `Opening ${world.name}…`
      : `${name} is off to ${world.name}…`;
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
        {failed && left ? (
          <button type="button" className="departure-card__btn" onClick={onDismiss ?? onStay} data-testid="departure-dismiss">
            Dismiss
          </button>
        ) : (
          phase !== 'gone' && (
            <button type="button" className="departure-card__btn" onClick={onStay} data-testid="departure-stay">
              {failed ? 'OK' : 'Stay'}
            </button>
          )
        )}
      </span>
    </div>
  );
}
