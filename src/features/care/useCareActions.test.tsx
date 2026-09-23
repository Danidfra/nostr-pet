/**
 * `perform` must be safe to call from a delayed flow (a walk that arrives
 * later): it decides from LIVE in-flight state, not from the render in which
 * it was captured.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';
import type { ReactNode } from 'react';

import { useCareActions } from './useCareActions';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const NOW = Math.floor(Date.now() / 1000);
const D = 'blobbi-aaaaaaaaaaaa-0000000001';
let state: NostrEvent[] = [];
const published: NostrEvent[] = [];
let releasePublish: (() => void) | null = null;

const query = vi.fn(async (filters: NostrFilter[]) => {
  const ds = filters[0]['#d'];
  return state.filter((e) => e.kind === KIND_BLOBBI_STATE && (!ds || ds.includes(getTagValue(e.tags, 'd') ?? '')));
});
const event = vi.fn(async (ev: NostrEvent) => {
  await new Promise<void>((resolve) => {
    releasePublish = resolve;
  });
  published.push(ev);
});
const pool = { query, event } as unknown as NPool;
const signer = {
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    return { ...t, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NostrContext.Provider value={{ nostr: pool }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
}

describe('useCareActions.perform', () => {
  it('a perform captured before a write started still refuses to start a second write while the first is in flight', async () => {
    currentUser.user = { pubkey: PUBKEY, signer };
    state = [blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: NOW - 60, set: { hunger: '40' } })];
    published.length = 0;
    const updateCompanionEvent = vi.fn();
    const invalidate = vi.fn();
    const { result } = renderHook(() => useCareActions({ pubkey: PUBKEY, updateCompanionEvent, invalidate }), { wrapper });

    // Capture the function from the very first render: this is what a walk started earlier would hold.
    const stalePerform = result.current.perform;

    let first = false;
    act(() => {
      first = stalePerform(D, 'feed');
    });
    expect(first).toBe(true);
    await waitFor(() => expect(event).toHaveBeenCalledTimes(1));   // signed and now waiting on the relay

    let second = true;
    act(() => {
      second = stalePerform(D, 'clean');                              // same captured function, mid-flight
    });
    expect(second).toBe(false);
    expect(event).toHaveBeenCalledTimes(1);

    act(() => releasePublish?.());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(published).toHaveLength(1);
    expect(getTagValue(published[0].tags, 'd')).toBe(D);

    // Once settled, the same captured function may start a new write.
    let third = false;
    act(() => {
      third = stalePerform(D, 'clean');
    });
    expect(third).toBe(true);
    await waitFor(() => expect(event).toHaveBeenCalledTimes(2));
    act(() => releasePublish?.());
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
