/**
 * Which kind of world presence runs in this page. A module of its own, with no imports, so the test setup can reach
 * it before any hook loads (the same seam as `presence-switch.ts`).
 *
 *   'v1'     world presence v1 (README.md): one short lease in a first-party cookie, on one browser. The default.
 *   'nostr'  world travel on Nostr (M16, README.md "World travel on Nostr"): the Blobbi's World Location (kind 31126)
 *            is the authority, across devices; the cookie is never read or written.
 *
 * Nostr travel is on only when the build says so (`VITE_BLOBBI_WORLD_TRAVEL=nostr`, the owner's release decision:
 * its two kinds are provisional), or on a development server when the page's storage says
 * `localStorage['blobbi:world-travel:v1'] = 'nostr'`. A production build ignores the storage flag, so no page can
 * switch a player onto the new kinds.
 */
export type TravelMode = 'v1' | 'nostr';

export const TRAVEL_MODE_KEY = 'blobbi:world-travel:v1';

let forced: TravelMode | null = null;

/** Tests: force a mode (null: decide as a page does). */
export function setTravelMode(mode: TravelMode | null): void {
  forced = mode;
}

export function travelMode(env: { build?: string; dev?: boolean } = readEnv()): TravelMode {
  if (forced) return forced;
  if (env.build === 'nostr') return 'nostr';
  if (!env.dev) return 'v1';
  try {
    return globalThis.localStorage?.getItem(TRAVEL_MODE_KEY) === 'nostr' ? 'nostr' : 'v1';
  } catch {
    return 'v1';
  }
}

function readEnv(): { build?: string; dev?: boolean } {
  try {
    return { build: import.meta.env.VITE_BLOBBI_WORLD_TRAVEL as string | undefined, dev: !!import.meta.env.DEV };
  } catch {
    return {};
  }
}

/** Whether an input event is the player's (the browser's `isTrusted`: a script's event never moves a Blobbi). */
let trustedInput: (e: Event) => boolean = (e) => e.isTrusted;

export function isTrustedInput(e: Event): boolean {
  return trustedInput(e);
}

/** Tests: jsdom's events are never trusted, so a suite says which are the player's (null: the browser's word). */
export function setTrustedInputCheck(check: ((e: Event) => boolean) | null): void {
  trustedInput = check ?? ((e) => e.isTrusted);
}
