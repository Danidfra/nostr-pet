/**
 * Dev fixture worlds: a Blobbi described by a small spec (stage, state,
 * stats, progression, missions), a profile, a few items, and an in-memory
 * "relay" that answers queries and swallows publishes, so every stage and
 * state can be looked at in the real app without a real account, a real
 * relay or a real write. Built from the same builders the tests use
 * (`src/test/*`), which shape events the way the producers do, and the
 * kit's own mission definitions, so a "hatch ready" fixture is ready by the
 * kit's rules and not by a number invented here. Only a dev bundle behind
 * `VITE_BLOBBI_DEV_TOOLS` loads it.
 */
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  KIND_BLOBBI_STATE,
  KIND_BLOBBONAUT_PROFILE,
  STAT_MAX,
  STAT_MIN,
  getTagValue,
  isMissionComplete,
  missionProgress,
  parseModernBlobbiEvent,
  serializeEvolutionContent,
  type BlobbiCompanion,
  type BlobbiProgressionState,
  type BlobbiStage,
  type BlobbiStats,
  type BlobbiVisualGeneration,
  type Mission,
} from '@blobbi-kit/core';
import { createEvolveMissions, createHatchMissions, findEvolutionMission } from '@blobbi-kit/react';
import { isBlobbiEmotion, type BlobbiEmotion } from '@blobbi-kit/renderer';
import { CREATED_AT, PUBKEY, blobbiEvent, profileEvent } from '@/test/fixtures';
import { OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_SOAP, inventoryEvent, officialCareDefinition } from '@/test/inventory-fixtures';

export type FixtureName = 'egg' | 'baby' | 'adult' | 'adult-v2';
export const FIXTURE_NAMES: readonly FixtureName[] = ['egg', 'baby', 'adult', 'adult-v2'];
export const STAT_NAMES: readonly (keyof BlobbiStats)[] = ['hunger', 'happiness', 'hygiene', 'energy', 'health'];

export interface FixtureOptions {
  name: FixtureName;
  state?: 'active' | 'sleeping';
  /** A stat to put at a critical value, to see the poor-condition reactions. */
  low?: keyof BlobbiStats;
}

/** What `?fixture=…` asked for, plus the presentation pin the URL can carry. */
export interface FixtureRequest extends FixtureOptions {
  expression: BlobbiEmotion | null;
}

/**
 * Parse a query string into a fixture request. An unknown fixture name falls
 * back to the baby (a dev tool should show something and say so); an
 * unknown stat or expression is ignored.
 */
export function readFixtureRequest(search: string): FixtureRequest | null {
  const params = new URLSearchParams(search);
  const raw = params.get('fixture');
  if (raw === null) return null;
  const name = (FIXTURE_NAMES as readonly string[]).includes(raw) ? (raw as FixtureName) : 'baby';
  const state = params.get('state') === 'sleeping' ? ('sleeping' as const) : ('active' as const);
  const lowRaw = params.get('low');
  const low = lowRaw && (STAT_NAMES as readonly string[]).includes(lowRaw) ? (lowRaw as keyof BlobbiStats) : undefined;
  const expressionRaw = params.get('expression');
  const expression = expressionRaw && isBlobbiEmotion(expressionRaw) ? expressionRaw : null;
  return { name, state, low, expression };
}

/**
 * Mission progress as counts: how many of each the missions credit. The
 * hatch missions want one theme, one colour moment and seven interactions;
 * the evolve missions three, three, twenty-one and a profile edit
 * (`HATCH_MISSIONS` / `EVOLVE_MISSIONS` in the kit). Counts above a target
 * are clamped when written.
 */
export interface FixtureMissions {
  interactions: number;
  themes: number;
  colorMoments: number;
  editProfile: boolean;
}

/** Everything the fixture Blobbi is, in the model's own vocabulary. */
export interface FixtureSpec {
  name: string;
  stage: BlobbiStage;
  /** Which artwork family draws it (`visual_generation`). The adult FORM is not here: core derives it from the seed. */
  visualGeneration: BlobbiVisualGeneration;
  state: 'active' | 'sleeping';
  stats: BlobbiStats;
  careStreak: number;
  experience: number;
  progressionState: BlobbiProgressionState;
  missions: FixtureMissions;
}

export const FIXTURE_D = 'blobbi-aaaaaaaaaaaa-0000000001';
const PET_ID = '0000000001';
/**
 * When the fixture Blobbi was born. The seed, and with it the colours and
 * the adult form, derive from the birth time, so it is fixed: every rebuild
 * of the fixture is the same creature in a new state, never a new creature.
 */
