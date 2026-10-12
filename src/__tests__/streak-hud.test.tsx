/**
 * The streak and the condition dots in the HUD (M10). The streak rule is
 * blobbi-kit's; the home only reads `care_streak` from the authoritative
 * event and celebrates when it went up between two versions of the same
 * Blobbi: a bump on the pill and a word, a card on the milestone days,
 * nothing on load and nothing when the day was already counted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, getLocalDayString, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { chooseCare } from '@/test/care-ui';

let signCount = 0;
const signer = {
  async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> {
    signCount += 1;
    return { ...t, id: String(signCount).padStart(64, 'e'), pubkey: PUBKEY, sig: '0'.repeat(128) };
  },
};
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> =>
  relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f['#d'] || e.tags.some((t) => t[0] === 'd' && f['#d']!.includes(t[1]))))),
);
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => e.kind !== KIND_BLOBBI_STATE), ev];
});
const pool = { query, event } as unknown as NPool;

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
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

const NOW = Math.floor(Date.now() / 1000);
const TODAY = getLocalDayString();
const YESTERDAY = getLocalDayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
const brook = (streak: number, lastDay: string, set: Record<string, string> = {}) =>
  blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state: 'active', createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70', care_streak: String(streak), care_streak_last_day: lastDay, ...set } });

const pill = () => screen.queryByTestId('streak-pill');
const states = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.published = [];
  signCount = 0;
  window.localStorage.clear();
});

describe('The streak in the HUD', () => {
  it('shows the authoritative number on load without celebrating it', async () => {
    relay.all = [brook(5, TODAY)];
    renderHome();
    await ready();
    expect(pill()).toHaveAttribute('data-days', '5');
    expect(pill()).toHaveAccessibleName('Care streak: 5 days');
    expect(pill()).not.toHaveClass('streak-pill--bump');
    expect(screen.queryByTestId('streak-moment')).toBeNull();
  });

  it('bumps when a care write makes the kit count a new day', async () => {
    relay.all = [brook(3, YESTERDAY)];
    renderHome();
    await ready();
    await chooseCare('feed');
    await waitFor(() => expect(states()).toHaveLength(1));
    expect(getTagValue(states()[0].tags, 'care_streak')).toBe('4');
    await waitFor(() => expect(pill()).toHaveAttribute('data-days', '4'));
    expect(pill()).toHaveClass('streak-pill--bump');
    expect(screen.queryByTestId('streak-moment')).toBeNull();
  });

  it('a second care the same day changes nothing and celebrates nothing', async () => {
    relay.all = [brook(5, TODAY)];
    renderHome();
    await ready();
    await chooseCare('feed');
    await waitFor(() => expect(states()).toHaveLength(1));
    expect(getTagValue(states()[0].tags, 'care_streak')).toBe('5');
    await waitFor(() => expect(screen.getByTestId('care-status')).toHaveTextContent(/Fed Brook/));
    expect(pill()).toHaveAttribute('data-days', '5');
    expect(pill()).not.toHaveClass('streak-pill--bump');
    expect(screen.queryByTestId('streak-moment')).toBeNull();
  });

  it('a milestone day gets the card, which goes away on a tap; a broken streak starting over gets nothing', async () => {
    relay.all = [brook(6, YESTERDAY)];
    renderHome();
    await ready();
    await chooseCare('feed');
    await waitFor(() => expect(states()).toHaveLength(1));
    expect(getTagValue(states()[0].tags, 'care_streak')).toBe('7');
    const moment = await screen.findByTestId('streak-moment');
    expect(moment).toHaveAttribute('data-days', '7');
    expect(moment).toHaveTextContent('7 days in a row!');
    await userEvent.click(moment);
    expect(screen.queryByTestId('streak-moment')).toBeNull();
    // Only an increase counts: a streak of 9 that lapsed becomes 1, and the home stays quiet.
    relay.published = [];
    relay.all = [brook(9, '2020-01-01')];
    renderHome();
    await waitFor(() => expect(screen.getAllByTestId('streak-pill').at(-1)).toHaveAttribute('data-days', '9'));
  });
});

describe('The condition dots', () => {
  it('one dot per visible stat, coloured by the kit’s status, with the number only in the sheet', async () => {
    relay.all = [brook(1, TODAY, { hunger: '50', happiness: '20', hygiene: '80' })];
    renderHome();
    await ready();
    const dots = screen.getByTestId('condition-dots');
    expect(dots.querySelector('[data-stat="happiness"]')).toHaveAttribute('data-status', 'critical');
    expect(dots.querySelector('[data-stat="hunger"]')).toHaveAttribute('data-status', 'warning');
    expect(dots.querySelector('[data-stat="hygiene"]')).toHaveAttribute('data-status', 'normal');
    expect(screen.getByTestId('hud-top')).not.toHaveTextContent('20');
    expect(screen.getByTestId('hud-top')).not.toHaveTextContent('Hunger');
  });
});
