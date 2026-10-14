/**
 * Someone signed into an account they already have while a guest Blobbi
 * lives on this device (M14, Part 8; plain words and a separate removal
 * since M15). Nothing is merged and nothing is thrown away by the app: the
 * account's own home is shown, and the player is told, in a child's words
 * and with the Blobbi's name, what is on the device and what they can do.
 *
 * The reason the Blobbi cannot simply join the account is the canonical
 * identity (a V3 Blobbi IS its address: its owner's key and its `d`, and its
 * look is born from that address, so under another key it would be another
 * Blobbi). That reason is kept out of the main explanation and offered under
 * "Why?", without protocol words.
 *
 * Three answers, none of them a merge:
 *
 *   Keep here      remembered for this account: the sheet does not return
 *                  for it (`conflicts` in the record); the guest Blobbi and
 *                  its key are untouched.
 *   Decide later   the X, the backdrop, Escape, or the button: the sheet
 *                  goes for this visit and nothing is written, so it is
 *                  asked again on the next visit. A closed sheet is never a
 *                  decision.
 *   Remove         opens the SEPARATE destructive flow (`GuestRemoveSheet`),
 *                  which asks for an explicit confirmation and warns when
 *                  the Blobbi was never saved anywhere.
 *
 * Both sheets are `GameOverlay`s, so the blocking-layer queue (M15) shows
 * one at a time and never over another sheet.
 */
import { useState } from 'react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import type { GuestDocument } from './guest-store';
import { guestBlobbiOf } from './guest-world';
import { guestEverSaved } from './guest-session';

function Portrait({ blobbi, id }: { blobbi: BlobbiCompanion | undefined; id: string }) {
  if (!blobbi) return null;
  return (
    <span className="overlay-portrait" aria-hidden>
      <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`${id}-${blobbi.d}`} size="100%" transparent style={{ width: '100%', height: '100%' }} />
    </span>
  );
}

interface GuestConflictSheetProps {
  open: boolean;
  doc: GuestDocument;
  /** Keep it on the device, remembered for this account: the sheet is not shown again for it. */
  onKeep: () => void;
  /** Decide later: closed for this visit, nothing written, asked again next time. */
  onLater: () => void;
  /** The player wants to remove it: open the separate, confirmed removal. */
  onRemove: () => void;
}

export function GuestConflictSheet({ open, doc, onKeep, onLater, onRemove }: GuestConflictSheetProps) {
  const { blobbi, name } = guestBlobbiOf(doc);
  return (
    <GameOverlay open={open} onClose={onLater} title={`${name} is still here`} testId="guest-conflict" subtitle="You signed in to a different account." lead={<Portrait blobbi={blobbi} id="conflict" />}>
      <div className="space-y-3 text-sm" data-testid="guest-conflict-text">
        <p>
          {name} lives on this device, and this account does not know {name}. Nothing has changed and nothing was deleted.
        </p>
        <p className="text-muted-foreground">
          To play with {name} again, sign out. To give {name} a home of its own, sign out and choose Save {name}.
        </p>
        <details className="guest-status__more" data-testid="guest-conflict-why">
          <summary>Why can’t {name} join this account?</summary>
          <p className="pt-1 text-xs text-muted-foreground">
            Every Blobbi is born from its own key, and {name}’s colours and shape came from the key waiting on this device. Under this account’s key, {name} would be a
            different Blobbi. So {name} keeps its own key, and you can save {name} with it whenever you like.
          </p>
        </details>
        <div className="grid gap-2 pt-1">
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={onKeep} data-testid="guest-conflict-keep">
            Keep {name} here
          </button>
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onLater} data-testid="guest-conflict-later">
            Decide later
          </button>
          <button type="button" className="guest-invite__later guest-conflict__remove" onClick={onRemove} data-testid="guest-conflict-remove">
            Remove {name} from this device…
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}

interface GuestRemoveSheetProps {
  open: boolean;
  doc: GuestDocument;
  /** Back to the word about the Blobbi: nothing removed. */
  onCancel: () => void;
  /** The confirmed removal. */
  onRemove: () => void;
}

/**
 * The destructive flow, apart from the conflict sheet: what goes, a warning
 * when the Blobbi was never saved or its save never finished, an explicit
 * acknowledgement always (the key kept here may be the only copy on the
 * device), and a cancel that keeps everything.
 */
export function GuestRemoveSheet({ open, doc, onCancel, onRemove }: GuestRemoveSheetProps) {
  const { blobbi, name } = guestBlobbiOf(doc);
  // Saved means read back from the relays (`done`). A save that landed but never finished is not a backup of the key:
  // this record may be the only copy of it on the device, so every case asks for an explicit acknowledgement (M15 integration).
  const saved = doc.migration?.stage === 'done';
  const unfinished = !saved && guestEverSaved(doc);
  const [acknowledged, setAcknowledged] = useState(false);
  const ready = acknowledged;
  return (
    <GameOverlay open={open} onClose={onCancel} title={`Remove ${name} from this device?`} testId="guest-remove" lead={<Portrait blobbi={blobbi} id="remove" />}>
      <div className="space-y-3 text-sm" data-testid="guest-remove-text">
        {saved ? (
          <p data-testid="guest-remove-saved">
            {name} was saved to an account, so only this device’s copy goes. {name} stays in that account. To open it again, you will need the key you kept.
          </p>
        ) : unfinished ? (
          <div className="space-y-1 rounded-2xl border border-destructive/40 bg-destructive/5 p-3" role="alert" data-testid="guest-remove-unfinished">
            <p className="font-semibold">{name}’s save did not finish.</p>
            <p className="text-xs text-muted-foreground">
              {name} may be saved, but the key kept here may be the only one. Without it, {name} may never come back.
            </p>
          </div>
        ) : (
          <div className="space-y-1 rounded-2xl border border-destructive/40 bg-destructive/5 p-3" role="alert" data-testid="guest-remove-warning">
            <p className="font-semibold">{name} has never been saved.</p>
            <p className="text-xs text-muted-foreground">
              Removing {name} deletes it for good: its key, its care and its days here. There is no way to bring {name} back.
            </p>
          </div>
        )}
        <p className="text-muted-foreground">Your signed-in account is not touched.</p>
        <label className="flex items-start gap-2 text-xs font-semibold">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} data-testid="guest-remove-ack" />
          <span>{saved ? `I have ${name}’s key somewhere safe.` : `I understand ${name} may not be brought back.`}</span>
        </label>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" className="onboard-btn onboard-btn--secondary" onClick={onCancel} data-testid="guest-remove-cancel">
            Keep {name}
          </button>
          <button type="button" className="onboard-btn onboard-btn--primary !bg-destructive" onClick={onRemove} disabled={!ready} data-testid="guest-remove-confirm">
            Remove {name}
          </button>
        </div>
      </div>
    </GameOverlay>
  );
}
