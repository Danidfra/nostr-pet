/**
 * Saving the guest Blobbi to the player's new account: the guest world's
 * records become the account's first canonical events.
 *
 * The account's key is the one reserved when the egg was made, so the Blobbi
 * keeps its address `(pubkey, d)` byte for byte, and with it (V3) its whole
 * look: the published egg or baby IS the one the player has been caring for.
 * Nothing is re-derived and no companion is re-made.
 *
 * What is published, in Island's order (the Blobbi first, the profile that
 * names it second), each from a TEMPLATE built out of the guest record:
 *
 *   kind 31124   the Blobbi's latest state: every tag as it stands (`d`, name,
 *                stage, stats, streak, progression, `visual_generation`) and
 *                the content (its missions). `created_at` is the moment of
 *                saving; `published_at` is left for the publish adapter to set.
 *   kind 11125   the profile as it stands (`has`, `current_companion`, xp and
 *                the day's progress); made fresh if the guest world has none.
 *
 * Not published: the guest days' kind 1124 care receipts. They are social
 * receipts, best-effort by every producer; the care itself is in the Blobbi's
 * tags (stats, streak, experience) and travels with it. The Journey's day
 * count therefore starts at the save (`RELEASE_READINESS`, M14).
 *
 * Idempotent and resumable: before each publish the relays are asked whether
 * the account already holds that event (a resumed save, a refresh after a
 * publish landed); one found is taken as landed and not published again. A
 * publish is a replace, so even a repeat could never make a second Blobbi.
 * Verification reads both back; only then is the guest record let go.
 */
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE } from '@blobbi-kit/core';
import type { PublishEventTemplate } from '@blobbi-kit/react';
import { profileTemplate } from '@/features/adoption/adoption-plan';
import type { GuestDocument } from './guest-store';
import { guestBlobbiEvent, guestProfileEvent } from './guest-world';

export type MigrationStep = 'blobbi' | 'profile';
export const MIGRATION_STEPS: readonly MigrationStep[] = ['blobbi', 'profile'];

/** Tags the publish adapter sets for a first publish; a guest record's values are its own and are dropped. */
const RESET_TAGS = new Set(['published_at']);

function templateFrom(event: NostrEvent, now: number): PublishEventTemplate & { tags: string[][]; content: string; created_at: number } {
  return { kind: event.kind, tags: event.tags.filter(([name]) => !RESET_TAGS.has(name)), content: event.content, created_at: now };
}

export interface MigrationTemplates {
  blobbi: ReturnType<typeof templateFrom> | null;
  profile: ReturnType<typeof templateFrom>;
}

/** The two templates for a guest record. `blobbi` is null for a guest who never adopted (nothing to save). */
export function migrationTemplates(doc: GuestDocument, now: number = Math.floor(Date.now() / 1000)): MigrationTemplates {
  const blobbi = guestBlobbiEvent(doc.events, doc.blobbiD);
  const profile = guestProfileEvent(doc.events);
  const profileTpl = profile
    ? templateFrom(profile, now)
    : { ...profileTemplate({ ownerPubkey: doc.identity.pubkey, profile: null, d: doc.blobbiD ?? '', suggestedName: 'Blobbonaut' }), created_at: now };
  return { blobbi: blobbi ? templateFrom(blobbi, now) : null, profile: { ...profileTpl, tags: profileTpl.tags.filter(([name]) => !RESET_TAGS.has(name)) } };
}

export interface MigrationReader {
  query(filters: NostrFilter[], opts?: { signal?: AbortSignal }): Promise<NostrEvent[]>;
}
export interface MigrationPublisher {
  publish(template: PublishEventTemplate): Promise<NostrEvent>;
}

export type StepState = 'waiting' | 'checking' | 'publishing' | 'landed' | 'found' | 'failed';
export interface MigrationProgress {
  step: MigrationStep;
  state: StepState;
}

