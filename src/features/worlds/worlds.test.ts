/**
 * Which worlds can be travelled to: only checked https addresses, nothing
 * carried in them, and an upcoming world never an address at all.
 */
import { describe, expect, it } from 'vitest';
import { isTravelUrl, worldById, worlds } from './worlds';

describe('the worlds', () => {
  it('opens exactly the worlds with a checked address, and labels the rest upcoming', () => {
    const list = worlds();
    expect(list.map((w) => [w.id, w.open])).toEqual([
      ['island', true],
      ['rumble', true],
      ['farm', true],
      ['pixel', false],
    ]);
    expect(worldById('pixel')!.url).toBeNull();
  });

  it('every open address is https on blobbi.pet, with no query, fragment or credentials (nothing travels)', () => {
    for (const w of worlds().filter((x) => x.open)) {
      const url = new URL(w.url!);
      expect(url.protocol).toBe('https:');
      expect(url.hostname.endsWith('.blobbi.pet')).toBe(true);
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
      expect(url.username + url.password).toBe('');
    }
  });

  it('refuses anything that is not a plain web address', () => {
    expect(isTravelUrl('https://island.blobbi.pet/')).toBe(true);
    expect(isTravelUrl('http://localhost:5173/')).toBe(true);
    for (const bad of [null, undefined, '', 'javascript:alert(1)', 'data:text/html,hi', 'http://island.blobbi.pet/', 'https://user:pw@island.blobbi.pet/', '/relative', 'not a url']) {
      expect(isTravelUrl(bad), String(bad)).toBe(false);
    }
  });
});
