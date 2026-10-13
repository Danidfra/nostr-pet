/**
 * The Blobbi alive in the save ceremony (M14.2). Not a picture: it breathes
 * (the renderer's idle), blinks, follows the pointer with its eyes and the
 * field the player is typing in, looks curious while they type, is glad of
 * a name, hops with a few hearts when a step is passed, and celebrates when
 * the account is made (`ceremony-life.ts` holds the moments; this plays
 * them). Left alone it glances about or smiles now and then, on long
 * pauses.
 *
 * One drawing, the canonical renderer's, driven by the shared expression
 * controller (`features/expression`): each moment asks for a face under its
 * own source and priority, so a reaction interrupts the typing's curiosity
 * and gives it back after. The moves are CSS on the portrait's box (two
 * copies of each, taken in turn, so the same move coming round again
 * restarts), never on the drawing; the sparkles are the renderer's own
 * effects. Reduced motion keeps the faces and the eyes and drops the moves
 * and the sparkles. Timers, not animation frames, and every one is cleared
 * on unmount.
 *
 * The steps reach it through `useCeremonyStage()`: `react(moment)` and
 * `attend(element)` (where its eyes go while a field is the player's).
 */
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import type { CeremonyLife } from './useCeremonyLife';

export interface CeremonyPortraitProps {
  blobbi: BlobbiCompanion;
  life: CeremonyLife;
  /** The save's progress ring: how many of the steps landed. */
  progress?: number;
  reduced: boolean;
}

/** The Blobbi in the middle of the ceremony, alive, with the ring around it. */
export function CeremonyPortrait({ blobbi, life, progress = 0, reduced }: CeremonyPortraitProps) {
  const { portrait, faceRef } = life;
  return (
    <div className="savescene__portrait" data-progress={progress} data-testid="save-portrait" data-face={portrait.faceName} data-move={portrait.move && !reduced ? portrait.move.kind : undefined} data-beat={portrait.move ? portrait.move.key % 2 : undefined} data-reduced={reduced ? 'true' : undefined}>
      <span className="savescene__ring" aria-hidden />
      <div className="savescene__body" ref={(el) => { faceRef.current = el; }} data-testid="save-portrait-body">
        <BlobbiRenderer
          visual={toBlobbiVisual(blobbi)}
          instanceId={`save-${blobbi.d}`}
          size="100%"
          transparent
          style={{ width: '100%', height: '100%' }}
          motion={reduced ? 'still' : 'idle'}
          expression={portrait.face}
          eyeOffset={portrait.gaze}
          eyesClosed={portrait.blink}
          effects={portrait.effects}
          label={blobbi.name}
        />
      </div>
    </div>
  );
}
