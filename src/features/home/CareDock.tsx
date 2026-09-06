import { Bath, Gamepad2, Loader2, Moon, Sun, Utensils, type LucideIcon } from 'lucide-react';
import type { CareAction, CareAvailability } from '@/features/care';

const ICONS: Record<CareAction, LucideIcon> = {
  feed: Utensils,
  play: Gamepad2,
  clean: Bath,
  rest: Moon,
};

const TINT: Record<CareAction, string> = {
  feed: 'bg-orange-500 text-white',
  play: 'bg-yellow-400 text-yellow-950',
  clean: 'bg-cyan-500 text-white',
  rest: 'bg-indigo-500 text-white',
};

interface CareDockProps {
  actions: readonly CareAvailability[];
  pendingAction: CareAction | null;
  onAction: (action: CareAction) => void;
}

/**
 * The care dock: four big, round, thumb-friendly buttons. Recovered idea from
 * the pre-nuke sticky actions footer, without the modal in between: tapping
 * IS the action. Unavailable actions stay visible but say why.
 */
export function CareDock({ actions, pendingAction, onAction }: CareDockProps) {
  const busy = pendingAction !== null;
  return (
    <div role="group" aria-label="Care for your Blobbi" className="flex items-end justify-center gap-3 sm:gap-5">
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
            className="group flex w-16 flex-col items-center gap-1.5 focus-visible:outline-none sm:w-20"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-offset-2 ring-offset-background transition duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ring sm:h-16 sm:w-16 ${TINT[action]} ${
                disabled ? 'opacity-45 saturate-50' : 'group-hover:-translate-y-0.5 group-hover:brightness-110 group-active:scale-95'
              }`}
            >
              {isPending ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />}
            </span>
            <span className="scene-text text-xs font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
