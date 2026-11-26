/**
 * The player's journey with their Blobbis, as four chapters of small things
 * to do. Pure: every objective is DERIVED from facts the app already has; the
 * journey stores no progress of its own and grants nothing the protocol
 * does not.
 *
 * Where each fact comes from, and what that means:
 *
 *   NOSTR (canonical, every device, every Blobbi app):
 *     owned / hatched / adults     the player's kind 31124 collection (stages)
 *     fed / played / bathed /      the player's kind 1124 interaction receipts
 *       medicine / drink           (`action` tag), written by every care here
 *                                  and in the other Blobbi apps
 *     days of care                 the local calendar days those receipts were
 *                                  made on (any two days: never "in a row", so
 *                                  a day off never undoes anything)
 *     evolution missions           the kit's own evolve tasks for this Blobbi
 *                                  (`useEvolveTasks`: the canonical rule)
 *     Blobbonaut level             the kind 11125 `xp` tag → `xpToLevel`, earned
 *                                  with the kit's daily missions (here too
 *                                  since M12.1: `features/progression`)
 *     how many Blobbis allowed     the kit's `getUnlocks(level).maxBlobbis`
 *   DEVICE (this browser only; a nice touch, never a gate):
 *     first cuddle                 a stroke that became petting (petting is never written)
 *     a nap                        a rest that landed (rest writes no receipt)
 *
 * Nothing on the device unlocks anything: the only unlock in the journey
 * (another egg) is the kit's own rule over the canonical level. A chapter's
 * "reward" is what it opens, never an item or a number the protocol does not
 * hold.
 */
import type { LifecycleTask } from '@/features/lifecycle';
import { t } from '@/i18n';

export type ChapterId = 'beginning' | 'first-steps' | 'growing' | 'family';
export type ObjectiveSource = 'nostr' | 'device';
export type CareAction = 'feed' | 'play' | 'clean' | 'medicate' | 'boost';

/** Where an objective can be done, when it can be done in this home. */
export type ObjectiveAction =
  | { kind: 'room'; room: 'kitchen' | 'home' | 'care' | 'rest' }
  | { kind: 'details' }
  | { kind: 'adopt' }
  | { kind: 'link'; href: string; label: string };

/**
 * Where an objective stands, for the player: finished; started (some progress); there to do; done for today and
 * waiting for another day (time, not effort, is what is missing); or in a chapter not opened yet.
 */
export type ObjectiveStatus = 'done' | 'in-progress' | 'available' | 'waiting' | 'locked';

export interface Objective {
  id: string;
  title: string;
  /** How to do it, in a sentence. */
  hint: string;
  done: boolean;
  status: ObjectiveStatus;
  /** What the wait is for, when it is waiting on time. */
  waitingFor?: string;
  /** Counted progress, when it has a count. */
  progress?: { current: number; required: number };
  source: ObjectiveSource;
  action?: ObjectiveAction;
}

export interface Chapter {
  id: ChapterId;
  number: number;
  title: string;
  /** One line of story. */
  story: string;
  objectives: Objective[];
  /** What finishing it opens. */
  opens: string;
  status: 'done' | 'current' | 'locked';
}

export interface JourneyFacts {
  /** Stages of every Blobbi the player owns. */
  stages: readonly ('egg' | 'baby' | 'adult')[];
  /** The Blobbi in the room now. */
  current: { stage: 'egg' | 'baby' | 'adult'; progressionState: string };
  /** Kinds of care the player has ever given (kind 1124 actions), any Blobbi, any app. Undefined while unknown. */
  careGiven: ReadonlySet<CareAction> | undefined;
  /** The distinct local calendar days the player gave care on (kind 1124 receipts), and whether today is one. */
  careDays?: { count: number; today: boolean };
  device: { petted: boolean; napped: boolean };
  /** The kit's evolve tasks for the current Blobbi, when it is a baby on its way to growing up. */
  evolveTasks: readonly LifecycleTask[];
  /** Blobbonaut XP (kind 11125), undefined when there is no profile yet. */
  xp: number | undefined;
  level: number;
  maxBlobbis: number;
}

