/**
 * The home's other profile writes (adoption's profile, the daily award) over an in-memory relay network: built only
 * from a complete read, never over an older profile, created only when a complete read finds none, after the base in
 * time, one at a time per account, and never sent for an account that is gone.
 */
import { describe, expect, it } from 'vitest';
import { parseBlobbonautEvent, updateBlobbonautTags, type NostrEvent } from '@blobbi-kit/core';
import { profileQueue } from './profile-queue';
import { writeProfileSafely, type ProfileBuild, type SafeWriteDeps } from './safe-profile-write';
import { writeCompanionProfile } from './profile-write';
import { DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';

const NOW = 1_800_000_000_000;
const S = NOW / 1000;

function deps(net: FakeNetwork, acc: TestAccount, over: Partial<SafeWriteDeps> = {}) {
  const signed: NostrEvent[] = [];
  const d: SafeWriteDeps = {
    owner: acc.pubkey,
    relays: net.port,
    sign: async (t) => {
      const e = acc.sign({ kind: t.kind, created_at: t.created_at!, tags: t.tags, content: t.content });
      signed.push(e);
      return e;
    },
    stillAccount: () => true,
    now: () => NOW,
    timeoutMs: 50,
    ...over,
  };
  return { deps: d, signed };
}

/** A daily-award-like change: the xp tag over whatever profile is newest, everything else kept. */
const award = (base: NostrEvent | null): ProfileBuild<never> => ({ template: { kind: 11125, content: base!.content, tags: updateBlobbonautTags(base!.tags, { xp: '999' }) } });
const newestOn = (net: FakeNetwork, url = DITTO) => net.relays.get(url)!.events.filter((e) => e.kind === 11125).sort((a, b) => b.created_at - a.created_at)[0];

describe("the home's other profile writes", () => {
  it('builds over the newest profile, keeps every other tag and the content, and comes after it in time', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    net.seed(profileEvent(acc, { has: [a], companion: a, createdAt: S - 600 }), [PRIMAL]);
    // The newest profile (a companion chosen elsewhere) is only on one relay, and its clock ran ahead
    const newest = profileEvent(acc, { has: [a, b], companion: b, createdAt: S + 300, extra: [['island_room', 'garden']] });
    net.seed(newest, [DITTO]);
    const run = deps(net, acc);
    const out = await writeProfileSafely(run.deps, award);
    expect(out.kind).toBe('sent');
    const written = newestOn(net);
    expect(parseBlobbonautEvent(written)?.currentCompanion).toBe(b);
    expect(written.tags).toContainEqual(['island_room', 'garden']);
    expect(written.tags).toContainEqual(['xp', '999']);
    expect(written.content).toBe(newest.content);
    expect(written.created_at).toBe(newest.created_at + 1);
  });

  it('a relay that must answer does not: nothing is built, signed or sent', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S - 600 }));
    net.relays.get(PRIMAL)!.down = true;
    const run = deps(net, acc);
    expect((await writeProfileSafely(run.deps, award)).kind).toBe('unsafe');
    expect(run.signed).toHaveLength(0);
    expect(net.sent()).toHaveLength(0);
  });

  it('a profile written while the signer was asked: nothing is sent (the newer one is never replaced)', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    net.seed(profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 600 }));
    const run = deps(net, acc, {
      sign: async (t) => {
        // Another app chose b meanwhile
        net.seed(profileEvent(acc, { has: [a, b], companion: b, createdAt: S - 5 }));
        return acc.sign({ kind: t.kind, created_at: t.created_at!, tags: t.tags, content: t.content });
      },
    });
    expect((await writeProfileSafely(run.deps, award)).kind).toBe('stale');
    expect(net.sent()).toHaveLength(0);
    expect(parseBlobbonautEvent(newestOn(net))?.currentCompanion).toBe(b);
  });

  it('never creates a profile unless asked to, and then only when a complete read finds none', async () => {
    const acc = testAccount();
    const d = dOf(acc.pubkey, 1);
    const create = (): ProfileBuild<never> => ({ template: { kind: 11125, content: '', tags: [['d', 'x'], ['has', d]] } });

    const none = fakeNetwork();
    expect((await writeProfileSafely(deps(none, acc).deps, create)).kind).toBe('no-profile');
    expect(none.sent()).toHaveLength(0);

    const silent = fakeNetwork();
    silent.relays.get(PRIMAL)!.silent = true;
    expect((await writeProfileSafely(deps(silent, acc).deps, create, { create: true })).kind).toBe('unsafe');
    expect(silent.sent()).toHaveLength(0);

    const empty = fakeNetwork();
    expect((await writeProfileSafely(deps(empty, acc).deps, create, { create: true })).kind).toBe('sent');
    expect(newestOn(empty).tags).toContainEqual(['has', d]);
  });

  it('a profile that appears while creating one is never replaced', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const run = deps(net, acc, {
      sign: async (t) => {
        net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 9)], createdAt: S - 1 }));
        return acc.sign({ kind: t.kind, created_at: t.created_at!, tags: t.tags, content: t.content });
      },
    });
    const out = await writeProfileSafely(run.deps, () => ({ template: { kind: 11125, content: '', tags: [] } }), { create: true });
    expect(out.kind).toBe('stale');
    expect(net.sent()).toHaveLength(0);
  });

  it('the account gone before sending, or a signer for another key: nothing is sent', async () => {
    const acc = testAccount();
    const other = testAccount();
    for (const over of [
      { stillAccount: (() => {
          let n = 0;
          return () => ++n < 3;
        })() },
      { sign: async (t: Parameters<SafeWriteDeps['sign']>[0]) => other.sign({ kind: t.kind, created_at: t.created_at!, tags: t.tags, content: t.content }) },
    ] as Partial<SafeWriteDeps>[]) {
      const net = fakeNetwork();
      net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S - 600 }));
      expect((await writeProfileSafely(deps(net, acc, over).deps, award)).kind).toBe('wrong-account');
      expect(net.sent()).toHaveLength(0);
    }
  });

  it('a write the caller decides against writes nothing and asks no signer', async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S - 600 }));
    const run = deps(net, acc);
    expect(await writeProfileSafely(run.deps, () => ({ skip: 'already-paid' as const }))).toEqual({ kind: 'skipped', reason: 'already-paid' });
    expect(run.signed).toHaveLength(0);
  });

  it("a companion choice and an award at the same moment: one after the other, the award built over the choice", async () => {
    const acc = testAccount();
    const net = fakeNetwork();
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    net.seed(profileEvent(acc, { has: [a, b], companion: a, createdAt: S - 600 }));
    const choice = profileQueue.run(acc.pubkey, () =>
      writeCompanionProfile(
        { owner: acc.pubkey, d: b, at: NOW, over: null, pending: null },
        { relays: net.port, sign: async (t) => acc.sign(t), onSigned: () => {}, stillAccount: () => true, online: () => true, now: () => NOW, timeoutMs: 50, sleep: async () => {} },
      ),
    );
    const paid = writeProfileSafely({ ...deps(net, acc).deps, now: () => NOW + 1_000 }, award);
    const [c, p] = await Promise.all([choice, paid]);
    expect(c.kind).toBe('saved');
    expect(p.kind).toBe('sent');
    const top = newestOn(net);
    expect(parseBlobbonautEvent(top)?.currentCompanion).toBe(b);
    expect(top.tags).toContainEqual(['xp', '999']);
  });
});

describe('the profile queue', () => {
  it('runs one write at a time per account, in order; a failure never blocks the next; accounts never wait', async () => {
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = profileQueue.run('a', async () => {
      log.push('a1 start');
      await gate;
      log.push('a1 end');
      throw new Error('boom');
    });
    const second = profileQueue.run('a', async () => void log.push('a2'));
    const other = profileQueue.run('b', async () => void log.push('b1'));
    await other;
    expect(log).toEqual(['a1 start', 'b1']);
    release();
    await expect(first).rejects.toThrow('boom');
    await second;
    expect(log).toEqual(['a1 start', 'b1', 'a1 end', 'a2']);
  });
});
