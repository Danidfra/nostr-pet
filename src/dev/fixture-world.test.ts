import { describe, expect, it } from 'vitest';
import { KIND_BLOBBI_STATE, getTagValue, parseModernBlobbiEvent } from '@blobbi-kit/core';
import { buildFixtureWorld, createFixturePool, FIXTURE_D, FIXTURE_NAMES } from './fixture-world';
import { PUBKEY } from '@/test/fixtures';

describe('dev fixture worlds', () => {
  it('build a modern Blobbi at each stage, a profile that owns it, a kind 0 and a few items, for the fixture pubkey only', () => {
    for (const name of FIXTURE_NAMES) {
      const events = buildFixtureWorld({ name });
      const blobbi = events.find((e) => e.kind === KIND_BLOBBI_STATE)!;
      const parsed = parseModernBlobbiEvent(blobbi)!;
      expect(parsed.d).toBe(FIXTURE_D);
      expect(parsed.stage).toBe(name === 'egg' ? 'egg' : name === 'baby' ? 'baby' : 'adult');
      expect(parsed.visualGeneration).toBe(name === 'adult-v2' ? 'v2' : 'v1');
      // The player's events are the fixture pubkey's; item definitions are their issuers'.
      expect(events.filter((e) => e.kind !== 31632).every((e) => e.pubkey === PUBKEY)).toBe(true);
      expect(events.filter((e) => e.kind === 0)).toHaveLength(1);
      expect(events.filter((e) => e.kind === 31632)).toHaveLength(3);
    }
    expect(getTagValue(buildFixtureWorld({ name: 'baby', state: 'sleeping' })[0].tags, 'state')).toBe('sleeping');
    expect(getTagValue(buildFixtureWorld({ name: 'egg', state: 'sleeping' })[0].tags, 'state')).toBe('active');
    expect(getTagValue(buildFixtureWorld({ name: 'baby', low: 'hunger' })[0].tags, 'hunger')).toBe('8');
  });

  it('the fixture pool answers filters and replaces replaceables, and nothing leaves it', async () => {
    const pool = createFixturePool(buildFixtureWorld({ name: 'baby' }));
    const [blobbi] = await pool.query([{ kinds: [KIND_BLOBBI_STATE], authors: [PUBKEY], '#d': [FIXTURE_D] }]);
    expect(blobbi).toBeDefined();
    const next = { ...blobbi, id: 'n'.repeat(64), created_at: blobbi.created_at + 10, tags: blobbi.tags.map((t) => (t[0] === 'state' ? ['state', 'sleeping'] : t)) };
    await pool.event(next);
    const after = await pool.query([{ kinds: [KIND_BLOBBI_STATE], authors: [PUBKEY] }]);
    expect(after).toHaveLength(1);
    expect(getTagValue(after[0].tags, 'state')).toBe('sleeping');
    expect(await pool.query([{ kinds: [1], authors: [PUBKEY] }])).toEqual([]);
  });
});
