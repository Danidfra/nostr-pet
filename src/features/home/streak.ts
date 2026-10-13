/**
 * The care streak, as the home shows it. The rule lives in blobbi-kit
 * (`getStreakTagUpdates`: the first care of a new local day makes the
 * streak +1 if yesterday was cared for, else 1; a second care the same day
 * changes nothing). The home never computes a streak: it reads
 * `companion.careStreak` from the authoritative event and only notices when
 * that number went UP between two versions of the same Blobbi. A page load
 * is not an increase; a care write that bumps the tag is.
 */

/** Days that deserve a bigger moment. */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30, 60, 100, 365];

export interface StreakChange {
  from: number;
  to: number;
  milestone: boolean;
}

/** The change worth celebrating between two authoritative values, or null. */
export function detectStreakIncrease(previous: number | undefined, next: number | undefined): StreakChange | null {
  const from = previous ?? 0;
  const to = next ?? 0;
  if (to <= from) return null;
  return { from, to, milestone: STREAK_MILESTONES.includes(to) };
}

/** A line for the moment. */
export function streakLine(change: StreakChange): string {
  if (change.milestone) return `${change.to} days in a row!`;
  if (change.to === 1) return 'A new streak begins.';
  return `${change.to} days in a row.`;
}

/**
 * What the HUD's flame shows (M14.1): the streak, but only once the player
 * has really cared. A fresh egg carries a streak of 1 from the kit's own
 * template and a hatch keeps it, so a flame for that would light for
 * nothing; a streak of 2 or more is real care by definition, and 1 counts
 * once a care receipt exists (or care landed on this visit). Zero hides it.
 */
export function flameDays(careStreak: number | undefined, careGiven: boolean): number {
  const days = careStreak ?? 0;
  if (days >= 2) return days;
  return careGiven ? days : 0;
}
