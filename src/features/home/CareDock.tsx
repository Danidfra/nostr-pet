import { Bath, Gamepad2, Loader2, Moon, Sun, Utensils, type LucideIcon } from 'lucide-react';
import type { CareAction, CareAvailability } from '@/features/care';

const ICONS: Record<CareAction, LucideIcon> = {
  feed: Utensils,
  play: Gamepad2,
  clean: Bath,
  rest: Moon,
};

const TINT: Record<CareAction, string> = {
  feed: 'verb--feed',
  play: 'verb--play',
  clean: 'verb--clean',
  rest: 'verb--rest',
};

interface CareDockProps {
  actions: readonly CareAvailability[];
  pendingAction: CareAction | null;
  onAction: (action: CareAction) => void;
}

/**
 * The care verbs: four round, thumb-friendly buttons. Tapping IS the action
 * (no modal in between). They are the item-free fallback (the kit's plain
 * care effects) and, for rest, the way to bed. Unavailable verbs stay
 * visible but say why.
 */
export function CareDock({ actions, pendingAction, onAction }: CareDockProps) {
  const busy = pendingAction !== null;
  return (
    <div role="group" aria-label="Care for your Blobbi" className="verb-row">
      {actions.map(({ action, label, available, reason }) => {
        const Icon = action === 'rest' && label === 'Wake' ? Sun : ICONS[action];
        const isPending = pendingAction === action;
        const disabled = busy || !available;
        return (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            disabled={disabled}
            aria-disabled={disabled}
            aria-busy={isPending}
            aria-label={available ? label : `${label}: ${reason}`}
            title={available ? label : reason}
            data-testid={`care-${action}`}
            className={`verb ${TINT[action]} ${disabled ? 'verb--off' : ''}`}
          >
            <span className="verb__disc">{isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}</span>
            <span className="verb__label scene-text">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
