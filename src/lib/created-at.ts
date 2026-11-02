/**
 * When a replaceable or addressable event is republished over `prev`.
 *
 * NIP-01: of two versions, relays keep the one with the higher `created_at`,
 * and in the same second the one with the lower id. A republish stamped with
 * the device clock alone can therefore lose to the version it replaces: two
 * writes in the same second (a care, then another), or a device whose clock is
 * a little behind the device that wrote `prev`.
 *
 * So a republish is stamped one second after `prev` when that is later than
 * now, but never more than `MAX_STAMP_AHEAD_S` ahead of this device's clock:
 *
 *   - quick successive writes move ahead of the clock by at most that much,
 *     and the clock catches up as soon as they stop;
 *   - a `prev` further in the future than that was stamped by a clock that is
 *     wrong, not merely a second ahead. It is not chased: the republish gets
 *     the device's time and loses to `prev` until `prev`'s time has passed,
 *     which is the plain NIP-01 outcome. Chasing it would push every later
 *     write of this Blobbi into the future after it, and relays refuse events
 *     too far ahead (strfry 960 s, the Blobbi relay 900 s for most kinds).
 *
 * 60 s is far inside every relay's future window and far above anything a
 * person can cause by tapping.
 */
export const MAX_STAMP_AHEAD_S = 60;

/** `created_at` for a republish over an event stamped `prevCreatedAt` (none: a first publish), at `now` (seconds). */
export function stampAfter(prevCreatedAt: number | undefined, now: number): number {
  if (prevCreatedAt === undefined || !Number.isFinite(prevCreatedAt)) return now;
  const after = Math.floor(prevCreatedAt) + 1;
  if (after <= now) return now;
  return after <= now + MAX_STAMP_AHEAD_S ? after : now;
}
