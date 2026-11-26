/**
 * Renaming a Blobbi on the real pool over fake relays (the app's relay URLs, faked): only the name changes, a
 * required relay that does not answer stops it, the newest revision is the base, a save no counting relay took is
 * never a success, and a care started at the same time on this page is never undone by it (nor it by the care).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTagValue, parseModernBlobbiEvent, updateBlobbiTags, type NostrEvent } from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, PRIMARY_KINDS, PRIMARY_READ_KINDS, PRIMARY_RELAY } from '@/config/relays';
import { createHomePool } from '@/lib/home-pool';
import { fakeNetwork, type FakeNetwork } from '@/test/fake-relays';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { PublishUnconfirmedError } from '@/lib/relay-transport';

let signed = 0;
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: PUBKEY, signer: { signEvent: async (t: object) => ({ ...t, pubkey: PUBKEY, id: String(++signed).padStart(64, 'e'), sig: 's' }) } } }),
}));
import { useRenameBlobbi } from './useRenameBlobbi';
import { serializeBlobbiWrite } from './blobbi-writes';
import { checkNewName, planRename } from './rename';

let network: FakeNetwork;
const D_OF = (e: NostrEvent) => getTagValue(e.tags, 'd')!;
const brook = (createdAt = 100, extra: string[][] = [['custom_host_tag', 'keep-me']]) => ({ ...blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt, extra }), content: '{"missions":{"keep":true}}', id: String(createdAt).padStart(64, '0') });

function setup() {
  const nostr = createHomePool({ relays: BASE_RELAYS, hints: [], primary: { url: PRIMARY_RELAY, readKinds: PRIMARY_READ_KINDS, writeKinds: PRIMARY_KINDS }, open: network.open, eoseTimeout: 30, relayTimeout: 300 });
  const updated: NostrEvent[] = [];
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <NostrContext.Provider value={{ nostr }}>{children}</NostrContext.Provider>
    </QueryClientProvider>
  );
  const view = renderHook(() => useRenameBlobbi({ pubkey: PUBKEY, updateCompanionEvent: (e) => void updated.push(e) }), { wrapper });
  return { ...view, updated, nostr };
}
const sent = () => network.published().filter((p) => p.event.kind === 31124).map((p) => p.event);

beforeEach(() => {
  network = fakeNetwork();
  signed = 0;
});

describe('renaming a Blobbi', () => {
  it('changes the name and nothing else: tags, content, identity, stage and stats as they were', async () => {
    const base = brook();
    for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(base);
    const { result, updated } = setup();
    await act(() => result.current.mutateAsync({ d: D_OF(base), name: '  Lupa ', current: 'Brook' }));
    const [event] = sent();
    expect(getTagValue(event.tags, 'name')).toBe('Lupa');
    const others = (tags: string[][]) => tags.filter(([n]) => !['name', 'published_at', 'client'].includes(n)).map((t) => t.join('|')).sort();
    expect(others(event.tags)).toEqual(others(base.tags));
    expect(event.content).toBe(base.content);
    expect(event.created_at).toBeGreaterThan(base.created_at);
    expect(parseModernBlobbiEvent(event)).toMatchObject({ d: D_OF(base), stage: 'baby', stats: parseModernBlobbiEvent(base)!.stats });
    expect(updated.map((e) => e.id)).toEqual([event.id]);
  });

  it.each([['silent', 'hanging'], ['refusing the connection', 'offline']] as const)('a required relay %s: nothing is signed or sent', async (_, mode) => {
    const base = brook();
    for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(base);
    network.relay(ABSENCE_REQUIRED_RELAYS[1]).mode = mode;
    const { result } = setup();
    await act(() => expect(result.current.mutateAsync({ d: D_OF(base), name: 'Lupa', current: 'Brook' })).rejects.toThrow(/Not every relay answered/));
    expect(signed).toBe(0);
    expect(sent()).toEqual([]);
  }, 15_000);

  it('builds on the newest revision any required relay holds (a care made on another device)', async () => {
    const old = brook(100);
    const cared = { ...brook(200), tags: updateBlobbiTags(brook(200).tags, { hunger: '99' }) };
    for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(old);
    network.relay(ABSENCE_REQUIRED_RELAYS[2]).events.push(cared);
    const { result } = setup();
    await act(() => result.current.mutateAsync({ d: D_OF(old), name: 'Lupa', current: 'Brook' }));
    expect(getTagValue(sent()[0].tags, 'hunger')).toBe('99');
  });

  it('a save only a relay that does not count took is not a success, and the screen keeps the old name', async () => {
    const base = brook();
    for (const url of ABSENCE_REQUIRED_RELAYS) {
      network.relay(url).events.push(base);
      network.relay(url).refuseWith = 'blocked: down';
    }
    const { result, updated } = setup();
    const error = await act(() => result.current.mutateAsync({ d: D_OF(base), name: 'Lupa', current: 'Brook' }).catch((e: unknown) => e));
    expect(error).toBeInstanceOf(PublishUnconfirmedError);
    expect(updated).toEqual([]);
  });

  it('a care started at the same moment on this page: the rename waits its turn and keeps the care', async () => {
    const base = brook();
    for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(base);
    const { result } = setup();
    let finishCare!: () => void;
    // A care in flight: it holds the Blobbi's turn, then lands a new revision everywhere
    const care = serializeBlobbiWrite(PUBKEY, D_OF(base), async () => {
      await new Promise<void>((r) => (finishCare = r));
      const after = { ...base, id: 'c'.repeat(64), created_at: base.created_at + 50, tags: updateBlobbiTags(base.tags, { hunger: '77' }) };
      for (const url of ABSENCE_REQUIRED_RELAYS) network.relay(url).events.push(after);
    });
    const rename = result.current.mutateAsync({ d: D_OF(base), name: 'Lupa', current: 'Brook' });
    await new Promise((r) => setTimeout(r, 30));
    expect(sent()).toEqual([]);
    finishCare();
    await care;
    await act(() => rename);
    const [event] = sent();
    expect([getTagValue(event.tags, 'name'), getTagValue(event.tags, 'hunger')]).toEqual(['Lupa', '77']);
  });

  it("a guest's Blobbi is renamed in the world on this device", async () => {
    const base = brook();
    const world: NostrEvent[] = [base];
    const local = { query: async () => world, event: async (e: NostrEvent) => void world.push(e) };
    const updated: NostrEvent[] = [];
    const qc = new QueryClient();
    const { result } = renderHook(() => useRenameBlobbi({ pubkey: PUBKEY, updateCompanionEvent: (e) => void updated.push(e) }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>
          <NostrContext.Provider value={{ nostr: local as never }}>{children}</NostrContext.Provider>
        </QueryClientProvider>
      ),
    });
    await act(() => result.current.mutateAsync({ d: D_OF(base), name: 'Lupa', current: 'Brook' }));
    expect(getTagValue(world[1].tags, 'name')).toBe('Lupa');
    expect(network.published()).toEqual([]);
  });
});

describe('the new name', () => {
  it('follows the adoption rules, never blank, never the same', () => {
    expect(checkNewName('  Lupa  Lu ', 'Brook')).toEqual({ ok: true, name: 'Lupa Lu' });
    expect(checkNewName('   ', 'Brook')).toEqual({ ok: false, reason: 'empty' });
    expect(checkNewName('x'.repeat(25), 'Brook')).toEqual({ ok: false, reason: 'too-long' });
    expect(checkNewName('Brook', 'Brook')).toEqual({ ok: false, reason: 'unchanged' });
  });

  it('is written as typed, whatever the language (a name is never translated)', () => {
    const plan = planRename(parseModernBlobbiEvent(brook())!, 'Egg', 500);
    expect(getTagValue(plan.tags, 'name')).toBe('Egg');
  });
});
