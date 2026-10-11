/**
 * What the dock offers in a room (the shell's `middleSlot`): the room's
 * items (or what a piece of furniture opened), the bedroom's Sleep or Wake,
 * the closet's word about the Island; a use that failed, with its way out;
 * and a short notice. Ditto's per-room bars, over this app's care.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Loader2, Moon, Sun } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { CareError } from '@/features/home/CareFeedback';
import type { RoomId } from '@/features/home/rooms/rooms';
import { RoomItemStrip } from './RoomItemStrip';
import { RoomOfferFailure } from './RoomCareParts';
import type { RoomOffer } from '../hooks/useRoomCare';
import type { RoomCareEntry } from '../lib/room-care';

interface RoomCarePanelProps {
  blobbi: Pick<BlobbiCompanion, 'name' | 'state' | 'stage'>;
  roomId: RoomId;
  /** The strip, unless this room has none (the bedroom, the closet). */
  strip: {
    title: string;
    entries: readonly RoomCareEntry[];
    selectedKey: string | null;
    onSelect: (key: string) => void;
    onUse: (entry: RoomCareEntry) => void;
    onDragStart: (e: ReactPointerEvent, entry: RoomCareEntry) => void;
    emptyText: string;
    onClose?: () => void;
    highlightKey?: number;
  } | null;
  offer: RoomOffer | null;
  busy: boolean;
  onRetry: () => void;
  onPutAway: () => void;
  onRest: () => void;
  restPending: boolean;
  /** No bed in this room to walk to: Sleep happens where it stands. */
  hasBed: boolean;
  closetHint: string;
  error: Error | null;
  notice: string | null;
}

export function RoomCarePanel({ blobbi, roomId, strip, offer, busy, onRetry, onPutAway, onRest, restPending, hasBed, closetHint, error, notice }: RoomCarePanelProps) {
  const asleep = blobbi.state === 'sleeping';
  return (
    <div className="room-care-panel" data-testid="room-care-panel" data-room={roomId}>
      {offer?.phase === 'failed' && <RoomOfferFailure offer={offer} onRetry={onRetry} onPutAway={onPutAway} />}
      {notice && (
        <p className="room-care-notice" role="status" data-testid="room-care-notice">{notice}</p>
      )}
      <CareError error={error} />

      {strip ? (
        <RoomItemStrip
          {...strip}
          activeKey={offer && offer.phase !== 'failed' ? offer.entryKey : null}
          busy={busy}
        />
      ) : roomId === 'rest' ? (
        <div className="room-rest-bar" data-testid="room-rest-bar">
          <button type="button" className="room-rest-button" onClick={onRest} disabled={restPending || (busy && !asleep)} data-testid="room-rest" aria-busy={restPending || undefined}>
            {restPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : asleep ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
            <span>{asleep ? 'Wake up' : blobbi.stage === 'egg' ? 'Rest' : 'Sleep'}</span>
          </button>
          <p className="text-[11px] text-foreground/60">
            {asleep ? `${blobbi.name} is asleep.` : hasBed && blobbi.stage !== 'egg' ? `${blobbi.name} walks to the bed first. You can tap the bed too.` : `${blobbi.name} rests right here.`}
          </p>
        </div>
      ) : (
        <p className="room-item-strip__empty" data-testid="room-closet-hint">{closetHint}</p>
      )}
    </div>
  );
}
