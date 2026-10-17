import { afterEach, describe, expect, it } from 'vitest';
import { TRAVEL_MODE_KEY, isTrustedInput, setTravelMode, setTrustedInputCheck, travelMode } from './travel-mode';

afterEach(() => {
  setTravelMode('off');
  setTrustedInputCheck(null);
  localStorage.clear();
});

describe('whether world travel runs (travel-mode.ts)', () => {
  it('off by default; Nostr travel only when the build says so, or a development page asks', () => {
    setTravelMode(null);
    expect(travelMode({ build: undefined, dev: false })).toBe('off');
    expect(travelMode({ build: 'nostr', dev: false })).toBe('nostr');
    expect(travelMode({ build: undefined, dev: true })).toBe('off');
    localStorage.setItem(TRAVEL_MODE_KEY, 'nostr');
    expect(travelMode({ build: undefined, dev: true })).toBe('nostr');
    // A production build ignores the page's storage: no page can switch a player onto the experimental kinds
    expect(travelMode({ build: undefined, dev: false })).toBe('off');
    expect(travelMode({ build: 'off', dev: false })).toBe('off');
    // The removed cookie presence is not a mode any more: an old value means off
    expect(travelMode({ build: 'v1', dev: false })).toBe('off');
    localStorage.setItem(TRAVEL_MODE_KEY, 'v1');
    expect(travelMode({ build: undefined, dev: true })).toBe('off');
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
