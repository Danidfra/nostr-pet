import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NPool } from '@nostrify/nostrify';
import { failingSocketClass } from '@/test/failing-socket';
import { createHomePool } from './home-pool';
import { JitteredBackoff, RECONNECT_CAP_MS } from './relay-backoff';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the reconnection schedule', () => {
  it('doubles from one second, never past the ceiling, each wait between half and all of its step', () => {
    const low = new JitteredBackoff(1000, 30_000, () => 0);
    const high = new JitteredBackoff(1000, 30_000, () => 1);
    const lows = Array.from({ length: 10 }, () => low.next());
    const highs = Array.from({ length: 10 }, () => high.next());
    expect(highs).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000, 30000]);
    expect(lows).toEqual(highs.map((v) => v / 2));
    expect(high.retries).toBe(10);
    high.reset();
    expect([high.retries, high.next()]).toEqual([0, 1000]);
  });
});

describe('a relay that never connects, through the pool', () => {
  async function run(hours: number, during?: (pool: NPool, waits: number[]) => Promise<void>) {
    vi.useFakeTimers();
    const sockets: { url: string; closedAt: number | null }[] = [];
    vi.stubGlobal('WebSocket', failingSocketClass(sockets));
    const waits: number[] = [];
    const pool = createHomePool({ relays: ['wss://down.test'], hints: [], transport: null, log: (e) => void (e.ns === 'relay.ws.retry' && waits.push((e as unknown as { backoff: number }).backoff)) });
    const stop = new AbortController();
    const sub = (async () => {
      try {
        for await (const msg of pool.relay('wss://down.test').req([{ kinds: [31124] }], { signal: stop.signal })) void msg;
      } catch {
        /* aborted */
      }
    })();
    await vi.advanceTimersByTimeAsync(hours * 60 * 60_000);
    await during?.(pool, waits);
    stop.abort();
    await pool.close().catch(() => {});
    await vi.advanceTimersByTimeAsync(10);
    await sub;
    return { sockets, waits };
  }

  it('keeps trying at most every 30 s, one socket at a time', async () => {
    const { sockets, waits } = await run(2);
    expect(Math.max(...waits)).toBeLessThanOrEqual(RECONNECT_CAP_MS);
    // Two hours at about 15 to 30 s each: hundreds of tries, not eleven
    expect(waits.length).toBeGreaterThan(200);
    // Never two sockets open at once for the same relay
    const open = sockets.filter((s) => s.closedAt === null);
    expect(open.length).toBeLessThanOrEqual(1);
  }, 30_000);

  it('back online: the next try is a short one', async () => {
    const { waits } = await run(1, async (pool, w) => {
      (pool as NPool & { connectivityRestored(): void }).connectivityRestored();
      const before = w.length;
      // The retry already waiting runs on its own schedule (websocket-ts logs it when it fires); the one after is short
      await vi.advanceTimersByTimeAsync(RECONNECT_CAP_MS + 2_000);
      expect(w.length).toBeGreaterThan(before + 1);
      expect(w[before + 1]).toBeLessThanOrEqual(1000);
    });
    expect(waits.length).toBeGreaterThan(0);
  }, 30_000);
});
