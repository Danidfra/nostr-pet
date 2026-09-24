/**
 * Who may define an item the home will show and use.
 *
 * Trust is an issuer-pubkey table and nothing else: a kind 31632 from anyone
 * else is displayed as an unknown item, never fetched for artwork, never
 * usable. The table mirrors Blobbi Island's (`src/inventory/trusted-issuers.ts`)
 * so an item earned anywhere in the ecosystem is read the same way at home.
 *
 * Two roles:
 *  - `blobbi`: the official issuer. Effects and the care action are read from
 *    the definition's content (`effects["game:blobbi"]`, `metadata.action`).
 *  - `partner`: a friendly game. Its definitions are shown and its raw produce
 *    is food, but its numbers are never trusted: the effect is home policy.
 */

export type IssuerRole = 'blobbi' | 'partner';

export interface TrustedIssuer {
  pubkey: string;
  /** Short label for the UI ("Blobbi Island", "Nostr Farm"). */
  label: string;
  role: IssuerRole;
  /** Relays this issuer's definitions are known to live on (read hints). */
  relays: readonly string[];
}

/** The official Blobbi item issuer (npub1nmac6vz…). */
export const OFFICIAL_ITEM_ISSUER = '9efb8d3045ba753f3664d503308b49783356b26a6d5f4b944bfac4239afe63a9';

/** Nostr Farm (npub173a27t3…), whose produce a Blobbi may eat. */
export const FARM_ITEM_ISSUER = 'f47aaf2e3279fe6fcdde556336d1f740705126c9a37e6390e2ede21165199fb4';

export const TRUSTED_ISSUERS: readonly TrustedIssuer[] = [
  { pubkey: OFFICIAL_ITEM_ISSUER, label: 'Blobbi', role: 'blobbi', relays: ['wss://relay.ditto.pub', 'wss://relay.dreamith.to'] },
  { pubkey: FARM_ITEM_ISSUER, label: 'Nostr Farm', role: 'partner', relays: ['wss://relay.primal.net', 'wss://relay.ditto.pub'] },
];

/** Exact whole-hex match only: no prefixes, no npubs. */
export function trustedIssuer(pubkey: string): TrustedIssuer | undefined {
  return TRUSTED_ISSUERS.find((issuer) => issuer.pubkey === pubkey);
}

export function isTrustedIssuer(pubkey: string): boolean {
  return trustedIssuer(pubkey) !== undefined;
}
