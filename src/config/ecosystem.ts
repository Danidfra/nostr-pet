/**
 * Where the rest of the Blobbi ecosystem lives, as seen from the standalone.
 *
 * The standalone is the home: "your Blobbi lives here". Ditto is where eggs
 * are adopted and hatched; Blobbi Island is the world you go out into. Each is
 * an independent app sharing only the player's Nostr identity and events, so
 * the only thing this module knows is a destination.
 *
 * `BLOBBI_ISLAND_URL` follows the ecosystem's `*.blobbi.pet` subdomain
 * convention (assets.blobbi.pet, farm.blobbi.pet). No sibling repo carries a
 * deploy-time Island URL, so the default is this convention and a build can
 * point elsewhere with `VITE_BLOBBI_ISLAND_URL`.
 */

export const DEFAULT_BLOBBI_ISLAND_URL = 'https://island.blobbi.pet';

/** Ditto, where the lifecycle missions that need a theme or a profile are completed. */
export const DITTO_URL = 'https://ditto.pub';

/** Where a Blobbi is adopted today. */
export const DITTO_BLOBBI_URL = `${DITTO_URL}/blobbi`;

/** This app's source code (AGPL-3.0-or-later): what the About sheet links to. */
export const SOURCE_CODE_URL = 'https://github.com/Danidfra/nostr-pet';

/**
 * Resolve the Island destination: the env override when it is an absolute
 * `http(s):` URL, the ecosystem default otherwise. Anything else (a relative
 * path, a `javascript:` scheme, whitespace) is refused, never opened.
 */
export function resolveBlobbiIslandUrl(
  override: string | undefined = import.meta.env.VITE_BLOBBI_ISLAND_URL,
): string {
  const candidate = override?.trim();
  if (!candidate) return DEFAULT_BLOBBI_ISLAND_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    // fall through to the default
  }
  return DEFAULT_BLOBBI_ISLAND_URL;
}

export const BLOBBI_ISLAND_URL = resolveBlobbiIslandUrl();
