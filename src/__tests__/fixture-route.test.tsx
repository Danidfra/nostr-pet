/**
 * A development fixture link opens the real app over an in-memory world,
 * and nothing else: `/room?fixture=adult-v3&perf` shows a simulated adult
 * in the room with the performance overlay, before and instead of any
 * account, relay, key or write. The fixture user is decided above the
 * router and the login store, so a real login kept on the device is
 * neither used nor touched; no socket opens, nothing is fetched, no key is
 * made; care, rooms and settings work and write nothing but device
 * preferences. Without the dev-tools flag the link is refused out loud (dev
 * builds), and a production build has no fixture code at all
 * (`env-contract.test.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const socket = vi.fn();
const fetchSpy = vi.fn();
let randomCalls = 0;
const realGetRandomValues = crypto.getRandomValues.bind(crypto);

/** The app as `main.tsx` mounts it, at this URL, with the flag as given: a fresh module graph each time. */
async function openApp(url: string, flag: 'true' | 'off' = 'true') {
  vi.stubEnv('VITE_BLOBBI_DEV_TOOLS', flag);
  window.history.replaceState({}, '', url);
  vi.resetModules();
  // A fresh graph re-creates the test seams in their app state: set them as the test setup does for every suite
  (await import('@/features/room/lib/room-arrival')).setRoomArrivalEnabled(false);
  (await import('@/features/progression/daily-xp-switch')).setDailyXpEnabled(false);
  const { default: App } = await import('@/App');
  return render(<App />);
}

/** The login store writes its (empty) list on mount; what matters is that no login is in it. */
const noLogins = () => JSON.parse(localStorage.getItem('nostr:login') ?? '[]').length === 0;
const inRoom = () => screen.findByTestId('room-blobbi-anchor', {}, { timeout: 8000 });
const STORED_LOGIN = JSON.stringify([{ id: 'nsec:' + 'e'.repeat(64), type: 'nsec', pubkey: 'e'.repeat(64), createdAt: '2026-10-11T00:00:00.000Z', data: { nsec: 'nsec1placeholder' } }]);

