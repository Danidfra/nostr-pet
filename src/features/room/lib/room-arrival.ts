/**
 * Coming home (M12.1): whenever the player enters the room (the app opened, a
 * reload, back from the classic home or from another Blobbi app), the Blobbi
 * arrives through the teleport's own arrival: it gathers from motes, forms,
 * lands with its "ta-da", and its life resumes. A visual convention only:
 * nothing is written and nothing is said about where the Blobbi was (there is
 * no presence protocol; see `features/worlds/README.md`).
 *
 * What it reuses: the room's one presence controller (`usePresence`, started
 * `absent`, then `enter()`), so the arrival is the same machine, timeline,
 * cues and drawings as a teleport, and a departure to another world is its
 * mirror. What decides it, here, once per mount of the room:
 *
 *   - an egg never arrives: its first moment is the hatch theatre (the birth
 *     is never covered by an arrival), and an egg has no "home-coming" yet;
 *   - a sleeper is simply in its bed;
 *   - everyone else arrives.
 *
 * When it plays: once the room is on screen. A room seen before (a quick or no
 * fold-in), or the flat room without WebGL, after a short beat; a room built
 * for the first time, once its fold-in has finished (`onRoomBuilt`), with a
 * cap so a build the page never shows (a hidden tab) cannot hold it forever.
 * Reduced motion: the presence's own short fade.
 */

/** A beat after the room is drawn, so the arrival is seen landing in it rather than with it. */
export const ARRIVAL_LEAD_MS = 280;
/** The most a first visit's fold-in may hold the arrival back (the fold-in itself is about 1.5 s). */
export const ARRIVAL_BUILD_CAP_MS = 3_200;

let enabled = true;

/**
 * Test seam: suites that are about something else start with the Blobbi present, as before M12.1 (`test-setup.ts`
 * turns the arrival off; the arrival's own tests turn it on). Never called by the app.
 */
export function setRoomArrivalEnabled(on: boolean): void {
  enabled = on;
}

export function roomArrivalEnabled(): boolean {
  return enabled;
}

export interface ArrivalFacts {
  stage: 'egg' | 'baby' | 'adult';
  sleeping: boolean;
}

/** Whether this entry into the room is an arrival (decided once, when the room mounts). */
export function arrivesOnEntry({ stage, sleeping }: ArrivalFacts): boolean {
  if (!enabled) return false;
  return stage !== 'egg' && !sleeping;
}

/**
 * How long to wait, now, before the arrival begins: null while the room is not on screen yet (its scene still
 * loading), the short beat once it is drawn, the cap while a first build has not reported its end.
 */
export function arrivalDelay(scene: 'loading' | 'ready' | 'unavailable' | null, built: boolean): number | null {
  if (scene === null || scene === 'loading') return null;
  if (scene === 'unavailable' || built) return ARRIVAL_LEAD_MS;
  return ARRIVAL_BUILD_CAP_MS;
}
