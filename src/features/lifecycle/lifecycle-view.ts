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
import { t, tp } from '@/i18n';

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
 * The kit's hatch and evolve missions (its `HATCH_MISSIONS`, `EVOLVE_MISSIONS` and the evolve stat task), by id, so
 * their words follow the page's language; an id not listed here keeps the kit's own words.
 */
const MISSION_KEY = {
  create_theme: 'createTheme',
  color_moment: 'colorMoment',
  interactions: 'interactions',
  create_themes: 'createThemes',
  color_moments: 'colorMoments',
  edit_profile: 'editProfile',
  maintain_stats: 'maintainStats',
} as const;
type MissionKey = (typeof MISSION_KEY)[keyof typeof MISSION_KEY];

function missionKey(id: string): MissionKey | undefined {
  return Object.prototype.hasOwnProperty.call(MISSION_KEY, id) ? MISSION_KEY[id as keyof typeof MISSION_KEY] : undefined;
}

/** A mission's name and description in the page's language (the kit's words for one it does not know). */
export function missionText(task: Pick<HatchTask, 'id' | 'name' | 'description' | 'required'>): { name: string; description: string } {
  const key = missionKey(task.id);
  if (!key) return { name: task.name, description: task.description };
  const name = t(`home.missions.${key}.name`);
  switch (key) {
    case 'interactions':
      return { name, description: tp('home.missions.interactions.description', task.required) };
    case 'createThemes':
    case 'colorMoments':
      return { name, description: t(`home.missions.${key}.description`, { count: task.required }) };
    case 'maintainStats':
      return { name, description: t('home.missions.maintainStats.description', { value: task.required }) };
    default:
      return { name, description: t(`home.missions.${key}.description`) };
  }
}

/** A mission link's label in the page's language: the kit's for a mission it does not know, else a plain Open. */
function linkLabel(task: HatchTask, fallback: 'open' | 'openInDitto'): string {
  const key = missionKey(task.id);
  if (key === 'createTheme' || key === 'createThemes') return t('home.missions.link.createTheme');
  if (key === 'colorMoment' || key === 'colorMoments') return t('home.missions.link.openEspy');
  if (key === 'editProfile') return t('home.missions.link.editProfile');
  return task.actionLabel ?? t(`home.missions.link.${fallback}`);
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
    return { href: task.actionTarget, label: linkLabel(task, 'open') };
  }
  if (task.action === 'navigate') {
    if (!task.actionTarget.startsWith('/') || task.actionTarget.startsWith('//')) return undefined;
    return { href: `${dittoUrl.replace(/\/$/, '')}${task.actionTarget}`, label: linkLabel(task, 'openInDitto') };
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

/**
 * Standalone's rule (M14.1): a Blobbi grows up on its care alone. The kit's
 * mission sets pair the care tally with adventures made in other apps (a
 * theme in Ditto, a colour moment on espy, a profile tab); here those are
 * optional, and the transition is open once every mission that can be done
 * here (the care tally, a stat kept up: the ones with no link elsewhere) is
 * complete.
 * The transition itself is the kit's (`useBlobbiHatch` / `useBlobbiEvolve`,
 * the canonical event, the same on every device); only when the home
 * offers it is this app's, as the first egg's hatch already was.
 */
export function homeMissionsDone(tasks: readonly LifecycleTask[]): boolean {
  const here = tasks.filter((task) => !task.link);
  return here.length > 0 && here.every((task) => task.completed);
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
    ? source.tasks.map((task) => ({
        id: task.id,
        ...missionText(task),
        current: task.current,
        required: task.required,
        completed: task.completed,
        link: taskLink(task, dittoUrl),
      }))
    : [];
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const ready = !!active && total > 0 && (source.allCompleted || homeMissionsDone(tasks));

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
