import { describe, expect, it } from 'vitest';
import type { NostrFilter } from '@nostrify/nostrify';
import { buildReadRoutingPolicy, primaryCovers, routeReadFilters } from './relay-routing';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, OWN_SYNC_KINDS, PRIMARY_KINDS, PRIMARY_READ_KINDS, PRIMARY_RELAY, PROFILE_REQUIRED_RELAYS, syncDestinations } from '@/config/relays';
import { ECOSYSTEM_READ_HINTS } from '@/features/inventory/relay-hints';
import { BLOBBI_RELAY_URL, blobbiRelayAcceptsKind } from './blobbi-relay-routing';

const ME = 'a'.repeat(64);
const policy = buildReadRoutingPolicy({ appRelays: BASE_RELAYS, hints: ECOSYSTEM_READ_HINTS, primary: { url: PRIMARY_RELAY, kinds: PRIMARY_READ_KINDS } });
const routesOf = (filter: NostrFilter) => [...routeReadFilters([filter], policy).keys()];

describe("the home's relay table", () => {
  it('the primary is the Blobbi relay, and none of the application relays', () => {
    expect(PRIMARY_RELAY).toBe(BLOBBI_RELAY_URL);
    expect(PRIMARY_RELAY).toBe('wss://relay.blobbi.pet');
    expect(BASE_RELAYS).toEqual(['wss://relay.ditto.pub', 'wss://relay.primal.net', 'wss://relay.nostr.band']);
    expect(BASE_RELAYS).not.toContain(PRIMARY_RELAY);
  });

  it('every primary kind is one the relay has a write rule for; kind 0, deletions, NIP-46 and themes are not among them', () => {
    for (const kind of PRIMARY_KINDS) expect(blobbiRelayAcceptsKind(kind)).toBe(true);
    for (const kind of [0, 5, 1, 24133, 36767, 3367, 16769, 10002, 1059]) expect(PRIMARY_KINDS).not.toContain(kind);
    for (const kind of [31124, 11125, 1124, 31633, 31634, 1416, 1417, 31126, 21124]) expect(PRIMARY_KINDS).toContain(kind);
  });

  it('a profile write never REQUIRES the primary, and absence is never concluded WITHOUT it', () => {
    expect(PROFILE_REQUIRED_RELAYS).not.toContain(PRIMARY_RELAY);
    expect(ABSENCE_REQUIRED_RELAYS).toEqual([PRIMARY_RELAY, 'wss://relay.ditto.pub', 'wss://relay.primal.net']);
  });

  it('an own event belongs on the primary and on the secondaries of its flow, and nowhere else', () => {
    for (const kind of [31124, 11125, 1124, 1416]) expect(syncDestinations(kind)).toEqual([PRIMARY_RELAY, ...BASE_RELAYS]);
    for (const kind of [31633, 31634, 1417]) expect(syncDestinations(kind)).toEqual([PRIMARY_RELAY, 'wss://relay.ditto.pub', 'wss://relay.primal.net']);
    for (const kind of [0, 1, 5, 31125, 31126, 21124, 24133, 31632]) expect(syncDestinations(kind)).toEqual([]);
    expect(OWN_SYNC_KINDS).toEqual([31124, 11125, 1124, 31633, 31634, 1416, 1417]);
  });
});

describe('read routes with the primary', () => {
  it('the Blobbi kinds are asked of the primary FIRST, then of every application relay', () => {
    for (const kind of [31124, 11125, 1124, 1416]) expect(routesOf({ kinds: [kind], authors: [ME] })).toEqual([PRIMARY_RELAY, ...BASE_RELAYS]);
    expect(routesOf({ kinds: [31633], authors: [ME] }).slice(0, 4)).toEqual([PRIMARY_RELAY, ...BASE_RELAYS]);
    // The legacy profile is read from it too (never written)
    expect(primaryCovers({ kinds: [11125, 31125], authors: [ME] }, policy)).toBe(true);
  });

  it('profile metadata, NIP-46, the Ditto theme kinds and an ids lookup keep the application relays alone', () => {
    for (const filter of [{ kinds: [0], authors: [ME] }, { kinds: [24133], '#p': [ME] }, { kinds: [36767], authors: [ME] }, { kinds: [3367], authors: [ME] }, { kinds: [16769], authors: [ME] }, { ids: ['c'.repeat(64)] }] as NostrFilter[]) {
      expect(routesOf(filter)).toEqual([...BASE_RELAYS]);
    }
  });

  it('a primary listed among the application relays or the hints is still one relay, routed by kind', () => {
    const doubled = buildReadRoutingPolicy({ appRelays: [PRIMARY_RELAY + '/', ...BASE_RELAYS], hints: [{ label: 'x', kinds: [31633], relays: [PRIMARY_RELAY] }], primary: { url: PRIMARY_RELAY, kinds: [31124] } });
    expect([...routeReadFilters([{ kinds: [0] }], doubled).keys()]).toEqual([...BASE_RELAYS]);
    expect([...routeReadFilters([{ kinds: [31633] }], doubled).keys()]).toEqual([...BASE_RELAYS]);
    expect([...routeReadFilters([{ kinds: [31124] }], doubled).keys()]).toEqual([PRIMARY_RELAY, ...BASE_RELAYS]);
  });

  it('without a primary nothing changes', () => {
    const bare = buildReadRoutingPolicy({ appRelays: BASE_RELAYS, hints: [] });
    expect(bare.primary).toBeNull();
    expect([...routeReadFilters([{ kinds: [31124] }], bare).keys()]).toEqual([...BASE_RELAYS]);
  });
});
