/**
 * The guest's status, where the player can see it (M14.1): a small pill by
 * the Blobbi's name, "On this device", that says in a word where the Blobbi
 * lives. Tapping it opens a short explanation in a child's words (M14.2):
 * the Blobbi is still exploring this little world and lives only on this
 * device, so if its data disappears it could too; saving gives it a
 * connected home to visit from other devices and explore new worlds from;
 * playing on without one is fine. Save {name}, or Maybe later. Never a
 * modal that interrupts, no relays in it, and never a promise that saving
 * alone keeps a Blobbi forever (the key does).
 *
 * After a save lands, the pill becomes "Saved" for the rest of the visit
 * (`SavedPill`): the guest's status, not the relays' health, which the
 * connection dot says separately.
 */
import { Check, Smartphone } from 'lucide-react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { deviceOnlyLine, noStorageLine } from './guest-session';

export const GUEST_STATUS_LINE = 'On this device';
export const SAVED_STATUS_LINE = 'Saved';

export function GuestStatusPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="status-pill status-pill--guest" onClick={onOpen} data-testid="guest-status" aria-label="Your Blobbi lives only on this device. Learn what that means">
      <Smartphone aria-hidden />
      <span>{GUEST_STATUS_LINE}</span>
    </button>
  );
}

export function SavedPill() {
  return (
    <span className="status-pill status-pill--saved" role="status" data-testid="saved-status" title="Your Blobbi has a connected home now">
      <Check aria-hidden />
      <span>{SAVED_STATUS_LINE}</span>
    </span>
  );
}

interface GuestStatusSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  onSave: () => void;
  /** This browser is not remembering anything (private mode, blocked storage): said instead of the device line. */
  storageOk: boolean;
}

export function GuestStatusSheet({ open, onClose, name, onSave, storageOk }: GuestStatusSheetProps) {
  return (
    <GameOverlay open={open} onClose={onClose} title={`${name}’s little world`} testId="guest-status-sheet" size="medium">
      <div className="guest-status" data-testid="guest-status-text">
        <p className="guest-status__lead">{name} is still exploring this little world.</p>
        <p className="guest-status__line">{storageOk ? deviceOnlyLine(name) : noStorageLine(name)}</p>
        <p className="guest-status__line">Give {name} a connected home to visit from other devices and explore new worlds together.</p>
        <details className="guest-status__more">
          <summary>Good to know</summary>
          <ul className="guest-status__points" aria-label="Good to know">
            <li>{storageOk ? `Clearing this browser’s data, or losing this device, can erase ${name}.` : `Closing this window will erase ${name}.`}</li>
            <li>You can keep playing here without saving for as long as you like.</li>
            <li>Saving gives you a little key. Keep it safe and {name} stays yours. Nothing else can bring it back.</li>
          </ul>
        </details>
        <div className="guest-status__actions">
          <button
            type="button"
            className="onboard-btn onboard-btn--primary"
            onClick={() => {
              onClose();
              onSave();
            }}
            data-testid="guest-status-save"
          >
            Save {name}
          </button>
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onClose} data-testid="guest-status-later">
            Maybe later
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}
