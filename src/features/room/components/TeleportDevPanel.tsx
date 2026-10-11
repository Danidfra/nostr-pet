/**
 * Development only: the Blobbi's journeys by hand. Leave, arrive, a round
 * trip, cancel; and a scrubber that shows one exact moment of either
 * journey on whichever drawing stands in the room (2D or 3D, adult or baby:
 * the room's appearance setting and the `?fixture=` worlds choose), drawn at
 * once, so the effect can be studied frame by frame, even in a background
 * tab. Never in a production build (the room renders it behind the dev
 * tools flag); it calls the presence controller exactly as a future presence
 * coordinator would.
 */
import { useEffect, useState } from 'react';

import type { Presence } from '@/features/teleport/react/usePresence';
import { journeyDuration, type JourneyKind } from '@/features/teleport/timeline';

interface TeleportDevPanelProps {
  presence: Presence;
  preview: { kind: JourneyKind; t: number; reduced: boolean } | null;
  onPreview: (preview: { kind: JourneyKind; t: number; reduced: boolean } | null) => void;
}

/** A round trip's pause while away. */
const AWAY_MS = 900;

export function TeleportDevPanel({ presence, preview, onPreview }: TeleportDevPanelProps) {
  const [open, setOpen] = useState(false);
  const [roundTrip, setRoundTrip] = useState(false);
  const [kind, setKind] = useState<JourneyKind>('depart');
  const [reduced, setReduced] = useState(false);
  const { state, enter } = presence;

  // A round trip: once away, come back after a moment
  useEffect(() => {
    if (!roundTrip || state !== 'absent') return;
    const timer = setTimeout(() => {
      setRoundTrip(false);
      enter();
    }, AWAY_MS);
    return () => clearTimeout(timer);
  }, [roundTrip, state, enter]);

  const total = journeyDuration(kind, reduced);
  const scrub = (t: number) => onPreview({ kind, t, reduced });

  if (!open) {
    return (
      <button type="button" className="teleport-dev teleport-dev--closed" onClick={() => setOpen(true)} data-testid="teleport-dev-open">
        ✦ Teleport
      </button>
    );
  }
  return (
    <div className="teleport-dev" data-testid="teleport-dev" data-state={state}>
      <div className="flex items-center gap-2">
        <strong className="flex-1">Teleport · {state}</strong>
        <button type="button" onClick={() => { onPreview(null); setOpen(false); }} aria-label="Close teleport preview">✕</button>
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => { onPreview(null); presence.leave(); }} data-testid="teleport-dev-leave">Leave</button>
        <button type="button" onClick={() => { onPreview(null); presence.enter(); }} data-testid="teleport-dev-arrive">Arrive</button>
        <button type="button" onClick={() => { onPreview(null); setRoundTrip(true); if (!presence.leave() && state === 'absent') enter(); }} data-testid="teleport-dev-round-trip">Round trip</button>
        <button type="button" onClick={() => { onPreview(null); setRoundTrip(false); presence.cancel(); }} data-testid="teleport-dev-cancel">Cancel</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label><input type="radio" checked={kind === 'depart'} onChange={() => { setKind('depart'); onPreview(preview ? { ...preview, kind: 'depart', t: Math.min(preview.t, journeyDuration('depart', reduced)) } : null); }} /> depart</label>
        <label><input type="radio" checked={kind === 'arrive'} onChange={() => { setKind('arrive'); onPreview(preview ? { ...preview, kind: 'arrive', t: Math.min(preview.t, journeyDuration('arrive', reduced)) } : null); }} /> arrive</label>
        <label><input type="checkbox" checked={reduced} onChange={(e) => { setReduced(e.target.checked); if (preview) onPreview({ ...preview, reduced: e.target.checked }); }} /> reduced</label>
      </div>
      <input
        type="range"
        min={0}
        max={total}
        step={10}
        value={preview?.kind === kind ? preview.t : 0}
        onChange={(e) => scrub(Number(e.target.value))}
        aria-label="Journey time"
        data-testid="teleport-dev-scrub"
      />
      <div className="flex items-center gap-2 text-[11px] opacity-80">
        <span className="flex-1">{preview ? `${preview.kind} at ${Math.round(preview.t)} ms of ${total}` : 'scrub to hold a moment'}</span>
        {preview && <button type="button" onClick={() => onPreview(null)} data-testid="teleport-dev-release">Release</button>}
      </div>
    </div>
  );
}
