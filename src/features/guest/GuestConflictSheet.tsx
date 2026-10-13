/**
 * Someone signed into an account they already have while a guest Blobbi
 * lives on this device (M14, Part 8). Nothing is merged and nothing is
 * thrown away by the app: the account's own home is shown, and the player is
 * told, once per account, what is on the device and why it cannot simply
 * move into this account.
 *
 * The reason is the canonical identity: a V3 Blobbi IS its address (its
 * owner's key and its `d`), and its look is born from that address. Under
 * another key it would be another Blobbi. So the choice is the player's, in
 * plain words: keep it here (sign out to play with it), or remove it from
 * this device (asked twice).
 */
import { useState } from 'react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import type { GuestDocument } from './guest-store';
import { guestBlobbiEvent } from './guest-world';

interface GuestConflictSheetProps {
  open: boolean;
  doc: GuestDocument;
  /** Keep it on the device (the default; the sheet closes and is not shown again for this account). */
  onKeep: () => void;
  /** Remove the guest record from this device, by the player's explicit, confirmed choice. */
  onRemove: () => void;
}

export function GuestConflictSheet({ open, doc, onKeep, onRemove }: GuestConflictSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const record = guestBlobbiEvent(doc.events, doc.blobbiD);
  const blobbi = record ? parseModernBlobbiEvent(record) : undefined;
  const name = blobbi?.name ?? 'A little Blobbi';
  return (
    <GameOverlay
      open={open}
      onClose={onKeep}
      title="A Blobbi lives on this device"
      testId="guest-conflict"
      subtitle={`${name} was raised here as a guest, before you signed in.`}
      lead={
        blobbi ? (
          <span className="overlay-portrait" aria-hidden>
            <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`conflict-${blobbi.d}`} size="100%" transparent style={{ width: '100%', height: '100%' }} />
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          You are signed in with an account of your own now, and this home shows that account's Blobbis. {name} stays on this device, untouched, as a guest.
        </p>
        <p className="text-muted-foreground">
          {name} cannot be moved into this account: a Blobbi's colours and shape are born from the key it belongs to, so under your account's key it would be a
          different Blobbi. To play with {name} again, sign out; to give {name} a home of its own on Nostr, sign out and choose Save my Blobbi.
        </p>
        {!confirming ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" className="onboard-btn onboard-btn--primary" onClick={onKeep} data-testid="guest-conflict-keep">
              Keep it here
            </button>
            <button type="button" className="onboard-btn onboard-btn--secondary" onClick={() => setConfirming(true)} data-testid="guest-conflict-remove">
              Remove from this device
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3" role="alert" data-testid="guest-conflict-confirm">
            <p className="font-semibold">Remove {name} from this device?</p>
            <p className="text-xs text-muted-foreground">{name} was never saved anywhere else, so this cannot be undone.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="onboard-btn onboard-btn--secondary" onClick={() => setConfirming(false)} data-testid="guest-conflict-cancel">
                Keep it
              </button>
              <button type="button" className="onboard-btn onboard-btn--primary !bg-destructive" onClick={onRemove} data-testid="guest-conflict-remove-confirm">
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </GameOverlay>
  );
}
