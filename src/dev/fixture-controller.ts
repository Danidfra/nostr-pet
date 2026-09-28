/**
 * The dev fixture controller: the one place that rewrites the fixture world
 * while the app runs. The dev panel talks to it; it talks to the fixture
 * store; the app notices through the same query cache every relay-backed
 * change goes through. Two kinds of change, kept apart on purpose:
 *
 *   set state          the world is rewritten to say something (a stage, a
 *                      stat, a mission count); nothing "happens", the Blobbi
 *                      simply is that now. Pure model, no kit hook.
 *   presentation pins  a face, a facing, reduced motion: scene settings, not
 *                      world state. Nothing is written anywhere.
 *
 * Performing a lifecycle action (start incubation, hatch, evolve) is NOT
 * here: the panel runs the real `useLifecycle` against the fixture pool, so
 * whatever the kit accepts or rejects is what the panel shows.
 *
 * Nothing in this module reaches a relay: the store is in memory, the
 * signer is fake, the pubkey is the fixture's. Dev bundle only.
 */
import type { NostrEvent } from '@nostrify/nostrify';
import { CRITICAL_THRESHOLDS, STAT_MAX, STAT_MIN, getSelectedBlobbiKey, type BlobbiStage, type BlobbiStats } from '@blobbi-kit/core';
import { EVOLVE_STAT_THRESHOLD, clearEvolutionFromStorage } from '@blobbi-kit/react';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import type { Facing } from '@/features/home/scene';
import { PUBKEY } from '@/test/fixtures';
import {
  FIXTURE_D,
  NO_MISSIONS,
  STAT_NAMES,
  buildFixtureBlobbi,
  buildFixtureWorldFromSpec,
  createFixtureStore,
  fixtureNameFor,
  specFromCompanion,
  specFromOptions,
  type FixtureMissions,
  type FixtureRequest,
  type FixtureSpec,
  type FixtureStore,
} from './fixture-world';

/** Presentation pins: scene settings the panel sets. `null`/`undefined` means "the game decides". */
export interface PresentationPins {
  expression: BlobbiEmotion | null;
  facing: Facing | null;
  reducedMotion: boolean | undefined;
}

export const NO_PINS: PresentationPins = { expression: null, facing: null, reducedMotion: undefined };

export type FixtureChange = { kind: 'blobbi'; event: NostrEvent } | { kind: 'pins'; pins: PresentationPins } | { kind: 'reset' };

/** A healthy value: comfortably above every warning threshold and the evolve threshold. */
export const HEALTHY_VALUE = Math.min(STAT_MAX, Math.max(92, EVOLVE_STAT_THRESHOLD + 10));
/** How far under the critical threshold a "critical" preset goes. */
const UNDER_CRITICAL = 5;

/**
 * The value that makes a stat critical for a stage, from the kit's own
 * thresholds; a stat the stage has no threshold for (an egg's hunger) is
 * left healthy, since the kit never calls it critical.
 */
export function criticalValue(stage: BlobbiStage, stat: keyof BlobbiStats): number {
  const threshold = (CRITICAL_THRESHOLDS[stage] as Partial<Record<keyof BlobbiStats, number>>)[stat];
  return threshold === undefined ? HEALTHY_VALUE : Math.max(STAT_MIN, threshold - UNDER_CRITICAL);
}

export type StatPreset = 'healthy' | 'hungry' | 'dirty' | 'tired' | 'critical';
export const STAT_PRESETS: readonly StatPreset[] = ['healthy', 'hungry', 'dirty', 'tired', 'critical'];
const LOW_STAT: Partial<Record<StatPreset, keyof BlobbiStats>> = { hungry: 'hunger', dirty: 'hygiene', tired: 'energy' };

/** The stats a preset means for a stage. */
export function statsForPreset(stage: BlobbiStage, preset: StatPreset): BlobbiStats {
  const stats = Object.fromEntries(STAT_NAMES.map((s) => [s, HEALTHY_VALUE])) as unknown as BlobbiStats;
  if (preset === 'critical') for (const s of STAT_NAMES) stats[s] = criticalValue(stage, s);
  const low = LOW_STAT[preset];
  if (low) stats[low] = criticalValue(stage, low);
  return stats;
}

/** Every mission of a progression complete, by count. */
export const ALL_MISSIONS: FixtureMissions = { interactions: 21, themes: 3, colorMoments: 3, editProfile: true };

export interface FixturePreset {
  id: string;
  label: string;
  group: 'egg' | 'baby' | 'adult';
  apply: (spec: FixtureSpec) => FixtureSpec;
}

const stage = (spec: FixtureSpec, s: BlobbiStage, generation: FixtureSpec['visualGeneration'] = 'v1'): FixtureSpec => ({
  ...spec,
  stage: s,
  visualGeneration: generation,
  name: fixtureNameFor(s),
  state: 'active',
  progressionState: 'none',
  missions: NO_MISSIONS,
});
const healthy = (spec: FixtureSpec): FixtureSpec => ({ ...spec, stats: statsForPreset(spec.stage, 'healthy') });

/**
 * Whole-Blobbi presets. Each is a function over the current spec, so a
 * preset says only what it is about (the stage, the progression, the
 * condition) and derives every number from the kit's rules.
 */
