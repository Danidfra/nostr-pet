import { Backpack, Bath, Gamepad2, Loader2, Moon, Sun, Utensils, type LucideIcon } from 'lucide-react';
import type { CareAction, CareAvailability } from '@/features/care';
import type { CareVerb } from './care-model';

const ICONS: Record<CareAction, LucideIcon> = { feed: Utensils, play: Gamepad2, clean: Bath, rest: Moon };
const TINT: Record<CareAction, string> = { feed: 'verb--feed', play: 'verb--play', clean: 'verb--clean', rest: 'verb--rest' };

interface CareDockProps {
  actions: readonly CareAvailability[];
  /** The verb whose options are open, if any. */
  selected: CareVerb | null;
  /** The verb a walk or a write is in progress for. */
  pendingAction: CareAction | null;
  onSelect: (verb: CareVerb) => void;
  /** The bag: everything owned, in a sheet. */
  onOpenItems: () => void;
  itemCount: number;
  disabled?: boolean;
}

/**
 * The bottom row: four care intents and, beside them, the bag. A verb does
 * not act by itself; it opens its options above (`CareOptions`). Unavailable
 * verbs stay visible and say why. Tapping IS the choice: no modal between.
 */
export function CareDock({ actions, selected, pendingAction, onSelect, onOpenItems, itemCount, disabled = false }: CareDockProps) {
  const busy = pendingAction !== null;
  return (
    <div role="group" aria-label="Care for your Blobbi" className="verb-row" data-testid="care-dock">
      {actions.map(({ action, label, available, reason }) => {
        const Icon = action === 'rest' && label === 'Wake' ? Sun : ICONS[action];
        const isPending = pendingAction === action;
        const off = disabled || busy || !available;
        const open = selected === action;
        return (
          <button
            key={action}
            type="button"
            onClick={() => onSelect(action)}
            disabled={off}
            aria-disabled={off}
            aria-busy={isPending}
            aria-expanded={open}
            aria-label={available ? label : `${label}: ${reason}`}
            title={available ? label : reason}
            data-testid={`care-${action}`}
            data-open={open ? 'true' : 'false'}
            className={`verb ${TINT[action]} ${off ? 'verb--off' : ''} ${open ? 'verb--open' : ''}`}
          >
            <span className="verb__disc">
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
            </span>
            <span className="verb__label scene-text">{label}</span>
          </button>
        );
      })}
      <span className="verb-row__divider" aria-hidden />
      <button type="button" onClick={onOpenItems} disabled={disabled} className={`verb verb--bag ${disabled ? 'verb--off' : ''}`} aria-label={itemCount > 0 ? `Items, ${itemCount} ready` : 'Items'} data-testid="action-items">
        <span className="verb__disc">
          <Backpack className="h-5 w-5" aria-hidden />
          {itemCount > 0 && (
            <span className="verb__count verb__count--bag" aria-hidden>
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </span>
        <span className="verb__label scene-text">Items</span>
      </button>
    </div>
  );
}
