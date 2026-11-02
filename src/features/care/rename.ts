/**
 * Renaming a Blobbi: the kind 31124 republished with a new `name` tag and
 * nothing else changed. Same `d`, same owner, so the same Blobbi: its look
 * (derived from owner and `d`), stage, stats, timestamps, progression,
 * missions in the content and every tag another app wrote are kept as they
 * are (the kit's `updateBlobbiTags` over the full tag list). No new kind, no
 * new tag, free.
 *
 *   read     a signed-in player's Blobbi is read from the relays a complete
 *            read needs, each to EOSE (`readCensus`); one silent is
 *            "try again", never a rename over what it might hold. A guest's
 *            or a fixture's world is on this device and is complete
 *   order    in turn with every other write of this Blobbi on this page
 *            (`serializeBlobbiWrite`), the read inside the turn
 *   write    the publish adapter: saved only once a relay that counts
 *            accepted it; otherwise the error says so (never a success)
 *
 * What this cannot do: order a rename against a write from another device or
 * app at the same moment. Kind 31124 is replaceable; the newest write wins.
 * Reading every required relay just before writing narrows that window, it
 * does not close it.
 */
import { KIND_BLOBBI_STATE, isModernBlobbiEvent, parseModernBlobbiEvent, updateBlobbiTags, type BlobbiCompanion, type NostrEvent } from '@blobbi-kit/core';
import type { PublishEventTemplate } from '@blobbi-kit/react';
import { normalizeBlobbiName } from '@/features/adoption/adoption-plan';
import { stampAfter } from '@/lib/created-at';

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'too-long' | 'unchanged' };

/** A new name: the adoption's rules (trimmed, printable, short), never blank, and not the current one. */
export function checkNewName(raw: string, current: string): NameCheck {
  const out = normalizeBlobbiName(raw);
  if (!out.ok) return { ok: false, reason: 'too-long' };
  if (out.isDefault) return { ok: false, reason: 'empty' };
  if (out.name === current) return { ok: false, reason: 'unchanged' };
  return { ok: true, name: out.name };
}

/** The republish: only `name` changes; content, every other tag and the identity stay; `created_at` after the base's, within a bound (`stampAfter`). */
export function planRename(companion: BlobbiCompanion, name: string, now: number): PublishEventTemplate & { tags: string[][]; content: string; created_at: number; prev: NostrEvent } {
  return {
    kind: KIND_BLOBBI_STATE,
    content: companion.event.content,
    tags: updateBlobbiTags(companion.allTags, { name }),
    created_at: stampAfter(companion.event.created_at, now),
    prev: companion.event,
  };
}

/** NIP-01: the newer `created_at`, then the lower id. */
export function newestRevision(events: readonly NostrEvent[], pubkey: string, d: string): BlobbiCompanion | null {
  let newest: NostrEvent | null = null;
  for (const e of events) {
    if (e.kind !== KIND_BLOBBI_STATE || e.pubkey !== pubkey || !e.tags.some((t) => t[0] === 'd' && t[1] === d)) continue;
    if (!newest || e.created_at > newest.created_at || (e.created_at === newest.created_at && e.id < newest.id)) newest = e;
  }
  return (newest && isModernBlobbiEvent(newest) ? parseModernBlobbiEvent(newest) : null) ?? null;
}
