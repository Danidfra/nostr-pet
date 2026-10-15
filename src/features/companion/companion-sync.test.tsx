/**
 * The home's companion against an in-memory relay network (no real relay, no real key): a choice made here is
 * written into the profile; a choice made in another app (Blobbi Pixel, Ditto, another device) is met and shown;
 * the ordering rules, the moments that hold a switch, offline, slow and refusing relays, retries, and accounts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import { KIND_BLOBBI_STATE, buildEggTags, getSelectedBlobbiKey, parseBlobbonautEvent, updateBlobbiTags } from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { companionChoices, choiceKey } from './choice-store';
import { companionSync, syncTiming } from './companion-sync';
import { switchHolds } from './switch-hold';
import { DITTO, PRIMAL, BAND, fakeNetwork, profileEvent, testAccount, type FakeNetwork, type TestAccount } from './test/fake-relays';

// ─── The signed-in account (a test key; switched by the tests) ───
const signedIn = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: { signEvent: (t: unknown) => Promise<unknown>; getPublicKey: () => Promise<string> } } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: signedIn.user, users: signedIn.user ? [signedIn.user] : [] }) }));

const S = () => Math.floor(Date.now() / 1000);

function signInAs(acc: TestAccount) {
  signedIn.user = { pubkey: acc.pubkey, signer: { signEvent: async (t) => acc.sign(t as never), getPublicKey: async () => acc.pubkey } };
}

function blobbi(acc: TestAccount, petId: string, name: string, createdAt: number): NostrEvent {
  const tags = updateBlobbiTags(buildEggTags(acc.pubkey, petId, createdAt, name, { visualGeneration: 'v3' }), { stage: 'baby', state: 'active' });
  return acc.sign({ kind: KIND_BLOBBI_STATE, created_at: createdAt, tags, content: '' });
}

/** The app's pool over the fake network: a merged query (as NPool does), and each relay on its own. */
function poolOver(net: FakeNetwork): NPool {
  return {
    async query(filters: NostrFilter[]) {
      const seen = new Map<string, NostrEvent>();
      for (const r of net.relays.values()) if (!r.down && !r.silent) for (const e of r.events) if (matchFilters(filters as Filter[], e as never)) seen.set(e.id, e);
      return [...seen.values()];
    },
    relay(url: string) {
      return {
        query: (fs: NostrFilter[], o: { signal: AbortSignal }) => net.port.query(url, fs[0] as never, o.signal),
        event: (e: NostrEvent, o: { signal: AbortSignal }) => net.port.publish(url, e, o.signal),
      };
    },
    async event() {
      throw new Error('the companion never publishes through the merged pool');
    },
    async *req() {},
  } as unknown as NPool;
}

let client: QueryClient;
function render(net: FakeNetwork) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pool = poolOver(net);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NostrContext.Provider value={{ nostr: pool }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NostrContext.Provider>
  );
  return renderHook(() => useHomeBlobbi(), { wrapper });
}

const profilesSent = (net: FakeNetwork) => net.sent().filter((e) => e.kind === 11125);
const companionOn = (net: FakeNetwork, url = DITTO) => {
  const top = net.relays.get(url)!.events.filter((e) => e.kind === 11125).sort((a, b) => b.created_at - a.created_at)[0];
  return top ? parseBlobbonautEvent(top)?.currentCompanion : undefined;
};
type App = 'Ditto' | 'Blobbi Pixel' | 'this home on another device';
/** What each app adds around the kit's tags: Ditto its client tag, Pixel nothing, this home `client` and `published_at`. */
const SHAPE: Record<App, (at: number) => string[][]> = {
  Ditto: () => [['client', 'Ditto']],
  'Blobbi Pixel': () => [],
  'this home on another device': (at) => [['client', 'Blobbi'], ['published_at', String(at - 86_400)]],
};
/** Another app chose (Ditto's Set as companion, Blobbi Pixel's MY BLOBBIS): a newer profile on the relays. */
function chosenElsewhere(net: FakeNetwork, acc: TestAccount, ds: string[], d: string, createdAt: number, app: App = 'Ditto') {
  net.seed(profileEvent(acc, { has: ds, companion: d, createdAt, extra: SHAPE[app](createdAt) }), [DITTO, PRIMAL]);
}
async function rereadProfile() {
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['blobbonaut-profile'] });
  });
}

let acc: TestAccount;
let net: FakeNetwork;
let A: NostrEvent, B: NostrEvent, C: NostrEvent;
let dA: string, dB: string, dC: string;

