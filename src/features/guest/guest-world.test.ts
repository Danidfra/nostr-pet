import { describe, expect, it } from 'vitest';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE } from '@blobbi-kit/core';
import type { NostrEvent } from '@nostrify/nostrify';
import { GUEST_RECEIPT_CAP, applyGuestEvent, guestBlobbiEvent, guestProfileEvent, isAboutGuest, queryGuestEvents } from './guest-world';

const PK = 'c'.repeat(64);
let n = 0;
const ev = (kind: number, tags: string[][] = [], created_at?: number): NostrEvent => {
  n += 1;
  return { id: String(n).padStart(64, '0'), pubkey: PK, kind, created_at: created_at ?? n, tags, content: '', sig: '' };
};

describe('guest-world', () => {
  it('replaces addressable and replaceable kinds by (kind, pubkey, d) and appends the rest', () => {
    let world = applyGuestEvent([], ev(KIND_BLOBBI_STATE, [['d', 'blobbi-1']]));
    world = applyGuestEvent(world, ev(KIND_BLOBBI_STATE, [['d', 'blobbi-1'], ['stage', 'baby']]));
    world = applyGuestEvent(world, ev(KIND_BLOBBONAUT_PROFILE, [['d', 'p']]));
    world = applyGuestEvent(world, ev(KIND_BLOBBONAUT_PROFILE, [['d', 'p'], ['xp', '5']]));
    world = applyGuestEvent(world, ev(KIND_BLOBBI_INTERACTION));
    world = applyGuestEvent(world, ev(KIND_BLOBBI_INTERACTION));
    expect(world.filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(world.find((e) => e.kind === KIND_BLOBBI_STATE)?.tags).toContainEqual(['stage', 'baby']);
    expect(world.filter((e) => e.kind === KIND_BLOBBONAUT_PROFILE)).toHaveLength(1);
    expect(world.filter((e) => e.kind === KIND_BLOBBI_INTERACTION)).toHaveLength(2);
  });

  it('caps the receipts, oldest first, and never touches the Blobbi state', () => {
    let world = applyGuestEvent([], ev(KIND_BLOBBI_STATE, [['d', 'blobbi-1']]));
    for (let i = 0; i < GUEST_RECEIPT_CAP + 10; i += 1) world = applyGuestEvent(world, ev(KIND_BLOBBI_INTERACTION));
    const receipts = world.filter((e) => e.kind === KIND_BLOBBI_INTERACTION);
    expect(receipts).toHaveLength(GUEST_RECEIPT_CAP);
    expect(world.some((e) => e.kind === KIND_BLOBBI_STATE)).toBe(true);
    // The newest are the ones kept
    expect(Math.min(...receipts.map((e) => e.created_at))).toBeGreaterThan(10);
  });

  it('answers filters as a relay would, each event once, newest first', () => {
    const a = ev(KIND_BLOBBI_STATE, [['d', 'blobbi-1'], ['b', 'blobbi:ecosystem:v1']], 10);
    const b = ev(KIND_BLOBBI_INTERACTION, [], 20);
    const world = [a, b];
    expect(queryGuestEvents(world, [{ kinds: [KIND_BLOBBI_STATE], authors: [PK], '#b': ['blobbi:ecosystem:v1'] }])).toEqual([a]);
    expect(queryGuestEvents(world, [{ authors: [PK] }, { kinds: [KIND_BLOBBI_INTERACTION] }]).map((e) => e.id)).toEqual([b.id, a.id]);
    expect(queryGuestEvents(world, [{ authors: ['d'.repeat(64)] }])).toEqual([]);
  });

  it('knows which filters are about the guest alone', () => {
    expect(isAboutGuest({ authors: [PK] }, PK)).toBe(true);
    expect(isAboutGuest({ authors: [PK, 'e'.repeat(64)] }, PK)).toBe(false);
    expect(isAboutGuest({ kinds: [31632] }, PK)).toBe(false);
    expect(isAboutGuest({ authors: [] }, PK)).toBe(false);
  });

  it('finds the latest Blobbi state and the profile', () => {
    const world = [ev(KIND_BLOBBI_STATE, [['d', 'blobbi-1'], ['stage', 'egg']], 1), ev(KIND_BLOBBI_STATE, [['d', 'blobbi-1'], ['stage', 'baby']], 2), ev(KIND_BLOBBONAUT_PROFILE, [['d', 'p']], 3)];
    expect(guestBlobbiEvent(world, 'blobbi-1')?.tags).toContainEqual(['stage', 'baby']);
    expect(guestBlobbiEvent(world, null)).toBeUndefined();
    expect(guestProfileEvent(world)?.kind).toBe(KIND_BLOBBONAUT_PROFILE);
  });
});
