import { memo, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { CareAction, CareAvailability } from '@/features/care';
import type { CeremonyKind } from '@/features/lifecycle';
import { CareDock } from '../CareDock';
import type { CareVerb } from '../care-model';

interface ActionBarProps {
  actions: readonly CareAvailability[];
  selected: CareVerb | null;
  pendingAction: CareAction | null;
  onSelect: (verb: CareVerb) => void;
  onOpenItems: () => void;
  itemCount: number;
  /** The options strip for the selected verb, rendered above the row. */
  options?: ReactNode;
  /** A lifecycle moment is ready: the one big pill. */
  lifecycleReady?: { kind: CeremonyKind; label: string } | null;
  onLifecycle?: (kind: CeremonyKind) => void;
  disabled?: boolean;
  /** The room floor's CSS background; the dock continues it under the controls. */
  floorBackground?: string;
}

/**
 * The bottom of the screen, under the thumb: the lifecycle pill when a
 * moment is ready, the options for the chosen verb, then the four care
 * intents with the bag beside them. The dock sits in the flow at the
 * front edge of the floor, so it never covers the Blobbi.
 */
function ActionBarImpl({ actions, selected, pendingAction, onSelect, onOpenItems, itemCount, options, lifecycleReady, onLifecycle, disabled = false, floorBackground }: ActionBarProps) {
  return (
    <nav className="hud-bottom" aria-label="Actions" data-testid="action-bar" style={floorBackground ? ({ '--dock-floor': floorBackground } as React.CSSProperties) : undefined}>
      {lifecycleReady && onLifecycle && (
        <button type="button" className="lifecycle-pill" onClick={() => onLifecycle(lifecycleReady.kind)} disabled={disabled} data-testid={`action-${lifecycleReady.kind}`}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {lifecycleReady.label}
        </button>
      )}
      {options}
      <CareDock actions={actions} selected={selected} pendingAction={pendingAction} onSelect={onSelect} onOpenItems={onOpenItems} itemCount={itemCount} disabled={disabled} />
    </nav>
  );
}

/** Memoized: the dock must not re-render on every step the Blobbi takes. */
export const ActionBar = memo(ActionBarImpl);
