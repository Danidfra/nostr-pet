import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setRoomArrivalEnabled } from '@/features/room/lib/room-arrival';
import { setDailyXpEnabled } from '@/features/progression/daily-xp-switch';

// The room's home-coming (M12.1) starts the Blobbi absent for a moment: suites about other things meet it present,
// as before; the arrival's own suite turns it on
setRoomArrivalEnabled(false);
// Today's missions write to the profile (progress, and the day's award). The kit's store of the day outlives a test,
// so suites about other things would pay a day an earlier test finished; the progression suites turn it on
setDailyXpEnabled(false);

// jsdom has no matchMedia; the theme provider and hover checks read it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
