/**
 * The lifecycle as one view the home can render: where this Blobbi is on
 * egg → baby → adult, which canonical missions stand between it and the
 * next stage, and what the one next action is.
 *
 * Every rule here is the kit's (`useHatchTasks` / `useEvolveTasks` decide
 * completion); this module only folds their results into words and into
 * the renderer's egg crack vocabulary. Pure.
 */
import type { BlobbiCompanion } from '@blobbi-kit/core';
import type { HatchTask } from '@blobbi-kit/react';
import type { BlobbiEggCrack } from '@blobbi-kit/renderer';

export type LifecycleProcess = 'none' | 'incubating' | 'evolving';

/** The one thing the player can do next about the lifecycle. */
export type LifecycleNext =
  | 'start-incubation' // egg, not incubating
  | 'incubate' // egg, incubating, missions pending
  | 'hatch' // egg, incubating, every mission complete
  | 'start-evolution' // baby, not evolving
  | 'evolve-tasks' // baby, evolving, missions pending
  | 'evolve' // baby, evolving, every mission complete
  | 'grown'; // adult

export interface LifecycleTaskLink {
  href: string;
  label: string;
}

export interface LifecycleTask {
  id: string;
  name: string;
  description: string;
  current: number;
  required: number;
  completed: boolean;
  /** Where to go to complete it, when it is not done here. */
  link?: LifecycleTaskLink;
}

export interface LifecycleView {
  stage: BlobbiCompanion['stage'];
  process: LifecycleProcess;
  next: LifecycleNext;
  tasks: LifecycleTask[];
  completed: number;
  total: number;
  /** Every mission the kit requires for the pending transition is complete. */
  ready: boolean;
  /** The shell as the renderer should draw it (eggs only; `'none'` otherwise). */
  eggCrack: BlobbiEggCrack;
  isLoading: boolean;
}

export interface TaskSource {
  tasks: readonly HatchTask[];
  allCompleted: boolean;
  isLoading: boolean;
}

/**
 * Turn a kit task's action into a link the home can offer. `navigate` targets
 * are Ditto routes (the missions were designed there); `external_link` is
 * used as-is; `open_modal` has no equivalent here.
 */
export function taskLink(task: HatchTask, dittoUrl: string): LifecycleTaskLink | undefined {
  if (!task.actionTarget) return undefined;
  if (task.action === 'external_link') {
    // The targets are the kit's own bundled mission data, but a link the home
    // renders is only ever an absolute http(s) URL; anything else is dropped.
    if (!isHttpUrl(task.actionTarget)) return undefined;
    return { href: task.actionTarget, label: task.actionLabel ?? 'Open' };
  }
  if (task.action === 'navigate') {
    if (!task.actionTarget.startsWith('/') || task.actionTarget.startsWith('//')) return undefined;
    return { href: `${dittoUrl.replace(/\/$/, '')}${task.actionTarget}`, label: task.actionLabel ?? 'Open in Ditto' };
  }
  return undefined;
}

function isHttpUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * How cracked the shell looks for a hatch progress. Progress feedback, not a
 * gate: the cracks grow with completed missions and the shell is `'heavy'`
 * only when the kit says every mission is done.
 */
export function eggCrackForProgress(completed: number, total: number, ready: boolean): BlobbiEggCrack {
  if (ready) return 'heavy';
  if (total <= 0) return 'none';
  const ratio = completed / total;
  if (ratio >= 2 / 3) return 'medium';
  if (ratio >= 1 / 3) return 'light';
  return 'none';
}

export interface BuildLifecycleViewInput {
  companion: Pick<BlobbiCompanion, 'stage' | 'progressionState'>;
  hatch: TaskSource;
  evolve: TaskSource;
  dittoUrl: string;
}

export function buildLifecycleView({ companion, hatch, evolve, dittoUrl }: BuildLifecycleViewInput): LifecycleView {
  const { stage } = companion;
  const process: LifecycleProcess =
    companion.progressionState === 'incubating' || companion.progressionState === 'evolving' ? companion.progressionState : 'none';

  const source = stage === 'egg' ? hatch : stage === 'baby' ? evolve : undefined;
  const active = source && process !== 'none';
  const tasks: LifecycleTask[] = active
    ? source.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        current: t.current,
        required: t.required,
        completed: t.completed,
        link: taskLink(t, dittoUrl),
      }))
    : [];
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const ready = !!active && source.allCompleted && total > 0;

  let next: LifecycleNext;
  if (stage === 'adult') next = 'grown';
  else if (stage === 'egg') next = process === 'incubating' ? (ready ? 'hatch' : 'incubate') : 'start-incubation';
  else next = process === 'evolving' ? (ready ? 'evolve' : 'evolve-tasks') : 'start-evolution';

  return {
    stage,
    process,
    next,
    tasks,
    completed,
    total,
    ready,
    eggCrack: stage === 'egg' && process === 'incubating' ? eggCrackForProgress(completed, total, ready) : 'none',
    isLoading: !!active && source.isLoading,
  };
}
