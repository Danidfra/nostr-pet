import { describe, expect, it } from 'vitest';
import { BLOBBI_V3_ONLY_TAG_NAMES, KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue, getTagValues, parseModernBlobbiEvent } from '@blobbi-kit/core';
import { buildFixtureWorld, createFixturePool, FIXTURE_BORN_AT, FIXTURE_D, FIXTURE_NAMES } from './fixture-world';
import { EARLIER_D, PUBKEY } from '@/test/fixtures';

describe('dev fixture worlds', () => {
  it('build a modern Blobbi at each stage, a profile that owns it, a kind 0 and a few items, for the fixture pubkey only', () => {
    for (const name of FIXTURE_NAMES) {
      const events = buildFixtureWorld({ name });
      const blobbi = events.find((e) => e.kind === KIND_BLOBBI_STATE)!;
      const parsed = parseModernBlobbiEvent(blobbi)!;
      expect(parsed.d).toBe(FIXTURE_D);
      expect(parsed.stage).toBe(name.startsWith('egg') ? 'egg' : name.startsWith('baby') ? 'baby' : 'adult');
      expect(parsed.visualGeneration).toBe(name.endsWith('-v3') ? 'v3' : name === 'adult-v2' ? 'v2' : 'v1');
      // A V3 fixture is born with its whole identity; the others carry none of it.
      if (name.endsWith('-v3')) expect(parsed.v3Identity?.missing).toEqual([]);
      else expect(blobbi.tags.some((t) => BLOBBI_V3_ONLY_TAG_NAMES.includes(t[0]))).toBe(false);
      // No generation-prefixed tag exists any more.
      expect(blobbi.tags.some((t) => t[0].startsWith('v3_'))).toBe(false);
      // The player's events are the fixture pubkey's; item definitions are their issuers'.
      expect(events.filter((e) => e.kind !== 31632).every((e) => e.pubkey === PUBKEY)).toBe(true);
      expect(events.filter((e) => e.kind === 0)).toHaveLength(1);
      expect(events.filter((e) => e.kind === 31632)).toHaveLength(3);
    }
    // An established account by default: the Blobbi it raised before is in the world, hatched and older, and
    // the profile knows both. A `first` account has the fixture Blobbi alone.
    const established = buildFixtureWorld({ name: 'egg-v3' });
    const earlier = parseModernBlobbiEvent(established.find((e) => getTagValue(e.tags, 'd') === EARLIER_D)!)!;
    expect(earlier.stage).toBe('adult');
    expect(earlier.event.created_at).toBeLessThan(FIXTURE_BORN_AT);
    expect(getTagValues(established.find((e) => e.kind === KIND_BLOBBONAUT_PROFILE)!.tags, 'has')).toEqual([FIXTURE_D, EARLIER_D]);
    const first = buildFixtureWorld({ name: 'egg-v3', account: 'first' });
    expect(first.filter((e) => e.kind === KIND_BLOBBI_STATE).map((e) => getTagValue(e.tags, 'd'))).toEqual([FIXTURE_D]);
    expect(getTagValues(first.find((e) => e.kind === KIND_BLOBBONAUT_PROFILE)!.tags, 'has')).toEqual([FIXTURE_D]);
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
    // Still one event per Blobbi: the fixture one, rewritten, and the one the account raised before it.
    const after = await pool.query([{ kinds: [KIND_BLOBBI_STATE], authors: [PUBKEY] }]);
    expect(after.map((e) => getTagValue(e.tags, 'd')).sort()).toEqual([EARLIER_D, FIXTURE_D].sort());
    expect(getTagValue(after.find((e) => getTagValue(e.tags, 'd') === FIXTURE_D)!.tags, 'state')).toBe('sleeping');
    expect(await pool.query([{ kinds: [1], authors: [PUBKEY] }])).toEqual([]);
  });
});
