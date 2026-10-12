/**
 * Another egg is checked at signing against a FRESH read: the collection
 * and the profile's level (the kit's `getUnlocks`), whatever the screen
 * thought. The first adoption keeps its rule: any Blobbi owned stops it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE } from '@blobbi-kit/core';
import { PUBKEY, blobbiEvent, profileEvent } from '@/test/fixtures';
import { useAdoptEgg } from './useAdoptEgg';
import { newEggPreview } from './adoption-plan';

const sign = vi.fn(async (t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> => ({ ...t, id: 'f'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { pubkey: PUBKEY, signer: { signEvent: sign } }, users: [] }) }));

let stored: NostrEvent[] = [];
const published: NostrEvent[] = [];
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => stored.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async (e: NostrEvent) => void published.push(e)),
} as unknown as NPool;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NostrContext.Provider value={{ nostr: pool }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
}

const adopt = async (additional: boolean) => {
  const hook = renderHook(() => useAdoptEgg({ pubkey: PUBKEY, updateCompanionEvent: vi.fn(), refresh: vi.fn(), additional }), { wrapper });
  act(() => void hook.result.current.adopt(newEggPreview(PUBKEY)));
  await waitFor(() => expect(hook.result.current.result ?? hook.result.current.error).toBeTruthy());
  return hook.result.current;
};

beforeEach(() => {
  stored = [];
  published.length = 0;
  sign.mockClear();
});

describe('adopting another egg', () => {
  it('under the unlock (level 5: two Blobbis): the egg and the profile are signed', async () => {
    stored = [blobbiEvent('0000000001', { stage: 'adult' }), profileEvent({ xp: 900 })];
    const r = await adopt(true);
    expect(r.result?.kind).toBe('adopted');
    expect(published.map((e) => e.kind)).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE]);
  });

  it('at the limit for the fresh level: refused before any signature', async () => {
    stored = [blobbiEvent('0000000001', { stage: 'adult' }), profileEvent({ xp: 849 })];
    const r = await adopt(true);
    expect(r.result).toEqual({ kind: 'limit', count: 1, max: 1 });
    expect(sign).not.toHaveBeenCalled();
    expect(published).toHaveLength(0);
  });

  it('no profile at all is level 1: refused', async () => {
    stored = [blobbiEvent('0000000001', { stage: 'adult' })];
    expect((await adopt(true)).result).toMatchObject({ kind: 'limit', max: 1 });
    expect(sign).not.toHaveBeenCalled();
  });

  it('two already at level 5 (two allowed): refused', async () => {
    stored = [blobbiEvent('0000000001', { stage: 'adult' }), blobbiEvent('0000000002', { stage: 'egg' }), profileEvent({ xp: 900 })];
    expect((await adopt(true)).result).toEqual({ kind: 'limit', count: 2, max: 2 });
  });

  it('the first adoption keeps its rule: any Blobbi owned stops it, whatever the level', async () => {
    stored = [blobbiEvent('0000000001', { stage: 'adult' }), profileEvent({ xp: 39_200 })];
    expect((await adopt(false)).result).toEqual({ kind: 'existing', count: 1 });
    expect(sign).not.toHaveBeenCalled();
  });
});
