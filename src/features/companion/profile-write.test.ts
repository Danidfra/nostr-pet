import { describe, expect, it, vi } from 'vitest';
import { getCanonicalBlobbonautD, parseBlobbonautEvent, type NostrEvent } from '@blobbi-kit/core';
import { buildCompanionProfile, preservesProfile, writeCompanionProfile, type ProfileWriteDeps } from './profile-write';
import type { PendingWrite } from './choice-store';
import { BAND, DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';

const NOW = 1_800_000_000_000;
const S = NOW / 1000;

function deps(net: FakeNetwork, acc: TestAccount, over: Partial<ProfileWriteDeps> = {}) {
  const signed: NostrEvent[] = [];
  let pending: PendingWrite | null = null;
  const d: ProfileWriteDeps = {
    relays: net.port,
    sign: async (t) => {
      const e = acc.sign(t);
      signed.push(e);
      return e;
    },
    onSigned: (p) => (pending = p),
    stillAccount: () => true,
    online: () => true,
    now: () => NOW,
    timeoutMs: 50,
    sleep: async () => {},
    ...over,
  };
  return { deps: d, signed, pending: () => pending };
}

const companion = (e: NostrEvent | null | undefined) => (e ? parseBlobbonautEvent(e)?.currentCompanion : undefined);
const newestOn = (net: FakeNetwork, url: string) => net.relays.get(url)!.events.filter((e) => e.kind === 11125).sort((a, b) => b.created_at - a.created_at)[0];

describe('the companion choice written into the profile', () => {
  it('replaces only current_companion: every has, unknown tag, xp and the content survive', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    const base = profileEvent(acc, { has: [a, b, c], companion: a, createdAt: S - 100, extra: [['island_room', 'garden'], ['client', 'Ditto']] });
    net.seed(base);
    const run = deps(net, acc);
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: null }, run.deps);
    expect(out.kind).toBe('saved');
    const written = newestOn(net, DITTO);
    expect(companion(written)).toBe(b);
    expect(written.tags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual([a, b, c]);
    expect(written.tags).toContainEqual(['island_room', 'garden']);
    expect(written.tags).toContainEqual(['xp', '420']);
    expect(written.content).toBe(base.content);
    expect(written.created_at).toBeGreaterThan(base.created_at);
    expect(run.signed).toHaveLength(1);
  });

  it('a profile made by a device whose clock runs ahead is still replaced (created_at after the base)', async () => {
    const acc = testAccount();
    const base = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S + 500 });
    expect(buildCompanionProfile(base, acc.pubkey, dOf(acc.pubkey, 2), S).created_at).toBe(S + 501);
  });

  it('lists the chosen Blobbi in has when the profile does not (never removes one)', () => {
    const acc = testAccount();
    const base = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 10 });
    const next = buildCompanionProfile(base, acc.pubkey, dOf(acc.pubkey, 2), S);
    expect(next.tags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual([dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)]);
    expect(preservesProfile(base, next, dOf(acc.pubkey, 2))).toBe(true);
    expect(preservesProfile(base, { ...next, tags: next.tags.filter((t) => t[0] !== 'xp') }, dOf(acc.pubkey, 2))).toBe(false);
    expect(preservesProfile(base, { ...next, content: '' }, dOf(acc.pubkey, 2))).toBe(false);
  });

  it('carries a legacy 31125 profile over into an 11125 with the canonical d', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { kind: 31125, has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 1000 }));
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, deps(net, acc).deps);
    expect(out.kind).toBe('saved');
    const written = newestOn(net, DITTO);
    expect(written.tags).toContainEqual(['d', getCanonicalBlobbonautD(acc.pubkey)]);
  });

  it.each([
    ['a required relay is down', (n: FakeNetwork) => (n.relays.get(PRIMAL)!.down = true)],
    ['a required relay never answers (timeout)', (n: FakeNetwork) => (n.relays.get(DITTO)!.silent = true)],
  ])('never builds a profile from an incomplete read: %s', async (_name, breakIt) => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    breakIt(net);
    const run = deps(net, acc);
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, run.deps)).kind).toBe('unsafe');
    expect(run.signed).toHaveLength(0);
    expect(net.sent()).toHaveLength(0);
  });

  it('an optional relay down or silent does not stop a complete read', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    net.relays.get(BAND)!.silent = true;
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, deps(net, acc).deps)).kind).toBe('saved');
  });

  it('builds over the newest profile even when only one relay has it (a partial relay answer)', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    net.seed(profileEvent(acc, { has: [a], companion: a, createdAt: S - 500 }));
    // Pixel added c later; only primal has it
    net.seed(profileEvent(acc, { has: [a, c], companion: c, createdAt: S - 100 }), [PRIMAL]);
    await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: null }, deps(net, acc).deps);
    expect(newestOn(net, DITTO).tags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual([a, c, b]);
  });

  it('never creates a profile: none on a complete read is "no-profile"', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const run = deps(net, acc);
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 1), at: NOW, over: null, pending: null }, run.deps)).kind).toBe('no-profile');
    expect(run.signed).toHaveLength(0);
  });

  it('publishes nothing when the profile already names the Blobbi', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    const run = deps(net, acc);
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 1), at: NOW, over: null, pending: null }, run.deps)).kind).toBe('unchanged');
    expect(net.sent()).toHaveLength(0);
  });

  it('a profile written by another app between the read and the send is built over, never replaced', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    const seen = profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 100 });
    net.seed(seen);
    const run = deps(net, acc, {
      sign: vi.fn(async (t) => {
        // While the player's signer is open, Ditto adds a Blobbi to the profile
        if (!net.relays.get(DITTO)!.events.some((e) => e.tags.some((x) => x[0] === 'has' && x[1] === c))) net.seed(profileEvent(acc, { has: [a, b, c], companion: a, createdAt: S - 10 }));
        return acc.sign(t);
      }),
    });
    // The player chose b over the profile they were shown (naming a)
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: { id: seen.id, createdAt: seen.created_at, d: a }, pending: null }, run.deps)).kind).toBe('saved');
    const written = newestOn(net, DITTO);
    expect(companion(written)).toBe(b);
    expect(written.tags.filter((t) => t[0] === 'has').map((t) => t[1])).toContain(c);
  });

  it('a relay that refuses leaves the write partial; the retry sends the very same event, not a new one', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    net.relays.get(PRIMAL)!.refuse = true;
    net.relays.get(BAND)!.down = true;
    const run = deps(net, acc);
    const first = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, run.deps);
    expect(first.kind).toBe('partial');
    const pending = run.pending()!;
    expect(pending).not.toBeNull();
    net.relays.get(PRIMAL)!.refuse = false;
    const again = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending }, run.deps);
    expect(again.kind).toBe('saved');
    expect(run.signed).toHaveLength(1);
    expect(new Set(net.sent().map((e) => e.id))).toEqual(new Set([pending.event.id]));
    // Ditto already held it: it was not sent there again
    expect(net.relays.get(DITTO)!.sent).toHaveLength(1);
  });

  it('a relay that says OK and loses the event is not counted as saved', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    net.relays.get(DITTO)!.forget = true;
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, deps(net, acc).deps);
    expect(out.kind).toBe('partial');
  });

  it('nothing accepted anywhere: failed, and the signed event is kept for the retry', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
    for (const r of net.relays.values()) r.refuse = true;
    const run = deps(net, acc);
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, run.deps);
    expect(out.kind).toBe('failed');
    expect(run.pending()?.event.id).toBe(run.signed[0].id);
  });

  it('a pending write superseded by a newer choice elsewhere is dropped, never sent', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    const base = profileEvent(acc, { has: [a, b, c], companion: a, createdAt: S - 600 });
    net.seed(base);
    const mine = acc.sign(buildCompanionProfile(base, acc.pubkey, b, S - 500));
    net.seed(profileEvent(acc, { has: [a, b, c], companion: c, createdAt: S - 60 }));
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: { event: mine, base: { id: base.id, createdAt: base.created_at } } }, deps(net, acc).deps);
    expect(out).toMatchObject({ kind: 'superseded', profile: { d: c } });
    expect(net.sent()).toHaveLength(0);
  });

  it('a pending write built on a profile that has changed since is rebuilt over the new one', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    const base = profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 600 });
    const mine = acc.sign(buildCompanionProfile(base, acc.pubkey, b, S - 100));
    net.seed(profileEvent(acc, { has: [a, b, c], companion: a, createdAt: S - 300 }));
    const run = deps(net, acc);
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: { event: mine, base: { id: base.id, createdAt: base.created_at } } }, run.deps)).kind).toBe('saved');
    expect(net.sent().some((e) => e.id === mine.id)).toBe(false);
    expect(newestOn(net, DITTO).tags.filter((t) => t[0] === 'has').map((t) => t[1])).toContain(c);
  });

  it('a refused signature, a signer for another key, an account switched mid-way: nothing is sent', async () => {
    const acc = testAccount();
    const other = testAccount();
    for (const over of [
      { sign: async () => Promise.reject(new Error('User rejected')) },
      { sign: async (t: Parameters<ProfileWriteDeps['sign']>[0]) => other.sign(t) },
      { stillAccount: (() => {
          let n = 0;
          return () => ++n < 2;
        })() },
    ] as Partial<ProfileWriteDeps>[]) {
      const net = fakeNetwork();
      net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S - 100 }));
      const out = await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 2), at: NOW, over: null, pending: null }, deps(net, acc, over).deps);
      expect(['sign-failed', 'wrong-account']).toContain(out.kind);
      expect(net.sent()).toHaveLength(0);
    }
  });

  it('a choice made offline never overwrites a choice made clearly later in another app', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    const seen = profileEvent(acc, { has: [a, b, c], companion: a, createdAt: S - 3_600 });
    // Chosen on this device 30 minutes ago, offline; Ditto chose c 10 minutes ago
    net.seed(profileEvent(acc, { has: [a, b, c], companion: c, createdAt: S - 600 }));
    const run = deps(net, acc);
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW - 1_800_000, over: { id: seen.id, createdAt: seen.created_at, d: a }, pending: null }, run.deps);
    expect(out).toMatchObject({ kind: 'superseded', profile: { d: c } });
    expect(run.signed).toHaveLength(0);
    expect(net.sent()).toHaveLength(0);
  });

  it('a choice too close in time to another app\'s is not written: the player is asked', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b, c] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2), dOf(acc.pubkey, 3)];
    const seen = profileEvent(acc, { has: [a, b, c], companion: a, createdAt: S - 3_600 });
    net.seed(profileEvent(acc, { has: [a, b, c], companion: c, createdAt: S - 20 }));
    const run = deps(net, acc);
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW - 10_000, over: { id: seen.id, createdAt: seen.created_at, d: a }, pending: null }, run.deps)).kind).toBe('ambiguous');
    expect(net.sent()).toHaveLength(0);
  });

  it('offline: nothing is read, signed or sent', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const run = deps(net, acc, { online: () => false });
    expect((await writeCompanionProfile({ owner: acc.pubkey, d: dOf(acc.pubkey, 1), at: NOW, over: null, pending: null }, run.deps)).kind).toBe('offline');
    expect(run.signed).toHaveLength(0);
  });

  it('ignores forged profiles and other authors', async () => {
    const acc = testAccount();
    const other = testAccount();
    const net = fakeNetwork();
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    net.seed(profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 100 }));
    // As a relay would deliver it (JSON): no verification cached on the object
    const forged = { ...JSON.parse(JSON.stringify(profileEvent(acc, { has: [], companion: b, createdAt: S - 1 }))), sig: 'f'.repeat(128) } as NostrEvent;
    // A relay serving a forged newer profile and someone else's profile
    net.seed(forged, [BAND]);
    net.seed(profileEvent(other, { has: [], companion: b, createdAt: S - 1 }), [BAND]);
    const out = await writeCompanionProfile({ owner: acc.pubkey, d: b, at: NOW, over: null, pending: null }, deps(net, acc).deps);
    expect(out.kind).toBe('saved');
    expect(newestOn(net, PRIMAL).tags.filter((t) => t[0] === 'has')).toHaveLength(2);
  });
});