beforeEach(() => {
  window.localStorage.clear();
  companionChoices.reset();
  companionSync.reset();
  syncTiming.timeoutMs = 60;
  syncTiming.readBackPauseMs = 5;
  acc = testAccount();
  signInAs(acc);
  net = fakeNetwork();
  A = blobbi(acc, '0000000001', 'Ada', S() - 9_000);
  B = blobbi(acc, '0000000002', 'Bo', S() - 8_000);
  C = blobbi(acc, '0000000003', 'Cy', S() - 7_000);
  [dA, dB, dC] = [A, B, C].map((e) => e.tags.find((t) => t[0] === 'd')![1]);
  for (const e of [A, B, C]) net.seed(e);
  // The profile as Ditto left it a while ago: three Blobbis, Ada the companion, xp and an extra tag of its own
  net.seed(profileEvent(acc, { has: [dA, dB, dC], companion: dA, createdAt: S() - 3_600, extra: [['island_room', 'garden']] }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function ready(net: FakeNetwork) {
  const view = render(net);
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  return view;
}

describe('the companion shared with the other Blobbi apps', () => {
  it('shows the profile\'s companion and publishes nothing on load, refresh or re-mount', async () => {
    const view = await ready(net);
    expect(view.result.current.current?.d).toBe(dA);
    view.unmount();
    await ready(net);
    await rereadProfile();
    expect(profilesSent(net)).toHaveLength(0);
  });

  it('a choice made here shows at once and is written into the profile, keeping everything else', async () => {
    const view = await ready(net);
    act(() => view.result.current.select(dB));
    expect(view.result.current.current?.d).toBe(dB);
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('saved'));
    expect(companionOn(net, DITTO)).toBe(dB);
    expect(companionOn(net, PRIMAL)).toBe(dB);
    const written = net.relays.get(DITTO)!.events.find((e) => e.kind === 11125)!;
    expect(written.tags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual([dA, dB, dC]);
    expect(written.tags).toContainEqual(['island_room', 'garden']);
    expect(new Set(profilesSent(net).map((e) => e.id)).size).toBe(1);
  });

  it('choosing the Blobbi already chosen publishes nothing', async () => {
    const view = await ready(net);
    act(() => view.result.current.select(dA));
    await new Promise((r) => setTimeout(r, 50));
    expect(profilesSent(net)).toHaveLength(0);
  });

  it('never publishes for a Blobbi the account does not own', async () => {
    const view = await ready(net);
    act(() => view.result.current.select(`blobbi-${'f'.repeat(12)}-0000000009`));
    await new Promise((r) => setTimeout(r, 50));
    expect(profilesSent(net)).toHaveLength(0);
    expect(view.result.current.current?.d).toBe(dA);
  });

  it.each([['Ditto'], ['Blobbi Pixel'], ['this home on another device']] as [App][])('a newer choice made in %s is met and shown, never published again', async (app) => {
    const view = await ready(net);
    chosenElsewhere(net, acc, [dA, dB, dC], dC, S() - 5, app);
    await rereadProfile();
    await waitFor(() => expect(view.result.current.current?.d).toBe(dC));
    expect(profilesSent(net)).toHaveLength(0);
    expect(companionChoices.get(acc.pubkey)).toMatchObject({ d: dC, by: 'remote' });
  });

  it('a choice published here never blocks a later one made elsewhere', async () => {
    const view = await ready(net);
    act(() => view.result.current.select(dB));
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('saved'));
    const mine = profilesSent(net)[0];
    // Ditto, a moment later by the network's order
    chosenElsewhere(net, acc, [dA, dB, dC], dC, mine.created_at + 1);
    await rereadProfile();
    await waitFor(() => expect(view.result.current.current?.d).toBe(dC));
  });

  it('an old device pick (kept before choices were shared) gives way to the profile', async () => {
    window.localStorage.setItem(getSelectedBlobbiKey(acc.pubkey), dC);
    const view = await ready(net);
    expect(view.result.current.current?.d).toBe(dA);
    expect(profilesSent(net)).toHaveLength(0);
  });

  it('a stale local choice not shared yet gives way to a profile made clearly later', async () => {
    window.localStorage.setItem(choiceKey(acc.pubkey), JSON.stringify({ version: 1, account: acc.pubkey, d: dB, at: Date.now() - 3_000_000, by: 'player', synced: null, pending: null }));
    const view = await ready(net);
    chosenElsewhere(net, acc, [dA, dB, dC], dC, S() - 600);
    await rereadProfile();
    await waitFor(() => expect(view.result.current.current?.d).toBe(dC));
    expect(profilesSent(net)).toHaveLength(0);
  });

  it('two choices too close in time are put to the player; nothing is written until they answer', async () => {
    window.localStorage.setItem(choiceKey(acc.pubkey), JSON.stringify({ version: 1, account: acc.pubkey, d: dB, at: Date.now() - 20_000, by: 'player', synced: null, pending: null }));
    chosenElsewhere(net, acc, [dA, dB, dC], dC, S() - 10);
    const view = await ready(net);
    expect(view.result.current.companion?.ambiguity).toEqual({ local: dB, global: dC });
    expect(view.result.current.current?.d).toBe(dB);
    expect(profilesSent(net)).toHaveLength(0);
    // The player keeps the Blobbi of this device: now it is their newest choice, and it is shared
    act(() => view.result.current.companion!.resolve('local'));
    await waitFor(() => expect(companionOn(net)).toBe(dB));
    expect(view.result.current.companion?.ambiguity).toBeNull();
  });

  it('a newer choice from elsewhere waits while a moment is on screen, then shows', async () => {
    const view = await ready(net);
    let release!: () => void;
    act(() => {
      release = switchHolds.hold();
    });
    chosenElsewhere(net, acc, [dA, dB, dC], dC, S() - 5);
    await rereadProfile();
    await new Promise((r) => setTimeout(r, 50));
    expect(view.result.current.current?.d).toBe(dA);
    act(() => release());
    await waitFor(() => expect(view.result.current.current?.d).toBe(dC));
  });

  it('offline: the choice shows, waits, and is shared when the connection comes back', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const view = await ready(net);
    act(() => view.result.current.select(dB));
    await waitFor(() => expect(view.result.current.companion?.status).toEqual({ kind: 'waiting', reason: 'offline' }));
    expect(view.result.current.current?.d).toBe(dB);
    expect(profilesSent(net)).toHaveLength(0);
    online.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('saved'));
    expect(companionOn(net)).toBe(dB);
  });

  it('a relay that must answer does not: nothing is built or signed; Try again shares it', async () => {
    net.relays.get(PRIMAL)!.silent = true;
    const view = await ready(net);
    const signs = vi.spyOn(signedIn.user!.signer, 'signEvent');
    act(() => view.result.current.select(dB));
    await waitFor(() => expect(view.result.current.companion?.status).toEqual({ kind: 'waiting', reason: 'unsafe' }));
    expect(signs).not.toHaveBeenCalled();
    net.relays.get(PRIMAL)!.silent = false;
    act(() => view.result.current.companion!.retry());
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('saved'));
  });

  it('a refused publication is retried with the very same signed event (no duplicate)', async () => {
    for (const r of net.relays.values()) r.refuse = true;
    const view = await ready(net);
    act(() => view.result.current.select(dB));
    await waitFor(() => expect(view.result.current.companion?.status).toEqual({ kind: 'waiting', reason: 'failed' }));
    for (const r of net.relays.values()) r.refuse = false;
    act(() => view.result.current.companion!.retry());
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('saved'));
    expect(new Set(profilesSent(net).map((e) => e.id)).size).toBe(1);
  });

  it('a signer that says no: nothing is sent, and the player may try again', async () => {
    const view = await ready(net);
    vi.spyOn(signedIn.user!.signer, 'signEvent').mockRejectedValueOnce(new Error('User rejected'));
    act(() => view.result.current.select(dB));
    await waitFor(() => expect(view.result.current.companion?.status).toEqual({ kind: 'waiting', reason: 'sign-failed' }));
    expect(profilesSent(net)).toHaveLength(0);
    act(() => view.result.current.companion!.retry());
    await waitFor(() => expect(companionOn(net)).toBe(dB));
  });

  it('after a reload an unshared choice waits for Try again (never sent by itself)', async () => {
    window.localStorage.setItem(choiceKey(acc.pubkey), JSON.stringify({ version: 1, account: acc.pubkey, d: dB, at: Date.now() - 5_000, by: 'player', synced: null, pending: null, over: { id: 'a'.repeat(64), createdAt: S() - 3_600, d: dA } }));
    const view = await ready(net);
    await waitFor(() => expect(view.result.current.companion?.status).toEqual({ kind: 'waiting', reason: 'not-sent' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(profilesSent(net)).toHaveLength(0);
  });

  it('switching accounts never carries a choice, or its write, to the other account', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const view = await ready(net);
    act(() => view.result.current.select(dB));
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('waiting'));
    const other = testAccount();
    signInAs(other);
    view.rerender();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(profilesSent(net)).toHaveLength(0);
    expect(companionChoices.get(other.pubkey)).toBeNull();
    expect(companionChoices.get(acc.pubkey)?.d).toBe(dB);
  });

  it('an optional relay that is down never stops the share', async () => {
    net.relays.get(BAND)!.down = true;
    const view = await ready(net);
    act(() => view.result.current.select(dC));
    await waitFor(() => expect(view.result.current.companion?.status.kind).toBe('saved'));
  });
});
