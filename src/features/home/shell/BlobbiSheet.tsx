import type { BlobbiCompanion, BlobbonautProfile } from '@blobbi-kit/core';
import { RenamePencil } from '@/features/care-ui/RenameBlobbiDialog';
import { Chip } from './Chip';
import { ChevronRight, Map as MapIcon, Moon, Snowflake, Sparkles } from 'lucide-react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from './GameOverlay';
import { PhotoTile } from '@/features/photo';
import { BlobbiStatusPanel, type StatItem } from '../BlobbiStatusPanel';
import { ProgressionStrip } from '../ProgressionStrip';
import { BlobbiSelector } from '../BlobbiSelector';
import { LifecyclePanel } from '@/features/lifecycle';
import type { Lifecycle, CeremonyKind, CeremonyPhase } from '@/features/lifecycle';
import { t } from '@/i18n';
import { stageLabel } from '../labels';

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
  /** The Polaroid: a portrait of this Blobbi to keep or to send (src/features/photo). */
  onOpenPhoto?: () => void;
  /** Rename this Blobbi (the pencil beside its name); absent where it cannot be renamed. */
  onRename?: () => void;
  devForce?: (kind: CeremonyKind) => void;
  /** A guest's Blobbi (M14): evolving waits for a saved Blobbi; the panel says so instead of offering it. */
  guest?: boolean;
}

/**
 * Everything about this Blobbi that is not the Blobbi itself, as one game
 * screen: the portrait and name, stage and state, the five rings and the
 * exact numbers, progression, the lifecycle missions, and the other
 * Blobbis. The home shows only what matters at a glance; this is the rest.
 */
export function BlobbiSheet({ open, onClose, blobbi, mood, statItems, profile, companions, onSelect, lifecycle, ceremony, onCeremony, firstBlobbi, devForce, guest = false, onOpenJourney, onOpenPhoto, onRename }: BlobbiSheetProps) {
  const portrait = (
    <span className="overlay-portrait" aria-hidden>
      <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`details-${blobbi.d}`} size="100%" isSleeping={blobbi.state === 'sleeping'} transparent style={{ width: '100%', height: '100%' }} />
    </span>
  );
  const chips = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip testId="stage-badge">{stageLabel(blobbi.stage)}</Chip>
      {blobbi.state === 'sleeping' && (
        <Chip tone="sleep" testId="state-badge">
          <Moon className="h-3.5 w-3.5" aria-hidden /> {t('home.sheet.sleeping')}
        </Chip>
      )}
      {blobbi.state === 'hibernating' && (
        <Chip tone="cold" testId="state-badge">
          <Snowflake className="h-3.5 w-3.5" aria-hidden /> {t('home.sheet.hibernating')}
        </Chip>
      )}
      {blobbi.state === 'active' && <Chip testId="state-badge">{t('home.sheet.awake')}</Chip>}
      {blobbi.progressionState !== 'none' && (
        <Chip tone="grow" testId="progression-badge">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {blobbi.progressionState === 'incubating' ? t('home.sheet.incubating') : t('home.sheet.evolving')}
        </Chip>
      )}
    </div>
  );

  return (
    <GameOverlay open={open} onClose={onClose} title={blobbi.name} titleAction={onRename ? <RenamePencil name={blobbi.name} onClick={onRename} /> : undefined} testId="blobbi-sheet" lead={portrait} subtitle={chips} size="medium">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground" data-testid="mood-line">
          {t('home.sheet.moodLine', { name: blobbi.name, mood })}
        </p>

        <section aria-label={t('home.sheet.conditionAndProgress')} className="overlay-card">
          <h3 className="overlay-card__title">{t('home.sheet.condition')}</h3>
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
              <span className="menu-tile__title">{t('home.sheet.journey')}</span>
              <span className="menu-tile__sub">{t('home.sheet.journeySub')}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
          </button>
        )}
        {onOpenPhoto && <PhotoTile name={blobbi.name} onOpen={onOpenPhoto} />}
        <LifecyclePanel name={blobbi.name} lifecycle={lifecycle} ceremony={ceremony} onCeremony={onCeremony} firstBlobbi={firstBlobbi} devForce={devForce} embedded guest={guest} />

        {companions.length > 1 && (
          <section aria-label={t('home.sheet.yourBlobbis')} className="overlay-card">
            <h3 className="overlay-card__title">{t('home.sheet.yourBlobbis')}</h3>
            <BlobbiSelector companions={companions} currentD={blobbi.d} onSelect={onSelect} />
          </section>
        )}
      </div>
    </GameOverlay>
  );
}
