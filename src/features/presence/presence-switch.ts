/**
 * Whether world presence runs in this page. A module of its own, with no imports, so the test setup can reach it
 * without loading any hook before a test file's `vi.mock` takes effect (the same seam as `daily-xp-switch.ts`).
 *
 * On by default. A player (or a tester) can turn it off for the browser with
 * `localStorage['blobbi:world-presence:v1'] = 'off'`: the Blobbi then always stays in the home, as before. The test
 * setup turns it off; the presence suites turn it on.
 */
let enabled = true;

export const PRESENCE_OFF_KEY = 'blobbi:world-presence:v1';

export function setWorldPresenceEnabled(on: boolean): void {
  enabled = on;
}

export function worldPresenceEnabled(): boolean {
  if (!enabled) return false;
  try {
    return globalThis.localStorage?.getItem(PRESENCE_OFF_KEY) !== 'off';
  } catch {
    return true;
  }
}
