/**
 * The session's safety, ritual by ritual, over a fake host (M15 care
 * refinement): exactly one write, after the last stage and held against a
 * cancel (`protect`); a cancel at every stage of every ritual writes
 * nothing and gives everything back; a failed write waits for the player
 * and Try again is the host's retry of the same write, never a second
 * commit; a soak whose walk is stopped writes nothing; hygiene full is
 * refused before anything starts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBathSession, type BathCommitOutcome, type BathHost, type BathItem, type BathSession } from './useBathSession';
import { RITUALS, type RitualDef } from './rituals';

const ITEM = (itemId: string): BathItem => ({ choice: { source: 'starter', entry: { item: { itemId, name: itemId, glyph: { type: 'emoji', text: '•' } } } } as never, name: itemId, glyph: { type: 'emoji', text: '•' } as never });
const RITUAL_ITEMS: [RitualDef, string][] = [[RITUALS.soap, 'blobbi:hygiene:soap'], [RITUALS.shampoo, 'blobbi:hygiene:shampoo'], [RITUALS.towel, 'blobbi:hygiene:soft-towel'], [RITUALS.soak, 'blobbi:hygiene:bubble-bath']];

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function setup(over: Partial<BathHost> = {}) {
  const calls = { commit: 0, retry: 0, leave: 0, enter: 0, exit: 0, landed: 0, notify: [] as string[] };
  const host: BathHost = {
    name: 'Lupa',
    reducedMotion: false,
    hygiene: 40,
    // The jumps take their time, as the hosts' do (a walk and an arc in, an arc out)
    enter: async (run) => { calls.enter++; await run.wait(400); return true; },
    exit: async (run) => { calls.exit++; await run.wait(400); },
    leave: () => { calls.leave++; },
    commit: async () => { calls.commit++; return { kind: 'landed' }; },
    retry: async () => { calls.retry++; return { kind: 'landed' }; },
    onLanded: () => { calls.landed++; },
    face: () => {},
    gaze: () => {},
    gesture: () => {},
    play: () => {},
    notify: (t) => calls.notify.push(t),
    ...over,
  };
  const hook = renderHook(() => useBathSession(host));
  return { hook, calls, s: () => hook.result.current };
}

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/** Play the stage on screen the way a player would (rub across the body, hold the shower, or wait). */
async function playStage(session: () => BathSession) {
  const view = session().view;
  if (view?.stage?.kind === 'script') {
    await tick(150);
    return;
  }
  const kind = view?.stage?.kind;
  if (kind === 'rub' || kind === 'dry-rub' || kind === 'rinse') {
    // The layer takes the rubbing once the outline is known
    for (let i = 0; i < 20 && !session().view?.ready; i++) await tick(50);
  }
  if (kind === 'rub' || kind === 'dry-rub') {
    for (let col = 0; col < 8 && session().view?.stage?.kind === kind; col++) {
      const x = (col + 0.5) / 8;
      act(() => session().input.down({ x, y: 0.02 }));
      for (let k = 1; k <= 12; k++) act(() => session().input.move({ x, y: 0.02 + (0.96 * k) / 12 }));
      act(() => session().input.up());
    }
    await tick(800);
  } else if (kind === 'rinse') {
    for (let col = 0; col < 8 && session().view?.stage?.kind === 'rinse'; col++) {
      act(() => session().input.down({ x: (col + 0.5) / 8, y: 0.9 }));
      await tick(700);
      act(() => session().input.up());
    }
    await tick(800);
  } else await tick(100);
}

async function playTo(session: () => BathSession, stageIndex: number) {
  for (let guard = 0; guard < 200 && session().view?.status === 'stage' && session().view!.frame.stage!.index < stageIndex; guard++) await playStage(session);
}

