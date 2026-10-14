/**
 * Everything about this Blobbi that is not the Blobbi in its room, as one
 * game screen over the room (the classic home's `BlobbiSheet`, for the
 * room): the portrait and name, stage and state, the exact numbers behind
 * the HUD's rings, progression, the lifecycle (hatch, evolve: the writes
 * are the same kit transitions the classic home performs; the room's
 * reveal is its own, simpler one), the player's other Blobbis, and the way
 * to the whole inventory. Since M14.3 the Appearance card (how the Blobbi is
 * drawn here: Classic or the 3D Model, presentation only) stands right under
 * the condition, with its own icon and the look in force named, and the
 * one-time guide can light it when the sheet opens.
 */
import type { BlobbiCompanion, BlobbonautProfile } from '@blobbi-kit/core';
import { useEffect, useRef } from 'react';
import { Backpack, ChevronRight, Map as MapIcon, Moon, Palette, Snowflake, Sparkles } from 'lucide-react';
import { BlobbiAppearanceControl, type BlobbiAppearanceControlProps } from './RoomSettings';
import { LOOK_GUIDE_SHEET_MS, lookTitle, shownLook } from '../lib/look-guide';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { BlobbiStatusPanel, type StatItem } from '@/features/home/BlobbiStatusPanel';
import { ProgressionStrip } from '@/features/home/ProgressionStrip';
import { BlobbiSelector } from '@/features/home/BlobbiSelector';
import { LifecyclePanel, type CeremonyKind, type CeremonyPhase, type Lifecycle } from '@/features/lifecycle';

interface RoomBlobbiSheetProps {
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
  /** A guest's Blobbi (M14): the lifecycle runs on this device, and the panel says so. */
  guest?: boolean;
  /** Open the whole inventory (every item the player owns, usable here or not). */
  onOpenItems: () => void;
  /** How many items can be used now, for the button. */
  usableItemCount: number;
  /** How this Blobbi is drawn in the room (Classic or the 3D Model), chosen here and nowhere else (M14.2). */
  appearance?: { value: BlobbiAppearanceControlProps['appearance']; onChange: BlobbiAppearanceControlProps['onChange']; unavailable3d: string | null };
  /** The one-time guide (M14.3): the Appearance card is lit for a moment when the sheet opens, then `onAppearanceSeen`. */
  highlightAppearance?: boolean;
  onAppearanceSeen?: () => void;
  reducedMotion?: boolean;
}

/** The Appearance card, lit once by the guide: a glow that ends on its own, or at the first touch of the card. */
function AppearanceCard({ blobbi, appearance, highlight, onSeen, reducedMotion }: { blobbi: BlobbiCompanion; appearance: NonNullable<RoomBlobbiSheetProps['appearance']>; highlight: boolean; onSeen?: () => void; reducedMotion: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!highlight) return;
    ref.current?.scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    const t = setTimeout(() => onSeen?.(), LOOK_GUIDE_SHEET_MS);
    return () => clearTimeout(t);
  }, [highlight, onSeen, reducedMotion]);
  const shown = shownLook(appearance.value, appearance.unavailable3d);
  return (
    <section
      ref={ref}
      aria-labelledby="room-appearance-title"
      className={`overlay-card look-card ${highlight ? 'look-card--lit' : ''}`}
      data-testid="room-appearance-section"
      data-hint={highlight ? 'true' : undefined}
      data-reduced={reducedMotion ? 'true' : undefined}
      onPointerDownCapture={highlight ? onSeen : undefined}
      onFocusCapture={highlight ? onSeen : undefined}
    >
      <div className="look-card__head">
        <span className="look-card__icon" aria-hidden>
          <Palette className="h-5 w-5" />
        </span>
        <span className="look-card__text">
          <h3 id="room-appearance-title" className="look-card__title">
            Appearance
          </h3>
          <span className="look-card__sub">How {blobbi.name} looks in the 3D room. The same Blobbi either way, and only on this device.</span>
        </span>
        <span className="look-card__now" data-testid="room-appearance-current" data-appearance={shown}>
          {lookTitle(shown)}
        </span>
      </div>
      <BlobbiAppearanceControl appearance={appearance.value} onChange={appearance.onChange} unavailable3d={appearance.unavailable3d} preview={blobbi} reducedMotion={reducedMotion} />
    </section>
  );
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

export function RoomBlobbiSheet({ open, onClose, blobbi, mood, statItems, profile, companions, onSelect, lifecycle, ceremony, onCeremony, firstBlobbi, onOpenItems, usableItemCount, onOpenJourney, guest = false, appearance, highlightAppearance = false, onAppearanceSeen, reducedMotion = false }: RoomBlobbiSheetProps) {
  const portrait = (
    <span className="overlay-portrait" aria-hidden>
      <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`room-details-${blobbi.d}`} size="100%" isSleeping={blobbi.state === 'sleeping'} transparent style={{ width: '100%', height: '100%' }} />
    </span>
  );
  const chips = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip testId="room-stage-badge">{STAGE_LABEL[blobbi.stage]}</Chip>
      {blobbi.state === 'sleeping' && (
        <Chip tone="sleep" testId="room-state-badge">
          <Moon className="h-3.5 w-3.5" aria-hidden /> Sleeping
        </Chip>
      )}
      {blobbi.state === 'hibernating' && (
        <Chip tone="cold" testId="room-state-badge">
          <Snowflake className="h-3.5 w-3.5" aria-hidden /> Hibernating
        </Chip>
      )}
      {blobbi.state === 'active' && <Chip testId="room-state-badge">Awake</Chip>}
      {blobbi.progressionState !== 'none' && (
        <Chip tone="grow" testId="room-progression-badge">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {blobbi.progressionState === 'incubating' ? 'Incubating' : 'Evolving'}
        </Chip>
      )}
    </div>
  );

  return (
    <GameOverlay open={open} onClose={onClose} title={blobbi.name} testId="room-blobbi-sheet" lead={portrait} subtitle={chips} size="medium">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground" data-testid="room-mood-line">
          {blobbi.name} {mood}
        </p>

        <section aria-label="Condition and progress" className="overlay-card">
          <h3 className="overlay-card__title">Condition</h3>
          <BlobbiStatusPanel items={statItems} />
          <div className="mt-3 border-t border-border/60 pt-3">
            <ProgressionStrip blobbi={blobbi} profile={profile} />
          </div>
        </section>

        {appearance && <AppearanceCard blobbi={blobbi} appearance={appearance} highlight={highlightAppearance} onSeen={onAppearanceSeen} reducedMotion={reducedMotion} />}

        <button type="button" className="menu-tile" onClick={onOpenItems} data-testid="room-open-items">
          <span className="menu-tile__icon">
            <Backpack className="h-6 w-6" aria-hidden />
          </span>
          <span className="menu-tile__text">
            <span className="menu-tile__title">Items</span>
            <span className="menu-tile__sub">{usableItemCount > 0 ? `${usableItemCount} you can use now, and everything else you own.` : 'Everything you own, from every game.'}</span>
          </span>
        </button>

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

        <LifecyclePanel name={blobbi.name} lifecycle={lifecycle} ceremony={ceremony} onCeremony={onCeremony} firstBlobbi={firstBlobbi} embedded guest={guest} />


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
