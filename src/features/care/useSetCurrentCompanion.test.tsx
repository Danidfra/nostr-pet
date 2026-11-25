/**
 * The device-world companion writer never writes to the real relays: there the
 * companion sync's protected profile write is the only one (Phase 0).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { buildBlobbonautTags, updateBlobbonautTags } from '@blobbi-kit/core';
import type { ReactNode } from 'react';
import { createHomePool } from '@/lib/home-pool';
import { fakeNetwork } from '@/test/fake-relays';
import { PUBKEY } from '@/test/fixtures';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: PUBKEY, signer: { signEvent: async (t: object) => ({ ...t, pubkey: PUBKEY, id: 'f'.repeat(64), sig: 's' }) } } }),
}));
import { useSetCurrentCompanion } from './useSetCurrentCompanion';

const profile: NostrEvent = { id: '1'.repeat(64), pubkey: PUBKEY, kind: 11125, created_at: 100, tags: updateBlobbonautTags(buildBlobbonautTags(PUBKEY), { has: ['a', 'b'], current_companion: 'a' }), content: '', sig: 's' };

function render(nostr: unknown) {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <NostrContext.Provider value={{ nostr: nostr as never }}>{children}</NostrContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => useSetCurrentCompanion(PUBKEY), { wrapper });
}

describe('the device-world companion writer', () => {
  it('over the real relays it publishes nothing', async () => {
    const network = fakeNetwork();
    for (const url of ['wss://a.test', 'wss://b.test']) network.relay(url).events.push(profile);
    const { result } = render(createHomePool({ relays: ['wss://a.test', 'wss://b.test'], hints: [], open: network.open }));
    const out = await act(() => result.current.mutateAsync({ d: 'b', ownedDs: ['a', 'b'] }));
    expect(out).toEqual({ published: false, reason: 'networked' });
    expect(network.published()).toEqual([]);
  });

  it("in a world on this device (a guest's, a fixture's) it still writes the choice there", async () => {
    const written: NostrEvent[] = [];
    const world = { query: async () => [profile], event: async (e: NostrEvent) => void written.push(e) };
    const { result } = render(world);
    const out = await act(() => result.current.mutateAsync({ d: 'b', ownedDs: ['a', 'b'] }));
    expect(out.published).toBe(true);
    expect(written[0].tags).toContainEqual(['current_companion', 'b']);
  });
});
