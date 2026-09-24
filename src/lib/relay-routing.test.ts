import { describe, expect, it } from 'vitest';
import type { NostrFilter } from '@nostrify/nostrify';
import { buildReadRoutingPolicy, hintedRelaysFor, routeReadFilters, type ReadHint } from './relay-routing';

const APP = ['wss://app-a.example', 'wss://app-b.example'];
const ISSUER = 'a'.repeat(64);
const STRANGER = 'b'.repeat(64);
const HINTS: ReadHint[] = [
  { label: 'issuer definitions', kinds: [31632], authors: [ISSUER], relays: ['wss://issuer.example', 'wss://app-a.example'] },
  { label: 'game inventories', kinds: [31633, 1416, 1417], relays: ['wss://game.example'] },
  { label: 'another game', kinds: [31633], relays: ['wss://game.example', 'wss://other.example/'] },
];
const policy = buildReadRoutingPolicy({ appRelays: APP, hints: HINTS });

const defs = (authors: string[]): NostrFilter => ({ kinds: [31632], authors, '#d': ['x'] });
const inventories: NostrFilter = { kinds: [31633], authors: [STRANGER] };
const spends: NostrFilter = { kinds: [1416], authors: [STRANGER] };
const byId: NostrFilter = { ids: ['c'.repeat(64)] };

describe('hintedRelaysFor', () => {
  it('hints by kind, and by author only when the hint names authors', () => {
    expect(hintedRelaysFor(defs([ISSUER]), policy)).toEqual(['wss://issuer.example']);
    expect(hintedRelaysFor(defs([STRANGER]), policy)).toEqual([]);
    expect(hintedRelaysFor(defs([]), policy)).toEqual([]);
    expect(hintedRelaysFor(inventories, policy)).toEqual(['wss://game.example', 'wss://other.example']);
    expect(hintedRelaysFor(spends, policy)).toEqual(['wss://game.example']);
  });

  it('never hints a filter without kinds, and never repeats an application relay', () => {
    expect(hintedRelaysFor(byId, policy)).toEqual([]);
    expect(hintedRelaysFor({ kinds: [31124], authors: [STRANGER] }, policy)).toEqual([]);
    expect(hintedRelaysFor(defs([ISSUER]), policy)).not.toContain('wss://app-a.example');
  });
});

describe('routeReadFilters', () => {
  it('sends every filter to every application relay and only the covered filters to a hint', () => {
    const routes = routeReadFilters([defs([ISSUER]), inventories, byId], policy);
    expect([...routes.keys()]).toEqual(['wss://app-a.example', 'wss://app-b.example', 'wss://issuer.example', 'wss://game.example', 'wss://other.example']);
    expect(routes.get('wss://app-a.example')).toEqual([defs([ISSUER]), inventories, byId]);
    expect(routes.get('wss://issuer.example')).toEqual([defs([ISSUER])]);
    expect(routes.get('wss://game.example')).toEqual([inventories]);
    expect(routes.get('wss://other.example')).toEqual([inventories]);
  });

  it('a relay hinted by two filters receives both, once each', () => {
    const routes = routeReadFilters([inventories, spends, inventories], policy);
    expect(routes.get('wss://game.example')).toEqual([inventories, spends]);
  });

  it('with no hints the routes are exactly the application relays', () => {
    const bare = buildReadRoutingPolicy({ appRelays: APP, hints: [] });
    expect([...routeReadFilters([inventories], bare).keys()]).toEqual(APP);
  });

  it('caps hinted relays and never drops an application relay', () => {
    const wide = buildReadRoutingPolicy({
      appRelays: APP,
      hints: [{ label: 'many', kinds: [31633], relays: Array.from({ length: 10 }, (_, i) => `wss://h${i}.example`) }],
      maxRelays: 4,
    });
    const routes = routeReadFilters([inventories], wide);
    expect([...routes.keys()]).toEqual(['wss://app-a.example', 'wss://app-b.example', 'wss://h0.example', 'wss://h1.example']);
  });
});

describe('buildReadRoutingPolicy', () => {
  it('normalizes application relays and hints, dropping invalid URLs before they can reach a socket', () => {
    const built = buildReadRoutingPolicy({
      appRelays: ['wss://app.example/', 'WSS://APP.EXAMPLE', 'junk'],
      hints: [{ label: 'h', kinds: [31633], relays: ['ws://insecure.example', 'wss://ok.example/', 'http://web.example', 'wss://ok.example', ''] }],
    });
    expect(built.appRelays).toEqual(['wss://app.example']);
    expect(built.hints[0].relays).toEqual(['wss://ok.example']);
    expect(routeReadFilters([{ kinds: [31633] }], built).has('junk')).toBe(false);
    expect(routeReadFilters([{ kinds: [31633] }], built).has('ws://insecure.example')).toBe(false);
  });
});