export const FIXTURE_PRESETS: readonly FixturePreset[] = [
  { id: 'fresh-egg', label: 'Fresh egg', group: 'egg', apply: (s) => healthy(stage(s, 'egg')) },
  { id: 'incubating-egg', label: 'Incubating egg (0/3)', group: 'egg', apply: (s) => ({ ...healthy(stage(s, 'egg')), progressionState: 'incubating' }) },
  { id: 'cracking-egg', label: 'Cracking egg (2/3)', group: 'egg', apply: (s) => ({ ...healthy(stage(s, 'egg')), progressionState: 'incubating', missions: { ...NO_MISSIONS, interactions: 7, themes: 1 } }) },
  { id: 'hatch-ready', label: 'Hatch ready', group: 'egg', apply: (s) => ({ ...healthy(stage(s, 'egg')), progressionState: 'incubating', missions: ALL_MISSIONS }) },
  { id: 'healthy-baby', label: 'Healthy baby', group: 'baby', apply: (s) => healthy(stage(s, 'baby')) },
  { id: 'hungry-baby', label: 'Hungry baby', group: 'baby', apply: (s) => ({ ...stage(s, 'baby'), stats: statsForPreset('baby', 'hungry') }) },
  { id: 'dirty-baby', label: 'Dirty baby', group: 'baby', apply: (s) => ({ ...stage(s, 'baby'), stats: statsForPreset('baby', 'dirty') }) },
  { id: 'tired-baby', label: 'Tired baby', group: 'baby', apply: (s) => ({ ...stage(s, 'baby'), stats: statsForPreset('baby', 'tired') }) },
  { id: 'critical-baby', label: 'Critical baby', group: 'baby', apply: (s) => ({ ...stage(s, 'baby'), stats: statsForPreset('baby', 'critical') }) },
  { id: 'sleeping-baby', label: 'Sleeping baby', group: 'baby', apply: (s) => ({ ...healthy(stage(s, 'baby')), state: 'sleeping' }) },
  { id: 'evolving-baby', label: 'Evolving baby (0/4)', group: 'baby', apply: (s) => ({ ...healthy(stage(s, 'baby')), progressionState: 'evolving' }) },
  { id: 'evolution-ready', label: 'Evolution ready', group: 'baby', apply: (s) => ({ ...healthy(stage(s, 'baby')), progressionState: 'evolving', missions: ALL_MISSIONS }) },
  { id: 'healthy-adult', label: 'Healthy adult (V1)', group: 'adult', apply: (s) => healthy(stage(s, 'adult')) },
  { id: 'healthy-adult-v2', label: 'Healthy adult (V2)', group: 'adult', apply: (s) => healthy(stage(s, 'adult', 'v2')) },
  { id: 'critical-adult', label: 'Critical adult', group: 'adult', apply: (s) => ({ ...stage(s, 'adult', s.visualGeneration), stats: statsForPreset('adult', 'critical') }) },
];

export interface FixtureController {
  store: FixtureStore;
  request: FixtureRequest;
  /** The Blobbi as the world says it is right now, as a spec. */
  spec: () => FixtureSpec;
  /** Rewrite the Blobbi: a patch over the current spec, or a function of it. Returns the new event. */
  setSpec: (patch: Partial<FixtureSpec> | ((spec: FixtureSpec) => FixtureSpec)) => NostrEvent;
  applyPreset: (id: string) => NostrEvent | undefined;
  pins: () => PresentationPins;
  setPins: (patch: Partial<PresentationPins>) => void;
  clearPins: () => void;
  /** The world as the URL asked for it, no pins, the kit's session stores emptied. */
  reset: () => void;
  subscribe: (listener: (change: FixtureChange) => void) => () => void;
}

/** Forget what the kit and the app kept on this device about the fixture pubkey (never anyone else's). */
function forgetFixtureLocalState(): void {
  clearEvolutionFromStorage(PUBKEY, FIXTURE_D);
  try {
    const prefix = PUBKEY.slice(0, 12);
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && (key === getSelectedBlobbiKey(PUBKEY) || key.includes(FIXTURE_D) || key.includes(PUBKEY) || key.includes(prefix))) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* no storage: nothing to forget */
  }
}

export function createFixtureController(request: FixtureRequest): FixtureController {
  const initialSpec = specFromOptions(request);
  const store = createFixtureStore(buildFixtureWorldFromSpec(initialSpec));
  let pins: PresentationPins = { ...NO_PINS, expression: request.expression };
  const listeners = new Set<(change: FixtureChange) => void>();
  const notify = (change: FixtureChange) => {
    for (const l of listeners) l(change);
  };
  const spec = () => {
    const companion = store.companion();
    return companion ? specFromCompanion(companion) : initialSpec;
  };
  const setSpec: FixtureController['setSpec'] = (patch) => {
    const current = spec();
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    const event = buildFixtureBlobbi(next);
    // The kit keeps a session copy of the missions; the world is the truth now.
    clearEvolutionFromStorage(PUBKEY, FIXTURE_D);
    store.put(event);
    notify({ kind: 'blobbi', event });
    return event;
  };
  return {
    store,
    request,
    spec,
    setSpec,
    applyPreset: (id) => {
      const preset = FIXTURE_PRESETS.find((p) => p.id === id);
      return preset ? setSpec(preset.apply) : undefined;
    },
    pins: () => pins,
    setPins: (patch) => {
      pins = { ...pins, ...patch };
      notify({ kind: 'pins', pins });
    },
    clearPins: () => {
      pins = { ...NO_PINS };
      notify({ kind: 'pins', pins });
    },
    reset: () => {
      forgetFixtureLocalState();
      store.replace(buildFixtureWorldFromSpec(initialSpec));
      pins = { ...NO_PINS, expression: request.expression };
      notify({ kind: 'pins', pins });
      notify({ kind: 'reset' });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
