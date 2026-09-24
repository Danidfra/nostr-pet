import { describe, expect, it } from 'vitest';
import type { HatchTask } from '@blobbi-kit/react';
import { buildLifecycleView, eggCrackForProgress, taskLink } from './lifecycle-view';

const task = (id: string, current: number, required: number, extra: Partial<HatchTask> = {}): HatchTask => ({
  id,
  name: id,
  description: `do ${id}`,
  current,
  required,
  completed: current >= required,
  type: 'persistent',
  ...extra,
});
const none = { tasks: [], allCompleted: false, isLoading: false };
const DITTO = 'https://ditto.pub';

describe('eggCrackForProgress', () => {
  it('grows with completed missions and is heavy only when the kit says ready', () => {
    expect(eggCrackForProgress(0, 3, false)).toBe('none');
    expect(eggCrackForProgress(1, 3, false)).toBe('light');
    expect(eggCrackForProgress(2, 3, false)).toBe('medium');
    expect(eggCrackForProgress(3, 3, false)).toBe('medium'); // ready is the kit's word, not a ratio
    expect(eggCrackForProgress(3, 3, true)).toBe('heavy');
    expect(eggCrackForProgress(0, 0, false)).toBe('none');
  });
});

describe('taskLink', () => {
  it('turns Ditto routes and external links into links, and nothing else', () => {
    expect(taskLink(task('t', 0, 1, { action: 'navigate', actionTarget: '/themes', actionLabel: 'Create Theme' }), DITTO)).toEqual({ href: 'https://ditto.pub/themes', label: 'Create Theme' });
    expect(taskLink(task('c', 0, 1, { action: 'external_link', actionTarget: 'https://espy.you/', actionLabel: 'Open espy' }), `${DITTO}/`)).toEqual({ href: 'https://espy.you/', label: 'Open espy' });
    expect(taskLink(task('m', 0, 1, { action: 'open_modal', actionTarget: 'x' }), DITTO)).toBeUndefined();
    expect(taskLink(task('i', 0, 7), DITTO)).toBeUndefined();
  });
});

describe('buildLifecycleView', () => {
  it('an egg that is not incubating waits to start', () => {
    const v = buildLifecycleView({ companion: { stage: 'egg', progressionState: 'none' }, hatch: none, evolve: none, dittoUrl: DITTO });
    expect(v.next).toBe('start-incubation');
    expect(v.tasks).toEqual([]);
    expect(v.eggCrack).toBe('none');
  });

  it('an incubating egg shows the hatch missions and cracks as they complete', () => {
    const hatch = { tasks: [task('create_theme', 1, 1), task('color_moment', 0, 1), task('interactions', 3, 7)], allCompleted: false, isLoading: false };
    const v = buildLifecycleView({ companion: { stage: 'egg', progressionState: 'incubating' }, hatch, evolve: none, dittoUrl: DITTO });
    expect(v.next).toBe('incubate');
    expect(v.completed).toBe(1);
    expect(v.total).toBe(3);
    expect(v.ready).toBe(false);
    expect(v.eggCrack).toBe('light');
    expect(v.tasks[2]).toMatchObject({ id: 'interactions', current: 3, required: 7, completed: false });
  });

  it('an incubating egg with every mission done is ready to hatch and heavily cracked', () => {
    const hatch = { tasks: [task('create_theme', 1, 1), task('color_moment', 1, 1), task('interactions', 7, 7)], allCompleted: true, isLoading: false };
    const v = buildLifecycleView({ companion: { stage: 'egg', progressionState: 'incubating' }, hatch, evolve: none, dittoUrl: DITTO });
    expect(v.next).toBe('hatch');
    expect(v.ready).toBe(true);
    expect(v.eggCrack).toBe('heavy');
  });

  it('a baby follows the evolve missions and an adult is grown', () => {
    expect(buildLifecycleView({ companion: { stage: 'baby', progressionState: 'none' }, hatch: none, evolve: none, dittoUrl: DITTO }).next).toBe('start-evolution');
    const evolving = { tasks: [task('interactions', 21, 21), task('maintain_stats', 0, 1, { type: 'dynamic' })], allCompleted: false, isLoading: true };
    const v = buildLifecycleView({ companion: { stage: 'baby', progressionState: 'evolving' }, hatch: none, evolve: evolving, dittoUrl: DITTO });
    expect(v.next).toBe('evolve-tasks');
    expect(v.isLoading).toBe(true);
    expect(v.eggCrack).toBe('none');
    const ready = { ...evolving, tasks: evolving.tasks.map((t) => ({ ...t, current: t.required, completed: true })), allCompleted: true };
    expect(buildLifecycleView({ companion: { stage: 'baby', progressionState: 'evolving' }, hatch: none, evolve: ready, dittoUrl: DITTO }).next).toBe('evolve');
    expect(buildLifecycleView({ companion: { stage: 'adult', progressionState: 'none' }, hatch: none, evolve: none, dittoUrl: DITTO }).next).toBe('grown');
  });

  it('never reads the wrong task source for a stage', () => {
    const wrong = { tasks: [task('interactions', 21, 21)], allCompleted: true, isLoading: false };
    const v = buildLifecycleView({ companion: { stage: 'egg', progressionState: 'incubating' }, hatch: none, evolve: wrong, dittoUrl: DITTO });
    expect(v.ready).toBe(false);
    expect(v.tasks).toEqual([]);
  });
});
