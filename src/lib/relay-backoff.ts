/**
 * How long a relay connection waits before trying again, for nostrify's
 * NRelay1 (its `backoff` option; websocket-ts calls `next()` when it
 * schedules a retry and `reset()` once a reconnection succeeded).
 *
 * Measured over two hours against a relay that never connects:
 *
 *   NRelay1 default, 1 s doubling forever      11 tries, last wait 34 min and growing
 *   1 s doubling, 30 s ceiling                 318 tries, never more than 30 s
 *   this schedule                              about 60 tries (`relay-measurements.test.tsx`)
 *
 * The step doubles from `baseMs`; its ceiling grows with how long the relay
 * has been failing: 30 s for the first 5 minutes (a blip recovers fast),
 * 2 minutes until 30 minutes, then 5 minutes. While the page is hidden the
 * ceiling is 10 minutes: nobody is looking, and a phone's radio rests. Each
 * wait is drawn between half and all of its step ("equal jitter"), so
 * retries never line up across tabs or devices.
 *
 * Coming back (the browser online again, the page visible again) resets the
 * schedule (`HomePool.connectivityRestored`), and a connection stuck in a
 * long wait is replaced, because a wait already scheduled cannot be cut
 * short.
 */
export const RECONNECT_BASE_MS = 1_000;
/** The ceiling while the relay has been failing for less than five minutes. */
export const RECONNECT_CAP_MS = 30_000;
export const RECONNECT_CAP_MID_MS = 2 * 60_000;
export const RECONNECT_CAP_LONG_MS = 5 * 60_000;
export const RECONNECT_CAP_HIDDEN_MS = 10 * 60_000;
const MID_AFTER_MS = 5 * 60_000;
const LONG_AFTER_MS = 30 * 60_000;

export interface BackoffEnv {
  now?: () => number;
  random?: () => number;
  /** Whether the page is hidden now (`document.hidden`). */
  hidden?: () => boolean;
}

const pageHidden = () => typeof document !== 'undefined' && document.hidden === true;

export class JitteredBackoff {
  private step = 0;
  private count = 0;
  private value = 0;
  private failingSince: number | null = null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly hidden: () => boolean;

  constructor(
    private readonly baseMs: number = RECONNECT_BASE_MS,
    env: BackoffEnv = {},
  ) {
    this.now = env.now ?? (() => Date.now());
    this.random = env.random ?? Math.random;
    this.hidden = env.hidden ?? pageHidden;
  }

  get retries(): number {
    return this.count;
  }

  /** The wait last handed out (0 before the first retry). */
  get current(): number {
    return this.value;
  }

  /** The ceiling right now: by how long the relay has been failing, and longer while the page is hidden. */
  ceiling(): number {
    if (this.hidden()) return RECONNECT_CAP_HIDDEN_MS;
    const failing = this.failingSince === null ? 0 : this.now() - this.failingSince;
    return failing < MID_AFTER_MS ? RECONNECT_CAP_MS : failing < LONG_AFTER_MS ? RECONNECT_CAP_MID_MS : RECONNECT_CAP_LONG_MS;
  }

  next(): number {
    if (this.failingSince === null) this.failingSince = this.now();
    this.count++;
    const cap = this.ceiling();
    const step = Math.min(cap, this.baseMs * 2 ** this.step);
    if (step < cap) this.step++;
    this.value = Math.round(step / 2 + this.random() * (step / 2));
    return this.value;
  }

  reset(): void {
    this.step = 0;
    this.count = 0;
    this.value = 0;
    this.failingSince = null;
  }
}
