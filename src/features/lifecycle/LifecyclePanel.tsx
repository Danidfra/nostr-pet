import { Check, Circle, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import type { Lifecycle } from './useLifecycle';
import type { CeremonyKind, CeremonyPhase } from './useLifecycleCeremony';
import type { LifecycleTask } from './lifecycle-view';

interface LifecyclePanelProps {
  name: string;
  lifecycle: Lifecycle;
  ceremony: { phase: CeremonyPhase; kind: CeremonyKind | null; error: Error | null; dismiss: () => void };
  /** Begin the hatch or evolve ceremony (the panel never publishes by itself). */
  onCeremony: (kind: CeremonyKind) => void;
  /** Dev-only: run a ceremony without the mission gate. Absent in production builds. */
  devForce?: (kind: CeremonyKind) => void;
  /** Inside a sheet: no glass container of its own. */
  embedded?: boolean;
}

function TaskRow({ task }: { task: LifecycleTask }) {
  return (
    <li className="flex items-center gap-3 py-1.5" data-testid={`lifecycle-task-${task.id}`} data-completed={task.completed ? 'true' : 'false'}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${task.completed ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-foreground/50'}`} aria-hidden>
        {task.completed ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{task.name}</span>
        <span className="block text-xs text-muted-foreground">
          {task.description}
          {task.required > 1 && (
            <span className="ml-1 font-medium text-foreground/70">
              {task.current}/{task.required}
            </span>
          )}
        </span>
      </span>
      {!task.completed && task.link && (
        <a
          href={task.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {task.link.label}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </li>
  );
}

/**
 * Where this Blobbi is on egg → baby → adult, and the one next step. The
 * canonical missions are listed as the kit reports them; the panel never
 * invents a rule. Hatch and evolve start a ceremony in the scene; the
 * semantic write happens inside it, only once, and only after the build-up.
 */
export function LifecyclePanel({ name, lifecycle, ceremony, onCeremony, devForce, embedded = false }: LifecyclePanelProps) {
  const { view, pending, error, clearError } = lifecycle;
  const busy = pending !== null || (ceremony.phase !== 'idle' && ceremony.phase !== 'failed');
  const ceremonyKind: CeremonyKind = view.stage === 'egg' ? 'hatch' : 'evolve';

  const heading = (() => {
    switch (view.next) {
      case 'start-incubation':
        return `${name} is snug in its shell.`;
      case 'incubate':
        return `${name} is incubating.`;
      case 'hatch':
        return `${name} is ready to hatch!`;
      case 'start-evolution':
        return `${name} is growing up.`;
      case 'evolve-tasks':
        return `${name} is getting ready to evolve.`;
      case 'evolve':
        return `${name} is ready to evolve!`;
      case 'grown':
        return `${name} is fully grown.`;
    }
  })();

  const button = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-11';
  const primary = `${button} bg-primary text-primary-foreground hover:brightness-110`;
  const secondary = `${button} border border-border bg-background hover:bg-accent`;

  return (
    <section className={embedded ? 'rounded-2xl bg-foreground/5 px-3 py-3' : 'home-glass mx-auto w-full max-w-2xl rounded-3xl px-4 py-4 sm:px-6'} aria-label="Lifecycle" data-testid="lifecycle-panel" data-next={view.next}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{heading}</h2>
        {view.process !== 'none' && view.total > 0 && (
          <span className="text-xs font-medium text-muted-foreground" data-testid="lifecycle-progress">
            {view.completed} of {view.total} done
          </span>
        )}
      </div>

      {view.tasks.length > 0 && (
        <ul className="mt-2 divide-y divide-border/60" aria-label="Missions">
          {view.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}

      {view.next === 'start-incubation' && (
        <p className="mt-1 text-sm text-muted-foreground">Start incubating to begin the missions that lead to hatching.</p>
      )}
      {view.next === 'start-evolution' && (
        <p className="mt-1 text-sm text-muted-foreground">Start evolution to begin the missions that lead to the adult form.</p>
      )}
      {view.next === 'grown' && <p className="mt-1 text-sm text-muted-foreground">The adult form came from the same seed it was born with.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.next === 'start-incubation' && (
          <button type="button" className={primary} disabled={busy} onClick={() => void lifecycle.startIncubation()} data-testid="lifecycle-start-incubation">
            {pending === 'start-incubation' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            Start incubation
          </button>
        )}
        {(view.next === 'incubate' || view.next === 'hatch') && (
          <>
            <button type="button" className={primary} disabled={busy || !view.ready} onClick={() => onCeremony('hatch')} data-testid="lifecycle-hatch" aria-disabled={busy || !view.ready}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Hatch
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void lifecycle.stopIncubation()} data-testid="lifecycle-stop-incubation">
              {pending === 'stop-incubation' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Stop incubating
            </button>
          </>
        )}
        {view.next === 'start-evolution' && (
          <button type="button" className={primary} disabled={busy} onClick={() => void lifecycle.startEvolution()} data-testid="lifecycle-start-evolution">
            {pending === 'start-evolution' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            Start evolution
          </button>
        )}
        {(view.next === 'evolve-tasks' || view.next === 'evolve') && (
          <>
            <button type="button" className={primary} disabled={busy || !view.ready} onClick={() => onCeremony('evolve')} data-testid="lifecycle-evolve" aria-disabled={busy || !view.ready}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Evolve
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void lifecycle.stopEvolution()} data-testid="lifecycle-stop-evolution">
              {pending === 'stop-evolution' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Stop evolving
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
            Dismiss
          </button>
        </p>
      )}
    </section>
  );
}
