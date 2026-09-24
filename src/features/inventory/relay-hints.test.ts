/**
 * The hint table is data about other repositories; these tests pin what it
 * claims and that the router turns it into the reads the ecosystem needs.
 */
import { describe, expect, it } from 'vitest';
import { BASE_RELAYS, normalizeRelayUrl } from '@/config/relays';
import { buildReadRoutingPolicy, routeReadFilters } from '@/lib/relay-routing';
import { FARM_ITEM_ISSUER, OFFICIAL_ITEM_ISSUER, TRUSTED_ISSUERS } from './issuers';
import { ECOSYSTEM_READ_HINTS, FARM_INVENTORY_RELAYS, ISLAND_RELAYS, SOURCE_RELAYS } from './relay-hints';
import { describeInventorySource } from './sources';

const policy = buildReadRoutingPolicy({ appRelays: BASE_RELAYS, hints: ECOSYSTEM_READ_HINTS });
const relaysFor = (filter: Parameters<typeof routeReadFilters>[0][number]) => [...routeReadFilters([filter], policy).keys()];

describe('the ecosystem hint table', () => {
  it('is written in canonical relay URLs (a typo here would silently vanish at run time)', () => {
    for (const hint of ECOSYSTEM_READ_HINTS) for (const url of hint.relays) expect(normalizeRelayUrl(url), `${hint.label}: ${url}`).toBe(url);
    for (const issuer of TRUSTED_ISSUERS) for (const url of issuer.relays) expect(normalizeRelayUrl(url)).toBe(url);
  });

  it('names only inventory sources the home knows', () => {
    for (const id of Object.keys(SOURCE_RELAYS)) expect(describeInventorySource(id).known, id).toBe(true);
    expect(SOURCE_RELAYS['blobbi:island']).toBe(ISLAND_RELAYS);
    expect(SOURCE_RELAYS['farm:main']).toBe(FARM_INVENTORY_RELAYS);
  });

  it('carries one definition hint per trusted issuer, restricted to that issuer', () => {
    for (const issuer of TRUSTED_ISSUERS) {
      const hint = ECOSYSTEM_READ_HINTS.find((h) => h.kinds.includes(31632) && h.authors?.includes(issuer.pubkey));
      expect(hint, issuer.label).toBeDefined();
      expect(hint!.authors).toEqual([issuer.pubkey]);
      expect(hint!.relays).toEqual(issuer.relays);
    }
  });
});

describe('what each ecosystem read reaches', () => {
  it('official definitions: the application relays plus relay.dreamith.to', () => {
    expect(relaysFor({ kinds: [31632], authors: [OFFICIAL_ITEM_ISSUER], '#d': ['blobbi:food:apple'] })).toEqual([...BASE_RELAYS, 'wss://relay.dreamith.to']);
  });

  it("Farm definitions: the application relays only, since the Farm's relays are already among them", () => {
    expect(relaysFor({ kinds: [31632], authors: [FARM_ITEM_ISSUER], '#d': ['farm:produce:carrot'] })).toEqual([...BASE_RELAYS]);
  });

  it("a stranger's definitions are never fetched from anywhere but the application relays", () => {
    expect(relaysFor({ kinds: [31632], authors: ['b'.repeat(64)], '#d': ['weird:thing'] })).toEqual([...BASE_RELAYS]);
  });

  it('inventories, spends, folds and equipment: the application relays plus every known game relay (all already present today)', () => {
    const player = 'a'.repeat(64);
    const union = [...new Set([...BASE_RELAYS, ...ISLAND_RELAYS, ...FARM_INVENTORY_RELAYS])];
    expect(relaysFor({ kinds: [31633], authors: [player] })).toEqual(union);
    expect(relaysFor({ kinds: [1416], authors: [player] })).toEqual(union);
    expect(relaysFor({ kinds: [1417], authors: [player] })).toEqual(union);
    expect(relaysFor({ kinds: [31634], authors: [player], '#a': ['31124:x:y'] })).toEqual([...new Set([...BASE_RELAYS, ...ISLAND_RELAYS])]);
  });

  it('Blobbi state and profiles stay on the application relays', () => {
    expect(relaysFor({ kinds: [31124], authors: ['a'.repeat(64)], '#b': ['blobbi'] })).toEqual([...BASE_RELAYS]);
    expect(relaysFor({ kinds: [11125], authors: ['a'.repeat(64)], '#d': ['x'] })).toEqual([...BASE_RELAYS]);
  });

  it('would still reach the ecosystem if the application relays changed', () => {
    const elsewhere = buildReadRoutingPolicy({ appRelays: ['wss://home.example'], hints: ECOSYSTEM_READ_HINTS });
    const routes = routeReadFilters([{ kinds: [31633], authors: ['a'.repeat(64)] }, { kinds: [31632], authors: [OFFICIAL_ITEM_ISSUER] }], elsewhere);
    expect([...routes.keys()].sort()).toEqual(['wss://home.example', 'wss://relay.ditto.pub', 'wss://relay.dreamith.to', 'wss://relay.primal.net']);
    expect(routes.get('wss://relay.dreamith.to')).toEqual([{ kinds: [31632], authors: [OFFICIAL_ITEM_ISSUER] }]);
  });
});
