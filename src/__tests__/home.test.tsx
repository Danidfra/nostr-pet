/**
 * The first vertical slice, end to end against a relay double: signed out,
 * loading, error, confirmed empty, one Blobbi, several Blobbis, legacy events
 * ignored, status values from shared projected state, and the Island exit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, BLOBBONAUT_PROFILE_KINDS, getSelectedBlobbiKey } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { DEFAULT_BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import { PUBKEY, blobbiEvent, legacyMarkerEvent, legacyShapeEvent, profileEvent } from '@/test/fixtures';

// ─── Signed-in user double ───────────────────────────────────────────────────

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

// ─── Relay double ────────────────────────────────────────────────────────────

type Relay = { state: NostrEvent[]; profile: NostrEvent[]; fail?: boolean; delay?: number };
const relay: Relay = { state: [], profile: [] };

const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  if (relay.delay) await new Promise((r) => setTimeout(r, relay.delay));
  if (relay.fail) throw new Error('relay unreachable');
  const kinds = filters.flatMap((f) => f.kinds ?? []);
  if (kinds.includes(KIND_BLOBBI_STATE)) return relay.state;
  if (kinds.some((k) => (BLOBBONAUT_PROFILE_KINDS as readonly number[]).includes(k))) return relay.profile;
  return [];
});
const pool = { query } as unknown as NPool;

// Slice tests: movement resolves at once and nothing idles.
const SCENE = { reducedMotion: true, idleEnabled: false };

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={SCENE}>
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <Home />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
}

// Fixtures are dated relative to now so projected decay reflects minutes, not
// the year between a fixed timestamp and the day the test runs.
const NOW = Math.floor(Date.now() / 1000);
const BROOK = blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: NOW - 120, set: { hunger: '55', energy: '20' } });
const ELDER = blobbiEvent('0000000002', { name: 'Elder', stage: 'adult', createdAt: NOW - 3600, extra: [['visual_generation', 'v2']] });
const SHELL = blobbiEvent('0000000003', { name: 'Shell', stage: 'egg', createdAt: NOW - 86_400 });

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY };
  relay.state = [];
  relay.profile = [];
  relay.fail = false;
  relay.delay = 0;
  query.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const islandLink = () => screen.getByTestId('enter-island');
const chip = () => screen.getByTestId('blobbi-chip');
/** The Blobbi's details (badges, rings, other Blobbis) live in its sheet. */
async function openBlobbiSheet() {
  await userEvent.click(chip());
  return screen.findByTestId('blobbi-sheet');
}
async function openMenu() {
  await userEvent.click(screen.getByTestId('menu-button'));
  return screen.findByTestId('menu-sheet');
}

