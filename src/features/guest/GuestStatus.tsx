/**
 * The guest's status, where the player can see it (M14.1): a small pill by
 * the Blobbi's name, "On this device", that says in a word where the Blobbi
 * lives. Tapping it opens a short explanation: the Blobbi is kept in this
 * browser only, not on the Nostr relays; clearing the browser's data or
 * losing the device may erase it; saving makes a Nostr account for it, so
 * it can be visited from another device and taken to the connected worlds;
 * playing on without an account is fine. Save my Blobbi, or Maybe later.
 * Never a modal that interrupts; never a promise that an account alone
 * keeps a Blobbi forever (the key and the relays do).
 *
 * After a save lands, the pill becomes "Saved to Nostr" for the rest of
 * the visit (`SavedPill`): the guest's status, not the relays' health, which
 * the connection dot says separately.
 */
import { Check, Smartphone } from 'lucide-react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';

export const GUEST_STATUS_LINE = 'On this device';
export const SAVED_STATUS_LINE = 'Saved to Nostr';

export function GuestStatusPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="status-pill status-pill--guest" onClick={onOpen} data-testid="guest-status" aria-label="Your Blobbi lives on this device only. Learn what that means">
      <Smartphone aria-hidden />
      <span>{GUEST_STATUS_LINE}</span>
    </button>
  );
}

export function SavedPill() {
  return (
    <span className="status-pill status-pill--saved" role="status" data-testid="saved-status" title="Your Blobbi has a home on Nostr now">
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
    <GameOverlay open={open} onClose={onClose} title="On this device" testId="guest-status-sheet" size="medium">
      <div className="guest-status" data-testid="guest-status-text">
        <p className="guest-status__lead">
          {storageOk ? `${name} lives in this browser only.` : `${name} lives in this browser's memory only, and this browser is not remembering anything right now.`}
        </p>
        <ul className="guest-status__points" aria-label="What that means">
          <li>Nothing about {name} has been sent to the Nostr relays yet.</li>
          <li>{storageOk ? 'Clearing this browser’s data, or losing this device, may erase it.' : 'Closing this window will erase it.'}</li>
          <li>Saving makes a Nostr account for {name}: a key only you hold. With the key you can visit {name} from another device, and the connected worlds can know it.</li>
          <li>You can keep playing here without an account for as long as you like.</li>
        </ul>
        <p className="guest-status__fine">A saved Blobbi stays yours as long as you keep your key safe and the relays hold its record; saving is a beginning, not a vault.</p>
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
            Save my Blobbi
          </button>
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onClose} data-testid="guest-status-later">
            Maybe later
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}
