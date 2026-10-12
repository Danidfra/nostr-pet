/**
 * Today's missions in this home, over a fake relay holding the profile: the
 * award is written once, with the kit's numbers; a day already paid (by this
 * home earlier, another device or another Blobbi app) writes nothing; two
 * homes mounted at once write once; nothing is written while the missions are
 * unfinished or before a Blobbi has hatched; a mission for another app can be
 * swapped with the kit's rerolls.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { ReactNode } from 'react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { createDailyMissionsContent, getTodayDateString, totalDailyXp, writeDailyToStorage } from '@blobbi-kit/react';
import { KIND_BLOBBONAUT_PROFILE, getTagValue, parseBlobbonautEvent, parseProfileContent, serializeProfileContent, type MissionsContent } from '@blobbi-kit/core';
import { PUBKEY, profileEvent } from '@/test/fixtures';

let signed = 0;
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: PUBKEY,
      signer: {
        signEvent: async (t: { kind: number; content: string; tags: string[][]; created_at: number }) => ({ ...t, id: String(++signed).padStart(64, 'f'), pubkey: PUBKEY, sig: '0'.repeat(128) }),
      },
    },
  }),
}));

import { useDailyXp } from './useDailyXp';
import { setDailyXpEnabled } from './daily-xp-switch';

const relay = { profile: null as NostrEvent | null, published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => (relay.profile && filters.some((f) => f.kinds?.includes(KIND_BLOBBONAUT_PROFILE)) ? [relay.profile] : [])),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
    if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.profile = ev;
  }),
  req: vi.fn(),
} as unknown as NPool;

const TODAY = getTodayDateString();
const BABY = [{ stage: 'baby' as const }];
function finished(m: MissionsContent): MissionsContent {
  return { ...m, daily: m.daily.map((x) => ('count' in x ? { ...x, count: x.target } : { ...x, events: Array.from({ length: x.target }, (_, i) => `e${i}`) })) };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NostrContext.Provider value={{ nostr: pool }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
}

beforeAll(() => setDailyXpEnabled(true));
afterAll(() => setDailyXpEnabled(false));
beforeEach(async () => {
  // The kit flushes unsaved progress when a home unmounts (the previous test's): let it land before this one starts
  await new Promise((r) => setTimeout(r, 50));
  vi.clearAllMocks();
  signed = 0;
  relay.profile = { ...profileEvent({ xp: 100 }), content: '' };
  relay.published = [];
});
afterEach(() => vi.clearAllMocks());

const profile = () => parseBlobbonautEvent(relay.profile!)!;
const xpTag = () => Number(getTagValue(relay.profile!.tags, 'xp'));

describe("today's missions in this home", () => {
  it('pays the day once its three are done: one event, the kit\'s XP on top of the fresh total, level kept in step', async () => {
    const day = finished(createDailyMissionsContent(TODAY, PUBKEY, ['baby']));
    writeDailyToStorage(day, PUBKEY);
    const { result } = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    await waitFor(() => expect(result.current.award.kind).toBe('paid'));
    expect(relay.published).toHaveLength(1);
    expect(xpTag()).toBe(100 + totalDailyXp(day));
    expect(getTagValue(relay.profile!.tags, 'level')).toBe('2');
    expect(parseProfileContent(relay.profile!.content).missions).toEqual(day);
    if (result.current.award.kind === 'paid') expect(result.current.award.xp).toBe(totalDailyXp(day));
  });

  it('a day already paid (another device, another Blobbi app, a reload): nothing is written', async () => {
    const day = finished(createDailyMissionsContent(TODAY, PUBKEY, ['baby']));
    relay.profile = { ...profileEvent({ xp: 400 }), content: serializeProfileContent('', { missions: day }) };
    writeDailyToStorage(day, PUBKEY);
    const { result } = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    await waitFor(() => expect(result.current.award.kind).toBe('already'));
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(relay.published).toHaveLength(0);
    expect(xpTag()).toBe(400);
  });

  it('the screen thought it unpaid, but the fresh profile says paid (another app paid meanwhile): nothing is written', async () => {
    const day = finished(createDailyMissionsContent(TODAY, PUBKEY, ['baby']));
    writeDailyToStorage(day, PUBKEY);
    const stale = profile();
    relay.profile = { ...profileEvent({ xp: 400 }), content: serializeProfileContent('', { missions: day }) };
    const { result } = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: stale }), { wrapper });
    await waitFor(() => expect(result.current.award.kind).toBe('already'));
    expect(relay.published).toHaveLength(0);
  });

  it('two homes asking at once (two mounts, StrictMode): one event; asking again later: still one', async () => {
    const day = finished(createDailyMissionsContent(TODAY, PUBKEY, ['baby']));
    writeDailyToStorage(day, PUBKEY);
    const a = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    const b = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    await waitFor(() => expect(a.result.current.award.kind).toBe('paid'));
    await waitFor(() => expect(b.result.current.award.kind).toBe('paid'));
    expect(relay.published).toHaveLength(1);
    act(() => a.result.current.retryAward());
    await waitFor(() => expect(a.result.current.award.kind).toBe('already'));
    expect(relay.published).toHaveLength(1);
  });

  it('unfinished missions write no award; a player with only an egg has no missions yet', async () => {
    writeDailyToStorage(createDailyMissionsContent(TODAY, PUBKEY, ['baby']), PUBKEY);
    const { result } = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(result.current.award.kind).toBe('idle');
    expect(relay.published).toHaveLength(0);
    expect(result.current.missions).toHaveLength(3);

    const egg = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: [{ stage: 'egg' }], profile: profile() }), { wrapper });
    expect(egg.result.current.available).toBe(false);
  });

  it('a mission for another app is marked, and the kit\'s reroll swaps it (three a day)', async () => {
    const base = createDailyMissionsContent(TODAY, PUBKEY, ['baby']);
    writeDailyToStorage({ ...base, daily: [{ id: 'sing_1', target: 1, count: 0 }, ...base.daily.filter((m) => m.id !== 'sing_1').slice(0, 2)] }, PUBKEY);
    const { result } = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    const sing = result.current.missions.find((m) => m.id === 'sing_1')!;
    expect(sing.here).toBe(false);
    expect(result.current.rerollsLeft).toBe(3);
    act(() => result.current.swap('sing_1'));
    await waitFor(() => expect(result.current.missions.some((m) => m.id === 'sing_1')).toBe(false));
    expect(result.current.rerollsLeft).toBe(2);
    expect(relay.published).toHaveLength(0);
  });

  it('a failed award says why and is not tried again by itself; the player can', async () => {
    const day = finished(createDailyMissionsContent(TODAY, PUBKEY, ['baby']));
    writeDailyToStorage(day, PUBKEY);
    (pool.event as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('relay said no'));
    const { result } = renderHook(() => useDailyXp({ pubkey: PUBKEY, companions: BABY, profile: profile() }), { wrapper });
    await waitFor(() => expect(result.current.award.kind).toBe('failed'));
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect((pool.event as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    act(() => result.current.retryAward());
    await waitFor(() => expect(result.current.award.kind).toBe('paid'));
    expect(relay.published).toHaveLength(1);
  });
});
