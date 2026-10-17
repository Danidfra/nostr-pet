/**
 * M16, WHAT A BUILD SAYS ABOUT WORLD TRAVEL, checked when Vite starts (`vite.config.ts`), so a configuration mistake
 * fails loudly instead of compiling world travel off without a word. No imports: the Vite config loads it in Node.
 *
 *   VITE_BLOBBI_WORLD_TRAVEL   unset, empty or `off`: off (the default). `nostr`: world travel on Nostr. Anything else
 *                              is a mistake (`on`, `true`, a typo) and stops the build.
 *
 * World travel signs and publishes the Blobbi's World Location (kind 31126, experimental) to the public travel relays.
 * This app has no rehearsal mode (its other events are always published live), so `nostr` is the whole decision; Blobbi
 * Pixel, which has one, also requires its live build (`VITE_BLOBBI_PUBLISH=live`). The page still decides at run time
 * (`travel-mode.ts`, the same rule); this only makes the build's intent explicit, and says so when it is on.
 */
export type TravelBuildCheck = { ok: true; on: boolean; message: string | null } | { ok: false; message: string };

const TRAVEL_VALUES = ['', 'off', 'nostr'];

export function checkTravelBuild(o: { travel?: string; command: 'build' | 'serve' }): TravelBuildCheck {
  // Exactly as the page reads it (no trimming): what passes here is what turns it on there
  const travel = o.travel ?? '';
  if (!TRAVEL_VALUES.includes(travel)) {
    return { ok: false, message: `VITE_BLOBBI_WORLD_TRAVEL=${JSON.stringify(o.travel)} is not a value world travel knows: leave it unset (off) or set it to "nostr".` };
  }
  if (travel !== 'nostr') return { ok: true, on: false, message: null };
  return {
    ok: true,
    on: true,
    message:
      o.command === 'build'
        ? 'World travel: ON in this build. Moves are signed by the player and published to the public travel relays (kind 31126).'
        : 'World travel: ON in this development server. Moves are signed and published to the PUBLIC travel relays unless a test guard redirects them.',
  };
}
