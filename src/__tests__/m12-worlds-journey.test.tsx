/**
 * M12 in the room, over a fake relay: the Worlds sheet (open worlds are
 * buttons, upcoming ones are never links, Stay keeps the Blobbi home), the
 * Journey (chapters from the canonical record, a "Go there" that changes
 * room), a second egg only on the kit's level unlock (checked again before
 * signing) that does not hatch by itself, and an egg that is not the
 * account's first never hatched without its incubation.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, buildInteractionEventTemplate, getTagValue } from '@blobbi-kit/core';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent, earlierBlobbiEvent, profileEvent } from '@/test/fixtures';

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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => matches(e, f))));
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => e.kind !== KIND_BLOBBONAUT_PROFILE), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

function renderRoom() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/room']}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>,
  );
}

const brook = (set: Record<string, string> = {}) => blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', visualGeneration: 'v3', set });
const receipt = (d: string, action: 'feed' | 'play' | 'clean', n: number): NostrEvent => ({
  ...buildInteractionEventTemplate({ ownerPubkey: PUBKEY, blobbiDTag: d, action, source: 'blobbi-home' }),
  id: String(n).padStart(64, 'c'),
  pubkey: PUBKEY,
  created_at: 1_760_000_000 + n,
  sig: '0'.repeat(128),
});
const published = (kind: number) => relay.published.filter((e) => e.kind === kind);

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

beforeEach(() => {
  localStorage.clear();
  relay.all = [];
  relay.published = [];
  signCount = 0;
  currentUser.user = { pubkey: PUBKEY, signer };
});

describe('worlds from the room', () => {
  it('lists the open worlds as buttons and the upcoming one as a label, never a link', async () => {
    relay.all = [brook(), profileEvent({ currentCompanion: getTagValue(brook().tags, 'd') })];
    renderRoom();
    await userEvent.click(await screen.findByTestId('room-worlds'));
    const sheet = await screen.findByTestId('worlds-sheet');
    for (const id of ['island', 'rumble', 'farm']) {
      const card = within(sheet).getByTestId(`world-${id}`);
      expect(card.tagName).toBe('BUTTON');
      expect(card).toHaveAttribute('data-open', 'true');
    }
    const pixel = within(sheet).getByTestId('world-pixel');
    expect(pixel.tagName).not.toBe('BUTTON');
    expect(pixel).toHaveTextContent('Coming soon');
    // Nothing in the sheet is an address to follow: travel is the Blobbi's departure, then the page
    expect(sheet.querySelector('a[href]')).toBeNull();
    expect(within(sheet).getByTestId('worlds-note')).toHaveTextContent(/key never travels/);
  });

  it('a world chosen: the Blobbi says goodbye; Stay keeps it home and nothing navigates or is written', async () => {
    relay.all = [brook()];
    renderRoom();
    await userEvent.click(await screen.findByTestId('room-worlds'));
    await userEvent.click(await screen.findByTestId('world-island'));
    expect(screen.queryByTestId('worlds-sheet')).toBeNull();
    const card = await screen.findByTestId('departure-card');
    expect(card).toHaveTextContent('Brook is off to Blobbi Island');
    await userEvent.click(screen.getByTestId('departure-stay'));
    expect(screen.queryByTestId('departure-card')).toBeNull();
    expect(relay.published).toHaveLength(0);
  });
});

describe('the journey in the room', () => {
  it('derives the chapters from the record, and "Go there" takes the player to the right room', async () => {
    relay.all = [brook()];
    renderRoom();
    await userEvent.click(await screen.findByTestId('room-journey'));
    const sheet = await screen.findByTestId('journey-sheet');
    await waitFor(() => expect(within(sheet).getByTestId('chapter-first-steps')).toHaveAttribute('data-status', 'current'));
    expect(within(sheet).getByTestId('chapter-beginning')).toHaveAttribute('data-status', 'done');
    expect(within(sheet).getByTestId('chapter-family')).toHaveAttribute('data-status', 'locked');
    await userEvent.click(within(sheet).getByTestId('objective-feed-go'));
    expect(screen.queryByTestId('journey-sheet')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('room-shell')).toHaveAttribute('data-room', 'kitchen'));
    expect(relay.published).toHaveLength(0);
  });

  it('care given anywhere (kind 1124) and a two-day streak finish chapter 2', async () => {
    const b = brook({ care_streak: '2' });
    const d = getTagValue(b.tags, 'd')!;
    relay.all = [b, receipt(d, 'feed', 1), receipt(d, 'play', 2), receipt(d, 'clean', 3)];
    renderRoom();
    await userEvent.click(await screen.findByTestId('room-journey'));
    const sheet = await screen.findByTestId('journey-sheet');
    // An adult: chapter 3 done too; the family chapter is the current one
    await waitFor(() => expect(within(sheet).getByTestId('chapter-first-steps')).toHaveAttribute('data-status', 'done'));
    expect(within(sheet).getByTestId('chapter-family')).toHaveAttribute('data-status', 'current');
    // Level 1: no way to adopt from here
    expect(within(sheet).queryByTestId('objective-second-egg-go')).toBeNull();
    // The first look on this device celebrates nothing
    expect(screen.queryByTestId('chapter-toast')).toBeNull();
  });
});

describe('a second egg', () => {
  it('opens at level 5, is checked again before signing, lands as an egg that does not hatch by itself', async () => {
    const b = brook({ care_streak: '2' });
    const d = getTagValue(b.tags, 'd')!;
    relay.all = [b, receipt(d, 'feed', 1), receipt(d, 'play', 2), receipt(d, 'clean', 3), profileEvent({ currentCompanion: d, has: [d], xp: 900 })];
    renderRoom();
    await userEvent.click(await screen.findByTestId('room-journey'));
    await userEvent.click(await screen.findByTestId('objective-second-egg-go'));
    const sheet = await screen.findByTestId('room-adopt-sheet');
    expect(within(sheet).getByText('A new egg', { selector: 'h2' })).toBeInTheDocument();
    expect(within(sheet).getByTestId('adoption-footnote')).toHaveTextContent(/incubation tasks/);
    await userEvent.click(within(sheet).getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    const egg = published(KIND_BLOBBI_STATE)[0];
    expect(getTagValue(egg.tags, 'stage')).toBe('egg');
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1));
    const profileTags = published(KIND_BLOBBONAUT_PROFILE)[0].tags;
    // The profile keeps the first Blobbi, adds the egg, keeps its XP
    expect(profileTags.filter((t) => t[0] === 'has').map((t) => t[1])).toEqual(expect.arrayContaining([d, getTagValue(egg.tags, 'd')]));
    expect(getTagValue(profileTags, 'xp')).toBe('900');
    // The new egg is in the room, and it waits for its incubation: no theatre, no hatch
    await waitFor(() => expect(screen.getByTestId('room-header-name')).toHaveTextContent('Egg'), { timeout: 3000 });
    await act(() => new Promise((r) => setTimeout(r, 2_000)));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
  }, 15_000);

  it('a level that is no longer there refuses, and nothing is signed', async () => {
    const b = brook({ care_streak: '2' });
    const d = getTagValue(b.tags, 'd')!;
    relay.all = [b, receipt(d, 'feed', 1), receipt(d, 'play', 2), receipt(d, 'clean', 3), profileEvent({ currentCompanion: d, has: [d], xp: 900 })];
    renderRoom();
    await userEvent.click(await screen.findByTestId('room-journey'));
    await userEvent.click(await screen.findByTestId('objective-second-egg-go'));
    const sheet = await screen.findByTestId('room-adopt-sheet');
    // Meanwhile the profile on the relays says level 1 (another app, a stale view here)
    relay.all = relay.all.filter((e) => e.kind !== KIND_BLOBBONAUT_PROFILE).concat(profileEvent({ currentCompanion: d, has: [d], xp: 10 }));
    await userEvent.click(within(sheet).getByTestId('adoption-adopt'));
    // Refused either by the room's own view of the level (when it has re-read) or by the adoption's fresh read at signing
    await waitFor(() => expect(sheet).toHaveTextContent(/allows 1 Blobbi/));
    expect(signCount).toBe(0);
    expect(relay.published).toHaveLength(0);
  });
});

describe('hatching in the room keeps the kit\'s rules', () => {
  it('an egg that is not the account\'s first never hatches by itself, and has nothing to hatch until its incubation is done', async () => {
    const elder = earlierBlobbiEvent();
    const egg = blobbiEvent('0000000002', { name: 'Later', stage: 'egg', visualGeneration: 'v3' });
    relay.all = [elder, egg, profileEvent({ currentCompanion: getTagValue(egg.tags, 'd'), has: [getTagValue(elder.tags, 'd')!, getTagValue(egg.tags, 'd')!] })];
    renderRoom();
    await waitFor(() => expect(screen.getByTestId('room-header-name')).toHaveTextContent('Later'));
    await act(() => new Promise((r) => setTimeout(r, 2_500)));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(relay.published).toHaveLength(0);
  }, 10_000);
});
