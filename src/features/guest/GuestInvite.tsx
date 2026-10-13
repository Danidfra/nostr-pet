/**
 * The invitation to save (M14): a small bubble in the game world, after the
 * player has really cared for their hatched Blobbi and the home is quiet.
 * One line, two answers, and "Maybe later" is a full answer: the bubble goes
 * and rests for a day; the menu keeps the way whenever the player wants it.
 * No countdown, no warning, no second ask in the same visit.
 */
import { Heart, Sparkles } from 'lucide-react';
import { inviteLine } from './guest-session';

interface GuestInviteProps {
  name: string;
  onSave: () => void;
  onLater: () => void;
  reducedMotion: boolean;
}

export function GuestInvite({ name, onSave, onLater, reducedMotion }: GuestInviteProps) {
  return (
    <section className="guest-invite home-glass" role="dialog" aria-label="Save your Blobbi" data-testid="guest-invite" data-reduced={reducedMotion ? 'true' : undefined}>
      <span className="guest-invite__heart" aria-hidden>
        <Heart className="h-4 w-4" />
      </span>
      <p className="guest-invite__line">{inviteLine(name)}</p>
      <div className="guest-invite__actions">
        <button type="button" className="onboard-btn onboard-btn--primary guest-invite__save" onClick={onSave} data-testid="guest-invite-save">
          <Sparkles className="h-4 w-4" aria-hidden />
          Save my Blobbi
        </button>
        <button type="button" className="guest-invite__later" onClick={onLater} data-testid="guest-invite-later">
          Maybe later
        </button>
      </div>
    </section>
  );
}
