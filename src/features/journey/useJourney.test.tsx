/**
 * The journey's hook over a fake relay: care counted from the player's kind
 * 1124 receipts; a first look on a device records what is already done
 * without a celebration; a chapter finished afterwards is celebrated once,
 * and never again after a reload; the device record is read safely.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, buildInteractionEventTemplate, getCanonicalBlobbiD } from '@blobbi-kit/core';
import { PUBKEY } from '@/test/fixtures';
import { journeyStoreKey, parseJourneyRecord, useJourney, type UseJourneyOptions } from './useJourney';

const D = getCanonicalBlobbiD(PUBKEY, '0000000001');
let receipts: NostrEvent[] = [];
const query = vi.fn(async (filters: NostrFilter[]) => (filters.some((f) => f.kinds?.includes(KIND_BLOBBI_INTERACTION)) ? receipts : []));
const pool = { query } as unknown as NPool;

function receipt(action: 'feed' | 'play' | 'clean', n: number): NostrEvent {
  const t = buildInteractionEventTemplate({ ownerPubkey: PUBKEY, blobbiDTag: D, action, source: 'blobbi-home' });
  return { ...t, id: String(n).padStart(64, '0'), pubkey: PUBKEY, created_at: 1_760_000_000 + n, sig: '0'.repeat(128) };
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <NostrContext.Provider value={{ nostr: pool }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
}

const baby = (careStreak: number): UseJourneyOptions => ({
  pubkey: PUBKEY,
  companions: [{ stage: 'baby' }],
  current: { stage: 'baby', progressionState: 'none', careStreak },
  profile: null,
  evolveTasks: [],
});

beforeEach(() => {
  localStorage.clear();
  receipts = [];
});

describe('the journey hook', () => {
  it('counts care from the receipts, and celebrates a chapter finished after the first look, once', async () => {
    receipts = [receipt('feed', 1), receipt('play', 2), receipt('clean', 3)];
    const hook = renderHook((props: UseJourneyOptions) => useJourney(props), { wrapper: wrapper(), initialProps: baby(1) });
    await waitFor(() => expect(hook.result.current.chapters.find((c) => c.id === 'first-steps')!.objectives.find((o) => o.id === 'feed')!.done).toBe(true));
    // First look on this device: chapter 1 was already done; recorded quietly
    await waitFor(() => expect(parseJourneyRecord(localStorage.getItem(journeyStoreKey(PUBKEY)))).toMatchObject({ seeded: true, celebrated: ['beginning'] }));
    expect(hook.result.current.celebrate).toBeNull();
    // Day two of care lands: chapter 2 is finished now, celebrated
    hook.rerender(baby(2));
    await waitFor(() => expect(hook.result.current.celebrate).toBe('first-steps'));
    act(() => hook.result.current.dismissCelebration());
    expect(parseJourneyRecord(localStorage.getItem(journeyStoreKey(PUBKEY))).celebrated).toEqual(['beginning', 'first-steps']);
    hook.unmount();
    // A reload: the same facts, no celebration again
    const again = renderHook((props: UseJourneyOptions) => useJourney(props), { wrapper: wrapper(), initialProps: baby(2) });
    await waitFor(() => expect(again.result.current.chapters.find((c) => c.id === 'first-steps')!.status).toBe('done'));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(again.result.current.celebrate).toBeNull();
  });

  it('care landed in this session counts before the relays catch up', async () => {
    const hook = renderHook((props: UseJourneyOptions) => useJourney(props), { wrapper: wrapper(), initialProps: baby(0) });
    await waitFor(() => expect(query).toHaveBeenCalled());
    act(() => hook.result.current.noteCare('medicine'));
    act(() => hook.result.current.noteCare('feed'));
    act(() => hook.result.current.noteCare('rest'));
    const objectives = hook.result.current.chapters.find((c) => c.id === 'first-steps')!.objectives;
    expect(objectives.find((o) => o.id === 'feed')!.done).toBe(true);
    expect(objectives.find((o) => o.id === 'play')!.done).toBe(false);
  });

  it('the cuddle and the nap are kept on this device, per player', async () => {
    const hook = renderHook((props: UseJourneyOptions) => useJourney(props), { wrapper: wrapper(), initialProps: baby(0) });
    act(() => {
      hook.result.current.notePetted();
      hook.result.current.noteNapped();
    });
    expect(parseJourneyRecord(localStorage.getItem(journeyStoreKey(PUBKEY)))).toMatchObject({ petted: true, napped: true });
    expect(localStorage.getItem(journeyStoreKey('b'.repeat(64)))).toBeNull();
  });

  it('only the kit\'s unlock lets another egg join: level from the profile\'s XP', () => {
    const profile = (xp: number) => ({ xp }) as UseJourneyOptions['profile'];
    const at = (xp: number) => renderHook(() => useJourney({ ...baby(0), profile: profile(xp) }), { wrapper: wrapper() }).result.current;
    expect(at(0)).toMatchObject({ canAdoptMore: false, maxBlobbis: 1 });
    expect(at(849)).toMatchObject({ canAdoptMore: false, maxBlobbis: 1 });
    expect(at(850)).toMatchObject({ canAdoptMore: true, maxBlobbis: 2, level: 5 });
  });

  it('reads a damaged or foreign device record as empty', () => {
    expect(parseJourneyRecord('not json')).toMatchObject({ petted: false, celebrated: [] });
    expect(parseJourneyRecord(JSON.stringify({ petted: 'yes', celebrated: ['beginning', 'unlock-everything', 3] }))).toMatchObject({ petted: false, celebrated: ['beginning'] });
  });
});
