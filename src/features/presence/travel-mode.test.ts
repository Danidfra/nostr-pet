import { afterEach, describe, expect, it } from 'vitest';
import { TRAVEL_MODE_KEY, isTrustedInput, setTravelMode, setTrustedInputCheck, travelMode } from './travel-mode';

afterEach(() => {
  setTravelMode('v1');
  setTrustedInputCheck(null);
  localStorage.clear();
});

describe('which world presence runs (travel-mode.ts)', () => {
  it('v1 by default; Nostr travel only when the build says so, or a development page asks', () => {
    setTravelMode(null);
    expect(travelMode({ build: undefined, dev: false })).toBe('v1');
    expect(travelMode({ build: 'nostr', dev: false })).toBe('nostr');
    expect(travelMode({ build: undefined, dev: true })).toBe('v1');
    localStorage.setItem(TRAVEL_MODE_KEY, 'nostr');
    expect(travelMode({ build: undefined, dev: true })).toBe('nostr');
    // A production build ignores the page's storage: no page can switch a player onto the experimental kinds
    expect(travelMode({ build: undefined, dev: false })).toBe('v1');
    expect(travelMode({ build: 'off', dev: false })).toBe('v1');
  });

  it('a forced mode wins (tests)', () => {
    setTravelMode('nostr');
    expect(travelMode({ build: undefined, dev: false })).toBe('nostr');
  });

  it('only a trusted input is the player’s, unless a suite says otherwise', () => {
    const e = new Event('pointerdown');
    expect(isTrustedInput(e)).toBe(false);
    setTrustedInputCheck(() => true);
    expect(isTrustedInput(e)).toBe(true);
  });
});
