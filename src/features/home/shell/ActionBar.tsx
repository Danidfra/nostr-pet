import { Sparkles } from 'lucide-react';
import { CareDock } from '../CareDock';
import { ItemHotbar, type HotbarProps } from './ItemHotbar';
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
  /** The item hotbar. Absent hides it (signed out, no Blobbi). */
  hotbar?: HotbarProps;
  /** The room, so the dock takes its floor's colour. */
  room?: string;
  /** The room floor's CSS background; the dock continues it under the controls. */
  floorBackground?: string;
  /** Something that replaces the hotbar and the verbs for a while (the room editor's toolbar). */
  override?: React.ReactNode;
}

/**
 * The bottom of the screen, under the thumb, front to back: the lifecycle
 * pill when the kit says a moment is ready; the item hotbar (the room's
 * usable items, the bag first); the care verbs (feed, play, clean, rest),
 * which are the item-free fallback and the way to bed. The dock sits in
 * the flow, at the front edge of the floor, so it never covers the Blobbi.
 */
export function ActionBar({ actions, pendingAction, onAction, lifecycleReady, onLifecycle, disabled = false, hotbar, room, floorBackground, override }: ActionBarProps) {
  return (
    <nav className="hud-bottom" aria-label="Actions" data-testid="action-bar" data-room={room} style={floorBackground ? ({ '--dock-floor': floorBackground } as React.CSSProperties) : undefined}>
      {lifecycleReady && onLifecycle && (
        <button type="button" className="lifecycle-pill" onClick={() => onLifecycle(lifecycleReady.kind)} disabled={disabled} data-testid={`action-${lifecycleReady.kind}`}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {lifecycleReady.label}
        </button>
      )}
      {override ?? (
        <>
          {hotbar && <ItemHotbar {...hotbar} disabled={disabled || hotbar.disabled} />}
          <CareDock actions={disabled ? actions.map((a) => ({ ...a, available: false, reason: 'Something is happening.' })) : actions} pendingAction={pendingAction} onAction={onAction} />
        </>
      )}
    </nav>
  );
}
