/**
 * Dev fixture worlds: a Blobbi at a chosen stage, a profile, a few items,
 * and an in-memory "relay" that answers queries and swallows publishes,
 * so every stage and state can be looked at in the real app without a
 * real account, a real relay or a real write. Built from the same
 * builders the tests use (`src/test/*`), which shape events the way the
 * producers do. Only a dev bundle behind `VITE_BLOBBI_DEV_TOOLS` loads it.
 */
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, VISUAL_GENERATION_TAG, getTagValue } from '@blobbi-kit/core';
import { PUBKEY, blobbiEvent, profileEvent } from '@/test/fixtures';
import { OFFICIAL_APPLE, OFFICIAL_BALL, OFFICIAL_SOAP, inventoryEvent, officialCareDefinition } from '@/test/inventory-fixtures';

export type FixtureName = 'egg' | 'baby' | 'adult' | 'adult-v2';
export const FIXTURE_NAMES: readonly FixtureName[] = ['egg', 'baby', 'adult', 'adult-v2'];

export interface FixtureOptions {
  name: FixtureName;
  state?: 'active' | 'sleeping';
  /** A stat to put at a critical value, to see the poor-condition reactions. */
  low?: 'hunger' | 'energy' | 'health' | 'happiness' | 'hygiene';
}

export const FIXTURE_D = 'blobbi-aaaaaaaaaaaa-0000000001';

export function buildFixtureWorld({ name, state = 'active', low }: FixtureOptions): NostrEvent[] {
  const now = Math.floor(Date.now() / 1000);
  const stage = name === 'egg' ? 'egg' : name === 'baby' ? 'baby' : 'adult';
  const set: Record<string, string> = { hunger: '70', happiness: '72', hygiene: '68', energy: '75', health: '90' };
  if (low) set[low] = '8';
  const extra: string[][] = name === 'adult-v2' ? [[VISUAL_GENERATION_TAG, 'v2']] : [];
  const blobbi = blobbiEvent('0000000001', { name: name === 'egg' ? 'Shell' : name === 'baby' ? 'Brook' : 'Elder', stage, state: stage === 'egg' ? 'active' : state, createdAt: now - 3_600, set, extra });
  return [
    blobbi,
    profileEvent({ currentCompanion: FIXTURE_D, has: [FIXTURE_D], xp: 640 }),
    { id: 'k'.repeat(64), pubkey: PUBKEY, created_at: now - 3_600, kind: 0, tags: [], content: JSON.stringify({ name: 'Fixture Keeper' }), sig: '0'.repeat(128) },
    officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }, { emoji: '🍎', stages: ['baby', 'adult'] }),
    officialCareDefinition('blobbi:toy:ball', 'Ball', 'toy', 'play', { happiness: 20 }, { emoji: '⚽', stages: ['baby', 'adult'] }),
    officialCareDefinition('blobbi:hygiene:soap', 'Soap', 'hygiene', 'clean', { hygiene: 25 }, { emoji: '🧼', stages: ['egg', 'baby', 'adult'] }),
    inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 3, [OFFICIAL_BALL]: 2, [OFFICIAL_SOAP]: 2 }),
  ];
}

function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}

/** An in-memory relay: replaceable kinds replace, everything else appends; nothing leaves the tab. */
export function createFixturePool(initial: NostrEvent[]): NPool {
  let all = [...initial];
  const pool = {
    async query(filters: NostrFilter[]): Promise<NostrEvent[]> {
      await new Promise((r) => setTimeout(r, 120));
      const seen = new Set<string>();
      return all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
    },
    async event(ev: NostrEvent): Promise<void> {
      await new Promise((r) => setTimeout(r, 150));
      const d = getTagValue(ev.tags, 'd');
      if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE || ev.kind === 0) all = [...all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === d)), ev];
      else all.push(ev);
    },
    async close() {},
  };
  return pool as unknown as NPool;
}

let signCount = 0;
/** A signer that "signs" with a fake signature: the fixture relay verifies nothing. Dev only. */
export const fixtureSigner = {
  async getPublicKey() {
    return PUBKEY;
  },
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...t, id: String(signCount).padStart(64, 'f'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};

