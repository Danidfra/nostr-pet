/**
 * One switch for the two homes (M14.1): a compact vertical toggle in the
 * upper right of both, 2D over 3D β, the one in force marked. Choosing is
 * going there, and the choice is the device's default from then on (a
 * reload opens the same home); there is no separate "open in" setting any
 * more. The first time the room opens on a device a short introduction
 * greets the player there (the room's own `RoomIntro`, M14.2). Nothing here
 * is published.
 *
 * The toggle only says what was chosen; the page owns the switch
 * (`useModeSwitch`, its own file).
 */
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
