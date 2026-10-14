/**
 * The first time the room opens on a device: a word about it, over the room
 * itself (M14.2), with the two looks of this very Blobbi side by side
 * (M14.3): the familiar drawing as it stands in the 3D room, and the 3D
 * model. Both are the same Blobbi, the same care and the same story; only
 * how it is drawn here changes, and that is chosen in the Blobbi's sheet
 * under Appearance, any time. "Let's explore" closes it, "Don't show this
 * again" (on by default) keeps it from coming back, and closing it any other
 * way is the same as exploring. Nothing here is a step to pass: the room is
 * usable the moment it is closed, and nothing is published.
 *
 * The previews are the player's Blobbi, never a stand-in: the drawing is the
 * kit's renderer, the model is the same stage the lab uses, built from the
 * same genome the room builds from. Where there is no model (an egg, V1/V2
 * art, a browser without WebGL) the 3D card says so in a line instead.
 */
import { useEffect, useRef, useState } from 'react';
import { Armchair, Palette, Sparkles } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { BlobbiRenderer } from '@blobbi-kit/renderer';

import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import { genomeOf, stage3dOf } from '../lib/blobbi3d/identity';
import { LOOK_OPTIONS, previewNote3d, shownLook } from '../lib/look-guide';
import { webglAvailable } from '../hooks/useRoomScene';
import { Blobbi3dStage } from './Blobbi3dStage';

export interface RoomIntroProps {
  open: boolean;
  blobbi: BlobbiCompanion;
  /** The look chosen on this device (the card in force is marked). */
  appearance: BlobbiAppearance;
  /** Why this Blobbi has no 3D model here; null when it has one. */
  unavailable3d: string | null;
  reducedMotion?: boolean;
  /** Closed, with whether the player asked not to see it again. */
  onExplore: (dontShowAgain: boolean) => void;
}

/** The shorter side of a box as it is laid out, for a square canvas that wants pixels. */
function useBoxSide<T extends HTMLElement>(fallback: number): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const w = Math.round(Math.min(box.width, box.height));
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function RoomIntro({ open, blobbi, appearance, unavailable3d, reducedMotion = false, onExplore }: RoomIntroProps) {
  const [dismiss, setDismiss] = useState(true);
  const [frameRef, frameSide] = useBoxSide<HTMLDivElement>(128);
  const name = blobbi.name;
  const visual = toBlobbiVisual(blobbi);
  const genome = open ? genomeOf(visual) : null;
  const stage3d = stage3dOf(blobbi.stage);
  const webgl = open && webglAvailable();
  const note3d = previewNote3d(blobbi, unavailable3d, webgl);
  const model = !note3d && genome && stage3d ? { genome, stage: stage3d } : null;
  const current = shownLook(appearance, unavailable3d);
  const close = () => onExplore(dismiss);

  return (
    <GameOverlay open={open} onClose={close} title="Your 3D room" testId="mode-intro" size="medium" className="overlay-panel--intro">
      <div className="mode-intro" data-reduced={reducedMotion ? 'true' : undefined}>
        <p className="mode-intro__lead">
          <Armchair aria-hidden /> Welcome to the 3D room. It is experimental, so a few things are rough or not there yet.
        </p>

        <div className="mode-intro__previews" role="group" aria-label={`Two looks for ${name}`} data-testid="mode-intro-previews" data-current={current}>
          {LOOK_OPTIONS.map((o) => {
            const on = current === o.value;
            return (
              <figure key={o.value} className={`mode-intro__preview ${on ? 'mode-intro__preview--on' : ''}`} data-testid={`mode-intro-preview-${o.value}`} data-current={on ? 'true' : undefined}>
                <div className="mode-intro__frame" ref={o.value === '2d' ? frameRef : undefined} aria-hidden>
                  {o.value === '2d' && <BlobbiRenderer visual={visual} instanceId={`intro-2d-${blobbi.d}`} size="100%" motion={reducedMotion ? 'still' : 'idle'} transparent style={{ width: '100%', height: '100%' }} />}
                  {o.value === '3d' && model && <Blobbi3dStage genome={model.genome} stage={model.stage} view="front" motion={reducedMotion ? 'still' : 'idle'} size={frameSide} testId="mode-intro-stage-3d" label={`${name} in 3D`} />}
                  {o.value === '3d' && !model && (
                    <p className="mode-intro__note" data-testid="mode-intro-preview-3d-note">
                      {note3d}
                    </p>
                  )}
                </div>
                <figcaption className="mode-intro__caption">
                  <span className="mode-intro__title">
                    {o.title}
                    {on && (
                      <span className="mode-intro__now" data-testid={`mode-intro-now-${o.value}`}>
                        Now
                      </span>
                    )}
                  </span>
                  <span className="mode-intro__detail">{o.detail}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>

        <p className="mode-intro__lead" data-testid="mode-intro-appearance">
          <Palette aria-hidden /> Both are the same {name}, with the same care and the same story. Only the look here changes. Choose any time: tap {name} in the dock, then Appearance.
        </p>
        <ul className="mode-intro__points" aria-label="Good to know">
          <li>The 2D home is always one tap away. The same switch, top right.</li>
        </ul>
        <label className="mode-intro__check">
          <input type="checkbox" checked={dismiss} onChange={(e) => setDismiss(e.target.checked)} data-testid="mode-intro-dismiss" />
          <span>Don’t show this again</span>
        </label>
        <div className="mode-intro__actions mode-intro__actions--one">
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={close} data-testid="mode-intro-explore">
            <Sparkles className="h-4 w-4" aria-hidden /> Let’s explore
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}
