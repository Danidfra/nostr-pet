/**
 * Whether relays can be reached is decided from the browser's APIs, in
 * words: a plain-HTTP LAN page (no `crypto.randomUUID`, Web Crypto withheld
 * by the browser) is named as such, with the way out; a browser with no Web
 * Crypto at all is told apart; a secure page passes. Nothing is polyfilled.
 */
import { describe, expect, it } from 'vitest';
import { checkRelayTransport, RelayTimeoutError, RelayTransportError } from './relay-transport';

const lan = { protocol: 'http:', host: '192.168.1.4:8080' };

describe('checkRelayTransport', () => {
  it('passes a secure context with Web Crypto', () => {
    expect(checkRelayTransport({ crypto: { getRandomValues: () => {}, randomUUID: () => '' }, isSecureContext: true, location: { protocol: 'https:', host: 'blobbi.pet' } })).toBeNull();
  });

  it('names a plain-HTTP LAN address, where the browser keeps getRandomValues but withholds randomUUID, and says what to do', () => {
    const block = checkRelayTransport({ crypto: { getRandomValues: () => {} }, isSecureContext: false, location: lan });
    expect(block?.reason).toBe('insecure-context');
    expect(block?.message).toContain('http://192.168.1.4:8080');
    expect(block?.message).toMatch(/https:\/\//);
    expect(block?.message).toMatch(/localhost/);
    expect(block?.message).toMatch(/\?fixture=/);
  });

  it('tells a browser with no Web Crypto at all apart from an insecure page', () => {
    expect(checkRelayTransport({ crypto: undefined, isSecureContext: true })?.reason).toBe('no-web-crypto');
    expect(checkRelayTransport({ crypto: {}, isSecureContext: true })?.reason).toBe('no-web-crypto');
  });

  it('reads the real globals when given nothing (jsdom under vitest is a secure context with Web Crypto)', () => {
    expect(checkRelayTransport()).toBeNull();
  });

  it('the errors carry the words and a name a screen can switch on', () => {
    const block = checkRelayTransport({ crypto: { getRandomValues: () => {} }, isSecureContext: false, location: lan })!;
    const error = new RelayTransportError(block);
    expect(error.name).toBe('RelayTransportError');
    expect(error.reason).toBe('insecure-context');
    expect(error.message).toBe(block.message);
    const timeout = new RelayTimeoutError(15_000);
    expect(timeout.name).toBe('RelayTimeoutError');
    expect(timeout.message).toMatch(/15 seconds/);
  });
});
