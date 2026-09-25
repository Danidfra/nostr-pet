/**
 * The care loop and companion selection, end to end against a relay double
 * and a fake signer: fresh read before every write, kit planning, signing,
 * publish, relay-backed refresh, double-submit protection, failure, stage and
 * sleep semantics, and the kind 11125 update that keeps every other tag.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  KIND_BLOBBI_STATE,
  KIND_BLOBBI_INTERACTION,
  KIND_BLOBBONAUT_PROFILE,
  BLOBBONAUT_PROFILE_KINDS,
  getTagValue,
  getTagValues,
} from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { chooseCare } from '@/test/care-ui';
import { EnvironmentProvider } from '@/environment';
import type { Appearance } from '@/environment';
import { PUBKEY, blobbiEvent, profileEvent } from '@/test/fixtures';

// ─── Signed-in user with a fake signer ───────────────────────────────────────

let signCount = 0;
const signer = {
  async signEvent(template: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...template, id: String(signCount).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

// ─── Relay double: answers filters, stores what is published ─────────────────

type Relay = { state: NostrEvent[]; profile: NostrEvent[]; published: NostrEvent[]; publishFails?: boolean; publishDelay?: number };
const relay: Relay = { state: [], profile: [], published: [] };

const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const out: NostrEvent[] = [];
  for (const f of filters) {
    const kinds = f.kinds ?? [];
    if (kinds.includes(KIND_BLOBBI_STATE)) {
      const ds = f['#d'];
      out.push(...relay.state.filter((e) => !ds || ds.includes(getTagValue(e.tags, 'd') ?? '')));
    }
    if (kinds.some((k) => (BLOBBONAUT_PROFILE_KINDS as readonly number[]).includes(k))) out.push(...relay.profile);
  }
  return out;
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.publishDelay) await new Promise((r) => setTimeout(r, relay.publishDelay));
  if (relay.publishFails) throw new Error('relay rejected the event');
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.state = [...relay.state.filter((e) => getTagValue(e.tags, 'd') !== d), ev];
  if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.profile = [ev];
});
const pool = { query, event } as unknown as NPool;

const SCENE = { reducedMotion: true, idleEnabled: false };

function renderHome(appearance: Appearance = 'day') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Protocol tests: movement resolves at once and nothing idles, so every
  // assertion is about events, not about where the Blobbi is standing.
  return render(
    <EnvironmentProvider initialAppearance={appearance}>
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
      </SceneSettingsProvider>
    </EnvironmentProvider>,
  );
}

const NOW = Math.floor(Date.now() / 1000);
const BROOK_D = 'blobbi-aaaaaaaaaaaa-0000000001';
const ELDER_D = 'blobbi-aaaaaaaaaaaa-0000000002';
const brook = (set: Record<string, string> = {}, state: 'active' | 'sleeping' | 'hibernating' = 'active') =>
  blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state, createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70', ...set }, extra: [['custom_host_tag', 'keep-me']] });

const published31124 = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);
const published1124 = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_INTERACTION);
const published11125 = () => relay.published.filter((e) => e.kind === KIND_BLOBBONAUT_PROFILE);
const freshReads = () => query.mock.calls.filter(([filters]) => filters.some((f) => f['#d'] && f.kinds?.includes(KIND_BLOBBI_STATE)));

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.state = [];
  relay.profile = [];
  relay.published = [];
  relay.publishFails = false;
  relay.publishDelay = 0;
  signCount = 0;
  query.mockClear();
  event.mockClear();
});

async function ready() {
  return screen.findByRole('group', { name: /care for your blobbi/i });
}

/** The Blobbi's details (badges, rings, lifecycle, other Blobbis) live in its sheet. */
async function openBlobbiSheet() {
  await userEvent.click(screen.getByTestId('blobbi-chip'));
  return screen.findByTestId('blobbi-sheet');
}
async function closeSheet() {
  await userEvent.keyboard('{Escape}');
}

