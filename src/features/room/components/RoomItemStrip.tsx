/**
 * The items a room offers, in a strip along the dock: Ditto's carousel,
 * with this app's economy. Each tile says what it is: a STARTER (free,
 * unlimited, from the official kit) or an OWNED item with how many are
 * left; an item this Blobbi cannot use now stays in its place, dimmed,
 * with the reason.
 *
 * Choosing is not using. A tap (or the arrow keys) SELECTS; the Use button
 * uses the selection, and a tile can be dragged into the room (onto the
 * Blobbi, or onto the floor for it to walk to). The strip scrolls sideways
 * under a finger without lifting anything (`touch-action: pan-x`).
 */
import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Loader2, X } from 'lucide-react';

import { ItemGlyph } from '@/features/inventory';
import { cx } from '../lib/cx';
import { isHandFed, type RoomCareEntry } from '../lib/room-care';

interface RoomItemStripProps {
  title: string;
  entries: readonly RoomCareEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onUse: (entry: RoomCareEntry) => void;
  /** Start dragging a tile into the room. */
  onDragStart: (e: ReactPointerEvent, entry: RoomCareEntry) => void;
  /** The entry on its way or being used (its tile spins). */
  activeKey: string | null;
  /** Something is under way: nothing new starts. */
  busy: boolean;
  emptyText: string;
  /** A strip a piece of furniture opened: a way back to the room's own. */
  onClose?: () => void;
  /** A piece of furniture asked for attention: the strip glows once. */
  highlightKey?: number;
}

export function RoomItemStrip({ title, entries, selectedKey, onSelect, onUse, onDragStart, activeKey, busy, emptyText, onClose, highlightKey }: RoomItemStripProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selected = entries.find((e) => e.key === selectedKey) ?? null;
  const focusIndex = Math.max(0, entries.findIndex((e) => e.key === selectedKey));

  // The selected tile in view (keyboard, a furniture tap that selected for the player)
  useEffect(() => {
    if (!selectedKey) return;
    const tile = listRef.current?.querySelector<HTMLElement>(`[data-entry-key="${CSS.escape(selectedKey)}"]`);
    tile?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selectedKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (entries.length === 0) return;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    let next = -1;
    if (step) next = (focusIndex + step + entries.length) % entries.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = entries.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(entries[next].key);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-entry-key="${CSS.escape(entries[next].key)}"]`)?.focus());
  };

  const verb = selected && isHandFed(selected.action) ? 'Give' : 'Use';
  const useDisabled = !selected || !selected.usable || busy;

  return (
    <div className="room-item-strip" data-testid="room-item-strip">
      {/* Re-keyed per request, so the glow plays again; the strip itself (scroll, focus) stays */}
      {highlightKey ? <span key={highlightKey} className="room-item-strip__glow" aria-hidden data-testid="room-item-strip-glow" /> : null}
      <div className="flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground/70" data-testid="room-item-strip-title">{title}</p>
        {onClose && (
          <button type="button" className="room-strip-close" onClick={onClose} aria-label={`Close ${title}`} data-testid="room-item-strip-close">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="room-item-strip__empty" data-testid="room-item-strip-empty">{emptyText}</p>
      ) : (
        <div className="flex items-stretch gap-2">
          <div
            ref={listRef}
            role="listbox"
            aria-label={title}
            aria-orientation="horizontal"
            className="room-item-strip__list"
            onKeyDown={onKeyDown}
            data-testid="room-item-list"
          >
            {entries.map((entry, i) => {
              const isSelected = entry.key === selectedKey;
              const isActive = entry.key === activeKey;
              const draggable = entry.usable && !busy;
              return (
                <div
                  key={entry.key}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={!entry.usable || undefined}
                  aria-label={`${entry.name}, ${entry.quantity === null ? 'free starter item' : `${entry.quantity} owned`}${entry.usable ? '' : `, ${entry.reason}`}`}
                  tabIndex={i === focusIndex ? 0 : -1}
                  title={entry.reason ?? entry.name}
                  className={cx('room-item-tile', isSelected && 'room-item-tile--on', !entry.usable && 'room-item-tile--off')}
                  onClick={() => onSelect(entry.key)}
                  onPointerDown={draggable ? (e) => onDragStart(e, entry) : undefined}
                  data-room-drag={draggable ? '' : undefined}
                  data-entry-key={entry.key}
                  data-source={entry.choice.source}
                  data-testid={`room-item-${entry.key}`}
                >
                  <ItemGlyph glyph={entry.glyph} size="2rem" />
                  <span className="room-item-tile__name">{entry.name}</span>
                  <span className={cx('room-item-tile__badge', entry.quantity === null ? 'room-item-tile__badge--starter' : 'room-item-tile__badge--owned')} data-testid="room-item-badge">
                    {entry.quantity === null ? 'Free' : `×${entry.quantity}`}
                  </span>
                  {isActive && <Loader2 className="room-item-tile__spinner size-3.5 animate-spin text-primary" aria-hidden />}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="room-use-button"
            onClick={() => selected && onUse(selected)}
            disabled={useDisabled}
            aria-label={selected ? `${verb} ${selected.name}` : 'Choose an item to use'}
            data-testid="room-item-use"
          >
            {activeKey !== null && activeKey === selected?.key ? <Loader2 className="size-4 animate-spin" aria-hidden /> : verb}
          </button>
        </div>
      )}

      {selected && !selected.usable && (
        <p className="px-1 text-[11px] text-foreground/60" data-testid="room-item-reason">{selected.reason}</p>
      )}
    </div>
  );
}
