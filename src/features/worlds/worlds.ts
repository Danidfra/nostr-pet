/**
 * The places a Blobbi can travel to from its home. Each is an independent
 * application on its own origin; going there is a plain navigation, and
 * nothing travels with it: no key, no login, no session, no query string.
 * The other app signs the player in with its own sign-in, as it always has.
 *
 * A world is OPEN only with an address that was checked to answer as that
 * app (HTTPS, the app's own page title), on the date below. A world without
 * a checked address is UPCOMING: shown, labelled, never a link.
 *
 * Checked 2026-10-12 with a plain HTTPS request:
 *   https://island.blobbi.pet/                → 200, "Blobbi Island - Virtual Pet Adventure"
 *   https://rumble.blobbi.pet/                → 302 to /rumble.html?network=1, "Blobbi Rumble"
 *   https://farm.blobbi.pet/                  → 200, "Nostr Farm"
 * Checked 2026-10-18 when the Pixel game was deployed:
 *   https://pixel.blobbi.pet/                 → 200, "Blobbi Pixel"
 */
import { WORLD_PIXEL } from '@blobbi-kit/core';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';

/** The World ids the kit's World Travel protocol uses for the worlds the home is not (`WORLD_HOME` is this one). */
export const WORLD_ISLAND = 'blobbi-island';
export const WORLD_FARM = 'nostr-farm';
export const WORLD_RUMBLE = 'blobbi-rumble';

export type WorldId = 'island' | 'rumble' | 'farm' | 'pixel';

export interface World {
  id: WorldId;
  /** The World id the kit's World Travel protocol uses for the same place (a trip there names it). */
  travelId: string;
  name: string;
  /** One line: what you do there. */
  tagline: string;
  /** The checked address, or null for a world that is not open yet. */
  url: string | null;
  /** The card's look: two colours of its sky (behind the icon, and the card's face when the icon cannot load). */
  colors: readonly [string, string];
  /** The card's picture: that app's own icon, shipped with this app (public/icons/worlds/<travelId>.png). */
  icon: string;
}

/** Where a world's icon is kept in this app (each app's own 192 px icon, copied as it is). */
export const worldIconPath = (travelId: string) => `/icons/worlds/${travelId}.png`;

export const WORLDS_CHECKED_ON = '2026-10-18';

const DEFINED: readonly World[] = [
  { id: 'island', travelId: WORLD_ISLAND, name: 'Blobbi Island', tagline: 'Explore the island and meet other Blobbis.', url: BLOBBI_ISLAND_URL, colors: ['#7dd3fc', '#fde68a'], icon: worldIconPath(WORLD_ISLAND) },
  { id: 'rumble', travelId: WORLD_RUMBLE, name: 'Blobbi Rumble', tagline: 'A playful arena for friendly matches.', url: 'https://rumble.blobbi.pet/', colors: ['#fca5a5', '#fdba74'], icon: worldIconPath(WORLD_RUMBLE) },
  { id: 'farm', travelId: WORLD_FARM, name: 'Nostr Farm', tagline: 'Grow crops and gather produce.', url: 'https://farm.blobbi.pet/', colors: ['#86efac', '#bef264'], icon: worldIconPath(WORLD_FARM) },
  { id: 'pixel', travelId: WORLD_PIXEL, name: 'Blobbi Pixel', tagline: 'A pixel adventure with your Blobbi.', url: 'https://pixel.blobbi.pet/', colors: ['#c4b5fd', '#f9a8d4'], icon: worldIconPath(WORLD_PIXEL) },
];

/** An address a world may be opened at: absolute https (http only on localhost, for development), no credentials. */
export function isTravelUrl(candidate: string | null | undefined): candidate is string {
  if (!candidate) return false;
  try {
    const url = new URL(candidate);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/** Every world, each with whether it can be travelled to now. */
export function worlds(): readonly (World & { open: boolean })[] {
  return DEFINED.map((w) => ({ ...w, open: isTravelUrl(w.url) }));
}

export function worldById(id: WorldId): (World & { open: boolean }) | undefined {
  return worlds().find((w) => w.id === id);
}
