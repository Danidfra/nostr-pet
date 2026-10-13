/**
 * Two small things about the guest's key.
 *
 * `reserveGuestIdentity` makes the key the guest Blobbi will belong to. It is
 * the same primitive every new account here uses (`createNewAccount`,
 * nostr-tools' `generateSecretKey`); the difference is only WHEN it is shown:
 * not before the egg, but when the player chooses to save. Until then the key
 * signs nothing.
 *
 * `localRecordSigner` is what the guest world "signs" with. It is deliberately
 * NOT a signer: it stamps the guest's pubkey and the event's hash (so the kit
 * and the caches can tell records apart) and leaves `sig` EMPTY. A record
 * from the guest world therefore never verifies, cannot be mistaken for a
 * Nostr event by a relay, and is refused by the guest pool should it ever be
 * offered upstream. Saving the Blobbi signs fresh events from templates
 * (`guest-migration.ts`), with the real key, through the real publish path.
 */
import type { NostrSigner } from '@nostrify/nostrify';
import type { NostrEvent } from '@blobbi-kit/core';
import { getEventHash } from 'nostr-tools/pure';
import { createNewAccount } from '@/features/onboarding/new-account';
import type { GuestIdentity } from './guest-store';

export function reserveGuestIdentity(): GuestIdentity {
  const account = createNewAccount();
  return { nsec: account.nsec, pubkey: account.pubkey };
}

/** The mark of a guest record: no signature at all. */
export const UNSIGNED = '';

export function isUnsignedRecord(event: Pick<NostrEvent, 'sig'>): boolean {
  return event.sig === UNSIGNED;
}

export function localRecordSigner(pubkey: string): NostrSigner {
  return {
    async getPublicKey() {
      return pubkey;
    },
    async signEvent(template) {
      const unsigned = { ...template, pubkey };
      const id = getEventHash(unsigned);
      return { ...unsigned, id, sig: UNSIGNED } as NostrEvent;
    },
  };
}
