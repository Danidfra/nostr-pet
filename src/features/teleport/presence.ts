/**
 * Whether a Blobbi is here: the state machine of its journeys, renderer-free
 * and app-free (no React, no DOM, no Nostr), so a future presence
 * coordinator (another app, another tab) can drive it and blobbi-kit can
 * own it.
 *
 *            leave()                 (timeline ends)
 *   present ─────────▶ departing ───────────────────▶ absent
 *      ▲                   │ enter(): turns back,          │
 *      │                   ▼ from what is still there      │ enter()
 *      └──────────────── arriving ◀────────────────────────┘
 *        (timeline ends)       │ leave(): turns back, from what has formed
 *                              ▼
 *                          departing
 *
 * Rules:
 *  - asking for what is already happening, or already so, does nothing
 *    (`leave` while departing or absent, `enter` while arriving or present),
 *    so rapid or repeated triggers never stack journeys;
 *  - turning back mid-journey continues from the SAME visible amount of
 *    body: an arrival started during a departure picks up where that much
 *    of the body is formed, and the other way round; nothing pops;
 *  - `cancel` ends any journey at once, the Blobbi present;
 *  - completion and sound cues run on plain timers, not animation frames,
 *    so a hidden tab still completes its journey (silently: the app's
 *    sound already stays quiet in a hidden tab);
 *  - `dispose` clears every timer and listener; nothing fires after it.
 *
 * A journey is presentation only: the Blobbi's identity, care, inventory and
 * room are untouched; nothing here writes anything anywhere.
 */
import {
  ARRIVE,
  CUES,
  DEPART,
  REDUCED_CUES,
  arriveCutAt,
  arriveTimeAtHeight,
  departCutAt,
  departTimeAtHeight,
  journeyDuration,
  type JourneyCue,
  type JourneyKind,
} from './timeline';

export type PresenceState = 'present' | 'departing' | 'absent' | 'arriving';

export interface Journey {
  kind: JourneyKind;
  /** The clock time it started, minus `offset`: so `now - startedAt` is the time on its timeline. */
  startedAt: number;
  /** Where on the timeline it began (a turned-back journey starts part way). */
  offset: number;
  reduced: boolean;
}

export interface PresenceSnapshot {
  state: PresenceState;
  journey: Journey | null;
}

export interface PresenceController {
  getState(): PresenceState;
  snapshot(): PresenceSnapshot;
  /** Time on the current journey's timeline (ms), or null between journeys. */
  elapsed(): number | null;
  /** Start leaving. False if it is already leaving or gone. */
  leave(): boolean;
  /** Start arriving. False if it is already arriving or here. */
  enter(): boolean;
  /** End any journey at once, the Blobbi present. */
  cancel(): void;
  subscribe(listener: (snapshot: PresenceSnapshot) => void): () => void;
  dispose(): void;
  isDisposed(): boolean;
}

export interface PresenceOptions {
  initial?: 'present' | 'absent';
  /** Read at the start of each journey: a short fade instead of the full effect. */
  reducedMotion?: () => boolean;
  /** A journey's sound cue is due (the app plays it, or not). */
  onCue?: (cue: JourneyCue, kind: JourneyKind) => void;
  /** A journey finished (not one cancelled or turned back). */
  onComplete?: (state: 'present' | 'absent') => void;
  /** Test seams. */
  clock?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createPresenceController({
  initial = 'present',
  reducedMotion = () => false,
  onCue,
  onComplete,
  clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: PresenceOptions = {}): PresenceController {
  let state: PresenceState = initial;
  let journey: Journey | null = null;
  let timers: unknown[] = [];
  let disposed = false;
  const listeners = new Set<(snapshot: PresenceSnapshot) => void>();

  const snapshot = (): PresenceSnapshot => ({ state, journey });
  const emit = () => {
    const s = snapshot();
    for (const l of listeners) l(s);
  };
  const clearAll = () => {
    for (const t of timers) clearTimer(t);
    timers = [];
  };
  const elapsed = (): number | null => (journey ? clock() - journey.startedAt : null);

  /** Begin a journey at `offset` ms into its timeline. */
  const begin = (kind: JourneyKind, offset: number, reduced: boolean) => {
    clearAll();
    journey = { kind, startedAt: clock() - offset, offset, reduced };
    state = kind === 'depart' ? 'departing' : 'arriving';
    const total = journeyDuration(kind, reduced);
    for (const { at, cue } of (reduced ? REDUCED_CUES : CUES)[kind]) {
      if (at < offset) continue;
      timers.push(setTimer(() => onCue?.(cue, kind), Math.max(0, at - offset)));
    }
    timers.push(
      setTimer(() => {
        if (disposed) return;
        timers = [];
        journey = null;
        state = kind === 'depart' ? 'absent' : 'present';
        emit();
        onComplete?.(state);
      }, Math.max(0, total - offset)),
    );
    emit();
  };

  /** How much of the body shows `t` ms into a journey (1 whole, 0 gone), to turn back from. */
  const visibleAt = (j: Journey, t: number): number => {
    if (j.reduced) {
      const k = Math.min(1, Math.max(0, t / journeyDuration(j.kind, true)));
      return j.kind === 'depart' ? 1 - k : k;
    }
    if (j.kind === 'depart') return t < DEPART.gather ? 1 : departCutAt(t);
    return t < ARRIVE.incoming ? 0 : arriveCutAt(t);
  };

  return {
    getState: () => state,
    snapshot,
    elapsed,
    leave() {
      if (disposed || state === 'departing' || state === 'absent') return false;
      const reduced = reducedMotion();
      if (state === 'arriving' && journey) {
        // Turning back: leave from what has formed so far
        const v = visibleAt(journey, elapsed() ?? 0);
        const offset = reduced ? (1 - v) * journeyDuration('depart', true) : v >= 1 ? 0 : v <= 0 ? DEPART.dissolve : departTimeAtHeight(v);
        begin('depart', offset, reduced);
        return true;
      }
      begin('depart', 0, reduced);
      return true;
    },
    enter() {
      if (disposed || state === 'arriving' || state === 'present') return false;
      const reduced = reducedMotion();
      if (state === 'departing' && journey) {
        // Turning back: come back from what is still there
        const v = visibleAt(journey, elapsed() ?? 0);
        const offset = reduced ? v * journeyDuration('arrive', true) : v >= 1 ? ARRIVE.form : v <= 0 ? 0 : arriveTimeAtHeight(v);
        begin('arrive', offset, reduced);
        return true;
      }
      begin('arrive', 0, reduced);
      return true;
    },
    cancel() {
      if (disposed || !journey) return;
      clearAll();
      journey = null;
      state = 'present';
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      clearAll();
      listeners.clear();
      journey = null;
    },
    isDisposed: () => disposed,
  };
}