export const FIXTURE_BORN_AT = CREATED_AT;
const DEFAULT_STATS: BlobbiStats = { hunger: 70, happiness: 72, hygiene: 68, energy: 75, health: 90 };
const LOW_VALUE = 8;
export const NO_MISSIONS: FixtureMissions = { interactions: 0, themes: 0, colorMoments: 0, editProfile: false };

function stageOf(name: FixtureName): BlobbiStage {
  return name === 'egg' ? 'egg' : name === 'baby' ? 'baby' : 'adult';
}

export function fixtureNameFor(stage: BlobbiStage): string {
  return stage === 'egg' ? 'Shell' : stage === 'baby' ? 'Brook' : 'Elder';
}

/** The spec a URL request describes: the numbers the fixtures always had. */
export function specFromOptions({ name, state = 'active', low }: FixtureOptions): FixtureSpec {
  const stage = stageOf(name);
  const stats = { ...DEFAULT_STATS };
  if (low) stats[low] = LOW_VALUE;
  return {
    name: fixtureNameFor(stage),
    stage,
    visualGeneration: name === 'adult-v2' ? 'v2' : 'v1',
    state: stage === 'egg' ? 'active' : state,
    stats,
    careStreak: 1,
    experience: 0,
    progressionState: 'none',
    missions: NO_MISSIONS,
  };
}

/** Read a spec back from a parsed companion, so a patch applies to what the world currently says. */
export function specFromCompanion(companion: BlobbiCompanion): FixtureSpec {
  const stats = { ...DEFAULT_STATS };
  for (const stat of STAT_NAMES) if (typeof companion.stats[stat] === 'number') stats[stat] = companion.stats[stat] as number;
  const count = (id: string) => {
    const m = findEvolutionMission(companion.evolution, id);
    return m ? missionProgress(m) : 0;
  };
  const evolving = companion.progressionState === 'evolving';
  return {
    name: companion.name,
    stage: companion.stage,
    visualGeneration: companion.visualGeneration,
    state: companion.state === 'sleeping' ? 'sleeping' : 'active',
    stats,
    careStreak: companion.careStreak ?? 0,
    experience: companion.experience ?? 0,
    progressionState: companion.progressionState,
    missions: {
      interactions: count('interactions'),
      themes: count(evolving ? 'create_themes' : 'create_theme'),
      colorMoments: count(evolving ? 'color_moments' : 'color_moment'),
      editProfile: count('edit_profile') > 0,
    },
  };
}

const clampStat = (value: number) => Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));

/**
 * The kit's own mission list for the progression, with the spec's counts
 * filled in: a tally mission gets its count, an event mission gets that
 * many placeholder event ids. `undefined` when nothing is in progress.
 */
export function missionsForSpec(spec: FixtureSpec): Mission[] | undefined {
  if (spec.progressionState === 'none') return undefined;
  const missions = spec.progressionState === 'incubating' ? createHatchMissions() : createEvolveMissions();
  const counts: Record<string, number> = {
    interactions: spec.missions.interactions,
    create_theme: spec.missions.themes,
    create_themes: spec.missions.themes,
    color_moment: spec.missions.colorMoments,
    color_moments: spec.missions.colorMoments,
    edit_profile: spec.missions.editProfile ? 1 : 0,
  };
  return missions.map((m) => {
    const n = Math.max(0, Math.min(m.target, Math.floor(counts[m.id] ?? 0)));
    if ('events' in m) return { ...m, events: Array.from({ length: n }, (_, i) => `${m.id}-${i + 1}`.padEnd(64, '0')) };
    return { ...m, count: n };
  });
}

/** Whether every mission of the spec's progression is complete, by the kit's own rule. */
export function missionsComplete(spec: FixtureSpec): boolean {
  const missions = missionsForSpec(spec);
  return !!missions && missions.every(isMissionComplete);
}

let eventSerial = 0;
let lastCreatedAt = 0;

/**
 * The kind 31124 for a spec, published now but born at `FIXTURE_BORN_AT`
 * (the seed and the visual traits come from the birth time, so they never
 * change): the stats are what the spec says (decay starts from this
 * moment), the progression tags and the mission content are the kit's, and
 * the id is fresh so every rebuild is a new event to every cache.
 */
