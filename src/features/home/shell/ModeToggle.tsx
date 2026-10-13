/**
 * One switch for the two homes (M14.1): a compact vertical toggle in the
 * upper right of both, 2D over 3D β, the one in force marked. Choosing is
 * going there, and the choice is the device's default from then on (a
 * reload opens the same home); there is no separate "open in" setting any
 * more. The first time 3D is chosen on a device a short introduction asks
 * first (`ModeIntro`): the room is experimental, the 2D home is one tap
 * away, some things are still being built; Try 3D or Stay in 2D. After
 * that the switch is just a switch. Nothing here is published.
 *
 * The toggle only says what was chosen; the page owns the switch
 * (`useModeSwitch`, its own file), so the introduction can rise over the
 * whole game.
 */
import { Armchair, Sparkles } from 'lucide-react';
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

/** The first time 3D is chosen on this device: a word about it, as part of the game. */
export function ModeIntro({ open, onTry, onStay }: { open: boolean; onTry: () => void; onStay: () => void }) {
  return (
    <GameOverlay open={open} onClose={onStay} title="Your 3D room" testId="mode-intro" size="medium">
      <div className="mode-intro">
        <p className="mode-intro__lead">
          <Armchair aria-hidden /> Your Blobbi has a 3D home too: rooms to wander, furniture to move, a kitchen, a bath, a bed. The same Blobbi, the same care.
        </p>
        <ul className="mode-intro__points" aria-label="Good to know">
          <li>It is still being built, so some corners are rough and a few things are not there yet.</li>
          <li>The 2D home is always one tap away: the same switch, top right.</li>
          <li>Whichever you choose opens next time too.</li>
        </ul>
        <div className="mode-intro__actions">
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={onTry} data-testid="mode-intro-try">
            <Sparkles className="h-4 w-4" aria-hidden /> Try 3D
          </button>
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onStay} data-testid="mode-intro-stay">
            Stay in 2D
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}
