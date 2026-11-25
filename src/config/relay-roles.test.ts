/** Which relay is for what (the table in `relays.ts`), and how wide a read can get. */
import { describe, expect, it } from 'vitest';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY, KIND_GAME_INVENTORY_SPEND, KIND_GAME_ITEM_DEFINITION } from '@nostr-games/inventory';
import { ABSENCE_REQUIRED_RELAYS, MAX_EXTRA_RELAYS, MAX_RELAYS_PER_READ, PRIMARY_KINDS, PRIMARY_READ_KINDS, PROFILE_REQUIRED_RELAYS, confirmationRelaysFor } from './relays';
import { buildReadRoutingPolicy, routeReadFilters } from '@/lib/relay-routing';
import { ECOSYSTEM_READ_HINTS } from '@/features/inventory/relay-hints';
import { OFFICIAL_ITEM_ISSUER } from '@/features/inventory/issuers';
import { DEFAULT_RELAYS, defaultRelayRole } from '@/features/relays/relay-settings';
import { BASE_RELAYS, PRIMARY_RELAY } from './relays';

const BAND = 'wss://relay.nostr.band';

describe('relay roles', () => {
  it('relay.nostr.band is a default relay only: no complete read and no saved write depends on it', () => {
    expect(DEFAULT_RELAYS).toContain(BAND);
    expect(ABSENCE_REQUIRED_RELAYS).not.toContain(BAND);
    expect(PROFILE_REQUIRED_RELAYS).not.toContain(BAND);
    expect(defaultRelayRole(BAND)).toBe('default');
    for (const kind of [0, KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_GAME_INVENTORY_SPEND]) expect(confirmationRelaysFor(kind)).not.toBeNull();
  });

  it('the Blobbi relay, ditto and primal are the ones a complete read and a saved write need', () => {
    expect(DEFAULT_RELAYS.map(defaultRelayRole)).toEqual(['primary', 'required', 'required', 'default']);
    expect(ABSENCE_REQUIRED_RELAYS).toEqual(['wss://relay.blobbi.pet', 'wss://relay.ditto.pub', 'wss://relay.primal.net']);
  });

  it('a read reaches at most the defaults, five extras and the hints, under the ceiling', () => {
    const extras = Array.from({ length: MAX_EXTRA_RELAYS }, (_, i) => `wss://extra${i}.example`);
    const policy = { ...buildReadRoutingPolicy({ appRelays: BASE_RELAYS, hints: ECOSYSTEM_READ_HINTS, primary: { url: PRIMARY_RELAY, kinds: PRIMARY_READ_KINDS } }), extraReads: extras };
    // The widest read the home makes: Blobbi kinds, inventories and the official items in one request
    const routes = routeReadFilters([{ kinds: [KIND_BLOBBI_STATE] }, { kinds: [KIND_GAME_INVENTORY] }, { kinds: [KIND_GAME_ITEM_DEFINITION], authors: [OFFICIAL_ITEM_ISSUER] }], policy);
    expect(routes.size).toBeLessThanOrEqual(MAX_RELAYS_PER_READ);
    expect([...routes.keys()]).toEqual(expect.arrayContaining([...DEFAULT_RELAYS, ...extras, 'wss://relay.dreamith.to']));
    expect(routes.size).toBe(DEFAULT_RELAYS.length + MAX_EXTRA_RELAYS + 1);
    expect(PRIMARY_KINDS.length).toBeGreaterThan(0);
  });
});