export interface RunMigrationOptions {
  doc: GuestDocument;
  nostr: MigrationReader;
  publisher: MigrationPublisher;
  /** Each event the relays now hold, as soon as it is known (found or landed): the caller seeds its caches and records it. */
  onLanded: (step: MigrationStep, event: NostrEvent, how: 'found' | 'landed') => void;
  onProgress?: (progress: MigrationProgress) => void;
  readTimeoutMs?: number;
  now?: number;
}

export type MigrationOutcome = { ok: true; events: Partial<Record<MigrationStep, NostrEvent>> } | { ok: false; step: MigrationStep; error: Error; events: Partial<Record<MigrationStep, NostrEvent>> };

function filterFor(step: MigrationStep, doc: GuestDocument): NostrFilter {
  return step === 'blobbi' ? { kinds: [KIND_BLOBBI_STATE], authors: [doc.identity.pubkey], '#d': [doc.blobbiD ?? ''] } : { kinds: [KIND_BLOBBONAUT_PROFILE], authors: [doc.identity.pubkey] };
}

function newest(events: NostrEvent[]): NostrEvent | undefined {
  return [...events].sort((a, b) => b.created_at - a.created_at)[0];
}

/** Ask the relays whether `step`'s event is already there. Undefined when they could not be asked. */
async function alreadyHeld(step: MigrationStep, doc: GuestDocument, nostr: MigrationReader, timeoutMs: number): Promise<NostrEvent | undefined | null> {
  try {
    const events = await nostr.query([filterFor(step, doc)], { signal: AbortSignal.timeout(timeoutMs) });
    return newest(events.filter((e) => e.pubkey === doc.identity.pubkey)) ?? null;
  } catch {
    return undefined;
  }
}

/**
 * Publish what the relays do not hold yet, in order, stopping at the first
 * failure (the caller offers Try again; the next run picks up from the
 * relays' state, not from memory).
 */
export async function runGuestMigration({ doc, nostr, publisher, onLanded, onProgress, readTimeoutMs = 6_000, now }: RunMigrationOptions): Promise<MigrationOutcome> {
  const templates = migrationTemplates(doc, now);
  const events: Partial<Record<MigrationStep, NostrEvent>> = {};
  for (const step of MIGRATION_STEPS) {
    const template = step === 'blobbi' ? templates.blobbi : templates.profile;
    if (!template) continue;
    onProgress?.({ step, state: 'checking' });
    const held = await alreadyHeld(step, doc, nostr, readTimeoutMs);
    if (held) {
      events[step] = held;
      onLanded(step, held, 'found');
      onProgress?.({ step, state: 'found' });
      continue;
    }
    // Recorded as landed and the relays could not be asked: trust the record. Asked and not there (a relay behind, or
    // one that lost it): publish again; a publish is a replace, so nothing is doubled.
    if (held === undefined && doc.migration?.landed[step]) {
      onProgress?.({ step, state: 'found' });
      continue;
    }
    onProgress?.({ step, state: 'publishing' });
    try {
      const event = await publisher.publish(template);
      events[step] = event;
      onLanded(step, event, 'landed');
      onProgress?.({ step, state: 'landed' });
    } catch (error) {
      onProgress?.({ step, state: 'failed' });
      return { ok: false, step, error: error instanceof Error ? error : new Error(String(error)), events };
    }
  }
  return { ok: true, events };
}

/** Read both back. True only when the relays answered and hold the Blobbi (and the profile). */
export async function verifyGuestMigration(doc: GuestDocument, nostr: MigrationReader, readTimeoutMs = 8_000): Promise<boolean> {
  const blobbi = doc.blobbiD ? await alreadyHeld('blobbi', doc, nostr, readTimeoutMs) : null;
  if (doc.blobbiD && !blobbi) return false;
  const profile = await alreadyHeld('profile', doc, nostr, readTimeoutMs);
  return !!profile;
}
