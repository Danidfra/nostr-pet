/**
 * The daily award on the real relays (here an in-memory network): planned over a complete read of the newest
 * profile and written one profile write at a time, so it never restores a companion chosen a moment before, never
 * builds over a read a required relay did not answer, and never sends over a profile written while signing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { ReactNode } from 'react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import { createDailyMissionsContent, getTodayDateString, totalDailyXp, writeDailyToStorage } from '@blobbi-kit/react';
import { getTagValue, parseBlobbonautEvent, type MissionsContent } from '@blobbi-kit/core';
import { DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from '@/features/companion/test/fake-relays';

const signedIn = vi.hoisted(() => ({ user: undefined as unknown }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: signedIn.user, users: signedIn.user ? [signedIn.user] : [] }) }));

import { useDailyXp } from './useDailyXp';
import { setDailyXpEnabled } from './daily-xp-switch';

const S = () => Math.floor(Date.now() / 1000);
const TODAY = getTodayDateString();
const BABY = [{ stage: 'baby' as const }];
function finished(m: MissionsContent): MissionsContent {
  return { ...m, daily: m.daily.map((x) => ('count' in x ? { ...x, count: x.target } : { ...x, events: Array.from({ length: x.target }, (_, i) => `e${i}`) })) };
}

/**
 * The app's pool over the fake network. Its merged query is cut short as the real one is (`eoseTimeout`: a moment
 * after the fastest relay answers): `fast` names the relays that make it in time.
 */
function poolOver(net: FakeNetwork, fast?: readonly string[]): NPool {
  return {
    async query(filters: NostrFilter[]) {
      const out = new Map<string, NostrEvent>();
      for (const [url, r] of net.relays) if (!r.down && !r.silent && (!fast || fast.includes(url))) for (const e of r.events) if (matchFilters(filters as Filter[], e as never)) out.set(e.id, e);
      return [...out.values()];
    },
    relay: (url: string) => ({
      query: (fs: NostrFilter[], o: { signal: AbortSignal }) => net.port.query(url, fs[0] as never, o.signal),
      event: (e: NostrEvent, o: { signal: AbortSignal }) => net.port.publish(url, e, o.signal),
    }),
    async event() {
      throw new Error('the award never publishes through the merged pool');
    },
    async *req() {},
  } as unknown as NPool;
}

let acc: TestAccount;
let net: FakeNetwork;
let signer: { signEvent: (t: never) => Promise<NostrEvent>; getPublicKey: () => Promise<string> };
beforeAll(() => setDailyXpEnabled(true));
afterAll(() => setDailyXpEnabled(false));
beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 50));
  acc = testAccount();
  signer = { signEvent: async (t: never) => acc.sign(t), getPublicKey: async () => acc.pubkey };
  signedIn.user = { pubkey: acc.pubkey, signer };
  net = fakeNetwork();
  writeDailyToStorage(finished(createDailyMissionsContent(TODAY, acc.pubkey, ['baby'])), acc.pubkey);
});

function mount(profile: NostrEvent, fast?: readonly string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NostrContext.Provider value={{ nostr: poolOver(net, fast) }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
  return renderHook(() => useDailyXp({ pubkey: acc.pubkey, companions: BABY, profile: parseBlobbonautEvent(profile)! }), { wrapper });
}

const profilesSent = () => net.sent().filter((e) => e.kind === 11125);
const newestOn = (url = DITTO) => net.relays.get(url)!.events.filter((e) => e.kind === 11125).sort((a, b) => b.created_at - a.created_at)[0];

describe('the daily award on the relays', () => {
  it('is written over the newest profile, even when a quick read would miss it: a companion chosen a moment before is kept', async () => {
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    const shown = profileEvent(acc, { has: [a, b], companion: a, createdAt: S() - 600, content: '' });
    net.seed(shown, [PRIMAL]);
    // Chosen in another app a moment ago: the newest profile, only on one of the relays so far
    net.seed(profileEvent(acc, { has: [a, b], companion: b, createdAt: S() - 2, content: '', extra: [['island_room', 'garden']] }), [DITTO]);
    // A quick merged read hears only primal in time (it holds the older profile)
    const { result } = mount(shown, [PRIMAL]);
    await waitFor(() => expect(result.current.award.kind).toBe('paid'));
    expect(profilesSent().length).toBeGreaterThan(0);
    const top = newestOn();
    expect(parseBlobbonautEvent(top)?.currentCompanion).toBe(b);
    expect(top.tags).toContainEqual(['island_room', 'garden']);
    expect(Number(getTagValue(top.tags, 'xp'))).toBe(420 + totalDailyXp(finished(createDailyMissionsContent(TODAY, acc.pubkey, ['baby']))));
  });

  it('a relay that must answer does not: nothing is signed or sent, and the player is told', async () => {
    const shown = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S() - 600, content: '' });
    net.seed(shown);
    net.relays.get(PRIMAL)!.down = true;
    const signs = vi.spyOn(signer, 'signEvent');
    const { result } = mount(shown);
    await waitFor(() => expect(result.current.award.kind).toBe('failed'));
    expect(signs).not.toHaveBeenCalled();
    expect(profilesSent()).toHaveLength(0);
  });

  it('a profile written while the signer was asked: nothing is sent; Try again pays over the newer profile', async () => {
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    const shown = profileEvent(acc, { has: [a, b], companion: a, createdAt: S() - 600, content: '' });
    net.seed(shown);
    vi.spyOn(signer, 'signEvent').mockImplementationOnce(async (t: never) => {
      net.seed(profileEvent(acc, { has: [a, b], companion: b, createdAt: S() - 1, content: '' }));
      return acc.sign(t);
    });
    const { result } = mount(shown);
    await waitFor(() => expect(result.current.award).toMatchObject({ kind: 'failed' }));
    expect(profilesSent()).toHaveLength(0);
    act(() => result.current.retryAward());
    await waitFor(() => expect(result.current.award.kind).toBe('paid'));
    expect(parseBlobbonautEvent(newestOn())?.currentCompanion).toBe(b);
  });
});