beforeEach(() => {
  vi.stubGlobal('WebSocket', socket);
  vi.stubGlobal('fetch', fetchSpy);
  randomCalls = 0;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: (a: ArrayBufferView) => {
      randomCalls += 1;
      return realGetRandomValues(a as Uint8Array);
    },
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
afterEach(() => {
  delete (globalThis.crypto as unknown as Record<string, unknown>).getRandomValues;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  socket.mockClear();
  fetchSpy.mockClear();
  window.history.replaceState({}, '', '/');
});

describe('the fixture route', () => {
  it('opens the room with a simulated adult V3 and the performance overlay: no login, no socket, no fetch, no key, nothing written but device preferences', async () => {
    await openApp('/room?fixture=adult-v3&perf');
    await inRoom();
    expect(screen.getByTestId('room-header-name')).toHaveTextContent('Elder');
    // `?perf`: the fps indicator is on; the tools open on the performance view with Record ready; nothing else floats
    expect(screen.getByTestId('room-perf-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('dev-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('dev-tools-open'));
    expect(screen.getByTestId('dev-tools')).toHaveAttribute('data-view', 'performance');
    expect(screen.getByTestId('room-perf-record')).toBeEnabled();
    fireEvent.click(screen.getByTestId('dev-tools-close'));
    // The way in was never shown and no login was made
    expect(screen.queryByText(/Looking for your Blobbi/)).toBeNull();
    expect(screen.queryByText(/Sign in/)).toBeNull();
    expect(noLogins()).toBe(true);
    expect(socket).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(randomCalls).toBe(0);
    // Rooms, care and settings work and leave only device preferences behind
    const shell = screen.getByTestId('room-shell');
    expect(shell).toHaveAttribute('data-room', 'home');
    const use = await screen.findByTestId('room-item-use');
    expect(use).toBeEnabled();
    fireEvent.click(use);
    await new Promise((r) => setTimeout(r, 400));
    fireEvent.click(screen.getByTestId('room-nav-right'));
    await waitFor(() => expect(shell).not.toHaveAttribute('data-room', 'home'));
    fireEvent.click(screen.getByTestId('room-nav-left'));
    await waitFor(() => expect(shell).toHaveAttribute('data-room', 'home'));
    // The journey (it reads the fixture's receipts) and the worlds (nothing is fetched to list them) stay inside the fixture
    fireEvent.click(screen.getByTestId('room-journey'));
    expect(await screen.findByTestId('journey-sheet')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('journey-sheet'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('room-worlds'));
    expect(await screen.findByTestId('worlds-sheet')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('worlds-sheet'), { key: 'Escape' });
    await new Promise((r) => setTimeout(r, 100));
    expect(socket).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(randomCalls).toBe(0);
    for (const key of Object.keys(localStorage)) expect(key).toMatch(/^(blobbi[:-]|nostr:login$)/);
    expect(noLogins()).toBe(true);
  });

  it('feeding and playing in the fixture are simulated whole (the dish, the bites, the ball) with no socket, no fetch and no key; the writes land in the fixture world only', async () => {
    await openApp('/room?fixture=adult-v3');
    await inRoom();
    const shell = screen.getByTestId('room-shell');
    // The living room offers toys: the ball
    const use = await screen.findByTestId('room-item-use');
    for (let i = 0; i < 6 && !/Ball/.test(use.getAttribute('aria-label') ?? ''); i++) fireEvent.click(screen.getByTestId('room-item-next'));
    expect(screen.getByTestId('room-item-use')).toHaveAccessibleName(/Ball/);
    fireEvent.click(screen.getByTestId('room-item-use'));
    // Set down as a thing in the room; without WebGL (jsdom) it is a drawing on the floor
    await screen.findByTestId('room-floor-item');
    // Nobody walks in the simple room: the play is written at once, into the fixture's pool, and celebrated
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Elder/), { timeout: 6000 });
    expect(socket).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(randomCalls).toBe(0);
    // The kitchen: the apple, on a dish, eaten
    fireEvent.click(screen.getByTestId('room-nav-left'));
    await waitFor(() => expect(shell).toHaveAttribute('data-room', 'kitchen'));
    const give = await screen.findByTestId('room-item-use');
    for (let i = 0; i < 8 && !/Apple/.test(give.getAttribute('aria-label') ?? ''); i++) fireEvent.click(screen.getByTestId('room-item-next'));
    fireEvent.click(screen.getByTestId('room-item-use'));
    await screen.findByTestId('room-floor-item');
    await waitFor(() => expect(screen.getByTestId('room-floor-item')).toHaveAttribute('data-phase', 'eating'), { timeout: 6000 });
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Elder/), { timeout: 6000 });
    expect(socket).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(noLogins()).toBe(true);
    for (const key of Object.keys(localStorage)) expect(key).toMatch(/^(blobbi[:-]|nostr:login$)/);
  }, 30_000);

  it('opens a simulated baby V3 the same way', async () => {
    await openApp('/room?fixture=baby-v3&perf');
    await inRoom();
    expect(screen.getByTestId('room-header-name')).toHaveTextContent('Brook');
    expect(screen.getByTestId('room-perf-pill')).toBeInTheDocument();
    expect(socket).not.toHaveBeenCalled();
  });

  it('comes before the login store: a real login kept on the device is neither used nor touched, and the menu cannot sign it out', async () => {
    localStorage.setItem('nostr:login', STORED_LOGIN);
    await openApp('/room?fixture=adult-v3');
    await inRoom();
    expect(screen.getByTestId('room-header-name')).toHaveTextContent('Elder');
    // The fixture world's panel lives inside the room's dev tools (its Fixture view), not floating beside them
    expect(screen.queryByTestId('dev-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('dev-tools-open'));
    fireEvent.click(screen.getByTestId('dev-tools-tab-fixture'));
    expect(screen.getByTestId('dev-panel')).toHaveAttribute('data-embedded', 'true');
    fireEvent.click(screen.getByTestId('dev-tools-close'));
    expect(socket).not.toHaveBeenCalled();
    expect(localStorage.getItem('nostr:login')).toBe(STORED_LOGIN);
    // The room's menu: the fixture user is the one in it, and signing out there touches no real login
    fireEvent.click(screen.getByTestId('room-menu'));
    fireEvent.click(await screen.findByTestId('menu-account'));
    const signOut = await screen.findByTestId('sign-out');
    expect(screen.getByTestId('login-type')).toHaveTextContent('');
    expect(screen.queryByTestId('key-backup-section')).toBeNull();
    fireEvent.click(signOut);
    await new Promise((r) => setTimeout(r, 50));
    expect(localStorage.getItem('nostr:login')).toBe(STORED_LOGIN);
    expect(screen.getByTestId('room-shell')).toBeInTheDocument();
  });

  it('without the dev-tools flag the link is refused out loud and the real home shows signed out; no fixture, no socket', async () => {
    await openApp('/room?fixture=adult-v3&perf', 'off');
    const notice = await screen.findByTestId('fixture-refused');
    expect(notice).toHaveTextContent(/VITE_BLOBBI_DEV_TOOLS=true/);
    // The real app, signed out: the welcome (a /room link sends a visitor there)
    expect(await screen.findByTestId('onboarding-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('room-blobbi-anchor')).toBeNull();
    expect(screen.queryByTestId('room-perf')).toBeNull();
    expect(socket).not.toHaveBeenCalled();
  });

  it('with the flag on but no fixture asked for, the real app runs and nothing is said', async () => {
    await openApp('/room');
    expect(await screen.findByTestId('onboarding-welcome', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByTestId('fixture-refused')).toBeNull();
    expect(screen.queryByTestId('dev-panel')).toBeNull();
  });
});
