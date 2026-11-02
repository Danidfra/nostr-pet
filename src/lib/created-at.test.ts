import { describe, expect, it } from 'vitest';
import { MAX_STAMP_AHEAD_S, stampAfter } from './created-at';

/** NIP-01: the newer created_at wins, then the lower id. */
function winner(a: { created_at: number; id: string }, b: { created_at: number; id: string }) {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? a : b;
  return a.id < b.id ? a : b;
}

describe('stampAfter', () => {
  it('is the clock on a first publish, or once time has moved past prev', () => {
    expect(stampAfter(undefined, 1000)).toBe(1000);
    expect(stampAfter(900, 1000)).toBe(1000);
    expect(stampAfter(999, 1000)).toBe(1000);
  });

  it('lands after prev written in the same second, whatever the ids', () => {
    const prev = { created_at: 1000, id: '0000' };
    const next = { created_at: stampAfter(prev.created_at, 1000), id: 'ffff' };
    expect(next.created_at).toBe(1001);
    // Without the bump, the higher id would have lost the tie
    expect(winner(prev, { created_at: 1000, id: 'ffff' })).toBe(prev);
    expect(winner(prev, next)).toBe(next);
  });

  it('lands after prev from a device whose clock is a little ahead (skew within the bound)', () => {
    expect(stampAfter(1030, 1000)).toBe(1031);
    expect(stampAfter(1000 + MAX_STAMP_AHEAD_S - 1, 1000)).toBe(1000 + MAX_STAMP_AHEAD_S);
  });

  it('never chases a prev stamped further ahead than the bound', () => {
    expect(stampAfter(1000 + MAX_STAMP_AHEAD_S, 1000)).toBe(1000);
    expect(stampAfter(1000 + 3600, 1000)).toBe(1000);
    expect(stampAfter(1000 + 365 * 86400, 1000)).toBe(1000);
  });

  it('keeps rapid repeated writes within the bound, and the clock catches up once they stop', () => {
    let prev = 1000;
    let maxAhead = 0;
    // 500 writes within one second of wall time, each over the one before
    for (let i = 0; i < 500; i++) {
      const next = stampAfter(prev, 1000);
      maxAhead = Math.max(maxAhead, next - 1000);
      prev = next;
    }
    expect(maxAhead).toBe(MAX_STAMP_AHEAD_S);
    // At the bound, the next write goes back to the clock instead of further ahead
    expect(stampAfter(1000 + MAX_STAMP_AHEAD_S, 1000)).toBe(1000);
    // A minute later, with no writes in between, the clock is past every stamp
    expect(stampAfter(1000 + MAX_STAMP_AHEAD_S, 1000 + MAX_STAMP_AHEAD_S + 1)).toBe(1000 + MAX_STAMP_AHEAD_S + 1);
  });

  it('ignores a prev time that is not a number', () => {
    expect(stampAfter(Number.NaN, 1000)).toBe(1000);
    expect(stampAfter(Number.POSITIVE_INFINITY, 1000)).toBe(1000);
  });
});
