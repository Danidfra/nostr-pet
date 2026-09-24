import { Backpack } from 'lucide-react';
import { ItemGlyph, type HomeInventoryItem } from '@/features/inventory';
import { hotbarKey } from './hotbar-key';

export interface HotbarProps {
  /** The room's usable consumables, already filtered; in display order. */
  items: readonly HomeInventoryItem[];
  /** The key of the item in hand (`hotbarKey`), if any. */
  selectedKey: string | null;
  /** Tap a tile: hold it, or use it when it is already in hand. */
  onSelect: (entry: HomeInventoryItem) => void;
  /** The bag: opens the full items sheet. */
  onOpenItems: () => void;
  /** Usable items across the whole inventory, for the bag's badge. */
  itemCount: number;
  /** What to say under the strip: the held item's instruction, or why the strip is empty. */
  hint: string | null;
  disabled?: boolean;
}

/**
 * The item hotbar: what this Blobbi could use right now, in this room, one
 * thumb-sized tile each, scrolling sideways. The bag is the first tile and
 * opens the full sheet (every item, details, refresh). A tile shows the
 * item's artwork and how many are left; the one in hand is lifted.
 *
 * Presentation only: what an item is, whether it is usable, and how many
 * remain come from the inventory read (`useHomeInventory`); using one goes
 * through the overview's offer flow and the M4 spend pipeline. Nothing here
 * knows a kind number.
 */
export function ItemHotbar({ items, selectedKey, onSelect, onOpenItems, itemCount, hint, disabled = false }: HotbarProps) {
  return (
    <div className="hotbar-wrap" data-testid="hotbar">
      <div className="hotbar" role="list" aria-label="Items to use">
        <div role="listitem" className="hotbar-slot">
          <button type="button" className="hotbar-tile hotbar-tile--bag" onClick={onOpenItems} disabled={disabled} aria-label={itemCount > 0 ? `Items, ${itemCount} ready` : 'Items'} data-testid="action-items">
            <span className="hotbar-tile__art">
              <Backpack className="h-6 w-6" aria-hidden />
            </span>
            {itemCount > 0 && (
              <span className="hotbar-tile__qty hotbar-tile__qty--badge" aria-hidden>
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
            <span className="hotbar-tile__name">Items</span>
          </button>
        </div>
        {items.map((entry) => {
          const key = hotbarKey(entry);
          const selected = selectedKey === key;
          return (
            <div role="listitem" key={key} className="hotbar-slot">
              <button
                type="button"
                className={`hotbar-tile ${selected ? 'hotbar-tile--selected' : ''}`}
                onClick={() => onSelect(entry)}
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`${entry.item.name}, ${entry.quantity}${selected ? ', in hand' : ''}`}
                data-testid={`hotbar-item-${entry.item.itemId}`}
                data-selected={selected ? 'true' : 'false'}
              >
                <span className="hotbar-tile__art">
                  <ItemGlyph glyph={entry.item.glyph} size="2rem" />
                </span>
                <span className="hotbar-tile__qty" aria-hidden>
                  ×{entry.quantity}
                </span>
                <span className="hotbar-tile__name">{entry.item.name}</span>
              </button>
            </div>
          );
        })}
      </div>
      {hint && (
        <p className="hotbar-hint scene-text" data-testid="hotbar-hint" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}