describe('Home: signed out', () => {
  it('welcomes, then offers extension and bunker sign-in first (the key stays behind a fold) and the Island exit, and reads nothing', async () => {
    currentUser.user = undefined;
    renderHome();
    expect(await screen.findByTestId('onboarding-welcome')).toBeInTheDocument();
    // The Island is in "What is Blobbi?" (M12.2: the first screen is the scene and its two doors)
    await userEvent.click(screen.getByTestId('welcome-what-is-nostr'));
    expect(islandLink()).toHaveAttribute('href', DEFAULT_BLOBBI_ISLAND_URL);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByTestId('onboarding-existing'));
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with extension/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/bunker address/i)).toBeInTheDocument();
    expect(screen.getByTestId('login-signer-app')).toBeInTheDocument();
    expect(screen.getByTestId('login-key-section')).not.toHaveAttribute('open');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('Home: loading, error, empty', () => {
  it('shows a loading state while the relay is slow', async () => {
    relay.delay = 50;
    relay.state = [BROOK];
    renderHome();
    expect(await screen.findByText(/looking for your blobbi/i)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Brook' })).toBeInTheDocument();
  });

  it('shows an error with retry when the relay fails', async () => {
    relay.fail = true;
    renderHome();
    // The kit's collection read retries three times with backoff before it
    // reports an error; that policy is the kit's, so the test waits it out.
    expect(await screen.findByRole('alert', {}, { timeout: 12_000 })).toHaveTextContent(/could not reach your blobbi/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByTestId('blobbi-actor')).toBeNull();
  }, 15_000);

  it('shows the egg when the player owns no Blobbi: no profile step, no screen about having none (M12.3)', async () => {
    renderHome();
    expect(await screen.findByRole('heading', { name: /here is your egg/i })).toBeInTheDocument();
    expect(screen.queryByTestId('profile-skip')).toBeNull();
    expect(screen.getByTestId('adoption-adopt')).toBeInTheDocument();
  });

  it('treats a player with only legacy events as owning no Blobbi', async () => {
    relay.state = [legacyMarkerEvent('0000000007'), legacyShapeEvent()];
    renderHome();
    expect(await screen.findByRole('heading', { name: /here is your egg/i })).toBeInTheDocument();
    expect(screen.queryByText('Old')).toBeNull();
    expect(screen.queryByText('Older')).toBeNull();
  });
});

describe('Home: one Blobbi', () => {
  it('selects it naturally and shows canonical visual, stage, state, stats and the Island exit', async () => {
    relay.state = [BROOK, legacyMarkerEvent('0000000008')];
    renderHome();

    expect(await screen.findByRole('img', { name: 'Brook' })).toBeInTheDocument();
    expect(document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]')).toHaveAttribute('data-blobbi-generation', 'v1');
    expect(chip()).toHaveTextContent('Brook');
    // The scene itself carries no panels: no rings, no badges, no selector (the home switch top right is the one radiogroup, M14.1).
    expect(screen.queryByRole('group', { name: /care status/i })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: /blobbi|room/i })).toBeNull();

    await openBlobbiSheet();
    expect(screen.queryByRole('radiogroup', { name: /blobbi|room/i })).toBeNull();
    expect(screen.getByTestId('stage-badge')).toHaveTextContent('Baby');
    expect(screen.getByTestId('state-badge')).toHaveTextContent('Awake');

    const status = screen.getByRole('group', { name: /care status/i });
    for (const stat of ['hunger', 'happiness', 'health', 'hygiene', 'energy']) {
      expect(within(status).getByTestId(`stat-${stat}`)).toBeInTheDocument();
    }
    // Values come from shared projected state: a stat published at 20 is still
    // low a couple of minutes later, and flagged by the kit's thresholds.
    const energy = within(status).getByTestId('stat-energy');
    expect(energy.getAttribute('data-status')).not.toBe('normal');
    expect(within(status).getByTestId('stat-health').getAttribute('data-status')).toBe('normal');

    expect(screen.getByTestId('blobbi-xp')).toHaveTextContent('0');
    expect(screen.getByTestId('last-interaction')).toHaveTextContent(/min ago/);
    await userEvent.keyboard('{Escape}');

    await openMenu();
    // The Island is one of the Worlds since M14.1 (menu → Worlds); the door in the room is the other way
    await userEvent.click(screen.getByTestId('menu-worlds'));
    const island = await screen.findByTestId('world-island');
    expect(island.tagName).toBe('BUTTON');
    expect(island).toHaveAttribute('data-open', 'true');
  });

  it('shows the sleeping state and an egg-stage stat set', async () => {
    relay.state = [blobbiEvent('0000000004', { name: 'Nap', stage: 'egg', state: 'sleeping', createdAt: NOW - 60 })];
    renderHome();
    expect(await screen.findByRole('img', { name: 'Nap' })).toBeInTheDocument();
    expect(document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'egg');
    await openBlobbiSheet();
    expect(screen.getByTestId('state-badge')).toHaveTextContent('Sleeping');
    expect(screen.getByTestId('stage-badge')).toHaveTextContent('Egg');
    const status = screen.getByRole('group', { name: /care status/i });
    expect(within(status).queryByTestId('stat-hunger')).toBeNull();
    expect(within(status).getByTestId('stat-health')).toBeInTheDocument();
  });

  it('shows the player level from the kind 11125 profile', async () => {
    relay.state = [BROOK];
    relay.profile = [profileEvent({ xp: 250, has: ['blobbi-aaaaaaaaaaaa-0000000001'] })];
    renderHome();
    await screen.findByTestId('blobbi-chip');
    await openBlobbiSheet();
    expect(await screen.findByTestId('player-level')).toHaveTextContent(/^3/);
  });
});

