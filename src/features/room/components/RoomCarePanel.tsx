/**
 * The room's bottom bar and what rides above it: Ditto's `RoomBottomBar`
 * and `BarLayout` (`ditto/src/pages/BlobbiPage.tsx`), over this app's care.
 *
 *   living room, kitchen, care room   the carousel, centred between two
 *                                     action slots (empty: this app has no
 *                                     camera, shovel or towel)
 *   a shelf a piece of furniture      the same, with Back in the right slot
 *   opened (the toy box elsewhere)
 *   bedroom (and anyone asleep)       Sleep or Wake, centred (Ditto's RestBar)
 *   closet                            a quiet line (Ditto's ClosetBar)
 *
 * A use that failed and a short notice ride above the bar, where Ditto shows
 * its inline activities (`RoomCareCards`, the shell's `middleSlot`).
 */
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Moon, Sun, Undo2 } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import type { RoomId } from '@/features/home/rooms/rooms';
import { ItemCarousel } from './ItemCarousel';
import { RoomActionButton } from './RoomActionButton';
import { RoomOfferFailure } from './RoomCareParts';
import type { RoomOffer } from '../hooks/useRoomCare';
import type { RoomCareEntry } from '../lib/room-care';
import { cx } from '../lib/cx';
import { ROOM_ACTION_SLOT, ROOM_BOTTOM_BAR_CLASS, ROOM_CONTROL_SURFACE } from '../lib/room-ui';

/** A bar's layout: a button each side (or an empty slot) and the carousel between. Ditto's, verbatim. */
function BarLayout({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <div className={ROOM_BOTTOM_BAR_CLASS} data-testid="room-bar">
      <div className="flex items-center justify-between gap-1 sm:gap-3">
        {left || <div className={ROOM_ACTION_SLOT} />}
        <div className="flex-1 min-w-0 flex justify-center">{center}</div>
        {right || <div className={ROOM_ACTION_SLOT} />}
      </div>
    </div>
  );
}

export interface RoomCarouselBinding {
  entries: readonly RoomCareEntry[];
  focusedKey: string | null;
  onFocus: (key: string) => void;
  onUse: (entry: RoomCareEntry) => void;
  onBlocked: (entry: RoomCareEntry) => void;
  onDragStart: (e: ReactPointerEvent, entry: RoomCareEntry) => void;
  /** A piece of furniture opened this shelf: a way back to the room's own. */
  onClose?: () => void;
  /** A piece of furniture pointed at the carousel: it pulses for a moment. */
  highlight: boolean;
}

interface RoomBottomBarProps {
  blobbi: Pick<BlobbiCompanion, 'state' | 'stage'>;
  roomId: RoomId;
  carousel: RoomCarouselBinding | null;
  offer: RoomOffer | null;
  busy: boolean;
  onRest: () => void;
  restPending: boolean;
}

export function RoomBottomBar({ blobbi, roomId, carousel, offer, busy, onRest, restPending }: RoomBottomBarProps) {
  const asleep = blobbi.state === 'sleeping';
  if (carousel && !asleep) {
    return (
      <BarLayout
        center={
          <ItemCarousel
            items={carousel.entries}
            focusedKey={carousel.focusedKey}
            onFocus={carousel.onFocus}
            onUse={carousel.onUse}
            onBlocked={carousel.onBlocked}
            onDragStart={carousel.onDragStart}
            activeKey={offer && offer.phase !== 'failed' ? offer.entryKey : null}
            disabled={busy}
            highlight={carousel.highlight}
          />
        }
        right={carousel.onClose && <RoomActionButton icon={<Undo2 />} label="Back" color="text-muted-foreground" glowHex="#94a3b8" onClick={carousel.onClose} testId="room-shelf-back" />}
      />
    );
  }
  if (roomId === 'rest' || asleep) {
    return (
      <BarLayout
        center={
          blobbi.stage !== 'egg' && (
            <RoomActionButton
              icon={asleep ? <Sun /> : <Moon />}
              label={asleep ? 'Wake up' : 'Sleep'}
              color={asleep ? 'text-amber-500' : 'text-violet-500'}
              glowHex={asleep ? '#f59e0b' : '#8b5cf6'}
              onClick={onRest}
              disabled={restPending || (busy && !asleep)}
              loading={restPending}
              testId="room-rest"
            />
          )
        }
      />
    );
  }
  return (
    <div className={ROOM_BOTTOM_BAR_CLASS} data-testid="room-bar">
      <div className="flex items-center justify-center gap-2 py-1">
        <p className="text-xs text-muted-foreground/60 font-medium" data-testid="room-closet-hint">What your Blobbi wears is equipped on the Island.</p>
      </div>
    </div>
  );
}

/** What rides above the bar: a failed use with its way out, and a short notice. */
export function RoomCareCards({ offer, onRetry, onPutAway, error, notice }: { offer: RoomOffer | null; onRetry: () => void; onPutAway: () => void; error: Error | null; notice: string | null }) {
  const failed = offer?.phase === 'failed' ? offer : null;
  if (!failed && !error && !notice) return null;
  return (
    <div className="flex flex-col gap-1.5 px-4 sm:px-6 pb-2" data-testid="room-care-cards">
      {failed && <RoomOfferFailure offer={failed} onRetry={onRetry} onPutAway={onPutAway} />}
      {error && (
        <p role="alert" className={cx('rounded-2xl px-3 py-2 text-center text-[0.8em] text-destructive', ROOM_CONTROL_SURFACE)} data-testid="care-error">
          {error.message}
        </p>
      )}
      {notice && (
        <p role="status" className={cx('mx-auto rounded-full px-3 py-1.5 text-center text-[0.75em] text-foreground/80', ROOM_CONTROL_SURFACE)} data-testid="room-care-notice">
          {notice}
        </p>
      )}
    </div>
  );
}
