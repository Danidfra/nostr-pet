import { memo, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { CareAction, CareAvailability } from '@/features/care';
import type { StatItem } from '../BlobbiStatusPanel';
import type { CeremonyKind } from '@/features/lifecycle';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { CareDock } from '../CareDock';
import type { CareVerb } from '../care-model';

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

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
  /** The Blobbi, for the dock's left button: the one door to everything about it (M14.1). */
  blobbi?: BlobbiCompanion;
  mood?: string;
  /** The stage's stats with their status: one small dot each under the portrait. */
  statItems?: readonly StatItem[];
  onOpenBlobbi?: () => void;
}

const STAT_WORD: Record<StatItem['stat'], string> = { hunger: 'food', happiness: 'joy', hygiene: 'clean', energy: 'energy', health: 'health' };

/**
 * The bottom of the screen, under the thumb: the lifecycle pill when a
 * moment is ready, the options for the chosen verb, then the four care
 * intents with the bag beside them. The dock sits in the flow at the
 * front edge of the floor, so it never covers the Blobbi.
 */
function ActionBarImpl({ actions, selected, pendingAction, onSelect, onOpenItems, itemCount, options, lifecycleReady, onLifecycle, disabled = false, floorBackground, blobbi, mood, statItems = [], onOpenBlobbi }: ActionBarProps) {
  return (
    <nav className="hud-bottom" aria-label="Actions" data-testid="action-bar" style={floorBackground ? ({ '--dock-floor': floorBackground } as React.CSSProperties) : undefined}>
      {lifecycleReady && onLifecycle && (
        <button type="button" className="lifecycle-pill" onClick={() => onLifecycle(lifecycleReady.kind)} disabled={disabled} data-testid={`action-${lifecycleReady.kind}`}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {lifecycleReady.label}
        </button>
      )}
      {options}
      <div className="dock-row">
        {blobbi && onOpenBlobbi && (
          <button type="button" className="verb verb--blobbi blobbi-chip" onClick={onOpenBlobbi} data-testid="blobbi-chip" aria-label={`${blobbi.name}: ${STAGE_WORD[blobbi.stage]}${mood ? `, ${mood}` : ''}. Open details`}>
            <span className="verb__disc verb__disc--portrait" aria-hidden>
              <span className="dock-portrait">
                <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`dock-${blobbi.d}`} size="100%" isSleeping={blobbi.state === 'sleeping'} transparent style={{ width: '100%', height: '100%' }} />
              </span>
            </span>
            <span className="verb__label scene-text">{blobbi.name.length > 9 ? 'Blobbi' : blobbi.name}</span>
            <span className="sr-only">
              {STAGE_WORD[blobbi.stage]}
              {mood ? ` · ${mood}` : ''}
            </span>
            {statItems.length > 0 && (
              <span className="cond-dots cond-dots--dock" aria-hidden data-testid="condition-dots">
                {statItems.map((item) => (
                  <span key={item.stat} className={`cond-dot cond-dot--${item.status}`} title={`${STAT_WORD[item.stat]} ${Math.round(item.value)}`} data-stat={item.stat} data-status={item.status} />
                ))}
              </span>
            )}
          </button>
        )}
        <CareDock actions={actions} selected={selected} pendingAction={pendingAction} onSelect={onSelect} onOpenItems={onOpenItems} itemCount={itemCount} disabled={disabled} />
      </div>
    </nav>
  );
}

/** Memoized: the dock must not re-render on every step the Blobbi takes. */
export const ActionBar = memo(ActionBarImpl);
