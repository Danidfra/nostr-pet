/**
 * The collection cache only moves forward (M13), through TanStack's own
 * paths: a read's answer and a local update. A stale answer (an older
 * version, or nothing) never undoes a newer Blobbi; a newer version (another
 * device) always comes through; one of the same second (two quick writes)
 * is taken, so a second write is never refused.
 */
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { parseModernBlobbiEvent, type BlobbiCompanion, type NostrEvent } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { COLLECTION_QUERY_KEY, isOlder, keepCollectionCanonical, markLocalWrite, mergeCollection } from './canonical-cache';

const version = (stage: 'egg' | 'baby' | 'adult', createdAt: number, id?: string): BlobbiCompanion => {
  const event: NostrEvent = { ...blobbiEvent('0000000001', { name: 'Pip', stage, visualGeneration: 'v3', createdAt }), ...(id ? { id } : {}) };
  return parseModernBlobbiEvent(event)!;
};
const collection = (...companions: BlobbiCompanion[]) => ({ companionsByD: Object.fromEntries(companions.map((c) => [c.d, c])), companions });
const KEY = [COLLECTION_QUERY_KEY, 'pk', 'all'];

function client() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  keepCollectionCanonical(c);
  return c;
}
const stageIn = (c: QueryClient) => (c.getQueryData(KEY) as ReturnType<typeof collection> | undefined)?.companions.map((b) => b.stage);

describe('the collection cache never goes back in time', () => {
  it('only a strictly older version is refused', () => {
    expect(isOlder({ created_at: 1 }, { created_at: 2 })).toBe(true);
    expect(isOlder({ created_at: 2 }, { created_at: 1 })).toBe(false);
    expect(isOlder({ created_at: 2 }, { created_at: 2 })).toBe(false);
  });

  it('a second write in the same second comes through (sleep, then wake at once)', () => {
    const c = client();
    c.setQueryData(KEY, collection(version('baby', 200, 'a'.repeat(64))));
    c.setQueryData(KEY, collection(version('adult', 200, 'b'.repeat(64))));
    expect(stageIn(c)).toEqual(['adult']);
  });

  it('this app\'s own write always goes in, even when another device\'s clock dated the cached version later', () => {
    const c = client();
    c.setQueryData(KEY, collection(version('baby', 9_999_999_999)));
    const mine = version('adult', 200);
    markLocalWrite(mine.event);
    c.setQueryData(KEY, collection(mine));
    expect(stageIn(c)).toEqual(['adult']);
    // But a relay's answer with an older version does not undo it... unless it is newer
    c.setQueryData(KEY, collection(version('baby', 100)));
    expect(stageIn(c)).toEqual(['adult']);
  });

  it('a read a moment behind (the egg again, after the hatch landed) does not undo the hatch', async () => {
    const c = client();
    c.setQueryData(KEY, collection(version('egg', 100)));
    // The hatch landed: the event goes into the cache
    c.setQueryData(KEY, collection(version('baby', 200)));
    // The re-read reaches a relay that still serves the egg
    await c.fetchQuery({ queryKey: KEY, queryFn: async () => collection(version('egg', 100)), staleTime: 0 });
    expect(stageIn(c)).toEqual(['baby']);
  });

  it('a read that returns nothing (just adopted, not served yet) keeps the Blobbi', async () => {
    const c = client();
    c.setQueryData(KEY, collection(version('egg', 100)));
    await c.fetchQuery({ queryKey: KEY, queryFn: async () => collection(), staleTime: 0 });
    expect(stageIn(c)).toEqual(['egg']);
  });

  it('another device\'s newer version comes through, from a read as from an update', async () => {
    const c = client();
    c.setQueryData(KEY, collection(version('baby', 200)));
    await c.fetchQuery({ queryKey: KEY, queryFn: async () => collection(version('adult', 300)), staleTime: 0 });
    expect(stageIn(c)).toEqual(['adult']);
  });

  it('an unchanged answer keeps the same references (no needless re-render)', async () => {
    const c = client();
    const first = collection(version('baby', 200));
    c.setQueryData(KEY, first);
    await c.fetchQuery({ queryKey: KEY, queryFn: async () => collection(version('baby', 200)), staleTime: 0 });
    expect(c.getQueryData(KEY)).toBe(first);
  });

  it('other shapes pass through untouched', () => {
    expect(mergeCollection(undefined, 'x')).toBe('x');
    expect(mergeCollection({ a: 1 }, { b: 2 })).toEqual({ b: 2 });
  });
});
