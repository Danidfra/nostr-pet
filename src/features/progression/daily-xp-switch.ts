/**
 * Test seam for today's missions' writes (`useDailyXp`). A module of its own, with no imports, so the test setup can
 * reach it without loading any hook before a test file's `vi.mock` takes effect.
 *
 * The kit keeps the day's missions in a module store that outlives a test, so suites about other things would
 * otherwise pay (and write) a day finished by an earlier test. `test-setup.ts` turns the writes off; the progression
 * suites turn them on. Never called by the app.
 */
let enabled = true;

export function setDailyXpEnabled(on: boolean): void {
  enabled = on;
}

export function dailyXpEnabled(): boolean {
  return enabled;
}
