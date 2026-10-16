/**
 * Adoption's one profile write (audited with the companion sync): built from a COMPLETE read of the profile, never
 * from a partial one (which could replace the player's real profile), after the profile it replaces, and the new egg
 * recorded as the player's choice (shared by that very write, or waiting on this device).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import { parseBlobbonautEvent } from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { useAdoptEgg } from '@/features/adoption/useAdoptEgg';
import { newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { companionChoices } from './choice-store';
import { companionSync } from './companion-sync';
import { DITTO, PRIMAL, dOf, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';

const signedIn = vi.hoisted(() => ({ user: undefined as unknown }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: signedIn.user, users: signedIn.user ? [signedIn.user] : [] }) }));

const S = () => Math.floor(Date.now() / 1000);

function poolOver(net: FakeNetwork): NPool {
  return {
    async query(filters: NostrFilter[]) {
      const out = new Map<string, NostrEvent>();
      for (const r of net.relays.values()) if (!r.down && !r.silent) for (const e of r.events) if (matchFilters(filters as Filter[], e as never)) out.set(e.id, e);
      return [...out.values()];
    },
    relay: (url: string) => ({
      query: (fs: NostrFilter[], o: { signal: AbortSignal }) => net.port.query(url, fs[0] as never, o.signal),
      event: (e: NostrEvent, o: { signal: AbortSignal }) => net.port.publish(url, e, o.signal),
    }),
    async event(e: NostrEvent) {
      const results = await Promise.allSettled(net.port.urls.map((u) => net.port.publish(u, e, AbortSignal.timeout(100))));
      if (!results.some((r) => r.status === 'fulfilled')) throw new Error('no relay accepted');
    },
    async *req() {},
  } as unknown as NPool;
}

let acc: TestAccount;
let net: FakeNetwork;
beforeEach(() => {
  window.localStorage.clear();
  companionChoices.reset();
  companionSync.reset();
  acc = testAccount();
  signedIn.user = { pubkey: acc.pubkey, signer: { signEvent: async (t: never) => acc.sign(t), getPublicKey: async () => acc.pubkey } };
  net = fakeNetwork();
});

const newestOn = (net: FakeNetwork, url = DITTO) => net.relays.get(url)!.events.filter((e) => e.kind === 11125).sort((a, b) => b.created_at - a.created_at)[0];

/** The player's Try again, with the companion sync's env over the fake network. */
async function tryAgain() {
  companionSync.setEnv(acc.pubkey, { account: () => acc.pubkey, relays: net.port, sign: async (t) => acc.sign(t), timeoutMs: 50, sleep: async () => {} });
  await act(async () => {
    await companionSync.retry(acc.pubkey);
  });
}

function adopt(net: FakeNetwork) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NostrContext.Provider value={{ nostr: poolOver(net) }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
  return renderHook(() => useAdoptEgg({ pubkey: acc.pubkey, updateCompanionEvent: () => {}, refresh: () => {}, additional: true }), { wrapper });
}

