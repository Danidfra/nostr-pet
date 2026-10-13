/**
 * The fridge, opened (M14.1). A tap on the kitchen's refrigerator used to
 * swap the dock's carousel for a "From the fridge" shelf; now the door
 * swings open over the room: a fridge drawn in CSS, its light on, shelves
 * with the food and drink the player has (the starter kit's, free, and the
 * owned items with how many are left), a magnet or two, and a handle to
 * close it. Tapping a food hands it over through the room's own care path
 * (`onUse`: the same write, spend and ledger as the carousel's Use); one
 * that cannot be given now says why instead. Nothing here is a second
 * feeding system: the entries are the shelf's (`shelfEntries`), the use is
 * the room's.
 *
 * Sized for a phone: as wide as the screen allows under 22rem, never wider
 * than the viewport, the shelves scrolling inside if there are many. The
 * sheet is a dialog: Escape and the handle close it, focus stays inside.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { ItemGlyph } from '@/features/inventory';
import type { RoomCareEntry } from '../lib/room-care';
import { cx } from '../lib/cx';

interface FridgeSheetProps {
  open: boolean;
  onClose: () => void;
  /** What the fridge holds: the shelf's entries (`shelfEntries`, feed and boost). */
  entries: readonly RoomCareEntry[];
  /** Hand an item over (the room's own use path). The sheet closes after. */
  onUse: (entry: RoomCareEntry) => void;
  /** Something is under way: nothing new starts. */
  busy?: boolean;
  blobbiName: string;
}

/** Three shelves, the items spread over them top to bottom, at most four a shelf before a new row. */
const SHELVES = 3;
function onShelves(entries: readonly RoomCareEntry[]): RoomCareEntry[][] {
  const perShelf = Math.max(2, Math.ceil(entries.length / SHELVES));
  const shelves: RoomCareEntry[][] = [];
  for (let i = 0; i < SHELVES; i += 1) shelves.push(entries.slice(i * perShelf, (i + 1) * perShelf));
  return shelves;
}

export function FridgeSheet({ open, onClose, entries, onUse, busy = false, blobbiName }: FridgeSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setBlocked(null);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previous?.focus?.();
  }, [open]);
  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };
  const choose = (entry: RoomCareEntry) => {
    if (busy) return;
    if (!entry.usable) {
      setBlocked(entry.reason ?? 'Not right now.');
      return;
    }
    onUse(entry);
    onClose();
  };
  const shelves = onShelves(entries);

  return (
    <div className="fridge-root" data-testid="fridge" onKeyDown={onKeyDown}>
      <div className="fridge-backdrop" onClick={onClose} aria-hidden data-testid="fridge-backdrop" />
      <div ref={panelRef} className="fridge" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="fridge-door">
        <div className="fridge__top" aria-hidden>
          <span className="fridge__magnet fridge__magnet--a" />
          <span className="fridge__magnet fridge__magnet--b" />
          <span className="fridge__note">for {blobbiName}</span>
        </div>
        <h2 id={titleId} className="fridge__title">
          What would {blobbiName} like?
        </h2>
        <button type="button" className="fridge__close" onClick={onClose} aria-label="Close the fridge" data-testid="fridge-close">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="fridge__inside">
          <span className="fridge__light" aria-hidden />
          {entries.length === 0 ? (
            <p className="fridge__empty" data-testid="fridge-empty">
              The fridge is empty right now.
            </p>
          ) : (
            <div className="fridge__shelves">
              {shelves.map((shelf, i) => (
                <div key={i} className="fridge__shelf" data-testid="fridge-shelf">
                  {shelf.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      className={cx('fridge__item', !entry.usable && 'fridge__item--off')}
                      onClick={() => choose(entry)}
                      disabled={busy}
                      aria-label={`${entry.name}${entry.quantity !== null ? `, ${entry.quantity} left` : ''}${entry.usable ? '' : `: ${entry.reason ?? 'not right now'}`}`}
                      data-testid="fridge-item"
                      data-key={entry.key}
                      data-usable={entry.usable ? 'true' : 'false'}
                    >
                      <span className="fridge__glyph">
                        <ItemGlyph glyph={entry.glyph} fill />
                      </span>
                      <span className="fridge__name">{entry.name}</span>
                      {entry.quantity !== null && <span className="fridge__count">×{entry.quantity}</span>}
                    </button>
                  ))}
                  <span className="fridge__shelf-edge" aria-hidden />
                </div>
              ))}
            </div>
          )}
        </div>
        {blocked && (
          <p className="fridge__blocked" role="status" data-testid="fridge-blocked">
            {blocked}
          </p>
        )}
        <span className="fridge__handle" aria-hidden />
      </div>
    </div>
  );
}
