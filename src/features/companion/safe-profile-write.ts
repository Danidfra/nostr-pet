/**
 * A PROFILE WRITE THAT NEVER RESTORES AN OLDER PROFILE, for the writes this
 * home builds itself besides the companion choice (`profile-write.ts`):
 * adoption's profile and the daily award.
 *
 * The profile (kind 11125) is replaceable and every Blobbi app writes it. A
 * write built over an older profile (a read cut short, a relay a moment
 * behind, another write meanwhile) would replace the newer one everywhere,
 * `current_companion` included. So, one at a time per account
 * (`profile-queue.ts`):
 *
 *   read      a COMPLETE read (every relay of `required` answered); else
 *             nothing is built (`unsafe`).
 *   build     the caller's change, over the newest profile. None at all:
 *             `no-profile`, unless the caller may create one (`create`: only
 *             adoption, and only on that complete read).
 *   stamp     `created_at` after the base's (a clock behind still replaces it).
 *   sign      by the account itself, still signed in; another key is refused.
 *   re-check  a second complete read: a profile written meanwhile means
 *             nothing is sent (`stale`; the caller decides again). Never
 *             rebuilt here, so a write asks the signer at most once.
 *   send      only if the account is still the one signed in.
 *
 * Moves to blobbi-kit with the companion's own writer (one safe write for
 * every app); until then this home's copy.
 */
import type { NostrEvent } from '@blobbi-kit/core';
import { verifyEvent } from 'nostr-tools/pure';
import { replaces, type ProfileStamp } from './choice-order';
import { profileQueue } from './profile-queue';
import { readProfileCensus, type ProfileRelays } from './profile-write';

export interface ProfileTemplate {
  kind: number;
  content: string;
  tags: string[][];
  created_at?: number;
  prev?: NostrEvent;
}

/** What the caller makes of the newest profile: a template, or a reason to write nothing. */
export type ProfileBuild<R> = { template: ProfileTemplate } | { skip: R };

export type SafeWriteOutcome<R> =
  | { kind: 'sent'; event: NostrEvent }
  | { kind: 'skipped'; reason: R }
  | { kind: 'no-profile' }
  /** A relay that must answer did not: nothing was built or sent. */
  | { kind: 'unsafe' }
  /** A profile was written meanwhile: nothing was sent. */
  | { kind: 'stale' }
  | { kind: 'wrong-account' }
  | { kind: 'failed'; message: string };

export interface SafeWriteDeps {
  owner: string;
  relays: ProfileRelays;
  /** Signs as the account (the app's signer; `prev` keeps `published_at`). */
  sign: (template: ProfileTemplate) => Promise<NostrEvent>;
  /** The account is still the one this write is for. */
  stillAccount: () => boolean;
  now?: () => number;
  timeoutMs?: number;
  verify?: (event: NostrEvent) => boolean;
}

const stamp = (e: NostrEvent): ProfileStamp => ({ id: e.id, createdAt: e.created_at });

export function writeProfileSafely<R>(deps: SafeWriteDeps, build: (base: NostrEvent | null) => ProfileBuild<R>, opts: { create?: boolean } = {}): Promise<SafeWriteOutcome<R>> {
  return profileQueue.run(deps.owner, () => write(deps, build, opts));
}

async function write<R>(deps: SafeWriteDeps, build: (base: NostrEvent | null) => ProfileBuild<R>, opts: { create?: boolean }): Promise<SafeWriteOutcome<R>> {
  const { relays, owner } = deps;
  const timeoutMs = deps.timeoutMs ?? 8_000;
  const verify = deps.verify ?? verifyEvent;
  const nowS = Math.floor((deps.now ?? Date.now)() / 1000);

  const first = await readProfileCensus(relays, owner, timeoutMs, verify);
  if (!first.complete) return { kind: 'unsafe' };
  const base = first.newest;
  if (!base && !opts.create) return { kind: 'no-profile' };
  const built = build(base);
  if ('skip' in built) return { kind: 'skipped', reason: built.skip };
  const template: ProfileTemplate = { ...built.template, created_at: base ? Math.max(nowS, base.created_at + 1) : nowS, ...(base ? { prev: base } : {}) };

  if (!deps.stillAccount()) return { kind: 'wrong-account' };
  let signed: NostrEvent;
  try {
    signed = await deps.sign(template);
  } catch (error) {
    return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
  if (signed.pubkey !== owner || !safeVerify(verify, signed) || !deps.stillAccount()) return { kind: 'wrong-account' };

  const again = await readProfileCensus(relays, owner, timeoutMs, verify);
  if (!again.complete) return { kind: 'unsafe' };
  const top = again.newest;
  if (top && top.id !== base?.id && (!base || replaces(stamp(top), stamp(base)))) return { kind: 'stale' };

  if (!deps.stillAccount()) return { kind: 'wrong-account' };
  const results = await Promise.allSettled(relays.urls.map((url) => relays.publish(url, signed, AbortSignal.timeout(timeoutMs))));
  if (!results.some((r) => r.status === 'fulfilled')) return { kind: 'failed', message: 'The relays did not take it.' };
  return { kind: 'sent', event: signed };
}

function safeVerify(verify: (e: NostrEvent) => boolean, e: NostrEvent): boolean {
  try {
    return verify(e);
  } catch {
    return false;
  }
}
