/**
 * Whether world travel runs in this page. A module of its own, with no imports, so the test setup can reach it before
 * any hook loads.
 *
 *   'off'    the default. The Blobbi is simply home: no location is read or written anywhere, nothing is signed or
 *            published, and the home plays exactly as a single-world app.
 *   'nostr'  world travel on Nostr (M16, README.md "World travel on Nostr"): the Blobbi's World Location (kind 31126)
 *            is the only authority for where it is, across devices and Blobbi worlds.
 *
 * Nostr travel is on only when the build says so (`VITE_BLOBBI_WORLD_TRAVEL=nostr`, the owner's release decision:
 * its two kinds are experimental), or on a development server when the page's storage says
 * `localStorage['blobbi:world-travel:v1'] = 'nostr'`. A production build ignores the storage flag, so no page can
 * switch a player onto the new kinds.
 */
export type TravelMode = 'off' | 'nostr';

export const TRAVEL_MODE_KEY = 'blobbi:world-travel:v1';

let forced: TravelMode | null = null;

/** Tests: force a mode (null: decide as a page does). */
export function setTravelMode(mode: TravelMode | null): void {
  forced = mode;
}

export function travelMode(env: { build?: string; dev?: boolean } = readEnv()): TravelMode {
  if (forced) return forced;
  if (env.build === 'nostr') return 'nostr';
  if (!env.dev) return 'off';
  try {
    return globalThis.localStorage?.getItem(TRAVEL_MODE_KEY) === 'nostr' ? 'nostr' : 'off';
  } catch {
    return 'off';
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
