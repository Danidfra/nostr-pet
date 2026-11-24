import { Check, Circle, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import type { Lifecycle } from './useLifecycle';
import type { CeremonyKind, CeremonyPhase } from './useLifecycleCeremony';
import type { LifecycleTask, LifecycleView } from './lifecycle-view';
import { INTERACTIONS_MISSION_ID } from './mission-tally';
import { t, tp } from '@/i18n';
import { stageLabel } from '@/features/home/labels';

interface LifecyclePanelProps {
  name: string;
  lifecycle: Lifecycle;
  ceremony: { phase: CeremonyPhase; kind: CeremonyKind | null; error: Error | null; dismiss: () => void };
  /** Begin the hatch or evolve ceremony (the panel never publishes by itself). */
  onCeremony: (kind: CeremonyKind) => void;
  /**
   * This egg is the account's first Blobbi (`first-blobbi.ts`): it hatches
   * without missions, so the panel offers the hatch itself and no incubation.
   */
  firstBlobbi?: boolean;
  /** Dev-only: run a ceremony without the mission gate. Absent in production builds. */
  devForce?: (kind: CeremonyKind) => void;
  /** Inside a sheet: no glass container of its own. */
  embedded?: boolean;
  /** A guest's Blobbi (M14): the lifecycle runs on this device, and the panel says so in a line. */
  guest?: boolean;
}

const STAGES: readonly LifecycleView['stage'][] = ['egg', 'baby', 'adult'];
const STAGE_INDEX: Record<LifecycleView['stage'], number> = { egg: 0, baby: 1, adult: 2 };

/** Egg → Baby → Adult, the one reached lit, the ones before it ticked. */
function StageTrack({ stage }: { stage: LifecycleView['stage'] }) {
  const at = STAGE_INDEX[stage];
  return (
    <ol className="stage-track" aria-label={t('home.lifecycle.stages')} data-testid="stage-track" data-stage={stage}>
      {STAGES.map((s, i) => (
        <li key={s} className={`stage-track__step ${i < at ? 'stage-track__step--past' : i === at ? 'stage-track__step--now' : 'stage-track__step--next'}`} aria-current={i === at ? 'step' : undefined} data-testid={`stage-${s}`}>
          <span className="stage-track__dot" aria-hidden>
            {i < at ? <Check /> : i === at ? <Sparkles /> : ''}
          </span>
          <span className="stage-track__label">{stageLabel(s)}</span>
        </li>
      ))}
    </ol>
  );
}

/** One mission: done here, to do here, or an adventure elsewhere (a link, optional for now). */
function TaskRow({ task }: { task: LifecycleTask }) {
  const here = !task.link;
  return (
    <li className={`mission ${task.completed ? 'mission--done' : ''} ${here ? '' : 'mission--away'}`} data-testid={`lifecycle-task-${task.id}`} data-completed={task.completed ? 'true' : 'false'} data-here={here ? 'true' : 'false'}>
      <span className="mission__mark" aria-hidden>
        {task.completed ? <Check /> : <Circle />}
      </span>
      <span className="mission__text">
        <span className="mission__name">
          {task.name}
          {!here && <span className="mission__badge">{t('home.lifecycle.elsewhere')}</span>}
        </span>
        <span className="mission__detail">{task.description}</span>
        {task.required > 1 && (
          <span className="journey-progress" role="progressbar" aria-valuemin={0} aria-valuemax={task.required} aria-valuenow={Math.min(task.current, task.required)} aria-label={t('home.lifecycle.taskProgress', { name: task.name, current: Math.min(task.current, task.required), required: task.required })}>
            <span className="journey-progress__bar" style={{ width: `${Math.round((Math.min(task.current, task.required) / Math.max(1, task.required)) * 100)}%` }} />
            <span className="journey-progress__count">
              {Math.min(task.current, task.required)}/{task.required}
            </span>
          </span>
        )}
      </span>
      {!task.completed && task.link && (
        <a href={task.link.href} target="_blank" rel="noopener noreferrer" className="mission__go">
          {task.link.label}
          <ExternalLink aria-hidden />
        </a>
      )}
    </li>
  );
}

/**
 * Where this Blobbi is on egg → baby → adult, and the one next step, as a
 * moment of the game rather than a list (M14.1): the three stages as a
 * track, the missions as what to do here (the care, counted) and what is
 * an adventure elsewhere (optional for now: Standalone lets a Blobbi grow
 * up on its care alone, `lifecycle-view.ts`), then the one button. Hatch
 * and evolve start a ceremony in the scene; the semantic write happens
 * inside it, only once, and only after the build-up. A guest's lifecycle
 * runs the same, on this device.
 */
export function LifecyclePanel({ name, lifecycle, ceremony, onCeremony, firstBlobbi = false, devForce, embedded = false, guest = false }: LifecyclePanelProps) {
  const { view: kitView, pending, error, clearError } = lifecycle;
  // A first Blobbi's egg skips the missions: the panel shows the hatch and nothing that leads up to it.
  const first = firstBlobbi && kitView.stage === 'egg';
  const view = first ? { ...kitView, next: 'hatch' as const, tasks: [], ready: true, process: 'none' as const } : kitView;
  const busy = pending !== null || (ceremony.phase !== 'idle' && ceremony.phase !== 'failed');
  const ceremonyKind: CeremonyKind = view.stage === 'egg' ? 'hatch' : 'evolve';
  const care = view.tasks.find((task) => task.id === INTERACTIONS_MISSION_ID);

  const heading = (() => {
    switch (view.next) {
      case 'start-incubation':
        return t('home.lifecycle.heading.startIncubation', { name });
      case 'incubate':
        return t('home.lifecycle.heading.incubate', { name });
      case 'hatch':
        return t('home.lifecycle.heading.hatch', { name });
      case 'start-evolution':
        return t('home.lifecycle.heading.startEvolution', { name });
      case 'evolve-tasks':
        return t('home.lifecycle.heading.evolveTasks', { name });
      case 'evolve':
        return t('home.lifecycle.heading.evolve', { name });
      case 'grown':
        return t('home.lifecycle.heading.grown', { name });
    }
  })();
  const line = (() => {
    if (first) return t('home.lifecycle.line.first');
    switch (view.next) {
      case 'start-incubation':
        return t('home.lifecycle.line.startIncubation');
      case 'incubate':
        return care && !care.completed ? tp('home.lifecycle.line.incubateCare', Math.max(0, care.required - care.current), { name }) : t('home.lifecycle.line.almost');
      case 'hatch':
        return t('home.lifecycle.line.hatch');
      case 'start-evolution':
        return t('home.lifecycle.line.startEvolution', { name });
      case 'evolve-tasks':
        return care && !care.completed ? tp('home.lifecycle.line.evolveCare', Math.max(0, care.required - care.current), { name }) : t('home.lifecycle.line.careDone');
      case 'evolve':
        return t('home.lifecycle.line.evolve', { name });
      case 'grown':
        return t('home.lifecycle.line.grown');
    }
  })();

  const button = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-11';
  const primary = `${button} bg-primary text-primary-foreground hover:brightness-110`;
  const secondary = `${button} border border-border bg-background hover:bg-accent`;

  return (
    <section className={embedded ? 'rounded-2xl bg-foreground/5 px-3 py-3' : 'home-glass mx-auto w-full max-w-2xl rounded-3xl px-4 py-4 sm:px-6'} aria-label={t('home.lifecycle.label')} data-testid="lifecycle-panel" data-next={view.next} data-first-blobbi={first ? 'true' : undefined} data-ready={view.ready ? 'true' : 'false'}>
      <StageTrack stage={view.stage} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{heading}</h2>
        {view.process !== 'none' && view.total > 0 && (
          <span className="text-xs font-medium text-muted-foreground" data-testid="lifecycle-progress">
            {t('home.lifecycle.progress', { completed: view.completed, total: view.total })}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="lifecycle-line">
        {line}
      </p>

      {view.tasks.length > 0 && (
        <ul className="mt-2 missions" aria-label={t('home.lifecycle.missions')}>
          {view.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}

      {first && (
        <p className="sr-only" data-testid="lifecycle-first-blobbi">
          {t('home.lifecycle.firstSr')}
        </p>
      )}
      {guest && view.stage !== 'adult' && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="lifecycle-guest-note">
          {t('home.lifecycle.guestNote', { name })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.next === 'start-incubation' && (
          <button type="button" className={primary} disabled={busy} onClick={() => void lifecycle.startIncubation()} data-testid="lifecycle-start-incubation">
            {pending === 'start-incubation' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {t('home.lifecycle.startIncubation')}
          </button>
        )}
        {(view.next === 'incubate' || view.next === 'hatch') && (
          <>
            <button type="button" className={primary} disabled={busy || !view.ready} onClick={() => onCeremony('hatch')} data-testid="lifecycle-hatch" aria-disabled={busy || !view.ready}>
              <Sparkles className="h-4 w-4" aria-hidden />
              {t('home.lifecycle.hatch')}
            </button>
            {!first && (
              <button type="button" className={secondary} disabled={busy} onClick={() => void lifecycle.stopIncubation()} data-testid="lifecycle-stop-incubation">
                {pending === 'stop-incubation' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {t('home.lifecycle.stopIncubating')}
              </button>
            )}
          </>
        )}
        {view.next === 'start-evolution' && (
          <button type="button" className={primary} disabled={busy} onClick={() => void lifecycle.startEvolution()} data-testid="lifecycle-start-evolution">
            {pending === 'start-evolution' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {t('home.lifecycle.startEvolution')}
          </button>
        )}
        {(view.next === 'evolve-tasks' || view.next === 'evolve') && (
          <>
            <button type="button" className={primary} disabled={busy || !view.ready} onClick={() => onCeremony('evolve')} data-testid="lifecycle-evolve" aria-disabled={busy || !view.ready}>
              <Sparkles className="h-4 w-4" aria-hidden />
              {t('home.lifecycle.evolve')}
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void lifecycle.stopEvolution()} data-testid="lifecycle-stop-evolution">
              {pending === 'stop-evolution' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {t('home.lifecycle.stopEvolving')}
            </button>
          </>
        )}
        {devForce && view.stage !== 'adult' && (
          <button type="button" className={`${secondary} border-dashed text-xs`} disabled={busy} onClick={() => devForce(ceremonyKind)} data-testid="lifecycle-dev-force">
            Force {ceremonyKind} (dev)
          </button>
        )}
      </div>

      {(error || ceremony.error) && (
        <p role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-card/90 px-3 py-2 text-sm text-destructive" data-testid="lifecycle-error">
          <span>{(ceremony.error ?? error)?.message}</span>
          <button
            type="button"
            className="text-xs font-semibold underline"
            onClick={() => {
              clearError();
              ceremony.dismiss();
            }}
          >
            {t('home.lifecycle.dismiss')}
          </button>
        </p>
      )}
    </section>
  );
}
