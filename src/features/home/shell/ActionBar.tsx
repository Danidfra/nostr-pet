import { Sparkles } from 'lucide-react';
import { CareDock } from '../CareDock';
import type { CareAction, CareAvailability } from '@/features/care';
import type { CeremonyKind } from '@/features/lifecycle';

interface ActionBarProps {
  actions: readonly CareAvailability[];
  pendingAction: CareAction | null;
  onAction: (action: CareAction) => void;
  /** A lifecycle moment is ready: the one big pill. */
  lifecycleReady?: { kind: CeremonyKind; label: string } | null;
  onLifecycle?: (kind: CeremonyKind) => void;
  disabled?: boolean;
}

/**
 * The bottom of the HUD, under the thumb: the care dock and, when the kit
 * says a lifecycle moment is ready, one bright pill for it. This is the
 * fallback and shortcut layer; the world itself is the preferred way to act
 * (the bed, the door, later the food and toys).
 */
export function ActionBar({ actions, pendingAction, onAction, lifecycleReady, onLifecycle, disabled = false }: ActionBarProps) {
  return (
    <nav className="hud-bottom" aria-label="Actions" data-testid="action-bar">
      {lifecycleReady && onLifecycle && (
        <button type="button" className="lifecycle-pill" onClick={() => onLifecycle(lifecycleReady.kind)} disabled={disabled} data-testid={`action-${lifecycleReady.kind}`}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {lifecycleReady.label}
        </button>
      )}
      <CareDock actions={disabled ? actions.map((a) => ({ ...a, available: false, reason: 'Something is happening.' })) : actions} pendingAction={pendingAction} onAction={onAction} />
    </nav>
  );
}