describe("adoption's profile write", () => {
  it('a profile only one relay can be asked about is not replaced: the egg is real, the profile untouched', async () => {
    const existing = profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S() - 600 });
    net.seed(existing, [DITTO]);
    net.relays.get(PRIMAL)!.down = true;
    const view = adopt(net);
    const preview = newEggPreview(acc.pubkey);
    act(() => void view.result.current.adopt(preview));
    await waitFor(() => expect(view.result.current.result?.kind).toBe('adopted'));
    expect(view.result.current.result).toMatchObject({ profile: null });
    expect(net.sent().filter((e) => e.kind === 11125)).toHaveLength(0);
    // The new egg waits on this device as the player's choice, to be shared (and listed) later
    expect(companionChoices.get(acc.pubkey)).toMatchObject({ d: preview.d, by: 'player', synced: null, note: 'needs-profile' });
    // Try again with every relay back: the profile that was out of sight is built over, never replaced by a new one
    net.relays.get(PRIMAL)!.down = false;
    await tryAgain();
    const top = newestOn(net);
    expect(top.id).not.toBe(existing.id);
    expect(parseBlobbonautEvent(top)?.has).toEqual([dOf(acc.pubkey, 1), preview.d]);
    expect(parseBlobbonautEvent(top)?.currentCompanion).toBe(preview.d);
  });

  it('a first adoption with a required relay silent twice: no profile is made from that read; Try again creates it once a complete read finds none', async () => {
    net.relays.get(PRIMAL)!.down = true;
    const view = adopt(net);
    const preview = newEggPreview(acc.pubkey);
    act(() => void view.result.current.adopt(preview));
    await waitFor(() => expect(view.result.current.result?.kind).toBe('adopted'));
    expect(net.sent().filter((e) => e.kind === 11125)).toHaveLength(0);
    expect(companionChoices.get(acc.pubkey)).toMatchObject({ d: preview.d, note: 'needs-profile', profileName: 'Blobbonaut' });

    // Try again while a required relay is still silent: an incomplete read is never taken for "no profile"
    await tryAgain();
    expect(net.sent().filter((e) => e.kind === 11125)).toHaveLength(0);
    expect(companionSync.status(acc.pubkey)).toEqual({ kind: 'waiting', reason: 'unsafe' });

    net.relays.get(PRIMAL)!.down = false;
    await tryAgain();
    expect(companionSync.status(acc.pubkey)).toEqual({ kind: 'saved' });
    const created = newestOn(net);
    expect(parseBlobbonautEvent(created)).toMatchObject({ has: [preview.d], currentCompanion: preview.d });
    expect(companionChoices.get(acc.pubkey)).toMatchObject({ note: null, synced: { id: created.id } });
    expect(new Set(net.sent().filter((e) => e.kind === 11125).map((e) => e.id)).size).toBe(1);
  });

  it('a first adoption with every relay answering and no profile anywhere creates the profile at once', async () => {
    const view = adopt(net);
    const preview = newEggPreview(acc.pubkey);
    act(() => void view.result.current.adopt(preview));
    await waitFor(() => expect(view.result.current.result?.kind).toBe('adopted'));
    const written = view.result.current.result!.kind === 'adopted' ? view.result.current.result!.profile : null;
    expect(parseBlobbonautEvent(written!)).toMatchObject({ has: [preview.d], currentCompanion: preview.d });
    expect(companionChoices.get(acc.pubkey)).toMatchObject({ note: null, synced: { id: written!.id } });
  });

  it('a profile that appears before Try again is built over, never replaced by a new one', async () => {
    net.relays.get(PRIMAL)!.down = true;
    const view = adopt(net);
    const preview = newEggPreview(acc.pubkey);
    act(() => void view.result.current.adopt(preview));
    await waitFor(() => expect(view.result.current.result?.kind).toBe('adopted'));
    net.relays.get(PRIMAL)!.down = false;
    // Another app made the profile meanwhile, with a Blobbi of its own and an extra tag
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 7)], companion: dOf(acc.pubkey, 7), createdAt: S() - 5, extra: [['island_room', 'garden']] }));
    await tryAgain();
    const top = newestOn(net);
    expect(parseBlobbonautEvent(top)?.has).toEqual([dOf(acc.pubkey, 7), preview.d]);
    expect(top.tags).toContainEqual(['island_room', 'garden']);
  });

  it('a complete read: the profile is merged (has, xp, extra tags kept) and the egg recorded as shared', async () => {
    net.seed(profileEvent(acc, { has: [dOf(acc.pubkey, 1)], companion: dOf(acc.pubkey, 1), createdAt: S() - 600, extra: [['island_room', 'garden']] }));
    const view = adopt(net);
    const preview = newEggPreview(acc.pubkey);
    act(() => void view.result.current.adopt(preview));
    await waitFor(() => expect(view.result.current.result?.kind).toBe('adopted'));
    const written = view.result.current.result!.kind === 'adopted' ? view.result.current.result!.profile! : null;
    expect(parseBlobbonautEvent(written!)?.has).toEqual([dOf(acc.pubkey, 1), preview.d]);
    expect(written!.tags).toContainEqual(['island_room', 'garden']);
    expect(companionChoices.get(acc.pubkey)?.synced?.id).toBe(written!.id);
  });

  it('the replacement comes after the profile it replaces, even with a clock behind', () => {
    const base = profileEvent(acc, { has: [], createdAt: S() + 900 });
    const t = profileTemplate({ ownerPubkey: acc.pubkey, profile: parseBlobbonautEvent(base)!, d: dOf(acc.pubkey, 2), suggestedName: 'X', now: S() });
    expect(t.created_at).toBe(base.created_at + 1);
  });
});
