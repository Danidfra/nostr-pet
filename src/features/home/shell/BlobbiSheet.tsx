import type { BlobbiCompanion, BlobbonautProfile } from '@blobbi-kit/core';
import { ChevronRight, Map as MapIcon, Moon, Snowflake, Sparkles } from 'lucide-react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from './GameOverlay';
import { BlobbiStatusPanel, type StatItem } from '../BlobbiStatusPanel';
import { ProgressionStrip } from '../ProgressionStrip';
import { BlobbiSelector } from '../BlobbiSelector';
import { LifecyclePanel } from '@/features/lifecycle';
import type { Lifecycle, CeremonyKind, CeremonyPhase } from '@/features/lifecycle';

interface BlobbiSheetProps {
  open: boolean;
  onClose: () => void;
  blobbi: BlobbiCompanion;
  mood: string;
  statItems: readonly StatItem[];
  profile: BlobbonautProfile | null | undefined;
  companions: readonly BlobbiCompanion[];
  onSelect: (d: string) => void;
  lifecycle: Lifecycle;
  ceremony: { phase: CeremonyPhase; kind: CeremonyKind | null; error: Error | null; dismiss: () => void };
  onCeremony: (kind: CeremonyKind) => void;
  /** This egg is the account's first Blobbi: it hatches without missions. */
  firstBlobbi?: boolean;
  /** The Journey (chapters, today's missions, the level): the Blobbi's progression, from here (M14.1). */
  onOpenJourney?: () => void;
  devForce?: (kind: CeremonyKind) => void;
  /** A guest's Blobbi (M14): evolving waits for a saved Blobbi; the panel says so instead of offering it. */
  guest?: boolean;
}

const STAGE_LABEL: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

function Chip({ children, testId, tone = 'neutral' }: { children: React.ReactNode; testId?: string; tone?: 'neutral' | 'sleep' | 'cold' | 'grow' }) {
  const tones = {
    neutral: 'bg-foreground/10 text-foreground',
    sleep: 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200',
    cold: 'bg-sky-500/20 text-sky-900 dark:text-sky-200',
    grow: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  } as const;
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Everything about this Blobbi that is not the Blobbi itself, as one game
 * screen: the portrait and name, stage and state, the five rings and the
 * exact numbers, progression, the lifecycle missions, and the other
 * Blobbis. The home shows only what matters at a glance; this is the rest.
 */
export function BlobbiSheet({ open, onClose, blobbi, mood, statItems, profile, companions, onSelect, lifecycle, ceremony, onCeremony, firstBlobbi, devForce, guest = false, onOpenJourney }: BlobbiSheetProps) {
  const portrait = (
    <span className="overlay-portrait" aria-hidden>
      <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`details-${blobbi.d}`} size="100%" isSleeping={blobbi.state === 'sleeping'} transparent style={{ width: '100%', height: '100%' }} />
    </span>
  );
  const chips = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip testId="stage-badge">{STAGE_LABEL[blobbi.stage]}</Chip>
      {blobbi.state === 'sleeping' && (
        <Chip tone="sleep" testId="state-badge">
          <Moon className="h-3.5 w-3.5" aria-hidden /> Sleeping
        </Chip>
      )}
      {blobbi.state === 'hibernating' && (
        <Chip tone="cold" testId="state-badge">
          <Snowflake className="h-3.5 w-3.5" aria-hidden /> Hibernating
        </Chip>
      )}
      {blobbi.state === 'active' && <Chip testId="state-badge">Awake</Chip>}
      {blobbi.progressionState !== 'none' && (
        <Chip tone="grow" testId="progression-badge">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {blobbi.progressionState === 'incubating' ? 'Incubating' : 'Evolving'}
        </Chip>
      )}
    </div>
  );

  return (
    <GameOverlay open={open} onClose={onClose} title={blobbi.name} testId="blobbi-sheet" lead={portrait} subtitle={chips} size="medium">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground" data-testid="mood-line">
          {blobbi.name} {mood}
        </p>

        <section aria-label="Condition and progress" className="overlay-card">
          <h3 className="overlay-card__title">Condition</h3>
          <BlobbiStatusPanel items={statItems} />
          <div className="mt-3 border-t border-border/60 pt-3">
            <ProgressionStrip blobbi={blobbi} profile={profile} />
          </div>
        </section>

        {onOpenJourney && (
          <button type="button" className="menu-tile" onClick={onOpenJourney} data-testid="sheet-journey">
            <span className="menu-tile__icon">
              <MapIcon className="h-6 w-6" aria-hidden />
            </span>
            <span className="menu-tile__text">
              <span className="menu-tile__title">Journey</span>
              <span className="menu-tile__sub">Chapters, today’s missions and your Blobbonaut level.</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
          </button>
        )}
        <LifecyclePanel name={blobbi.name} lifecycle={lifecycle} ceremony={ceremony} onCeremony={onCeremony} firstBlobbi={firstBlobbi} devForce={devForce} embedded guest={guest} />

        {companions.length > 1 && (
          <section aria-label="Your Blobbis" className="overlay-card">
            <h3 className="overlay-card__title">Your Blobbis</h3>
            <BlobbiSelector companions={companions} currentD={blobbi.d} onSelect={onSelect} />
          </section>
        )}
      </div>
    </GameOverlay>
  );
}
