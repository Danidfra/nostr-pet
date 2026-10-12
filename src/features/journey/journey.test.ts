/**
 * The chapters are derived, never stored: the same facts always give the
 * same chapters; device-only touches are ticked but never hold a chapter
 * back; the second egg opens only on the kit's unlock; a chapter is
 * celebrated once.
 */
import { describe, expect, it } from 'vitest';
import type { LifecycleTask } from '@/features/lifecycle';
import { buildJourney, currentChapter, newlyFinished, nextObjective, type CareAction, type JourneyFacts } from './journey';

const base: JourneyFacts = {
  stages: ['baby'],
  current: { stage: 'baby', progressionState: 'none' },
  careGiven: new Set<CareAction>(),
  careDays: { count: 0, today: false },
  device: { petted: false, napped: false },
  evolveTasks: [],
  xp: 0,
  level: 1,
  maxBlobbis: 1,
};
const facts = (patch: Partial<JourneyFacts> = {}): JourneyFacts => ({ ...base, ...patch });
const status = (f: JourneyFacts) => Object.fromEntries(buildJourney(f).map((c) => [c.id, c.status]));
const objective = (f: JourneyFacts, id: string) => buildJourney(f).flatMap((c) => c.objectives).find((o) => o.id === id)!;

describe('the journey', () => {
  it('a newcomer with an egg is on chapter 1, waiting for the hatch; the rest is locked', () => {
    const f = facts({ stages: ['egg'], current: { stage: 'egg', progressionState: 'incubating' } });
    expect(status(f)).toEqual({ beginning: 'current', 'first-steps': 'locked', growing: 'locked', family: 'locked' });
    expect(nextObjective(buildJourney(f))?.id).toBe('hatch');
  });

  it('a first cuddle and a nap (this device only) are ticked but never hold a chapter back', () => {
    const hatched = facts();
    expect(status(hatched).beginning).toBe('done');
    expect(objective(hatched, 'cuddle').done).toBe(false);
    expect(objective(facts({ device: { petted: true, napped: false } }), 'cuddle').done).toBe(true);
    // Chapter 2: the canonical things done, the nap not: done all the same
    const cared = facts({ careGiven: new Set<CareAction>(['feed', 'play', 'clean']), current: { stage: 'baby', progressionState: 'none' }, careDays: { count: 2, today: false } });
    expect(status(cared)['first-steps']).toBe('done');
    expect(objective(cared, 'nap').done).toBe(false);
  });

  it('care counts from the kind 1124 receipts; while they are unknown nothing is ticked', () => {
    const unknown = facts({ careGiven: undefined });
    expect(objective(unknown, 'feed').done).toBe(false);
    const fed = facts({ careGiven: new Set<CareAction>(['feed']) });
    expect(objective(fed, 'feed').done).toBe(true);
    expect(objective(fed, 'play').done).toBe(false);
    expect(objective(fed, 'feed').action).toEqual({ kind: 'room', room: 'kitchen' });
  });

  it('two days together: any two different days of care (not in a row), never undone by a day off', () => {
    const one = objective(facts({ careDays: { count: 1, today: false } }), 'two-days');
    expect(one).toMatchObject({ done: false, status: 'in-progress', progress: { current: 1, required: 2 } });
    expect(one.hint).toMatch(/do not have to be in a row/);
    // Cared for today, a day short: nothing more to do today, says so
    const today = objective(facts({ careDays: { count: 1, today: true } }), 'two-days');
    expect(today.status).toBe('waiting');
    expect(today.waitingFor).toMatch(/another day/);
    // Two days, however far apart (the receipts' days: a gap of a week is still two days)
    expect(objective(facts({ careDays: { count: 2, today: false } }), 'two-days')).toMatchObject({ done: true, status: 'done', progress: { current: 2, required: 2 } });
    expect(objective(facts({ careDays: { count: 9, today: true } }), 'two-days')).toMatchObject({ done: true, status: 'done', waitingFor: undefined });
    expect(objective(facts({ careDays: undefined }), 'two-days')).toMatchObject({ done: false, status: 'available' });
  });

  it('every objective says where it stands: done, in progress, to do, waiting on time, or locked in a closed chapter', () => {
    const f = facts({ stages: ['egg'], current: { stage: 'egg', progressionState: 'incubating' } });
    const chapters = buildJourney(f);
    expect(chapters[0].objectives.map((o) => [o.id, o.status])).toEqual([['adopt', 'done'], ['hatch', 'available'], ['cuddle', 'available']]);
    for (const c of chapters.slice(1)) for (const o of c.objectives) expect(o.status).toBe('locked');
    expect(objective(facts({ stages: ['adult'], current: { stage: 'adult', progressionState: 'none' }, careGiven: new Set<CareAction>(['feed', 'play', 'clean']), careDays: { count: 2, today: false }, xp: 300, level: 3 }), 'level').status).toBe('in-progress');
  });

  it('the level objective points at the daily missions that earn it, here as anywhere', () => {
    expect(objective(facts(), 'level').hint).toMatch(/Today's missions/);
    expect(objective(facts(), 'level').hint).not.toMatch(/does not award/);
  });

  it('growing up lists the kit\'s own evolve tasks while the baby is evolving, with their links', () => {
    const tasks: LifecycleTask[] = [
      { id: 'interactions', name: 'Care 21 times', description: 'Keep caring.', current: 5, required: 21, completed: false },
      { id: 'edit_profile', name: 'Edit your profile', description: 'On Ditto.', current: 0, required: 1, completed: false, link: { href: 'https://ditto.pub/settings/profile', label: 'Open Ditto' } },
    ] as LifecycleTask[];
    const cared = { careGiven: new Set<CareAction>(['feed', 'play', 'clean']) };
    const f = facts({ ...cared, current: { stage: 'baby', progressionState: 'evolving' }, careDays: { count: 2, today: false }, evolveTasks: tasks });
    const chapter = currentChapter(buildJourney(f))!;
    expect(chapter.id).toBe('growing');
    expect(chapter.objectives.map((o) => o.id)).toEqual(['start-growing', 'evolve:interactions', 'evolve:edit_profile', 'grown']);
    expect(objective(f, 'evolve:interactions').progress).toEqual({ current: 5, required: 21 });
    expect(objective(f, 'evolve:edit_profile').action).toEqual({ kind: 'link', href: 'https://ditto.pub/settings/profile', label: 'Open Ditto' });
    // Not evolving: no tasks shown, the way to start it
    expect(buildJourney(facts({ ...cared, current: { stage: 'baby', progressionState: 'none' }, careDays: { count: 2, today: false }, evolveTasks: tasks })).find((c) => c.id === 'growing')!.objectives.map((o) => o.id)).toEqual(['start-growing', 'grown']);
  });

  it('the second egg opens only when the kit\'s unlock allows another Blobbi, never from the journey itself', () => {
    const adult = { stages: ['adult'] as const, current: { stage: 'adult' as const, progressionState: 'none' }, careDays: { count: 3, today: false }, careGiven: new Set<CareAction>(['feed', 'play', 'clean']) };
    const locked = facts({ ...adult, stages: ['adult'], xp: 300, level: 3, maxBlobbis: 1 });
    expect(currentChapter(buildJourney(locked))?.id).toBe('family');
    expect(objective(locked, 'second-egg').action).toBeUndefined();
    expect(objective(locked, 'level').progress).toEqual({ current: 300, required: 850 });
    const open = facts({ ...adult, stages: ['adult'], xp: 900, level: 5, maxBlobbis: 2 });
    expect(objective(open, 'level').done).toBe(true);
    expect(objective(open, 'second-egg').action).toEqual({ kind: 'adopt' });
    // The second egg adopted: no more adopt button; hatching it is its own canonical incubation
    const two = facts({ ...adult, stages: ['adult', 'egg'], xp: 900, level: 5, maxBlobbis: 2 });
    expect(objective(two, 'second-egg')).toMatchObject({ done: true, action: undefined });
    expect(objective(two, 'second-hatch').done).toBe(false);
    expect(status(facts({ ...adult, stages: ['adult', 'baby'], xp: 900, level: 5, maxBlobbis: 2 })).family).toBe('done');
  });

  it('the same facts give the same chapters; each finished chapter is celebrated once', () => {
    const f = facts({ careGiven: new Set<CareAction>(['feed', 'play', 'clean']), current: { stage: 'baby', progressionState: 'none' }, careDays: { count: 2, today: false } });
    expect(buildJourney(f)).toEqual(buildJourney(f));
    const fresh = newlyFinished(buildJourney(f), new Set());
    expect(fresh).toEqual(['beginning', 'first-steps']);
    expect(newlyFinished(buildJourney(f), new Set(fresh))).toEqual([]);
  });
});
