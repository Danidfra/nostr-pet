import { describe, expect, it } from 'vitest';
import { orderChoices, replaces, type GlobalChoiceFacts, type LocalChoiceFacts } from './choice-order';

/**
 * "Choice order v1" vectors. Blobbi Pixel's `tests/companion-order.test.ts` carries the very same table: both apps
 * must give the same answer for the same facts. Times: `now` = 1_800_000_000_000 ms; profile times in seconds.
 */
const NOW = 1_800_000_000_000;
const S = NOW / 1000;
const A = 'blobbi-aaaaaaaaaaaa-0000000001';
const B = 'blobbi-aaaaaaaaaaaa-0000000002';
const id = (c: string) => c.repeat(64);
const g = (d: string, createdAt: number, i = 'b'): GlobalChoiceFacts => ({ d, createdAt, id: id(i) });
const l = (d: string, at: number | null, by: LocalChoiceFacts['by'], synced: LocalChoiceFacts['synced'] = null, over: LocalChoiceFacts['over'] = null): LocalChoiceFacts => ({ d, at, by, synced, over });

const CHOICE_ORDER_VECTORS: { name: string; local: LocalChoiceFacts | null; global: GlobalChoiceFacts | null; winner: string }[] = [
  { name: 'nothing anywhere', local: null, global: null, winner: 'none' },
  { name: 'only this device', local: l(A, NOW - 5_000, 'player'), global: null, winner: 'local' },
  { name: 'only the profile (Ditto, Pixel or another device chose)', local: null, global: g(B, S - 10), winner: 'global' },
  { name: 'both name the same Blobbi', local: l(A, NOW - 5_000, 'player'), global: g(A, S - 999), winner: 'agree' },
  // A published choice never blocks a later global one
  { name: 'published here, then a newer profile elsewhere', local: l(A, NOW - 600_000, 'player', { id: id('c'), createdAt: S - 600 }), global: g(B, S - 300), winner: 'global' },
  { name: 'published here; a relay still shows an older profile', local: l(A, NOW - 60_000, 'player', { id: id('c'), createdAt: S - 60 }), global: g(B, S - 600), winner: 'local' },
  { name: 'published here; another profile at the same second with a lower id', local: l(A, NOW - 60_000, 'player', { id: id('c'), createdAt: S - 60 }), global: g(B, S - 60, 'a'), winner: 'global' },
  { name: 'published here; another profile at the same second with a higher id', local: l(A, NOW - 60_000, 'player', { id: id('c'), createdAt: S - 60 }), global: g(B, S - 60, 'd'), winner: 'local' },
  { name: 'adopted from the profile, then a newer profile', local: l(A, (S - 900) * 1000, 'remote', { id: id('c'), createdAt: S - 900 }), global: g(B, S - 30), winner: 'global' },
  { name: 'adopted (time only), newer profile', local: l(A, (S - 900) * 1000, 'remote'), global: g(B, S - 899), winner: 'global' },
  { name: 'adopted (time only), same time', local: l(A, (S - 900) * 1000, 'remote'), global: g(B, S - 900), winner: 'ambiguous' },
  { name: 'old device pick (before stamps)', local: l(A, null, 'legacy'), global: g(B, S - 86_400), winner: 'global' },
  // Not yet published (offline, refused signature, no profile): this device's clock, with a margin
  { name: 'unpublished, profile clearly newer', local: l(A, NOW - 600_000, 'player'), global: g(B, S - 300), winner: 'global' },
  { name: 'unpublished, choice clearly newer', local: l(A, NOW - 60_000, 'player'), global: g(B, S - 3_600), winner: 'local' },
  { name: 'unpublished, within the margin', local: l(A, NOW - 100_000, 'player'), global: g(B, S - 70), winner: 'ambiguous' },
  { name: 'unpublished, exactly at the margin', local: l(A, NOW - 120_000, 'player'), global: g(B, S - 60), winner: 'ambiguous' },
  { name: 'unpublished, choice in the future', local: l(A, NOW + 3_600_000, 'player'), global: g(B, S - 60), winner: 'ambiguous' },
  { name: 'unpublished, profile in the future', local: l(A, NOW - 60_000, 'player'), global: g(B, S + 3_600), winner: 'ambiguous' },
  { name: 'no time at all', local: l(A, null, null), global: g(B, S - 60), winner: 'ambiguous' },
  // Chosen over the profile the player was shown: that profile never overrides the choice, however close in time
  { name: 'unpublished, chosen over this very profile', local: l(A, NOW - 10_000, 'player', null, { id: id('b'), createdAt: S - 30 }), global: g(B, S - 30), winner: 'local' },
  { name: 'unpublished, chosen over a newer profile than this one', local: l(A, NOW - 10_000, 'player', null, { id: id('c'), createdAt: S - 20 }), global: g(B, S - 30), winner: 'local' },
  { name: 'unpublished, the profile rewritten since but naming what the player saw', local: l(A, NOW - 10_000, 'player', null, { id: id('c'), createdAt: S - 900, d: B }), global: g(B, S - 5), winner: 'local' },
  { name: 'unpublished, a profile made since the choice, close in time', local: l(A, NOW - 100_000, 'player', null, { id: id('c'), createdAt: S - 900 }), global: g(B, S - 70), winner: 'ambiguous' },
  { name: 'unpublished, a profile made clearly after the choice', local: l(A, NOW - 600_000, 'player', null, { id: id('c'), createdAt: S - 900 }), global: g(B, S - 60), winner: 'global' },
];

describe('choice order v1', () => {
  it.each(CHOICE_ORDER_VECTORS)('$name → $winner', ({ local, global, winner }) => {
    expect(orderChoices(local, global, NOW).winner).toBe(winner);
  });

  it('orders replaceable events as NIP-01 does', () => {
    expect(replaces({ id: id('b'), createdAt: 2 }, { id: id('a'), createdAt: 1 })).toBe(true);
    expect(replaces({ id: id('a'), createdAt: 1 }, { id: id('b'), createdAt: 1 })).toBe(true);
    expect(replaces({ id: id('b'), createdAt: 1 }, { id: id('a'), createdAt: 1 })).toBe(false);
  });

  it('a stale local choice can never keep beating newer global choices', () => {
    // Every local choice, published or not, is overtaken by a profile made clearly later
    for (const local of [l(A, NOW - 3_600_000, 'player'), l(A, NOW - 3_600_000, 'player', { id: id('c'), createdAt: S - 3_600 }), l(A, null, 'legacy'), l(A, (S - 3_600) * 1000, 'remote')]) {
      expect(orderChoices(local, g(B, S - 60), NOW).winner).toBe('global');
    }
  });
});
