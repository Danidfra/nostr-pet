/**
 * One switch for the two homes (M14.1): a compact vertical toggle in the
 * upper right of both, 2D over 3D β, the one in force marked. Choosing is
 * going there, and the choice is the device's default from then on (a
 * reload opens the same home); there is no separate "open in" setting any
 * more. The first time the room opens on a device a short introduction
 * greets the player there (`ModeIntro`, M14.2): the room is experimental,
 * the Blobbi's look here can be chosen (the drawing or the 3D model, in the
 * Blobbi menu under Appearance), the 2D home is one tap away. "Let's
 * explore" closes it; "Don't show this again" (on by default) keeps it from
 * coming back. Nothing here is published.
 *
 * The toggle only says what was chosen; the page owns the switch
 * (`useModeSwitch`, its own file).
 */
import { useState } from 'react';
import { Armchair, Palette, Sparkles } from 'lucide-react';
import { GameOverlay } from './GameOverlay';
import type { HomeExperience } from '@/lib/home-experience';

export function ModeToggle({ mode, onChoose, className = '' }: { mode: HomeExperience; onChoose: (next: HomeExperience) => void; className?: string }) {
  return (
    <div className={`mode-toggle ${className}`} role="radiogroup" aria-label="Home view" data-testid="mode-toggle" data-mode={mode}>
      <button type="button" role="radio" aria-checked={mode === 'classic'} className={`mode-toggle__option ${mode === 'classic' ? 'mode-toggle__option--on' : ''}`} onClick={() => onChoose('classic')} data-testid="mode-2d" aria-label="2D home">
        2D
      </button>
      <button type="button" role="radio" aria-checked={mode === 'room'} className={`mode-toggle__option ${mode === 'room' ? 'mode-toggle__option--on' : ''}`} onClick={() => onChoose('room')} data-testid="mode-3d" aria-label="3D room, beta">
        3D<span className="mode-toggle__beta" aria-hidden>β</span>
      </button>
    </div>
  );
}

export interface ModeIntroProps {
  open: boolean;
  /** The Blobbi's name, for the words. */
  name?: string;
  /** Closed, with whether the player asked not to see it again. */
  onExplore: (dontShowAgain: boolean) => void;
}

/** The first time the room opens on this device: a word about it, as part of the game, over the room itself. */
export function ModeIntro({ open, name = 'your Blobbi', onExplore }: ModeIntroProps) {
  const [dismiss, setDismiss] = useState(true);
  return (
    <GameOverlay open={open} onClose={() => onExplore(dismiss)} title="Your 3D room" testId="mode-intro" size="medium">
      <div className="mode-intro">
        <p className="mode-intro__lead">
          <Armchair aria-hidden /> Welcome to the 3D room. It is experimental, so some corners are rough and a few things are not there yet. The same {name}, the same care.
        </p>
        <p className="mode-intro__lead" data-testid="mode-intro-appearance">
          <Palette aria-hidden /> You can choose how {name} looks here: the classic drawing or the 3D model. Tap {name} in the dock, then Appearance.
        </p>
        <ul className="mode-intro__points" aria-label="Good to know">
          <li>The 2D home is always one tap away. The same switch, top right.</li>
          <li>Whichever you choose opens next time too.</li>
        </ul>
        <label className="mode-intro__check">
          <input type="checkbox" checked={dismiss} onChange={(e) => setDismiss(e.target.checked)} data-testid="mode-intro-dismiss" />
          <span>Don’t show this again</span>
        </label>
        <div className="mode-intro__actions mode-intro__actions--one">
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={() => onExplore(dismiss)} data-testid="mode-intro-explore">
            <Sparkles className="h-4 w-4" aria-hidden /> Let’s explore
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}
