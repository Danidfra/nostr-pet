/**
 * A small cue where the Blobbi stands while it is not there to be seen (M16), shared by the classic home and the
 * room, both drawn in CSS only (no frame loop of their own):
 *
 *   looking  its place is not known yet (a fresh device, the relays' first answer on its way, at most a few
 *            seconds): a soft glow on the floor breathing slowly, three faint twinkles, and a small label
 *            "Looking for Brook…". Neither here nor away: no shadow, nothing to poke, never a journey.
 *   coming   a call home is under way (checking, waiting for the signer, publishing, the other World's departure
 *            window): the same glow, a little brighter, gathering, with motes drifting DOWN toward it, the
 *            teleport's own "incoming" direction, in the Blobbi's colour. No words (the away card says what is
 *            going on); the teleport's arrival takes over on the same spot, so the call and the arrival read as one.
 *
 * Under reduced motion both are still: the glow and the label, no movement.
 */
import type { CSSProperties } from 'react';

export interface TravelCueProps {
  kind: 'looking' | 'coming';
  name: string;
  /** The Blobbi's own colour for the motes and the glow. */
  tint?: string;
}

export function TravelCue({ kind, name, tint }: TravelCueProps) {
  return (
    <div
      className="travel-cue"
      data-kind={kind}
      data-testid={kind === 'looking' ? 'world-travel-looking' : 'world-travel-coming'}
      role={kind === 'looking' ? 'status' : undefined}
      aria-label={kind === 'looking' ? `Looking for ${name}` : undefined}
      aria-hidden={kind === 'coming' ? true : undefined}
      style={tint ? ({ '--cue-tint': tint } as CSSProperties) : undefined}
    >
      <span className="travel-cue__glow" aria-hidden />
      <span className="travel-cue__mote" aria-hidden />
      <span className="travel-cue__mote" aria-hidden />
      <span className="travel-cue__mote" aria-hidden />
      {kind === 'looking' && (
        <span className="travel-cue__label home-glass" aria-hidden>
          Looking for {name}…
        </span>
      )}
    </div>
  );
}
