/**
 * The room's care moments, drawn: an item lying on the floor for the
 * Blobbi to come to (and, if its use failed, the way to retry or put it
 * away), the feedback that follows the Blobbi, and the ghost under the
 * pointer while an item is carried. Presentation only; the decisions are
 * `useRoomCare`'s.
 */
import { forwardRef } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';

import { ItemGlyph, type ItemGlyphModel } from '@/features/inventory';
import { CareFeedback } from '@/features/home/CareFeedback';
import { cx } from '../lib/cx';
import { ROOM_CONTROL_SURFACE } from '../lib/room-ui';
import type { RoomCareFeedback, RoomOffer } from '../hooks/useRoomCare';

/** An item on the floor: waiting for the Blobbi (it can be put back), being used (eaten, played with, lathered), or failed (the dock says why). */
export function RoomFloorItem({ offer, glyph, onPutAway }: { offer: RoomOffer; glyph: ItemGlyphModel; onPutAway: () => void }) {
  return (
    <div className="room-floor-item" data-phase={offer.phase} data-testid="room-floor-item">
      <span className="room-floor-item__glyph">
        <ItemGlyph glyph={glyph} fill />
      </span>
      {offer.phase === 'walking' && (
        <button type="button" className="room-floor-item__cancel" onClick={onPutAway} aria-label={`Put ${offer.name} away`} data-testid="room-floor-item-cancel">
          <Undo2 className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A use that failed, where the player looks: why, Try again (their tap, never by itself) and Put away. Ditto's inline-card look. */
export function RoomOfferFailure({ offer, onRetry, onPutAway }: { offer: RoomOffer; onRetry: () => void; onPutAway: () => void }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2', ROOM_CONTROL_SURFACE)} role="group" aria-label={`${offer.name} was not used`} data-testid="room-offer-failure">
      <p className="min-w-0 flex-1 text-[0.8em] text-destructive" role="alert" data-testid="room-offer-error">
        {offer.name}: {offer.error ?? 'that did not work.'}
      </p>
      <button type="button" className="room-chip-button" onClick={onRetry} data-testid="room-offer-retry">
        <RotateCcw className="size-[1em]" aria-hidden /> Try again
      </button>
      <button type="button" className="room-chip-button room-chip-button--quiet" onClick={onPutAway} data-testid="room-offer-put-away">
        <Undo2 className="size-[1em]" aria-hidden /> Put away
      </button>
    </div>
  );
}

/**
 * What follows the Blobbi (the shell's `blobbiOverlay`): a box the size of
 * its art box, standing on its feet, so the home's feedback (chips over the
 * head, hearts, the spoken result) sits on it as it does on the home, in 2D
 * or 3D. An item handed to it shows at its mouth while it is used.
 */
export const RoomBlobbiOverlay = forwardRef<HTMLDivElement, { feedback: RoomCareFeedback | undefined; handed: { glyph: ItemGlyphModel; phase: RoomOffer['phase'] } | null }>(function RoomBlobbiOverlay({ feedback, handed }, ref) {
  return (
    <div ref={ref} className="room-blobbi-overlay" aria-live="off" data-testid="room-blobbi-box">
      {/* Lit while an item is carried over the Blobbi (the shell's data-drop, set without a render) */}
      <span className="room-drop-ring" aria-hidden />
      {handed && (
        <span className="room-handed-item" data-phase={handed.phase} data-testid="room-handed-item">
          <ItemGlyph glyph={handed.glyph} fill />
        </span>
      )}
      <CareFeedback result={feedback?.result} resultKey={feedback?.key ?? 0} />
    </div>
  );
});

/** The item under the pointer while it is carried; moved by the drag hook, never by React. */
export const RoomDragGhost = forwardRef<HTMLDivElement, { glyph: ItemGlyphModel | null }>(function RoomDragGhost({ glyph }, ref) {
  return (
    <div ref={ref} className="room-drag-ghost" style={{ display: 'none' }} aria-hidden data-testid="room-drag-ghost">
      {glyph && <ItemGlyph glyph={glyph} fill />}
    </div>
  );
});