async function playAll(session: () => BathSession) {
  for (let guard = 0; guard < 200 && session().view?.status === 'stage'; guard++) await playStage(session);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the session', () => {
  for (const [ritual, itemId] of RITUAL_ITEMS) {
    it(`${ritual.style}: played through, exactly one write after the last stage, then the celebration, then gone`, async () => {
      const { calls, s } = setup();
      act(() => { expect(s().start(ITEM(itemId))).toBe(true); });
      await tick(800);
      expect(s().view?.ritual).toBe(ritual);
      await playAll(s);
      await tick(100);
      expect(calls.commit).toBe(1);
      expect(calls.landed).toBe(1);
      await tick(5_000);
      expect(s().view).toBeNull();
      expect(calls.commit).toBe(1);
      expect(calls.retry).toBe(0);
      expect(calls.leave).toBe(1);
      // A soak jumps in and out of the tub; the others never go to it
      expect(calls.enter).toBe(ritual.place === 'tub' ? 1 : 0);
      expect(calls.exit).toBe(ritual.place === 'tub' ? 1 : 0);
    });

    it(`${ritual.style}: a cancel at every stage writes nothing and gives everything back`, async () => {
      for (let index = 0; index < ritual.stages.length; index++) {
        const { calls, s, hook } = setup();
        act(() => { s().start(ITEM(itemId)); });
        await tick(50);
        await playTo(s, index);
        expect(s().view?.frame.stage?.index).toBe(index);
        act(() => s().cancel('stopped'));
        await tick(6_000);
        expect(calls.commit).toBe(0);
        expect(calls.leave).toBe(1);
        expect(s().view).toBeNull();
        hook.unmount();
      }
    });

    it(`${ritual.style}: the write is held against a cancel (protect): asked during it, it lands first and is not written twice`, async () => {
      const write = deferred<BathCommitOutcome>();
      const { calls, s } = setup({ commit: () => { calls.commit++; return write.promise; } });
      act(() => { s().start(ITEM(itemId)); });
      await tick(800);
      await playAll(s);
      expect(s().view?.status).toBe('committing');
      act(() => s().cancel('room'));
      await tick(200);
      // Still on its way: the cancel waits
      expect(s().view?.status).toBe('committing');
      expect(calls.leave).toBe(0);
      await act(async () => { write.resolve({ kind: 'landed' }); await vi.advanceTimersByTimeAsync(50); });
      expect(calls.landed).toBe(1);
      await tick(3_000);
      expect(s().view).toBeNull();
      expect(calls.leave).toBe(1);
      expect(calls.commit).toBe(1);
    });
  }

  it('a failed write waits for the player (never by itself); Try again is the host’s retry of the same write, once', async () => {
    const choices: unknown[] = [];
    const { calls, s } = setup({
      commit: async (choice) => { calls.commit++; choices.push(choice); return { kind: 'failed', error: 'offline' }; },
      retry: async (choice) => { calls.retry++; choices.push(choice); return { kind: 'landed' }; },
    });
    const item = ITEM('blobbi:hygiene:soap');
    act(() => { s().start(item); });
    await tick(800);
    await playAll(s);
    await tick(100);
    expect(s().view?.status).toBe('failed');
    expect(s().view?.error).toBe('offline');
    await tick(20_000);
    expect(calls.commit).toBe(1);
    expect(calls.retry).toBe(0);
    act(() => s().retry());
    await tick(100);
    expect(calls.retry).toBe(1);
    expect(calls.commit).toBe(1);
    expect(choices).toEqual([item.choice, item.choice]);
    // A second tap after it landed does nothing
    act(() => s().retry());
    await tick(3_000);
    expect(calls.retry).toBe(1);
  });

  it('a soak whose walk to the tub is stopped writes nothing', async () => {
    const { calls, s } = setup({ enter: async () => { calls.enter++; return false; } });
    act(() => { s().start(ITEM('blobbi:hygiene:bubble-bath')); });
    await tick(3_000);
    expect(calls.enter).toBe(1);
    expect(calls.commit).toBe(0);
    expect(s().view).toBeNull();
  });

  it('a soak with no tub here (no enter) is played in place: no walk, the write after the play', async () => {
    const { calls, s } = setup({ enter: null });
    act(() => { s().start(ITEM('blobbi:hygiene:bubble-bath')); });
    await tick(200);
    expect(s().view?.inPlace).toBe(true);
    expect(s().view?.frame.place).toBe('in-place');
    await playAll(s);
    await tick(100);
    expect(calls.commit).toBe(1);
    expect(calls.exit).toBe(0);
  });

  it('hygiene full: refused with a word, nothing starts, nothing is written', async () => {
    const { calls, s } = setup({ hygiene: 100 });
    act(() => { expect(s().start(ITEM('blobbi:hygiene:soap'))).toBe(false); });
    await tick(2_000);
    expect(calls.notify[0]).toMatch(/squeaky clean/);
    expect(s().view).toBeNull();
    expect(calls.commit).toBe(0);
  });

  it('one ritual at a time: a second start while one is under way is refused', async () => {
    const { s } = setup();
    act(() => { s().start(ITEM('blobbi:hygiene:soap')); });
    await tick(100);
    act(() => { expect(s().start(ITEM('blobbi:hygiene:soft-towel'))).toBe(false); });
    expect(s().view?.ritual).toBe(RITUALS.soap);
  });
});
