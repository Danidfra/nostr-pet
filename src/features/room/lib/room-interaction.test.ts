import { describe, expect, it } from 'vitest';
import { Interrupted, createDirector, type Run } from './room-interaction';

/** Timers the test fires by hand. */
function timers() {
  const pending: { fn: () => void; ms: number; id: number }[] = [];
  let id = 0;
  return {
    pending,
    setTimer: (fn: () => void, ms: number) => {
      const handle = { fn, ms, id: ++id };
      pending.push(handle);
      return handle.id;
    },
    clearTimer: (handle: unknown) => {
      const i = pending.findIndex((p) => p.id === handle);
      if (i >= 0) pending.splice(i, 1);
    },
    fire: () => {
      const next = pending.shift();
      next?.fn();
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the interaction director', () => {
  it('runs a script to its end, calling what it borrowed back in reverse, and reports done', async () => {
    const t = timers();
    const director = createDirector({ setTimer: t.setTimer, clearTimer: t.clearTimer, hidden: () => false });
    const log: string[] = [];
    const run = director.start('feed', async (r) => {
      r.cleanup(() => log.push('face back'));
      log.push('notice');
      await r.wait(400);
      r.cleanup(() => log.push('dish gone'));
      log.push('eat');
    });
    expect(director.current()).toBe(run);
    await tick();
    expect(log).toEqual(['notice']);
    t.fire();
    await expect(run.ended).resolves.toBe('done');
    expect(log).toEqual(['notice', 'eat', 'dish gone', 'face back']);
    expect(director.current()).toBeNull();
  });

  it('a cancel ends a wait and a pending promise at once with the reason, and still gives everything back', async () => {
    const t = timers();
    const director = createDirector({ setTimer: t.setTimer, clearTimer: t.clearTimer, hidden: () => false });
    const log: string[] = [];
    let caught: unknown = null;
    const walk = new Promise<string>(() => {}); // never settles by itself
    const run = director.start('play', async (r) => {
      r.cleanup(() => log.push('ball gone'));
      try {
        await r.wait(1000);
      } catch (e) {
        caught = e;
        throw e;
      } finally {
        log.push('after wait');
      }
      await r.until(walk);
      log.push('never');
    });
    await tick();
    run.cancel('room');
    await expect(run.ended).resolves.toBe('room');
    expect(caught).toBeInstanceOf(Interrupted);
    expect((caught as Interrupted).reason).toBe('room');
    // What was borrowed goes back the moment the cancel comes, before the script has even seen it
    expect(log).toEqual(['ball gone', 'after wait']);
    expect(t.pending).toHaveLength(0);
    // A second cancel changes nothing
    run.cancel('teleport');
    await expect(run.ended).resolves.toBe('room');
  });

  it('a promise that settles after a cancel is forgotten: the script sees the interruption, not the value', async () => {
    const director = createDirector({ hidden: () => false });
    let resolveWalk!: (v: string) => void;
    const walk = new Promise<string>((r) => (resolveWalk = r));
    let seen: unknown = null;
    const run = director.start('play', async (r) => {
      try {
        seen = await r.until(walk);
      } catch (e) {
        seen = e;
      }
    });
    await tick();
    run.cancel('stopped');
    resolveWalk('arrived');
    await run.ended;
    expect(seen).toBeInstanceOf(Interrupted);
  });

  it('starting another script replaces the one under way, which ends `replaced` before the new one begins', async () => {
    const director = createDirector({ hidden: () => false });
    const order: string[] = [];
    const first = director.start('first', async (r) => {
      r.cleanup(() => order.push('first cleaned'));
      await r.wait(5000);
    });
    await tick();
    const second = director.start('second', async () => {
      order.push('second ran');
    });
    await expect(first.ended).resolves.toBe('replaced');
    await expect(second.ended).resolves.toBe('done');
    expect(order).toEqual(['first cleaned', 'second ran']);
    expect(second.id).toBeGreaterThan(first.id);
  });

  it('a protected moment finishes before a cancel takes effect, and the cancel then takes effect', async () => {
    const director = createDirector({ hidden: () => false });
    let resolveWrite!: (v: 'landed') => void;
    const write = new Promise<'landed'>((r) => (resolveWrite = r));
    const log: string[] = [];
    const run = director.start('feed', async (r) => {
      const result = await r.protect(() => write);
      log.push(result);
      expect(r.cancelled).toBe(true);
      // The next wait is cut at once
      await r.wait(1000);
      log.push('celebrated');
    });
    await tick();
    run.cancel('room');
    // Still running: the write is protected
    expect(director.current()).toBe(run);
    expect(log).toEqual([]);
    resolveWrite('landed');
    await expect(run.ended).resolves.toBe('room');
    expect(log).toEqual(['landed']);
  });

  it('in a hidden tab a wait is not kept, and a script that throws ends failed and is reported', async () => {
    const t = timers();
    const errors: unknown[] = [];
    const director = createDirector({ setTimer: t.setTimer, clearTimer: t.clearTimer, hidden: () => true, onError: (e) => errors.push(e) });
    const quick = director.start('a', async (r) => {
      await r.wait(10_000);
    });
    await expect(quick.ended).resolves.toBe('done');
    expect(t.pending).toHaveLength(0);
    const broken = director.start('b', async () => {
      throw new Error('boom');
    });
    await expect(broken.ended).resolves.toBe('failed');
    expect(errors).toHaveLength(1);
    expect(director.current()).toBeNull();
  });

  it('tells listeners when a run starts and ends', async () => {
    const director = createDirector({ hidden: () => false });
    const seen: (string | null)[] = [];
    director.subscribe((c) => seen.push(c?.name ?? null));
    const run = director.start('feed', async (r: Run) => {
      r.check();
    });
    await run.ended;
    expect(seen).toEqual(['feed', null]);
    director.cancel('room'); // nothing running: nothing happens
    expect(seen).toEqual(['feed', null]);
  });
});
