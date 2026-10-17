import { afterEach, describe, expect, it } from 'vitest';
import { checkTravelBuild } from './travel-build';
import { setTravelMode, travelMode } from './travel-mode';

afterEach(() => {
  setTravelMode('off');
  localStorage.clear();
});

describe('what a build says about world travel (travel-build.ts, checked by vite.config.ts)', () => {
  it('off by default, and off is silent', () => {
    for (const travel of [undefined, '', 'off']) expect(checkTravelBuild({ travel, command: 'build' })).toEqual({ ok: true, on: false, message: null });
  });

  it('`nostr` turns it on, and the build says it publishes to the public travel relays', () => {
    const on = checkTravelBuild({ travel: 'nostr', command: 'build' });
    expect(on).toMatchObject({ ok: true, on: true });
    expect(on.message).toMatch(/public travel relays/);
    expect(checkTravelBuild({ travel: 'nostr', command: 'serve' }).message).toMatch(/PUBLIC travel relays/);
  });

  it('an unknown value is a mistake, never a quiet off', () => {
    for (const travel of ['on', 'true', 'Nostr', ' nostr', 'v1']) expect(checkTravelBuild({ travel, command: 'build' }).ok).toBe(false);
  });

  it('the build check and the page agree on every value a build may carry', () => {
    setTravelMode(null);
    localStorage.setItem('blobbi:world-travel:v1', 'nostr');
    for (const travel of [undefined, '', 'off', 'nostr']) {
      const check = checkTravelBuild({ travel, command: 'build' });
      if (!check.ok) continue;
      // A production page ignores its storage: only the build decides
      expect(travelMode({ build: travel, dev: false })).toBe(check.on ? 'nostr' : 'off');
    }
  });
});