describe('Care: feed', () => {
  it('reads fresh, plans through the kit, signs, publishes the 31124 and the 1124, and shows relay-backed state', async () => {
    relay.state = [brook()];
    renderHome();
    await ready();
    await openBlobbiSheet();
    const before = Number(within(screen.getByRole('group', { name: /care status/i })).getByTestId('stat-hunger').getAttribute('aria-valuenow'));
    await closeSheet();
    expect(freshReads()).toHaveLength(0);

    await chooseCare('feed');
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/fed brook/i));

    // Fresh read before write, scoped to this Blobbi.
    expect(freshReads().length).toBeGreaterThanOrEqual(1);

    const [state] = published31124();
    expect(state).toBeDefined();
    expect(getTagValue(state.tags, 'd')).toBe(BROOK_D);
    expect(Number(getTagValue(state.tags, 'hunger'))).toBeGreaterThan(40);
    expect(Number(getTagValue(state.tags, 'experience'))).toBeGreaterThan(0);
    expect(getTagValue(state.tags, 'custom_host_tag')).toBe('keep-me');
    expect(getTagValue(state.tags, 'client')).toBe('Blobbi');
    expect(getTagValue(state.tags, 'published_at')).toBeTruthy();
    expect(state.pubkey).toBe(PUBKEY);

    await waitFor(() => expect(published1124()).toHaveLength(1));
    const [log] = published1124();
    expect(getTagValue(log.tags, 'action')).toBe('feed');
    expect(getTagValue(log.tags, 'source')).toBe('blobbi-home');
    expect(getTagValue(log.tags, 'a')).toBe(`${KIND_BLOBBI_STATE}:${PUBKEY}:${BROOK_D}`);

    // The screen reflects the published state, not a guess.
    await openBlobbiSheet();
    await waitFor(() => {
      const after = Number(within(screen.getByRole('group', { name: /care status/i })).getByTestId('stat-hunger').getAttribute('aria-valuenow'));
      expect(after).toBeGreaterThan(before);
    });
    expect(screen.getByTestId('blobbi-xp')).toHaveTextContent(getTagValue(state.tags, 'experience')!);
    expect(screen.getByTestId('care-hearts')).toBeInTheDocument();
  });

  it('never double-submits while a write is in flight', async () => {
    relay.state = [brook()];
    relay.publishDelay = 80;
    renderHome();
    await ready();
    await chooseCare('feed');
    // While the write is in flight every verb is off: nothing opens, nothing sends.
    await userEvent.click(screen.getByTestId('care-feed'));
    await userEvent.click(screen.getByTestId('care-play'));
    expect(screen.queryByTestId('care-options')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/fed brook/i));
    await waitFor(() => expect(published31124()).toHaveLength(1));
    expect(published31124()).toHaveLength(1);
    // The interaction log is fire-and-forget; let it land before the test ends.
    await waitFor(() => expect(published1124()).toHaveLength(1));
  });

  it('reports a failed publish and keeps showing the relay state', async () => {
    relay.state = [brook()];
    relay.publishFails = true;
    renderHome();
    await ready();
    await chooseCare('clean');
    // A starter use that fails leaves the soap with a retry; nothing was written.
    expect(await screen.findByTestId('item-error', {}, { timeout: 4000 })).toHaveTextContent(/relay rejected/i);
    expect(published31124()).toHaveLength(0);
    await userEvent.click(screen.getByTestId('offer-put-away'));
    await waitFor(() => expect(screen.getByTestId('care-feed')).toBeEnabled());
    await openBlobbiSheet();
    const hygiene = within(screen.getByRole('group', { name: /care status/i })).getByTestId('stat-hygiene');
    expect(Number(hygiene.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(45);
  });

  it('opening the home publishes nothing', async () => {
    relay.state = [brook()];
    renderHome();
    await ready();
    await new Promise((r) => setTimeout(r, 50));
    expect(relay.published).toHaveLength(0);
  });
});

describe('Care: rest and wake', () => {
  it('puts the Blobbi to sleep, then wakes it, through the state tag', async () => {
    relay.state = [brook()];
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('care-rest'));
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/resting/i));
    expect(getTagValue(published31124()[0].tags, 'state')).toBe('sleeping');
    expect(published1124()).toHaveLength(0);

    await openBlobbiSheet();
    await waitFor(() => expect(screen.getByTestId('state-badge')).toHaveTextContent(/sleeping/i));
    await closeSheet();
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    expect(screen.getByTestId('care-feed')).toHaveAttribute('aria-label', expect.stringMatching(/sleeping/i));
    const wake = screen.getByTestId('care-rest');
    expect(wake).toHaveAccessibleName('Wake');

    await userEvent.click(wake);
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/woke up/i));
    expect(getTagValue(published31124()[1].tags, 'state')).toBe('active');
    await openBlobbiSheet();
    await waitFor(() => expect(screen.getByTestId('state-badge')).toHaveTextContent(/awake/i));
  });

  it('draws a sleeping Blobbi differently and offers no care but Wake', async () => {
    relay.state = [brook({}, 'sleeping')];
    renderHome();
    await ready();
    expect(screen.getByTestId('care-rest')).toHaveAccessibleName('Wake');
    for (const a of ['feed', 'play', 'clean']) expect(screen.getByTestId(`care-${a}`)).toBeDisabled();
    expect(screen.getByTestId('blobbi-chip')).toHaveTextContent(/sleeping/i);
  });

  it('a hibernating Blobbi gets no actions', async () => {
    relay.state = [brook({}, 'hibernating')];
    renderHome();
    await ready();
    for (const a of ['feed', 'play', 'clean', 'rest']) expect(screen.getByTestId(`care-${a}`)).toBeDisabled();
  });
});

