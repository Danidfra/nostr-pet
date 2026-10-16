/**
 * The words around world presence, in a child's words and with no protocol in them: while the Blobbi is in another
 * Blobbi app, a small card says where and offers to call it home; when it leaves or comes back, a short line says so
 * and goes. Shared by the classic home and the room.
 */
import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { placeName } from './world-presence';

export interface WorldPresenceNoteProps {
  name: string;
  /** Where the Blobbi is (`home`, `pixel`, …). */
  place: string;
  /** The Blobbi is away from this home and its departure has finished. */
  away: boolean;
  /** The last journey the sync began, with a key that changes per journey. */
  journey: { kind: 'enter' | 'leave'; place: string; key: number } | null;
  onCallHome: () => void;
}

const LINE_MS = 3_200;

export function WorldPresenceNote({ name, place, away, journey, onCallHome }: WorldPresenceNoteProps) {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!journey) return;
    setLine(journey.kind === 'leave' ? `${name} hopped over to ${placeName(journey.place)}!` : `${name} is back home!`);
    const timer = setTimeout(() => setLine(null), LINE_MS);
    return () => clearTimeout(timer);
  }, [journey, name]);

  if (away) {
    return (
      <div className="world-presence-note home-glass" role="status" data-testid="world-presence-away" data-place={place}>
        <p className="text-sm font-semibold">
          {name} is playing in {placeName(place)}
        </p>
        <p className="text-xs opacity-80">{name} comes home when you play here.</p>
        <button type="button" className="lifecycle-pill !animate-none !px-3 !py-1.5 !text-xs" onClick={onCallHome} data-testid="world-presence-call-home">
          <Home className="h-3.5 w-3.5" aria-hidden />
          Call {name} home
        </button>
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
