/**
 * Today's progress, signed in on the relays (blobbi-kit 0.10 safe mode, through this home's adapters), over an
 * in-memory relay network: kept on this device per account the moment it happens, back after a reload, saved over the
 * NEWEST profile (a companion chosen a moment ago, other tags and content kept), cleared only once read back, never
 * saved by itself on load, on a tab hide or on unmount, and the day's XP paid once.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { ReactNode } from 'react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import { createDailyMissionsContent, dailyPendingKey, getTodayDateString, readDailyFromStorage, totalDailyXp, trackDailyMissionProgress, writeDailyToStorage } from '@blobbi-kit/react';
import { getTagValue, missionProgress, parseBlobbonautEvent, parseProfileContent, serializeProfileContent, type MissionsContent } from '@blobbi-kit/core';
import { DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from '@/features/companion/test/fake-relays';
import { profileQueue } from '@/features/companion/profile-queue';
import { writeCompanionProfile } from '@/features/companion/profile-write';

const signedIn = vi.hoisted(() => ({ user: undefined as unknown }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: signedIn.user, users: signedIn.user ? [signedIn.user] : [] }) }));

import { useDailyXp } from './useDailyXp';
import { setDailyXpEnabled } from './daily-xp-switch';

const BABY = [{ stage: 'baby' as const }];
const S = () => Math.floor(Date.now() / 1000);
const day = (pk: string) => createDailyMissionsContent(getTodayDateString(), pk, ['baby']);
function withProgress(m: MissionsContent, counts: number[]): MissionsContent {
  return { ...m, daily: m.daily.map((x, i) => ('count' in x ? { ...x, count: Math.min(x.target, counts[i] ?? 0) } : { ...x, events: Array.from({ length: Math.min(x.target, counts[i] ?? 0) }, (_, k) => `e${k}`) })) };
}
const progressOf = (m: MissionsContent | undefined) => m?.daily.map(missionProgress) ?? [];
const capped = (pk: string, counts: number[]) => counts.map((c, i) => Math.min(c, day(pk).daily[i].target));

/** Care done in the home that counts for the first mission (the store moves, then the tracker's signal). */
function progressHere(pk: string) {
  const m = readDailyFromStorage(pk) ?? day(pk);
  const first = m.daily[0];
  const next = 'count' in first ? { ...first, count: Math.min(first.target, first.count + 1) } : { ...first, events: [...first.events, `ev${Math.random()}`].slice(0, first.target) };
  writeDailyToStorage({ ...m, daily: [next, ...m.daily.slice(1)] }, pk);
  trackDailyMissionProgress('interact', 0, pk);
}

/** The app's pool over the fake network: a merged quick read (that can miss a relay), and each relay on its own. */
function poolOver(net: FakeNetwork, quick?: readonly string[]): NPool {
  return {
    async query(filters: NostrFilter[]) {
      const out = new Map<string, NostrEvent>();
      for (const [url, r] of net.relays) if (!r.down && !r.silent && (!quick || quick.includes(url))) for (const e of r.events) if (matchFilters(filters as Filter[], e as never)) out.set(e.id, e);
      return [...out.values()];
    },
    relay: (url: string) => ({
      query: (fs: NostrFilter[], o: { signal: AbortSignal }) => net.port.query(url, fs[0] as never, o.signal),
      event: (e: NostrEvent, o: { signal: AbortSignal }) => net.port.publish(url, e, o.signal),
    }),
    async event() {
      throw new Error('nothing publishes through the merged pool');
    },
    async *req() {},
  } as unknown as NPool;
}

let acc: TestAccount;
let net: FakeNetwork;
let signs: ReturnType<typeof vi.fn>;
function signInAs(a: TestAccount) {
  signs = vi.fn(async (t: never) => a.sign(t));
  signedIn.user = { pubkey: a.pubkey, signer: { signEvent: signs, getPublicKey: async () => a.pubkey } };
}

function mount(pk: () => string, profile: () => NostrEvent | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NostrContext.Provider value={{ nostr: poolOver(net, [PRIMAL]) }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
  return renderHook(() => useDailyXp({ pubkey: pk(), companions: BABY, profile: profile() ? parseBlobbonautEvent(profile()!)! : null }), { wrapper });
}
const newest = (url = DITTO) => [...net.relays.get(url)!.events].filter((e) => e.kind === 11125).sort((a, b) => b.created_at - a.created_at)[0];

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeAll(() => setDailyXpEnabled(true));
afterAll(() => setDailyXpEnabled(false));
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.localStorage.clear();
  acc = testAccount();
  signInAs(acc);
  net = fakeNetwork();
});
afterEach(() => vi.useRealTimers());