describe('Care: stages', () => {
  it('an egg can be cleaned and rested, not fed or played with', async () => {
    relay.state = [blobbiEvent('0000000003', { name: 'Shell', stage: 'egg', createdAt: NOW - 60 })];
    renderHome();
    await ready();
    expect(screen.getByTestId('care-feed')).toBeDisabled();
    expect(screen.getByTestId('care-play')).toBeDisabled();
    expect(screen.getByTestId('care-clean')).toBeEnabled();
    expect(screen.getByTestId('care-rest')).toBeEnabled();
    await chooseCare('clean');
    await waitFor(() => expect(published31124()).toHaveLength(1));
    expect(getTagValue(published31124()[0].tags, 'stage')).toBe('egg');
    await waitFor(() => expect(published1124()).toHaveLength(1));
  });
});

describe('Current companion (kind 11125)', () => {
  const profile = () => profileEvent({ currentCompanion: BROOK_D, has: [BROOK_D, ELDER_D], xp: 250 });

  it('selecting another Blobbi updates current_companion and preserves every other tag', async () => {
    relay.state = [brook(), blobbiEvent('0000000002', { name: 'Elder', stage: 'adult', createdAt: NOW - 3600 })];
    relay.profile = [{ ...profile(), tags: [...profile().tags, ['blobbi_onboarding_done', 'true'], ['inv', 'opaque-host-data']] }];
    renderHome();
    await ready();
    await openBlobbiSheet();
    await userEvent.click(screen.getByRole('radio', { name: /elder/i }));
    await waitFor(() => expect(published11125()).toHaveLength(1));
    const [next] = published11125();
    expect(getTagValue(next.tags, 'current_companion')).toBe(ELDER_D);
    expect(getTagValues(next.tags, 'current_companion')).toHaveLength(1);
    expect(getTagValues(next.tags, 'has').sort()).toEqual([BROOK_D, ELDER_D].sort());
    expect(getTagValue(next.tags, 'xp')).toBe('250');
    expect(getTagValue(next.tags, 'name')).toBe('Tester');
    expect(getTagValue(next.tags, 'blobbi_onboarding_done')).toBe('true');
    expect(getTagValue(next.tags, 'inv')).toBe('opaque-host-data');
    expect(getTagValue(next.tags, 'd')).toBe(getTagValue(profile().tags, 'd'));
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveTextContent('Elder'));
  });

  it('publishes nothing when the profile already names that Blobbi, or when there is no profile', async () => {
    relay.state = [brook(), blobbiEvent('0000000002', { name: 'Elder', stage: 'adult', createdAt: NOW - 3600 })];
    relay.profile = [profile()];
    renderHome();
    await ready();
    await openBlobbiSheet();
    await userEvent.click(screen.getByRole('radio', { name: /brook/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(published11125()).toHaveLength(0);
  });

  it('with no profile on relays, the pick stays on this device and nothing is created', async () => {
    relay.state = [brook(), blobbiEvent('0000000002', { name: 'Elder', stage: 'adult', createdAt: NOW - 3600 })];
    renderHome();
    await ready();
    await openBlobbiSheet();
    await userEvent.click(screen.getByRole('radio', { name: /elder/i }));
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveTextContent('Elder'));
    await new Promise((r) => setTimeout(r, 50));
    expect(relay.published).toHaveLength(0);
  });
});

describe('Rendering under the environment', () => {
  it('the home lighting changes, never the Blobbi', async () => {
    relay.state = [brook()];
    const { unmount } = renderHome('day');
    await ready();
    expect(document.documentElement.dataset.homePhase).toBe('day');
    const day = document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-body-box]')!.innerHTML;
    unmount();

    renderHome('night');
    await ready();
    expect(document.documentElement.dataset.homePhase).toBe('night');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const night = document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-body-box]')!.innerHTML;
    expect(night).toBe(day);
  });
});
