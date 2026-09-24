import { describe, expect, it } from 'vitest';
import { BASE_RELAYS, MAX_RELAYS_PER_READ, normalizeRelayUrl, relaySet } from './relays';

describe('normalizeRelayUrl', () => {
  it('gives one spelling to one relay', () => {
    expect(normalizeRelayUrl('wss://relay.ditto.pub')).toBe('wss://relay.ditto.pub');
    expect(normalizeRelayUrl('wss://relay.ditto.pub/')).toBe('wss://relay.ditto.pub');
    expect(normalizeRelayUrl('WSS://Relay.Ditto.Pub///')).toBe('wss://relay.ditto.pub');
    expect(normalizeRelayUrl('  wss://relay.ditto.pub:443 ')).toBe('wss://relay.ditto.pub');
    expect(normalizeRelayUrl('wss://relay.example:7777/nostr/')).toBe('wss://relay.example:7777/nostr');
  });

  it('rejects anything that is not a plain secure relay URL', () => {
    for (const bad of ['', '   ', 'relay.ditto.pub', 'ws://relay.ditto.pub', 'http://relay.ditto.pub', 'https://relay.ditto.pub', 'wss://user:pw@relay.ditto.pub', 'wss://relay.ditto.pub/?x=1', 'wss://relay.ditto.pub/#frag', 'javascript:alert(1)', 'not a url', 'wss://']) {
      expect(normalizeRelayUrl(bad), bad).toBeNull();
    }
    expect(normalizeRelayUrl(undefined)).toBeNull();
    expect(normalizeRelayUrl(42)).toBeNull();
    expect(normalizeRelayUrl({ url: 'wss://relay.ditto.pub' })).toBeNull();
  });

  it('the application relays are already canonical', () => {
    for (const url of BASE_RELAYS) expect(normalizeRelayUrl(url)).toBe(url);
  });
});

describe('relaySet', () => {
  it('normalizes, drops the invalid, deduplicates and keeps first-seen order', () => {
    expect(relaySet([['wss://b.example/', 'junk', 'wss://a.example'], ['WSS://B.EXAMPLE', null, 'wss://a.example/']])).toEqual(['wss://b.example', 'wss://a.example']);
  });

  it('caps at the ceiling without dropping the earlier entries', () => {
    const many = Array.from({ length: 20 }, (_, i) => `wss://r${i}.example`);
    expect(relaySet([many])).toHaveLength(MAX_RELAYS_PER_READ);
    expect(relaySet([many], 2)).toEqual(['wss://r0.example', 'wss://r1.example']);
  });
});
