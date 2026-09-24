import type { BlobbiCompanion, BlobbonautProfile } from '@blobbi-kit/core';
import { Moon, Snowflake, Sparkles } from 'lucide-react';
import { Sheet } from './Sheet';
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
  devForce?: (kind: CeremonyKind) => void;
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
 * Everything about this Blobbi that is not the Blobbi itself: stage and
 * state, the five rings, progression, the lifecycle missions, and the other
 * Blobbis. Held up in front of the home; the home stays behind it.
 */
export function BlobbiSheet({ open, onClose, blobbi, mood, statItems, profile, companions, onSelect, lifecycle, ceremony, onCeremony, devForce }: BlobbiSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={blobbi.name} testId="blobbi-sheet">
      <div className="flex flex-col gap-4">
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
          <span className="text-sm text-muted-foreground" data-testid="mood-line">
            {blobbi.name} {mood}
          </span>
        </div>

        <section aria-label="Condition and progress" className="rounded-2xl bg-foreground/5 px-3 py-3">
          <BlobbiStatusPanel items={statItems} />
          <div className="mt-3 border-t border-border/60 pt-3">
            <ProgressionStrip blobbi={blobbi} profile={profile} />
          </div>
        </section>

        <LifecyclePanel name={blobbi.name} lifecycle={lifecycle} ceremony={ceremony} onCeremony={onCeremony} devForce={devForce} embedded />

        {companions.length > 1 && (
          <section aria-label="Your Blobbis" className="rounded-2xl bg-foreground/5 px-3 py-3">
            <h3 className="mb-2 text-sm font-semibold">Your Blobbis</h3>
            <BlobbiSelector companions={companions} currentD={blobbi.d} onSelect={onSelect} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