/** XP needed for the level the second Blobbi opens at (`getUnlocks`: level 5 → two Blobbis). */
export const SECOND_BLOBBI_LEVEL = 5;
export const SECOND_BLOBBI_XP = 850;
/** Days of care for "Two days together": any two different days, never "in a row". */
export const CARE_DAYS_NEEDED = 2;

type Draft = Omit<Objective, 'status'>;

export function buildJourney(f: JourneyFacts): Chapter[] {
  const owned = f.stages.length;
  const hatched = f.stages.filter((s) => s !== 'egg').length;
  const adults = f.stages.filter((s) => s === 'adult').length;
  const cared = (a: CareAction) => !!f.careGiven?.has(a);
  const careKnown = f.careGiven !== undefined;

  const beginning: Draft[] = [
    { id: 'adopt', title: t('world.journey.objectives.adopt.title'), hint: t('world.journey.objectives.adopt.hint'), done: owned >= 1, source: 'nostr' },
    { id: 'hatch', title: t('world.journey.objectives.hatch.title'), hint: t('world.journey.objectives.hatch.hint'), done: hatched >= 1, source: 'nostr' },
    { id: 'cuddle', title: t('world.journey.objectives.cuddle.title'), hint: t('world.journey.objectives.cuddle.hint'), done: f.device.petted, source: 'device' },
  ];

  const days = f.careDays?.count ?? 0;
  const firstSteps: Draft[] = [
    { id: 'feed', title: t('world.journey.objectives.feed.title'), hint: t('world.journey.objectives.feed.hint'), done: careKnown && cared('feed'), source: 'nostr', action: { kind: 'room', room: 'kitchen' } },
    { id: 'play', title: t('world.journey.objectives.play.title'), hint: t('world.journey.objectives.play.hint'), done: careKnown && cared('play'), source: 'nostr', action: { kind: 'room', room: 'home' } },
    { id: 'clean', title: t('world.journey.objectives.clean.title'), hint: t('world.journey.objectives.clean.hint'), done: careKnown && cared('clean'), source: 'nostr', action: { kind: 'room', room: 'care' } },
    { id: 'nap', title: t('world.journey.objectives.nap.title'), hint: t('world.journey.objectives.nap.hint'), done: f.device.napped, source: 'device', action: { kind: 'room', room: 'rest' } },
    {
      id: 'two-days',
      title: t('world.journey.objectives.twoDays.title'),
      hint: t('world.journey.objectives.twoDays.hint'),
      done: days >= CARE_DAYS_NEEDED,
      progress: { current: Math.min(CARE_DAYS_NEEDED, days), required: CARE_DAYS_NEEDED },
      source: 'nostr',
      // Cared for today and still a day short: nothing more to do today but come back
      waitingFor: days < CARE_DAYS_NEEDED && f.careDays?.today ? t('world.journey.objectives.twoDays.waiting') : undefined,
    },
  ];

  const evolving = f.current.stage === 'baby' && f.current.progressionState === 'evolving';
  const growing: Draft[] = [
    {
      id: 'start-growing',
      title: t('world.journey.objectives.startGrowing.title'),
      hint: t('world.journey.objectives.startGrowing.hint'),
      done: adults >= 1 || evolving,
      source: 'nostr',
      action: { kind: 'details' },
    },
    ...(evolving && adults === 0
      ? f.evolveTasks.map<Draft>((task) => ({
          id: `evolve:${task.id}`,
          title: task.name,
          hint: task.description,
          done: task.completed,
          progress: task.required > 1 ? { current: Math.min(task.current, task.required), required: task.required } : undefined,
          source: 'nostr',
          action: task.link ? { kind: 'link', href: task.link.href, label: task.link.label } : undefined,
        }))
      : []),
    { id: 'grown', title: t('world.journey.objectives.grown.title'), hint: t('world.journey.objectives.grown.hint'), done: adults >= 1, source: 'nostr', action: { kind: 'details' } },
  ];

  const family: Draft[] = [
    {
      id: 'level',
      title: t('world.journey.objectives.level.title', { level: SECOND_BLOBBI_LEVEL }),
      hint: t('world.journey.objectives.level.hint'),
      done: f.level >= SECOND_BLOBBI_LEVEL || owned >= 2,
      progress: { current: Math.min(f.xp ?? 0, SECOND_BLOBBI_XP), required: SECOND_BLOBBI_XP },
      source: 'nostr',
    },
    {
      id: 'second-egg',
      title: t('world.journey.objectives.secondEgg.title'),
      hint: t('world.journey.objectives.secondEgg.hint'),
      done: owned >= 2,
      source: 'nostr',
      action: f.maxBlobbis > owned ? { kind: 'adopt' } : undefined,
    },
    { id: 'second-hatch', title: t('world.journey.objectives.secondHatch.title'), hint: t('world.journey.objectives.secondHatch.hint'), done: hatched >= 2, source: 'nostr', action: { kind: 'details' } },
  ];

  const raw: (Omit<Chapter, 'status' | 'objectives'> & { objectives: Draft[] })[] = [
    { id: 'beginning', number: 1, title: t('world.journey.chapters.beginning.title'), story: t('world.journey.chapters.beginning.story'), objectives: beginning, opens: t('world.journey.chapters.beginning.opens') },
    { id: 'first-steps', number: 2, title: t('world.journey.chapters.firstSteps.title'), story: t('world.journey.chapters.firstSteps.story'), objectives: firstSteps, opens: t('world.journey.chapters.firstSteps.opens') },
    { id: 'growing', number: 3, title: t('world.journey.chapters.growing.title'), story: t('world.journey.chapters.growing.story'), objectives: growing, opens: t('world.journey.chapters.growing.opens') },
    { id: 'family', number: 4, title: t('world.journey.chapters.family.title'), story: t('world.journey.chapters.family.story'), objectives: family, opens: t('world.journey.chapters.family.opens') },
  ];
  // Chapters open in order; one is current; a chapter whose every canonical objective is done counts done whenever it is.
  // Device objectives (a cuddle, a nap) are shown and ticked but never hold a chapter back: another device, or a
  // cleared browser, must never see a different chapter.
  let currentFound = false;
  return raw.map((c) => {
    const complete = c.objectives.every((o) => o.done || o.source === 'device');
    let status: Chapter['status'];
    if (complete && !currentFound) status = 'done';
    else if (!currentFound) {
      currentFound = true;
      status = 'current';
    } else status = complete ? 'done' : 'locked';
    return { ...c, status, objectives: c.objectives.map((o) => ({ ...o, status: objectiveStatus(o, status) })) };
  });
}

/** Where one objective stands, in its chapter. */
function objectiveStatus(o: Draft, chapter: Chapter['status']): ObjectiveStatus {
  if (o.done) return 'done';
  if (chapter === 'locked') return 'locked';
  if (o.waitingFor) return 'waiting';
  if (o.progress && o.progress.current > 0) return 'in-progress';
  return 'available';
}

/** The chapter the player is on (the first not finished), or null when every chapter is done. */
export function currentChapter(chapters: readonly Chapter[]): Chapter | null {
  return chapters.find((c) => c.status === 'current') ?? null;
}

/** The next thing to do: the first unfinished objective of the current chapter. */
export function nextObjective(chapters: readonly Chapter[]): Objective | null {
  return currentChapter(chapters)?.objectives.find((o) => !o.done) ?? null;
}

/**
 * Chapters finished now that were not celebrated on this device before: each is celebrated once, ever, per player
 * and device, however often the page reloads or the same facts arrive again.
 */
export function newlyFinished(chapters: readonly Chapter[], celebrated: ReadonlySet<ChapterId>): ChapterId[] {
  return chapters.filter((c) => c.status === 'done' && !celebrated.has(c.id)).map((c) => c.id);
}
