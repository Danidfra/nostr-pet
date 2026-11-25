/**
 * The kind 0 write never replaces metadata it could not read (`metadata-write.ts`,
 * `useProfileSetup.ts`), on the real pool over fake relays: a slow, silent or
 * failing relay, malformed metadata, a profile elsewhere, and a newer one
 * written while signing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NPool, NostrEvent } from '@nostrify/nostrify';
import type { ReactNode } from 'react';
import { createHomePool } from '@/lib/home-pool';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import { mergeRawMetadata, planMetadataWrite, parseRawMetadata, readMetadataCensus } from './metadata-write';

const PK = 'a'.repeat(64);
const DITTO = 'wss://relay.ditto.pub';
const PRIMAL = 'wss://relay.primal.net';
const BAND = 'wss://relay.nostr.band';

const signer = vi.hoisted(() => ({ sign: null as null | ((t: { content: string; tags: string[][]; created_at: number }) => void) }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: PK,
      signer: {
        signEvent: async (t: { kind: number; content: string; tags: string[][]; created_at: number }) => {
          signer.sign?.(t);
          return { ...t, pubkey: PK, id: `signed-${t.created_at}`.padEnd(64, '0'), sig: 's' };
        },
      },
    },
  }),
}));
import { useProfileSetup } from './useProfileSetup';

let network: FakeNetwork;
const kind0 = (content: unknown, created_at: number, id = String(created_at).padEnd(64, '0'), tags: string[][] = []): NostrEvent => ({ id, pubkey: PK, kind: 0, created_at, tags, content: typeof content === 'string' ? content : JSON.stringify(content), sig: 's' });
const FULL = { name: 'Dana', display_name: 'Dana Q', about: 'hi', nip05: '_@dana.test', lud16: 'dana@wallet.test', banner: 'https://x.test/b.png', website: 'dana.test', custom_field: { nested: true } };

function pool(): NPool {
  return createHomePool({ relays: [DITTO, PRIMAL, BAND], hints: [], primary: null, open: network.open, relayTimeout: 300 });
}

function setup(opts: { allowCreate?: boolean } = {}) {
  const nostr = pool();
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <NostrContext.Provider value={{ nostr }}>{children}</NostrContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => useProfileSetup(PK, opts), { wrapper });
}

const sent = () => network.published().filter((p) => p.event.kind === 0);

beforeEach(() => {
  network = fakeNetwork();
  signer.sign = null;
});

describe('the kind 0 write', () => {
  it('keeps every field it does not touch, unknown ones and values outside the schema included, and the base tags', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).events.push(kind0(FULL, 100, undefined, [['i', 'github:dana', 'proof'], ['client', 'other']]));
    const { result } = setup();
    await act(() => result.current.publish.mutateAsync({ name: 'Lupa', about: 'hi', picture: '' }));
    const [{ event }] = sent();
    expect(JSON.parse(event.content)).toEqual({ ...FULL, name: 'Lupa' });
    expect(event.tags).toEqual([['i', 'github:dana', 'proof'], ['client', 'Blobbi']]);
    expect(event.created_at).toBeGreaterThan(100);
  });

  it('the newest kind 0 wins, whichever relay holds it', async () => {
    network.relay(DITTO).events.push(kind0({ ...FULL, about: 'old' }, 100));
    network.relay(PRIMAL).events.push(kind0({ ...FULL, about: 'new' }, 200));
    const { result } = setup();
    await act(() => result.current.publish.mutateAsync({ name: 'Lupa', about: 'new', picture: '' }));
    expect(JSON.parse(sent()[0].event.content).about).toBe('new');
  });

  it.each([
    ['silent', 'hanging'],
    ['refusing the connection', 'offline'],
  ] as const)('a required relay %s: nothing is signed or sent', async (_, mode) => {
    network.relay(DITTO).events.push(kind0(FULL, 100));
    network.relay(PRIMAL).mode = mode;
    const signed = vi.fn();
    signer.sign = signed;
    const { result } = setup();
    await act(() => expect(result.current.publish.mutateAsync({ name: 'Lupa', about: '', picture: '' })).rejects.toThrow(/could not read your current profile/));
    expect(signed).not.toHaveBeenCalled();
    expect(sent()).toEqual([]);
  }, 15_000);

  it('a slow relay answering in time is waited for (the old 2.5 s cut wrote over it)', async () => {
    network.relay(DITTO).events.push(kind0(FULL, 100));
    network.relay(PRIMAL).mode = 'slow';
    network.relay(PRIMAL).delayMs = 3_000;
    network.relay(PRIMAL).events.push(kind0(FULL, 100));
    const { result } = setup();
    await act(() => result.current.publish.mutateAsync({ name: 'Lupa', about: 'hi', picture: '' }));
    expect(JSON.parse(sent()[0].event.content)).toEqual({ ...FULL, name: 'Lupa' });
  }, 15_000);

  it('a best-effort relay that is down does not block the write', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).events.push(kind0(FULL, 100));
    network.relay(BAND).mode = 'offline';
    const { result } = setup();
    await act(() => result.current.publish.mutateAsync({ name: 'Lupa', about: 'hi', picture: '' }));
    expect(sent().length).toBeGreaterThan(0);
  });

  it('malformed metadata is never replaced', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).events.push(kind0('{not json', 100));
    const { result } = setup();
    await act(() => expect(result.current.publish.mutateAsync({ name: 'Lupa', about: '', picture: '' })).rejects.toThrow(/could not be read safely/));
    expect(sent()).toEqual([]);
    expect(parseRawMetadata(kind0('[1,2]', 1))).toBeNull();
    expect(parseRawMetadata(kind0('null', 1))).toBeNull();
  });

  it('an account that signed in and has no kind 0 on these relays: none is created over one that may live elsewhere', async () => {
    const { result } = setup();
    await act(() => expect(result.current.publish.mutateAsync({ name: 'Lupa', about: '', picture: '' })).rejects.toThrow(/not found/));
    expect(sent()).toEqual([]);
  });

  it('a key made here (saving a guest) may start its first kind 0', async () => {
    const { result } = setup({ allowCreate: true });
    await act(() => result.current.publish.mutateAsync({ name: 'Lupa', about: '', picture: '' }));
    expect(JSON.parse(sent()[0].event.content)).toEqual({ name: 'Lupa', display_name: 'Lupa' });
  });

  it('a newer kind 0 written while the signer was asked: nothing is sent', async () => {
    for (const url of [DITTO, PRIMAL]) network.relay(url).events.push(kind0(FULL, 100));
    signer.sign = () => network.relay(PRIMAL).events.push(kind0({ ...FULL, about: 'from another app' }, 150));
    const { result } = setup();
    await act(() => expect(result.current.publish.mutateAsync({ name: 'Lupa', about: 'hi', picture: '' })).rejects.toThrow(/changed somewhere else/));
    expect(sent()).toEqual([]);
  });
});

describe('the merge and the plan', () => {
  it('display_name follows the name only when it was missing or the same', () => {
    expect(mergeRawMetadata({ name: 'x', display_name: 'x' }, { name: 'Dana', about: '', picture: '' })).toEqual({ name: 'Dana', display_name: 'Dana' });
    expect(mergeRawMetadata({ name: 'x', display_name: 'Other' }, { name: 'Dana', about: '', picture: '' })).toEqual({ name: 'Dana', display_name: 'Other' });
    expect(mergeRawMetadata({ picture: 'https://x.test/p.png' }, { name: '', about: '', picture: '' })).toEqual({ picture: 'https://x.test/p.png' });
  });

  it('an incomplete census refuses whatever was found', () => {
    expect(planMetadataWrite({ complete: false, missing: [PRIMAL], newest: kind0(FULL, 1) }, { name: 'a', about: '', picture: '' }, { allowCreate: true, now: 10, client: 'Blobbi' })).toEqual({ kind: 'refused', reason: 'incomplete' });
  });

  it('the census asks each relay on its own and names the required ones that did not answer', async () => {
    network.relay(PRIMAL).mode = 'offline';
    const census = await readMetadataCensus(pool(), PK, { timeoutMs: 300 });
    expect(census).toEqual({ complete: false, missing: [PRIMAL], newest: null });
  });
});
