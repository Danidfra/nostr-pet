/**
 * The words around world presence, in a child's words and with no protocol in them: while the Blobbi is in another
 * Blobbi world, a small card says where and offers to call it home; when it leaves or comes back, a short line says so
 * and goes. Shared by the classic home and the room, in both presence modes (`useHomeTravel`). On Nostr (M16) the
 * card also says what a call home is doing: waiting for the signer, on the way, or what went wrong, with Try again.
 */
import { useEffect, useState } from 'react';
import { Home, RotateCcw } from 'lucide-react';
import type { TravelPhase } from '@blobbi-kit/core';
import { placeName } from './world-presence';

export interface WorldPresenceNoteProps {
  name: string;
  /** Where the Blobbi is (`home`, `pixel`, `blobbi-pixel`, …). */
  place: string;
  /** The Blobbi is away from this home and its departure has finished. */
  away: boolean;
  /** The last journey the sync began, with a key that changes per journey. */
  journey: { kind: 'enter' | 'leave'; place: string; key: number } | null;
  onCallHome: () => void;
  /** A place's words (v1's `placeName` by default). */
  nameOf?: (place: string) => string;
  /** Nostr: what a call home is doing now. */
  travel?: TravelPhase;
  /** Nostr: whether its World shows recent play ("playing there right now", or else "last there"); v1: unset. */
  playedThere?: boolean;
  /** Nostr: try again after a failure. */
  onRetry?: () => void;
}

const LINE_MS = 3_200;

const FAILED: Record<string, (name: string) => string> = {
  declined: (n) => `The signer did not approve calling ${n} home.`,
  unreachable: () => "Couldn't reach the Blobbi relays.",
  stale: (n) => `${n} moved again meanwhile.`,
  'wrong-account': () => 'The account changed meanwhile.',
  failed: (n) => `${n} couldn't come home just now.`,
};

export function WorldPresenceNote({ name, place, away, journey, onCallHome, nameOf = placeName, travel, playedThere, onRetry }: WorldPresenceNoteProps) {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!journey) return;
    setLine(journey.kind === 'leave' ? `${name} hopped over to ${nameOf(journey.place)}!` : `${name} is back home!`);
    const timer = setTimeout(() => setLine(null), LINE_MS);
    return () => clearTimeout(timer);
  }, [journey, name, nameOf]);

  const phase = travel?.phase ?? 'idle';
  if (phase === 'arriving') {
    return (
      <p className="world-presence-line home-glass" role="status" data-testid="world-presence-line" data-travel-phase="arriving">
        {name} is on the way home…
      </p>
    );
  }
  if (away) {
    const working = phase === 'checking' || phase === 'signing' || phase === 'publishing';
    const failed = travel?.phase === 'failed' ? travel.reason : null;
    return (
      <div className="world-presence-note home-glass" role="status" data-testid="world-presence-away" data-place={place} data-travel-phase={phase} data-world-travel="explicit">
        <p className="text-sm font-semibold">
          {playedThere === false ? `${name} was last in ${nameOf(place)}` : `${name} is playing in ${nameOf(place)}${playedThere ? ' right now' : ''}`}
        </p>
        <p className="text-xs opacity-80" data-testid="world-presence-detail">
          {phase === 'signing' ? `Approve in your signer to call ${name} home.` : working ? `Calling ${name} home…` : failed ? (FAILED[failed] ?? FAILED.failed)(name) : `${name} comes home when you play here.`}
        </p>
        {failed && onRetry ? (
          <button type="button" className="lifecycle-pill !animate-none !px-3 !py-1.5 !text-xs" onClick={onRetry} data-testid="world-travel-retry">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
        ) : (
          <button type="button" className="lifecycle-pill !animate-none !px-3 !py-1.5 !text-xs" onClick={onCallHome} disabled={working} data-testid="world-presence-call-home">
            <Home className="h-3.5 w-3.5" aria-hidden />
            Call {name} home
          </button>
        )}
      </div>
    );
  }
  if (!line) return null;
  return (
    <p className="world-presence-line home-glass" role="status" data-testid="world-presence-line">
      {line}
    </p>
  );
}
