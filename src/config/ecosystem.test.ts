import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOBBI_ISLAND_URL, resolveBlobbiIslandUrl } from './ecosystem';

describe('resolveBlobbiIslandUrl', () => {
  it('uses the ecosystem default when nothing is configured', () => {
    expect(resolveBlobbiIslandUrl(undefined)).toBe(DEFAULT_BLOBBI_ISLAND_URL);
    expect(resolveBlobbiIslandUrl('')).toBe(DEFAULT_BLOBBI_ISLAND_URL);
    expect(resolveBlobbiIslandUrl('   ')).toBe(DEFAULT_BLOBBI_ISLAND_URL);
  });

  it('honours an absolute http(s) override, for a local or staging Island', () => {
    expect(resolveBlobbiIslandUrl('http://localhost:8081')).toBe('http://localhost:8081/');
    expect(resolveBlobbiIslandUrl('https://staging.island.example/')).toBe('https://staging.island.example/');
  });

  it('refuses anything that is not an absolute http(s) URL', () => {
    expect(resolveBlobbiIslandUrl('javascript:alert(1)')).toBe(DEFAULT_BLOBBI_ISLAND_URL);
    expect(resolveBlobbiIslandUrl('/island')).toBe(DEFAULT_BLOBBI_ISLAND_URL);
    expect(resolveBlobbiIslandUrl('not a url')).toBe(DEFAULT_BLOBBI_ISLAND_URL);
  });
});