describe("today's progress, kept and saved safely", () => {
  it('saved 3 s after care over the NEWEST profile: a companion chosen a moment ago, other tags, content and completed missions kept', async () => {
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    // What this home was shown (primal); and the newest profile, a moment ago in another app: companion b, that app's
    // finished second mission, an extra tag and its own content
    const shown = profileEvent(acc, { has: [a, b], companion: a, createdAt: S() - 600, content: '' });
    net.seed(shown, [PRIMAL]);
    const theirs = serializeProfileContent('{"room_layouts":{"v":1}}', { missions: withProgress(day(acc.pubkey), [0, 9, 0]) });
    net.seed(profileEvent(acc, { has: [a, b], companion: b, createdAt: S() - 2, content: theirs, extra: [['island_room', 'garden']] }), [DITTO]);
    const { result } = mount(() => acc.pubkey, () => shown);
    act(() => progressHere(acc.pubkey));
    expect(window.localStorage.getItem(dailyPendingKey(acc.pubkey))).not.toBeNull();
    expect(result.current.progress.status.kind).toBe('pending');
    await tick(3_100);
    await waitFor(() => expect(result.current.progress.status.kind).toBe('saved'));
    const top = newest();
    expect(parseBlobbonautEvent(top)).toMatchObject({ currentCompanion: b, has: [a, b], xp: 420 });
    expect(top.tags).toContainEqual(['island_room', 'garden']);
    expect(JSON.parse(top.content).room_layouts).toEqual({ v: 1 });
    // This home's progress and the other app's completed mission, both
    expect(progressOf(parseProfileContent(top.content).missions)).toEqual(capped(acc.pubkey, [1, 9, 0]));
    expect(window.localStorage.getItem(dailyPendingKey(acc.pubkey))).toBeNull();
    expect(signs).toHaveBeenCalledTimes(1);
  });

  it('a companion choice and a progress save at the same moment: one after the other in the shared queue, both kept', async () => {
    const [a, b] = [dOf(acc.pubkey, 1), dOf(acc.pubkey, 2)];
    const shown = profileEvent(acc, { has: [a, b], companion: a, createdAt: S() - 600, content: '' });
    net.seed(shown);
    const { result } = mount(() => acc.pubkey, () => shown);
    act(() => progressHere(acc.pubkey));
    await tick(3_000);
    const choice = profileQueue.run(acc.pubkey, () =>
      writeCompanionProfile({ owner: acc.pubkey, d: b, at: Date.now(), over: null, pending: null }, { relays: net.port, sign: async (t) => acc.sign(t), onSigned: () => {}, stillAccount: () => true, online: () => true, now: () => Date.now(), timeoutMs: 50, sleep: async () => {} }),
    );
    await tick(200);
    await choice;
    await waitFor(() => expect(result.current.progress.status.kind).toBe('saved'));
    const top = newest();
    expect(parseBlobbonautEvent(top)?.currentCompanion).toBe(b);
    expect(progressOf(parseProfileContent(top.content).missions)[0]).toBe(capped(acc.pubkey, [1])[0]);
  });

  it('never saved by itself on load, on a tab hide or on unmount; back after a reload; a failed save keeps it; Save sends it', async () => {
    const shown = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S() - 600, content: '' });
    net.seed(shown);
    net.relays.get(PRIMAL)!.down = true;
    const first = mount(() => acc.pubkey, () => shown);
    act(() => progressHere(acc.pubkey));
    await tick(3_100);
    await waitFor(() => expect(first.result.current.progress.status).toMatchObject({ kind: 'failed', reason: 'unsafe' }));
    expect(signs).not.toHaveBeenCalled();
    net.relays.get(PRIMAL)!.down = false;
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    first.unmount();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await tick(120_000);
    expect(signs).not.toHaveBeenCalled();

    // Reload: this page's memory starts over
    writeDailyToStorage(day(acc.pubkey), acc.pubkey);
    const again = mount(() => acc.pubkey, () => shown);
    expect(progressOf(readDailyFromStorage(acc.pubkey))[0]).toBe(capped(acc.pubkey, [1])[0]);
    expect(again.result.current.progress.status.kind).toBe('pending');
    await tick(120_000);
    expect(signs).not.toHaveBeenCalled();
    act(() => again.result.current.progress.save());
    await tick(500);
    await waitFor(() => expect(again.result.current.progress.status.kind).toBe('saved'));
    expect(signs).toHaveBeenCalledTimes(1);
    expect(progressOf(parseProfileContent(newest().content).missions)[0]).toBe(capped(acc.pubkey, [1])[0]);
  });

  it("one account's progress is never shown, merged or saved for another", async () => {
    const shown = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S() - 600, content: '' });
    net.seed(shown);
    net.relays.get(PRIMAL)!.down = true;
    let pk = acc.pubkey;
    const view = mount(() => pk, () => shown);
    act(() => progressHere(acc.pubkey));
    await tick(3_100);
    expect(window.localStorage.getItem(dailyPendingKey(acc.pubkey))).not.toBeNull();
    const other = testAccount();
    signInAs(other);
    pk = other.pubkey;
    view.rerender();
    expect(view.result.current.progress.status.kind).toBe('idle');
    expect(progressOf(readDailyFromStorage(other.pubkey))).not.toContain(1);
    net.relays.get(PRIMAL)!.down = false;
    act(() => view.result.current.progress.save());
    await tick(500);
    expect(signs).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(dailyPendingKey(other.pubkey))).toBeNull();
  });

  it('the day finished: paid once (the progress hook never writes a finished day); a reload pays nothing more', async () => {
    const shown = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], createdAt: S() - 600, content: '' });
    net.seed(shown);
    const done = withProgress(day(acc.pubkey), [9, 9, 9]);
    writeDailyToStorage(done, acc.pubkey);
    const first = mount(() => acc.pubkey, () => shown);
    act(() => trackDailyMissionProgress('interact', 0, acc.pubkey));
    await tick(500);
    await waitFor(() => expect(first.result.current.award.kind).toBe('paid'));
    await tick(10_000);
    expect(signs).toHaveBeenCalledTimes(1);
    const paid = newest();
    expect(Number(getTagValue(paid.tags, 'xp'))).toBe(420 + totalDailyXp(done));
    first.unmount();
    // A reload: the profile shows the day paid; nothing is paid or written again
    const again = mount(() => acc.pubkey, () => newest());
    await tick(10_000);
    await waitFor(() => expect(again.result.current.award.kind).toBe('already'));
    expect(signs).toHaveBeenCalledTimes(1);
    expect(Number(getTagValue(newest().tags, 'xp'))).toBe(420 + totalDailyXp(done));
  });
});
