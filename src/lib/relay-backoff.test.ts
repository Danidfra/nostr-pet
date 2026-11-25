import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NPool } from '@nostrify/nostrify';
import { failingSocketClass } from '@/test/failing-socket';
import { createHomePool, type HomePoolControls } from './home-pool';
import { JitteredBackoff, RECONNECT_CAP_HIDDEN_MS, RECONNECT_CAP_LONG_MS, RECONNECT_CAP_MID_MS, RECONNECT_CAP_MS } from './relay-backoff';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the reconnection schedule', () => {
  it('doubles from one second up to a ceiling that grows with how long the relay has been failing', () => {
    let now = 0;
    const b = new JitteredBackoff(1000, { now: () => now, random: () => 1, hidden: () => false });
    expect(Array.from({ length: 7 }, () => b.next())).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    // Past five minutes the step keeps doubling, now up to two minutes
    now = 6 * 60_000;
    expect([b.next(), b.next(), b.next(), b.next()]).toEqual([32_000, 64_000, RECONNECT_CAP_MID_MS, RECONNECT_CAP_MID_MS]);
    // Past thirty minutes, up to five
    now = 31 * 60_000;
    expect([b.next(), b.next(), b.next()]).toEqual([128_000, 256_000, RECONNECT_CAP_LONG_MS]);
    b.reset();
    expect([b.retries, b.next()]).toEqual([0, 1000]);
  });

  it('each wait is between half and all of its step; a hidden page waits up to ten minutes', () => {
    const low = new JitteredBackoff(1000, { now: () => 0, random: () => 0, hidden: () => false });
    expect([low.next(), low.next()]).toEqual([500, 1000]);
    const hidden = new JitteredBackoff(1000, { now: () => 0, random: () => 1, hidden: () => true });
    const waits = Array.from({ length: 12 }, () => hidden.next());
    expect(Math.max(...waits)).toBe(RECONNECT_CAP_HIDDEN_MS);
    expect(hidden.ceiling()).toBe(RECONNECT_CAP_HIDDEN_MS);
  });
});

describe('a relay that never connects, through the pool', () => {
  async function run(hours: number, opts: { hidden?: boolean; during?: (pool: NPool & HomePoolControls, waits: number[], sockets: { closedAt: number | null }[]) => Promise<void> } = {}) {
    vi.useFakeTimers();
    const sockets: { url: string; closedAt: number | null }[] = [];
    vi.stubGlobal('WebSocket', failingSocketClass(sockets));
    const hiddenSpy = opts.hidden ? vi.spyOn(document, 'hidden', 'get').mockReturnValue(true) : null;
    const waits: number[] = [];
    const pool = createHomePool({ relays: ['wss://down.test'], hints: [], transport: null, log: (e) => void (e.ns === 'relay.ws.retry' && waits.push((e as unknown as { backoff: number }).backoff)) });
    const stop = new AbortController();
    let streams = 0;
    let ended = 0;
    // A subscription that follows again whenever its stream ends (as the travel subscription does)
    const follow = (async () => {
      while (!stop.signal.aborted) {
        streams++;
        try {
          for await (const msg of pool.relay('wss://down.test').req([{ kinds: [31124] }], { signal: stop.signal })) void msg;
        } catch {
          /* ended */
        }
        ended++;
        if (!stop.signal.aborted) await new Promise((r) => setTimeout(r, 2_000));
      }
    })();
    await vi.advanceTimersByTimeAsync(hours * 60 * 60_000);
    await opts.during?.(pool, waits, sockets);
    stop.abort();
    hiddenSpy?.mockRestore();
    await pool.close().catch(() => {});
    await vi.advanceTimersByTimeAsync(2_100);
    await follow;
    return { sockets, waits, streams, ended };
  }

  it('two hours: tens of tries, not hundreds; never more than five minutes apart; one socket at a time', async () => {
    const { sockets, waits } = await run(2);
    expect(waits.length).toBeGreaterThan(40);
    expect(waits.length).toBeLessThan(90);
    expect(Math.max(...waits)).toBeLessThanOrEqual(RECONNECT_CAP_LONG_MS);
    expect(sockets.filter((s) => s.closedAt === null).length).toBeLessThanOrEqual(1);
  }, 30_000);

  it('a hidden page tries far less', async () => {
    const { waits } = await run(2, { hidden: true });
    expect(waits.length).toBeLessThan(35);
  }, 30_000);

  it('back online after an hour: the stuck connection is replaced and the next try comes at once; the old subscription ends, a new one follows; one socket at a time', async () => {
    const out = await run(1, {
      during: async (pool, _waits, sockets) => {
        const before = sockets.length;
        const connection = pool.relays.get('wss://down.test');
        pool.connectivityRestored();
        await vi.advanceTimersByTimeAsync(2_500);
        // Replaced: a new connection object for the relay
        expect(pool.relays.get('wss://down.test')).not.toBe(connection);
        // A fresh connection within a couple of seconds, not after the five-minute wait that was scheduled
        expect(sockets.length).toBeGreaterThan(before);
        expect(sockets.filter((s) => s.closedAt === null).length).toBeLessThanOrEqual(1);
        // A second call right after replaces nothing more
        const now = sockets.length;
        pool.connectivityRestored();
        await vi.advanceTimersByTimeAsync(50);
        expect(sockets.length - now).toBeLessThanOrEqual(1);
      },
    });
    expect(out.streams - out.ended).toBe(0);
  }, 30_000);

  it('a write on its way is never cut off: that connection is not replaced', async () => {
    await run(1, {
      during: async (pool, _waits, sockets) => {
        const event = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), kind: 1, created_at: 1, tags: [], content: '', sig: 'c'.repeat(128) };
        const write = pool.event(event, { relays: ['wss://down.test'], signal: AbortSignal.timeout(60 * 60_000) }).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(10);
        const connection = pool.relays.get('wss://down.test');
        pool.connectivityRestored();
        await vi.advanceTimersByTimeAsync(2_500);
        // Not replaced: the same connection, still holding the write
        expect(pool.relays.get('wss://down.test')).toBe(connection);
        expect(sockets.filter((s) => s.closedAt === null).length).toBeLessThanOrEqual(1);
        void write;
      },
    });
  }, 30_000);
});
