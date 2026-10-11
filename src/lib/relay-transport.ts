/**
 * Whether this page can talk to relays at all, decided before a socket is
 * opened, and the errors the home pool raises instead of hanging.
 *
 * nostrify's `NRelay1` names every subscription with `crypto.randomUUID()`.
 * Browsers expose that function (and `crypto.subtle`) only in a secure
 * context: `https://`, or `http://localhost`. A page opened over plain HTTP
 * on a LAN address (`http://192.168.1.4:8080`, a phone on the same Wi-Fi)
 * has `crypto.getRandomValues` but no `randomUUID`, so every REQ throws
 * inside the pool, where `NPool.req` swallows per-relay errors; no EOSE
 * ever arrives and `query` never resolves. The home would say "Looking for
 * your Blobbi…" forever. This check turns that into an error with a cause
 * and a way out, at once.
 *
 * Nothing here adds a fallback: a missing API is reported, never replaced.
 * Keys are made elsewhere (nostr-tools over `getRandomValues`) and are not
 * the problem; the relay transport is.
 */

export type TransportBlockReason = 'insecure-context' | 'no-web-crypto';

export interface TransportBlock {
  reason: TransportBlockReason;
  /** What the player reads: the cause and what to do instead. */
  message: string;
}

interface CryptoLike {
  getRandomValues?: unknown;
  randomUUID?: unknown;
}

export interface TransportEnvironment {
  crypto?: CryptoLike;
  isSecureContext?: boolean;
  /** `location.protocol` and `location.host`, for the message. */
  location?: { protocol: string; host: string };
}

function describeEnvironment(): TransportEnvironment {
  const g = globalThis as unknown as { crypto?: CryptoLike; isSecureContext?: boolean; location?: { protocol: string; host: string } };
  return { crypto: g.crypto, isSecureContext: g.isSecureContext, location: g.location };
}

/** `null` when relays can be reached; otherwise why not, in words. */
export function checkRelayTransport(env: TransportEnvironment = describeEnvironment()): TransportBlock | null {
  const c = env.crypto;
  const hasRandom = typeof c?.getRandomValues === 'function';
  const hasUUID = typeof c?.randomUUID === 'function';
  if (hasRandom && hasUUID) return null;
  const insecure = env.isSecureContext === false && (hasRandom || !c);
  const where = env.location ? `${env.location.protocol}//${env.location.host}` : 'this address';
  if (insecure) {
    return {
      reason: 'insecure-context',
      message: `This page is open over plain HTTP (${where}), which the browser treats as insecure, so it withholds part of Web Crypto and the relays cannot be reached. Open it over https://, or on localhost on this machine. A development fixture link (?fixture=) works here without an account.`,
    };
  }
  return {
    reason: 'no-web-crypto',
    message: 'This browser has no Web Crypto (crypto.getRandomValues and crypto.randomUUID), which the relays need. Use a current browser.',
  };
}

/** The relays cannot be reached from this page at all (see `checkRelayTransport`). */
export class RelayTransportError extends Error {
  readonly reason: TransportBlockReason;
  constructor(block: TransportBlock) {
    super(block.message);
    this.name = 'RelayTransportError';
    this.reason = block.reason;
  }
}

/** No relay answered a read within the home's deadline. */
export class RelayTimeoutError extends Error {
  constructor(ms: number) {
    super(`No relay answered within ${Math.round(ms / 1000)} seconds. Check the connection and try again.`);
    this.name = 'RelayTimeoutError';
  }
}
