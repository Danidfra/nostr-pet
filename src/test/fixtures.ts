/**
 * Kind 31124 fixtures shaped exactly like current producers publish them,
 * built with the kit's own `buildEggTags` so the modern contract is never
 * re-described here. A fixture is an EXISTING Blobbi unless a test says
 * otherwise, so it is V1 by default (no `visual_generation` tag, the way
 * every Blobbi born before the marker reads); `visualGeneration: 'v2'` asks
 * for a Blobbi born the way the kit creates them today.
 */
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, BLOBBI_ECOSYSTEM_NAMESPACE, buildEggTags, getCanonicalBlobbonautD, type BlobbiVisualGeneration, type NostrEvent } from '@blobbi-kit/core';

export const PUBKEY = 'a'.repeat(64);
export const CREATED_AT = 1_757_000_000;

export interface BlobbiFixtureOptions {
  stage?: 'egg' | 'baby' | 'adult';
  state?: 'active' | 'sleeping' | 'hibernating';
  name?: string;
  createdAt?: number;
  /** Tags appended after the canonical ones (later duplicates are not deduped). */
  extra?: string[][];
  /** Tag names to drop from the canonical set. */
  without?: string[];
  /** Tag values to override. */
  set?: Record<string, string>;
  /** Which artwork generation the Blobbi was born into. Default `'v1'`: an existing Blobbi. */
  visualGeneration?: BlobbiVisualGeneration;
}

export function blobbiEvent(petId: string, options: BlobbiFixtureOptions = {}): NostrEvent {
  const { stage = 'baby', state = 'active', name = 'Pet', createdAt = CREATED_AT, extra = [], without = [], set = {}, visualGeneration = 'v1' } = options;
  const overrides: Record<string, string> = { stage, state, ...set };
  const tags = buildEggTags(PUBKEY, petId, createdAt, name, { visualGeneration })
    .filter(([n]) => !without.includes(n))
    .map((t) => (t[0] in overrides ? [t[0], overrides[t[0]]] : t));
  return {
    id: petId.padEnd(64, '0'),
    pubkey: PUBKEY,
    created_at: createdAt,
    kind: KIND_BLOBBI_STATE,
    tags: [...tags, ...extra],
    content: '',
    sig: '0'.repeat(128),
  };
}

/** Old-app schema markers on a canonical-looking d: legacy, ignored. */
export function legacyMarkerEvent(petId: string): NostrEvent {
  return blobbiEvent(petId, { name: 'Old', extra: [['incubation_time', '3600']] });
}

/** Non-canonical d and no seed: the historical standalone shape. */
export function legacyShapeEvent(): NostrEvent {
  const base = blobbiEvent('0000000099', { name: 'Older', without: ['seed'] });
  return { ...base, tags: base.tags.map((t) => (t[0] === 'd' ? ['d', 'my-old-pet'] : t)) };
}

export function profileEvent(options: { currentCompanion?: string; has?: string[]; xp?: number } = {}): NostrEvent {
  const tags: string[][] = [
    ['d', getCanonicalBlobbonautD(PUBKEY)],
    ['b', BLOBBI_ECOSYSTEM_NAMESPACE],
    ['name', 'Tester'],
    ...(options.has ?? []).map((d) => ['has', d]),
  ];
  if (options.currentCompanion) tags.push(['current_companion', options.currentCompanion]);
  if (options.xp !== undefined) tags.push(['xp', String(options.xp)]);
  return {
    id: 'p'.repeat(64),
    pubkey: PUBKEY,
    created_at: CREATED_AT,
    kind: KIND_BLOBBONAUT_PROFILE,
    tags,
    content: '',
    sig: '0'.repeat(128),
  };
}
