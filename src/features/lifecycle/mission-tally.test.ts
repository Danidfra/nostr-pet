/**
 * The interactions tally rides in the care republish: one publish per care
 * action, the kit's mission store as the working copy, the event content as
 * the durable copy.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { KIND_BLOBBI_STATE, buildEggTags, parseEvolutionContent, parseModernBlobbiEvent, serializeEvolutionContent, type BlobbiCompanion, type NostrEvent } from '@blobbi-kit/core';
import { clearEvolutionFromStorage, createHatchMissions, readEvolutionFromStorage } from '@blobbi-kit/react';
import { planCareAction } from '@/features/care/care-plan';
import { tallyCareInteraction } from './mission-tally';

const PUBKEY = 'a'.repeat(64);
const NOW = Math.floor(Date.now() / 1000);

function egg(progressionState: 'none' | 'incubating', interactions = 0): BlobbiCompanion {
  const missions = createHatchMissions().map((m) => (m.id === 'interactions' && 'count' in m ? { ...m, count: interactions } : m));
  const tags = buildEggTags(PUBKEY, '0000000007', NOW - 3_600, 'Shell').map((t) => (t[0] === 'progression_state' ? ['progression_state', progressionState] : t));
  const event: NostrEvent = {
    id: 'e'.repeat(64),
    pubkey: PUBKEY,
    created_at: NOW - 3_600,
    kind: KIND_BLOBBI_STATE,
    tags,
    content: progressionState === 'incubating' ? serializeEvolutionContent(JSON.stringify({ social_checkpoint: { x: 1 } }), missions) : '',
    sig: '0'.repeat(128),
  };
  const companion = parseModernBlobbiEvent(event);
  if (!companion) throw new Error('fixture must be modern');
  return companion;
}

const count = (missions: ReturnType<typeof parseEvolutionContent>) => {
  const m = missions.find((x) => x.id === 'interactions');
  return m && 'count' in m ? m.count : undefined;
};

beforeEach(() => clearEvolutionFromStorage(PUBKEY, egg('incubating').d));

describe('tallyCareInteraction', () => {
  it('does nothing for a Blobbi that is not incubating or evolving', () => {
    expect(tallyCareInteraction(egg('none'), PUBKEY)).toBeUndefined();
  });

  it('counts from the persisted number, not from zero, and keeps counting in the session', () => {
    const companion = egg('incubating', 4);
    expect(count(tallyCareInteraction(companion, PUBKEY) ?? [])).toBe(5);
    expect(count(tallyCareInteraction(companion, PUBKEY) ?? [])).toBe(6);
    expect(count(readEvolutionFromStorage(PUBKEY, companion.d) ?? [])).toBe(6);
  });
});

describe('care plan content', () => {
  it('writes the tallied missions into the same republish and keeps the other content keys', () => {
    const companion = egg('incubating', 6);
    const evolution = tallyCareInteraction(companion, PUBKEY);
    const plan = planCareAction(companion, 'clean', NOW, { evolution });
    const parsed = JSON.parse(plan.event.content);
    expect(parsed.social_checkpoint).toEqual({ x: 1 });
    expect(count(parseEvolutionContent(plan.event.content))).toBe(7);
    expect(plan.event.kind).toBe(KIND_BLOBBI_STATE);
  });

  it('leaves the content untouched when there is nothing to tally', () => {
    const companion = egg('none');
    const plan = planCareAction(companion, 'clean', NOW, { evolution: tallyCareInteraction(companion, PUBKEY) });
    expect(plan.event.content).toBe('');
  });
});
