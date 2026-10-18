/**
 * A PROFILE WRITE THAT NEVER RESTORES AN OLDER PROFILE: the kit's
 * `writeProfileSafely` (`@blobbi-kit/core` 0.10), with this home's signature
 * verifier (nostr-tools `verifyEvent`). For the profile writes this home makes
 * besides the companion choice (`profile-write.ts`): adoption's profile, the
 * daily award, the daily progress (`profileWriterFor`, handed to the kit's
 * `usePersistDailyProgress`).
 *
 * The kit's rules: one write at a time per account (the same queue as the
 * companion choice, `profile-queue.ts`); a complete read of the required
 * relays (an incomplete read is never taken for "no profile"); the caller's
 * change over the newest profile (NIP-01 order), so `current_companion`,
 * `has`, unknown tags and other content are as the newest profile has them;
 * `created_at` after the base's; a profile created only when the caller may
 * (`create`) and a complete read finds none; the account checked before
 * signing, after signing and right before sending; a second complete read
 * after signing (a profile written meanwhile: `stale`, nothing sent, the
 * signer asked at most once); then read back (`confirmed`).
 */
import { writeProfileSafely as writeWithKit, type NostrEvent, type ProfileBuild, type ProfileRelays as KitProfileRelays, type ProfileWriteTemplate, type SafeProfileWriteOutcome } from '@blobbi-kit/core';
import type { ProfileWriter } from '@blobbi-kit/react';
import { verifyEvent } from 'nostr-tools/pure';
import { profileFilter, type ProfileRelays } from './profile-write';
import { profileDelivery } from './profile-delivery';

export type ProfileTemplate = ProfileWriteTemplate;
export type { ProfileBuild };
export type SafeWriteOutcome<R> = SafeProfileWriteOutcome<R>;

export interface SafeWriteDeps {
  owner: string;
  relays: ProfileRelays;
  /** Signs as the account (the app's signer; `prev` keeps `published_at`). */
  sign: (template: ProfileTemplate) => Promise<NostrEvent>;
  /** The account is still the one this write is for. */
  stillAccount: () => boolean;
  now?: () => number;
  timeoutMs?: number;
  /** Checks an event's id and signature (default: nostr-tools `verifyEvent`). */
  verify?: (event: NostrEvent) => boolean;
}

export function writeProfileSafely<R extends string>(deps: SafeWriteDeps, build: (base: NostrEvent | null) => ProfileBuild<R>, opts: { create?: boolean } = {}): Promise<SafeWriteOutcome<R>> {
  const { relays } = deps;
  // The kit only ever asks for the owner's profile, with a filter identical to this home's `profileFilter` (both
  // profile kinds, the owner, the profile's d values, limit 20): each relay is asked with that one
  const kitRelays: KitProfileRelays = { urls: relays.urls, required: relays.required, query: (url, _filter, signal) => relays.query(url, profileFilter(deps.owner), signal), publish: (url, event, signal) => relays.publish(url, event, signal) };
  return writeWithKit<R>({ ...deps, relays: kitRelays, verify: deps.verify ?? verifyEvent }, build, opts).then((out) => {
    // Sent (one relay at least): the relays that missed it are sent this very event later (`profile-delivery.ts`)
    if (out.kind === 'sent') profileDelivery.owe(out.event, relays);
    return out;
  });
}

/**
 * The kit's `ProfileWriter`: what its safe-mode hooks write with. `stillAccount(owner)` says whether the account a
 * write is FOR is still the one signed in (asked before signing, after signing and right before sending).
 */
export function profileWriterFor(deps: Omit<SafeWriteDeps, 'owner' | 'stillAccount'> & { stillAccount: (owner: string) => boolean }): ProfileWriter {
  return (owner, build) => writeProfileSafely({ ...deps, owner, stillAccount: () => deps.stillAccount(owner) }, build);
}
