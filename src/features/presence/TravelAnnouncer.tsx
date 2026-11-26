/**
 * What a screen reader hears of the Blobbi's place in Nostr world travel (M16.2), for the classic home and the room
 * alike. The cues at the Blobbi's spot (`TravelCue`) are decoration only: the room draws them in an `aria-hidden`
 * layer over its 3D canvas, so the words live here instead, in ONE polite live region:
 *
 *   - rendered into `document.body` (a portal), so no `aria-hidden` ancestor (the room's anchor layer, a hidden HUD)
 *     can ever silence it, and mounted before anything is said (a live region must exist before its text changes);
 *   - visually hidden (`sr-only`): sighted players have the cue and the away card;
 *   - it speaks only when the message CHANGES: looking → here/away, a call → its arrival, the relays unreachable.
 *     The Blobbi simply being home on load says nothing (that is the page itself), a first look the relays answer
 *     within `LOOKING_SAID_AFTER_MS` says nothing either, and a re-render repeats nothing.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LOOKING_SAID_AFTER_MS, travelAnnouncement, type TravelAnnouncerProps } from './travel-announcement';

export function TravelAnnouncer(p: TravelAnnouncerProps) {
  const [said, setSaid] = useState<string | null>(null);
  const next = p.active ? travelAnnouncement(p, said) : null;
  useEffect(() => {
    if (next === null || next === said) return;
    // A look the relays answer at once is not worth a word: "looking" is said only once it has lasted a moment
    if (p.view === 'looking' && said === null) {
      const timer = setTimeout(() => setSaid(next), LOOKING_SAID_AFTER_MS);
      return () => clearTimeout(timer);
    }
    setSaid(next);
  }, [next, said, p.view]);
  if (!p.active || typeof document === 'undefined') return null;
  return createPortal(
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="world-travel-announcer">
      {said ?? ''}
    </div>,
    document.body,
  );
}
