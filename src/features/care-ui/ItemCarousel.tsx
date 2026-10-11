/**
 * Ditto's `ItemCarousel` (`ditto/src/blobbi/rooms/components/ItemCarousel.tsx`):
 * a single-focus carousel. One item in the middle, big; round arrows either
 * side; from `sm` up, the neighbours as small previews you can tap. Fixed
 * slot sizes, so switching items never reflows the bar. The classes are
 * Ditto's; the structure is Ditto's.
 *
 * What the Standalone adds, and why:
 *
 *  - FOCUS is the page's (per room, for the visit), not the carousel's or
 *    localStorage's: `focusedKey` / `onFocus`. Arrows and previews only move
 *    the focus; nothing is used by choosing.
 *  - TAPPING THE FOCUSED ITEM uses it, as in Ditto: the explicit use. It is
 *    also what is dragged into the room (`onDragStart`).
 *  - OWNED items show how many are left (×N): this app's items are a real
 *    balance, spent on use; starters are free and carry no badge, as every
 *    item in Ditto's catalog does.
 *  - An item this Blobbi cannot use now stays, dimmed; tapping it says why
 *    (`onBlocked`) instead of using it.
 *  - The arrow keys move the focus while the carousel has keyboard focus, and
 *    a polite status says which item is in the middle.
 *
 * One carousel for every screen that offers items: the 3D room's dock and
 * the classic home's care options (`idPrefix` names its test hooks).
 */
