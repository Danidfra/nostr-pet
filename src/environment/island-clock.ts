/**
 * The Blobbi Island clock, as the Island computes it. Ported verbatim in
 * semantics from `blobbi-island/src/lib/island-clock.ts` and its phase table
 * (`island-sky.ts`), so the home and the Island agree on the time of day.
 *
 * One island day is two real hours, measured from a fixed UTC epoch. Every
 * client computes the phase from `Date.now()` alone: no backend, no Nostr
 * events, nothing persisted. A page reload cannot restart the cycle because
 * there is no state to restart.
 *
 * Nothing here is ever published. The clock is a shared convention, not
 * protocol state.
 */

/** One island day: two real hours. */
export const ISLAND_DAY_MS = 2 * 60 * 60 * 1000;

/** Island day 0 begins at 1 January 2026, 00:00 UTC. Fixed forever. */
export const ISLAND_EPOCH_MS = Date.UTC(2026, 0, 1);

/** One island day in island minutes. */
export const ISLAND_DAY_MINUTES = ISLAND_DAY_MS / 60_000;

/** How often the visual state is recomputed: 720 ticks per island day. */
export const ISLAND_TICK_MS = 10_000;

export type IslandPhase = 'dawn' | 'day' | 'sunset' | 'night';

/** The Island's phase table, in island minutes. */
export const ISLAND_PHASES: readonly { phase: IslandPhase; startMinute: number; endMinute: number }[] = [
  { phase: 'dawn', startMinute: 0, endMinute: 10 },
  { phase: 'day', startMinute: 10, endMinute: 75 },
  { phase: 'sunset', startMinute: 75, endMinute: 90 },
  { phase: 'night', startMinute: 90, endMinute: 120 },
];

/**
 * Position within the current island day, in `[0, 1)`. The double modulo
 * folds pre-epoch instants (and a badly set device clock) into range.
 */
export function islandDayProgressAt(nowMs: number): number {
  if (!Number.isFinite(nowMs)) return 0;
  const elapsed = nowMs - ISLAND_EPOCH_MS;
  const wrapped = ((elapsed % ISLAND_DAY_MS) + ISLAND_DAY_MS) % ISLAND_DAY_MS;
  return wrapped / ISLAND_DAY_MS;
}

/** Position within the current island day, in island minutes `[0, 120)`. */
export function islandMinuteAt(nowMs: number): number {
  return islandDayProgressAt(nowMs) * ISLAND_DAY_MINUTES;
}

export interface IslandTime {
  phase: IslandPhase;
  /** 0..1 within the phase. */
  phaseProgress: number;
  /** 0..120. */
  minute: number;
}

/** The phase for a day progress in `[0, 1)`, and how far into it we are. */
export function islandPhaseAt(dayProgress: number): IslandTime {
  const minute = Math.min(ISLAND_DAY_MINUTES - 1e-9, Math.max(0, dayProgress * ISLAND_DAY_MINUTES));
  const entry = ISLAND_PHASES.find((p) => minute >= p.startMinute && minute < p.endMinute) ?? ISLAND_PHASES[ISLAND_PHASES.length - 1];
  return { phase: entry.phase, phaseProgress: (minute - entry.startMinute) / (entry.endMinute - entry.startMinute), minute };
}

/** The island time at an instant. */
export function islandTimeAt(nowMs: number): IslandTime {
  return islandPhaseAt(islandDayProgressAt(nowMs));
}

/**
 * Milliseconds until the next tick boundary, aligned to absolute multiples of
 * the tick since the Unix epoch so two clients step at the same instants.
 * Always at least 1 ms.
 */
export function msUntilNextIslandTick(nowMs: number): number {
  if (!Number.isFinite(nowMs)) return ISLAND_TICK_MS;
  const sinceBoundary = ((nowMs % ISLAND_TICK_MS) + ISLAND_TICK_MS) % ISLAND_TICK_MS;
  return ISLAND_TICK_MS - sinceBoundary || ISLAND_TICK_MS;
}