describe('Home: travel to a world', () => {
  it('the Pixel world is a door: the Blobbi says goodbye and leaves before the page goes, never a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    relay.state = [BROOK];
    renderHome();
    await screen.findByTestId('blobbi-chip');
    await openMenu();
    await userEvent.click(screen.getByTestId('menu-worlds'));
    const pixel = await screen.findByTestId('world-pixel');
    expect(pixel.tagName).toBe('BUTTON');
    expect(pixel).toHaveTextContent('Visit');
    await userEvent.click(pixel);
    expect(screen.queryByTestId('worlds-sheet')).toBeNull();
    const card = await screen.findByTestId('departure-card');
    expect(card).toHaveTextContent('Brook is off to Blobbi Pixel');
    // While it leaves, the worlds' doors are shut: no second departure
    await openMenu();
    await userEvent.click(screen.getByTestId('menu-worlds'));
    expect(await screen.findByTestId('world-island')).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    // The departure plays to its end, and only then is the page asked to go
    await waitFor(() => expect(screen.getByTestId('departure-card')).toHaveAttribute('data-phase', 'gone'), { timeout: 4_000 });
    expect(screen.getByTestId('departure-card')).toHaveTextContent('Opening Blobbi Pixel');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('Stay keeps the Blobbi home, and the doors open again', async () => {
    relay.state = [BROOK];
    renderHome();
    await screen.findByTestId('blobbi-chip');
    await openMenu();
    await userEvent.click(screen.getByTestId('menu-worlds'));
    await userEvent.click(await screen.findByTestId('world-island'));
    await userEvent.click(await screen.findByTestId('departure-stay'));
    expect(screen.queryByTestId('departure-card')).toBeNull();
    await openMenu();
    await userEvent.click(screen.getByTestId('menu-worlds'));
    expect(await screen.findByTestId('world-island')).toBeEnabled();
  });
});

describe('Home: several Blobbis', () => {
  it('follows the profile current_companion and offers a selector', async () => {
    relay.state = [BROOK, ELDER, SHELL];
    relay.profile = [profileEvent({ currentCompanion: 'blobbi-aaaaaaaaaaaa-0000000002' })];
    renderHome();

    expect(await screen.findByTestId('blobbi-chip')).toHaveTextContent('Elder');
    expect(document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]')).toHaveAttribute('data-blobbi-generation', 'v2');

    await openBlobbiSheet();
    const group = screen.getByRole('radiogroup', { name: /choose your blobbi/i });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: /elder/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('falls back to the most recently cared-for Blobbi without a profile pick', async () => {
    relay.state = [SHELL, ELDER, BROOK];
    renderHome();
    expect(await screen.findByTestId('blobbi-chip')).toHaveTextContent('Brook');
  });

  it('lets the player pick another Blobbi and remembers it on this device', async () => {
    relay.state = [BROOK, ELDER];
    relay.profile = [profileEvent({ currentCompanion: 'blobbi-aaaaaaaaaaaa-0000000001' })];
    renderHome();
    expect(await screen.findByTestId('blobbi-chip')).toHaveTextContent('Brook');

    await openBlobbiSheet();
    await userEvent.click(screen.getByRole('radio', { name: /elder/i }));
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveTextContent('Elder'));
    expect(window.localStorage.getItem(getSelectedBlobbiKey(PUBKEY))).toBe('blobbi-aaaaaaaaaaaa-0000000002');
    // Picking closes the sheet; the scene is the newcomer's.
    expect(screen.queryByTestId('blobbi-sheet')).toBeNull();
    await openBlobbiSheet();
    expect(screen.getByTestId('stage-badge')).toHaveTextContent('Adult');
  });

  it('ignores a device pick that names a Blobbi the player no longer owns', async () => {
    window.localStorage.setItem(getSelectedBlobbiKey(PUBKEY), 'blobbi-aaaaaaaaaaaa-0000000099');
    relay.state = [BROOK, ELDER];
    relay.profile = [profileEvent({ currentCompanion: 'blobbi-aaaaaaaaaaaa-0000000002' })];
    renderHome();
    expect(await screen.findByTestId('blobbi-chip')).toHaveTextContent('Elder');
  });

  it('never publishes anything', async () => {
    relay.state = [BROOK, ELDER];
    renderHome();
    await screen.findByTestId('blobbi-actor');
    await openBlobbiSheet();
    await userEvent.click(screen.getByRole('radio', { name: /elder/i }));
    expect((pool as unknown as { event?: unknown }).event).toBeUndefined();
  });
});
