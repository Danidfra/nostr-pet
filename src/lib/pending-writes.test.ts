import { describe, expect, it } from 'vitest';
import { hasUnsaved, holdUnsaved, pendingWrites, trackWrite, whenWritesSettle } from './pending-writes';

describe('pending writes', () => {
  it('counts a write until it settles, failed or not, and resolves the wait after the last', async () => {
    let ok!: () => void;
    let fail!: (e: Error) => void;
    const a = trackWrite(new Promise<void>((r) => (ok = r)));
    const b = trackWrite(new Promise<void>((_, r) => (fail = r))).catch(() => {});
    expect(pendingWrites()).toBe(2);
    let settled = false;
    const wait = whenWritesSettle().then(() => (settled = true));
    ok();
    await a;
    expect(settled).toBe(false);
    fail(new Error('relay down'));
    await b;
    await wait;
    expect([pendingWrites(), settled]).toEqual([0, true]);
  });

  it('holds unsaved work until released, once', () => {
    const release = holdUnsaved('x');
    expect(hasUnsaved()).toBe(true);
    release();
    release();
    expect(hasUnsaved()).toBe(false);
  });
});