export function buildFixtureBlobbi(spec: FixtureSpec): NostrEvent {
  const now = Math.max(Math.floor(Date.now() / 1000), lastCreatedAt + 1);
  lastCreatedAt = now;
  eventSerial += 1;
  const set: Record<string, string> = {
    care_streak: String(Math.max(0, Math.floor(spec.careStreak))),
    experience: String(Math.max(0, Math.floor(spec.experience))),
    progression_state: spec.progressionState,
    last_decay_at: String(now),
    last_interaction: String(now),
  };
  for (const stat of STAT_NAMES) set[stat] = String(clampStat(spec.stats[stat]));
  const extra: string[][] = [];
  if (spec.progressionState !== 'none') extra.push(['progression_started_at', String(now - 60)]);
  const event = blobbiEvent(PET_ID, { name: spec.name, stage: spec.stage, state: spec.stage === 'egg' ? 'active' : spec.state, createdAt: FIXTURE_BORN_AT, set, extra, visualGeneration: spec.visualGeneration });
  const missions = missionsForSpec(spec);
  return { ...event, id: `f${eventSerial.toString(16)}`.padEnd(64, '0'), created_at: now, content: missions ? serializeEvolutionContent('', missions) : '' };
}

/** The rest of the world around the Blobbi: profile, kind 0, item definitions, one inventory. */
export function buildFixtureSurroundings(): NostrEvent[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    profileEvent({ currentCompanion: FIXTURE_D, has: [FIXTURE_D], xp: 640 }),
    { id: 'k'.repeat(64), pubkey: PUBKEY, created_at: now - 3_600, kind: 0, tags: [], content: JSON.stringify({ name: 'Fixture Keeper' }), sig: '0'.repeat(128) },
    officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }, { emoji: '🍎', stages: ['baby', 'adult'] }),
    officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }, { emoji: '⚽', stages: ['baby', 'adult'] }),
    officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { emoji: '🧼', stages: ['egg', 'baby', 'adult'] }),
    inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 3, [OFFICIAL_BALL]: 2, [OFFICIAL_SOAP]: 2 }),
  ];
}

export function buildFixtureWorldFromSpec(spec: FixtureSpec): NostrEvent[] {
  return [buildFixtureBlobbi(spec), ...buildFixtureSurroundings()];
}

export function buildFixtureWorld(options: FixtureOptions): NostrEvent[] {
  return buildFixtureWorldFromSpec(specFromOptions(options));
}

function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}

/** The in-memory relay plus the handle the dev controller rewrites it through. Nothing leaves the tab. */
export interface FixtureStore {
  pool: NPool;
  /** Every event the world holds right now. */
  events: () => readonly NostrEvent[];
  /** Put an event in as a publish would: replaceable kinds replace, everything else appends. */
  put: (event: NostrEvent) => void;
  /** Start over with exactly these events. */
  replace: (events: readonly NostrEvent[]) => void;
  /** The fixture Blobbi as the world currently says it is. */
  companion: () => BlobbiCompanion | undefined;
  /** Every event that was published into the world (care writes, lifecycle transitions), oldest first. */
  published: () => readonly NostrEvent[];
}

const isReplaceable = (kind: number) => kind === KIND_BLOBBI_STATE || kind === KIND_BLOBBONAUT_PROFILE || kind === 0;

export function createFixtureStore(initial: readonly NostrEvent[]): FixtureStore {
  let all: NostrEvent[] = [...initial];
  const published: NostrEvent[] = [];
  const put = (ev: NostrEvent) => {
    const d = getTagValue(ev.tags, 'd');
    if (isReplaceable(ev.kind)) all = [...all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === d)), ev];
    else all = [...all, ev];
  };
  const pool = {
    async query(filters: NostrFilter[]): Promise<NostrEvent[]> {
      await new Promise((r) => setTimeout(r, 120));
      const seen = new Set<string>();
      return all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
    },
    async event(ev: NostrEvent): Promise<void> {
      await new Promise((r) => setTimeout(r, 150));
      published.push(ev);
      put(ev);
    },
    async close() {},
  };
  return {
    pool: pool as unknown as NPool,
    events: () => all,
    put,
    replace: (events) => {
      all = [...events];
    },
    companion: () => {
      const event = all.find((e) => e.kind === KIND_BLOBBI_STATE && e.pubkey === PUBKEY && getTagValue(e.tags, 'd') === FIXTURE_D);
      return event ? parseModernBlobbiEvent(event) : undefined;
    },
    published: () => published,
  };
}

/** An in-memory relay: replaceable kinds replace, everything else appends; nothing leaves the tab. */
export function createFixturePool(initial: NostrEvent[]): NPool {
  return createFixtureStore(initial).pool;
}

let signCount = 0;
/** A signer that "signs" with a fake signature: the fixture relay verifies nothing. Dev only. */
export const fixtureSigner = {
  async getPublicKey() {
    return PUBKEY;
  },
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...t, id: String(signCount).padStart(64, 'f'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
