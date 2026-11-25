/**
 * How long a relay connection waits before trying again, for nostrify's
 * NRelay1 (its `backoff` option; websocket-ts calls `next()` before each
 * retry and `reset()` once a reconnection succeeded).
 *
 * NRelay1's default is `ExponentialBackoff(1000)` with no ceiling and no
 * jitter: measured over two hours of a relay that never connects, eleven
 * attempts and a wait that had reached 34 minutes and kept doubling, so a
 * relay that came back stayed unused for most of an hour; and every tab
 * retried at the same instants. This one doubles from `baseMs` up to
 * `capMs`, then stays there, and each wait is drawn between half of it and
 * all of it ("equal jitter"), so retries never line up.
 *
 * `reset()` is also called when the browser says it is online again
 * (`HomePool.connectivityRestored`): the next retry is short. A retry already
 * waiting is not cut short (websocket-ts has no way to), which the ceiling
 * bounds.
 */
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_CAP_MS = 30_000;

export class JitteredBackoff {
  private step = 0;
  private count = 0;
  private value = 0;

  constructor(
    private readonly baseMs: number = RECONNECT_BASE_MS,
    private readonly capMs: number = RECONNECT_CAP_MS,
    private readonly random: () => number = Math.random,
  ) {}

  get retries(): number {
    return this.count;
  }

  get current(): number {
    return this.value;
  }

  next(): number {
    this.count++;
    const ceiling = Math.min(this.capMs, this.baseMs * 2 ** this.step);
    if (ceiling < this.capMs) this.step++;
    this.value = Math.round(ceiling / 2 + this.random() * (ceiling / 2));
    return this.value;
  }

  reset(): void {
    this.step = 0;
    this.count = 0;
    this.value = 0;
  }
}