import { useCallback, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { ItemGlyph, type ItemGlyphModel } from '@/features/inventory';
import { CONTROL_SURFACE as ROOM_CONTROL_SURFACE, GUIDE_HIGHLIGHT as ROOM_GUIDE_HIGHLIGHT, cx } from './ui';
import { isHandFed, type CareEntry as RoomCareEntry } from './care-entries';

interface ItemCarouselProps {
  items: readonly RoomCareEntry[];
  /** The entry in the middle; the first when unset or gone. */
  focusedKey: string | null;
  onFocus: (key: string) => void;
  /** Use the item in the middle (the player tapped it). */
  onUse: (entry: RoomCareEntry) => void;
  /** The item in the middle cannot be used now: say why. */
  onBlocked: (entry: RoomCareEntry) => void;
  /** Start carrying the item in the middle into the room. */
  onDragStart?: (e: ReactPointerEvent, entry: RoomCareEntry) => void;
  /** The entry being used (a spinner under it). */
  activeKey?: string | null;
  /** Something is under way: nothing new starts. */
  disabled?: boolean;
  /** A piece of furniture pointed here: the middle card pulses for a moment. */
  highlight?: boolean;
  /** The test hooks' prefix (`room-item` in the room, `care-item` on the classic home). */
  idPrefix?: string;
}

const ARROW_CLASS = cx(
  'touch-hit size-[2.3em] rounded-full flex items-center justify-center shrink-0',
  ROOM_CONTROL_SURFACE,
  'text-foreground/70 hover:text-foreground hover:bg-background/80',
  'transition-all duration-200 active:scale-90 motion-reduce:active:scale-100',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

const PREVIEW_CLASS = 'hidden sm:flex items-center justify-center size-[2.6em] shrink-0 rounded-full select-none opacity-60 hover:opacity-90 transition-opacity duration-200';

/** An item's picture as Ditto draws it: an emoji bare, at the size of the text around it; an image or icon in a 1em box. */
export function ItemIcon({ glyph }: { glyph: ItemGlyphModel }) {
  if (glyph.type === 'emoji') return <span aria-hidden>{glyph.text}</span>;
  return <ItemGlyph glyph={glyph} size="1em" className="room-item-icon" />;
}

export function ItemCarousel({ items, focusedKey, onFocus, onUse, onBlocked, onDragStart, activeKey, disabled, highlight, idPrefix = 'room-item' }: ItemCarouselProps) {
  const count = items.length;
  const found = items.findIndex((e) => e.key === focusedKey);
  const index = found < 0 ? 0 : found;

  const step = useCallback(
    (dir: 1 | -1) => {
      if (count === 0) return;
      onFocus(items[(index + dir + count) % count].key);
    },
    [count, index, items, onFocus],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    }
  };

  if (count === 0) {
    return (
      <div className="flex items-center justify-center h-[3.6em]" data-testid={`${idPrefix}-empty`}>
        <p className="text-[0.8em] text-muted-foreground">Nothing here yet</p>
      </div>
    );
  }

  const current = items[index];
  const isThisActive = activeKey === current.key;
  const showPreviews = count >= 3;
  const draggable = !!onDragStart && !disabled && current.usable;
  const verb = isHandFed(current.action) ? 'Give' : 'Use';

  const arrow = (dir: 1 | -1) => (
    <button
      type="button"
      onClick={() => step(dir)}
      disabled={disabled}
      className={cx(ARROW_CLASS, disabled && 'opacity-30 pointer-events-none')}
      aria-label={dir === 1 ? 'Next item' : 'Previous item'}
      data-testid={dir === 1 ? `${idPrefix}-next` : `${idPrefix}-prev`}
    >
      {dir === 1 ? <ChevronRight className="size-[1.3em]" /> : <ChevronLeft className="size-[1.3em]" />}
    </button>
  );
  const preview = (dir: 1 | -1) => {
    if (!showPreviews) return null;
    const neighbour = items[(index + dir + count) % count];
    return (
      <button type="button" onClick={() => step(dir)} disabled={disabled} tabIndex={-1} aria-hidden className={PREVIEW_CLASS} data-testid={dir === 1 ? `${idPrefix}-preview-next` : `${idPrefix}-preview-prev`}>
        <span className="text-[1.5em] leading-none block">
          <ItemIcon glyph={neighbour.glyph} />
        </span>
      </button>
    );
  };

  return (
    <div className="flex items-center justify-center gap-[0.4em]" onKeyDown={onKeyDown} data-testid={`${idPrefix}-carousel`} data-count={count}>
      {arrow(-1)}
      {preview(-1)}

      <button
        type="button"
        onClick={() => (current.usable ? onUse(current) : onBlocked(current))}
        onPointerDown={draggable ? (e) => onDragStart!(e, current) : undefined}
        disabled={disabled}
        data-room-drag={draggable ? '' : undefined}
        aria-label={`${verb} ${current.name}${current.quantity === null ? '' : `, ${current.quantity} left`}${current.usable ? '' : `. ${current.reason}`}`}
        data-testid={`${idPrefix}-use`}
        data-entry-key={current.key}
        data-item-id={current.choice.entry.item.itemId}
        data-definition={current.choice.entry.item.definitionSource}
        title={current.choice.entry.item.definitionSource === 'builtin' ? 'Details are built-in; the definition relay did not answer' : undefined}
        data-source={current.choice.source}
        data-usable={current.usable}
        className={cx(
          'relative flex flex-col items-center justify-center shrink-0 overflow-hidden',
          'w-[5.25em] h-[4.75em] rounded-[1em]',
          'hover:bg-foreground/5 transition-all duration-200 active:scale-95 motion-reduce:active:scale-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && !isThisActive && 'opacity-50 pointer-events-none',
          !current.usable && 'opacity-50',
          highlight && ROOM_GUIDE_HIGHLIGHT,
          draggable && 'touch-none cursor-grab',
        )}
      >
        <span className="text-[2.6em] leading-none">
          <ItemIcon glyph={current.glyph} />
        </span>
        <span className="text-[0.8em] font-medium text-foreground mt-[0.3em] w-[6em] text-center truncate">{current.name}</span>
        {current.quantity !== null && (
          <span className="absolute top-[0.25em] right-[0.35em] rounded-full bg-primary px-[0.45em] text-[0.62em] font-bold leading-[1.55] text-primary-foreground" data-testid={`${idPrefix}-badge`}>
            ×{current.quantity}
          </span>
        )}
        {isThisActive && <Loader2 className="size-3.5 animate-spin text-primary absolute bottom-0.5" />}
      </button>

      {preview(1)}
      {arrow(1)}

      <p className="sr-only" aria-live="polite" data-testid={`${idPrefix}-status`}>
        {/* A starter's availability is not a price: no "free", just its name; an owned item says how many are left */}
        {current.name}, {current.quantity === null ? '' : `${current.quantity} left, `}{index + 1} of {count}
      </p>
    </div>
  );
}
