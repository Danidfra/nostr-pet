/**
 * The room's bottom bar and what rides above it: Ditto's `RoomBottomBar`
 * and `BarLayout` (`ditto/src/pages/BlobbiPage.tsx`), over this app's care.
 *
 * Since M14.1 the bar is the room's one set of controls, around the
 * carousel: on the LEFT the Blobbi (its details, the other Blobbis, its
 * lifecycle, its items: the sheet the header's name opens too), on the
 * RIGHT the room (decorating: furniture, wallpaper, flooring), with the
 * carousel between them; the HUD above keeps only the room switcher and
 * the needs.
 *
 *   living room, kitchen, care room   the carousel between the two
 *   a shelf a piece of furniture      the same, with Back in the right slot
 *   opened (the toy box elsewhere)    instead of the room
 *   bedroom (and anyone asleep)       Sleep or Wake, centred (Ditto's RestBar)
 *   closet                            Coming soon, said kindly (M14.1)
 *
 * A use that failed and a short notice ride above the bar, where Ditto shows
 * its inline activities (`RoomCareCards`, the shell's `middleSlot`).
 */
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Armchair, Moon, Shirt, Sun, Undo2 } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { BlobbiRenderer } from '@blobbi-kit/renderer';

import type { RoomId } from '@/features/home/rooms/rooms';
import { ItemCarousel } from '@/features/care-ui/ItemCarousel';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { RoomActionButton } from './RoomActionButton';
import { RoomOfferFailure } from './RoomCareParts';
import type { RoomOffer } from '../hooks/useRoomCare';
import type { RoomCareEntry } from '../lib/room-care';
import { cx } from '../lib/cx';
import { ROOM_ACTION_SLOT, ROOM_BOTTOM_BAR_CLASS, ROOM_CONTROL_SURFACE } from '../lib/room-ui';
import { LOOK_GUIDE_LINE } from '../lib/look-guide';

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

/** The two controls around the carousel (M14.1). */
export interface RoomBarControls {
  /** The Blobbi's own screen: details, the other Blobbis, lifecycle, items. */
  onOpenBlobbi: () => void;
  /** Decorate this room. */
  onDecorate: () => void;
  decorateDisabled?: boolean;
  /** Why decorating is off (no 3D graphics), for the label. */
  decorateUnavailable?: string | null;
  /** The one-time guide (M14.3): the Blobbi button glows and a small bubble over it asks about another look. */
  guide?: { reducedMotion: boolean } | null;
}

interface RoomBottomBarProps {
  blobbi: BlobbiCompanion;
  roomId: RoomId;
  /** A bath under way (M15): its bar stands where the carousel was, one tool at a time. */
  bath?: ReactNode;
  carousel: RoomCarouselBinding | null;
  offer: RoomOffer | null;
  busy: boolean;
  onRest: () => void;
  restPending: boolean;
  controls?: RoomBarControls;
}

/**
 * The left button: the Blobbi itself, drawn small, as the way to everything
 * about it. With the guide (M14.3) it glows and a bubble floats over it,
 * once: the bubble is part of the button's slot, tapping either opens the
 * sheet, and nothing else about the dock changes.
 */
function BlobbiButton({ blobbi, onClick, guide }: { blobbi: RoomBottomBarProps['blobbi']; onClick: () => void; guide?: RoomBarControls['guide'] }) {
  return (
    <div className={cx('relative', ROOM_ACTION_SLOT)} data-testid="room-bar-blobbi-slot" data-guide={guide ? 'true' : undefined}>
      {guide && (
        <button type="button" className="look-guide" onClick={onClick} data-testid="room-look-guide" data-reduced={guide.reducedMotion ? 'true' : undefined}>
          <span className="look-guide__bubble">{LOOK_GUIDE_LINE}</span>
        </button>
      )}
      <RoomActionButton
        icon={
          <span className="room-bar-portrait" aria-hidden>
            <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`bar-${blobbi.d}`} size="100%" isSleeping={blobbi.state === 'sleeping'} transparent style={{ width: '100%', height: '100%' }} />
          </span>
        }
        label={blobbi.name.length > 9 ? 'Blobbi' : blobbi.name}
        color="text-primary"
        glowHex="#a855f7"
        onClick={onClick}
        className={cx(guide && 'look-guide__target', guide?.reducedMotion && 'look-guide__target--still')}
        testId="room-bar-blobbi"
      />
    </div>
  );
}

/** The right button: the room (decorating), or why it cannot be decorated here (the HUD button's former words). */
function RoomButton({ controls }: { controls: RoomBarControls }) {
  const off = !!controls.decorateDisabled || !!controls.decorateUnavailable;
  return (
    <RoomActionButton
      icon={<Armchair />}
      label="Room"
      color="text-amber-600"
      glowHex="#f59e0b"
      onClick={controls.onDecorate}
      disabled={off}
      testId="room-bar-decorate"
      ariaLabel={controls.decorateUnavailable ?? 'Decorate this room'}
    />
  );
}

export function RoomBottomBar({ blobbi, roomId, bath = null, carousel, offer, busy, onRest, restPending, controls }: RoomBottomBarProps) {
  const asleep = blobbi.state === 'sleeping';
  const left = controls ? <BlobbiButton blobbi={blobbi} onClick={controls.onOpenBlobbi} guide={controls.guide} /> : undefined;
  const room = controls ? <RoomButton controls={controls} /> : undefined;
  // The bath's bar takes the carousel's place while the bath is on (the room's two buttons stay)
  if (bath) return <BarLayout left={left} center={bath} right={room} />;
  if (carousel && !asleep) {
    return (
      <BarLayout
        left={left}
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
        right={carousel.onClose ? <RoomActionButton icon={<Undo2 />} label="Back" color="text-muted-foreground" glowHex="#94a3b8" onClick={carousel.onClose} testId="room-shelf-back" /> : room}
      />
    );
  }
  if (roomId === 'rest' || asleep) {
    return (
      <BarLayout
        left={left}
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
        right={room}
      />
    );
  }
  // The closet: not open yet, and said so as part of the game (M14.1)
  return (
    <BarLayout
      left={left}
      center={
        <div className={cx('closet-soon', ROOM_CONTROL_SURFACE)} role="status" data-testid="room-closet-soon">
          <span className="closet-soon__icon" aria-hidden>
            <Shirt />
          </span>
          <span className="closet-soon__text">
            <span className="closet-soon__title">Coming soon</span>
            <span className="closet-soon__sub">Outfits are still being sewn. {blobbi.name}’s wardrobe opens in a later update.</span>
          </span>
        </div>
      }
      right={room}
    />
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
