/**
 * First run, end to end: a newcomer understands, adopts an egg, and sees it
 * in the room. The egg is the kit's (canonical d, seed pinned to created_at,
 * incubating with the hatch missions); the profile is created or updated
 * with everything preserved; a Blobbi that appeared meanwhile is never
 * duplicated; failures are honest and retryable without a new identity.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, NEW_BLOBBI_VISUAL_GENERATION, VISUAL_GENERATION_TAG, deriveBlobbiSeedV1, getSelectedBlobbiKey, getTagValue, getTagValues, parseModernBlobbiEvent } from '@blobbi-kit/core';
import { HATCH_MISSIONS } from '@blobbi-kit/react';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PUBKEY, blobbiEvent, profileEvent } from '@/test/fixtures';

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

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], failKinds: new Set<number>() };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.ids && !f.ids.includes(event.id)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    const name = key.slice(1);
    if (!event.tags.some((t) => t[0] === name && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.failKinds.has(ev.kind)) throw new Error(`relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => e.kind !== KIND_BLOBBONAUT_PROFILE), ev];
  else relay.all.push(ev);
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

const kind0 = (): NostrEvent => ({ id: 'k'.repeat(64), pubkey: PUBKEY, created_at: 1_700_000_000, kind: 0, tags: [], content: JSON.stringify({ name: 'Dana' }), sig: '0'.repeat(128) });
const published = (kind: number) => relay.published.filter((e) => e.kind === kind);

async function emptyHome() {
  renderHome();
  return screen.findByTestId('adoption-intro');
}

async function reachTheEgg() {
  await emptyHome();
  await userEvent.click(screen.getByTestId('adoption-start'));
  const preview = await screen.findByTestId('adoption-preview');
  await waitFor(() => expect(preview.querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'egg'));
  return preview.getAttribute('data-d')!;
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [kind0()];
  relay.published = [];
  relay.failKinds = new Set();
  signCount = 0;
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('First run', () => {
  it('signed out: says what a Blobbi is before asking for anything', async () => {
    currentUser.user = undefined;
    renderHome();
    expect(await screen.findByRole('list', { name: /what a blobbi is/i })).toHaveTextContent(/hatches from an egg/);
    expect(screen.getByTestId('onboarding-create')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-existing')).toBeInTheDocument();
  });

  it('adopts: intro, a unique egg with a name, the 31124 then one 11125, and the egg in the room', async () => {
    const d = await reachTheEgg();
    expect(d).toMatch(/^blobbi-aaaaaaaaaaaa-[0-9a-f]{10}$/);
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(0);

    await userEvent.type(screen.getByTestId('adoption-name'), 'Pip');
    await userEvent.click(screen.getByTestId('adoption-adopt'));

    // The egg: the kit's, incubating, seed pinned to the pinned created_at, the preview's identity.
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    const egg = published(KIND_BLOBBI_STATE)[0];
    expect(getTagValue(egg.tags, 'd')).toBe(d);
    expect(getTagValue(egg.tags, 'name')).toBe('Pip');
    expect(getTagValue(egg.tags, 'stage')).toBe('egg');
    expect(getTagValue(egg.tags, 'progression_state')).toBe('incubating');
    expect(getTagValue(egg.tags, 'seed')).toBe(deriveBlobbiSeedV1(PUBKEY, d, egg.created_at));
    expect(getTagValue(egg.tags, 'client')).toBe('Blobbi');
    expect(getTagValue(egg.tags, 'published_at')).toBe(String(egg.created_at));
    const parsed = parseModernBlobbiEvent(egg)!;
    expect(parsed.evolution.map((m) => m.id).sort()).toEqual(HATCH_MISSIONS.map((m) => m.id).sort());
    // Born V3: this app's creation rule (the kit's own default is still V2), carried on the event from the
    // first publish with its whole explicit identity, and drawn as such.
    expect(NEW_BLOBBI_VISUAL_GENERATION).toBe('v2');
    expect(getTagValue(egg.tags, VISUAL_GENERATION_TAG)).toBe('v3');
    expect(parsed.visualGeneration).toBe('v3');
    expect(parsed.v3Identity?.missing).toEqual([]);
    expect(parsed.v3Identity?.seed).toBe(getTagValue(egg.tags, 'seed'));
    await waitFor(() => expect(screen.getByTestId('blobbi-actor').querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-generation', 'v3'));
    // The egg in the room is the procedural egg of this identity.
    expect(screen.getByTestId('blobbi-actor').querySelector('[data-blobbi-body-box] svg')).toHaveAttribute('data-blobbi-stage', 'egg');

    // Exactly one profile, created from the kit base tags with the kind 0 name, after the egg.
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1));
    const profile = published(KIND_BLOBBONAUT_PROFILE)[0];
    expect(relay.published.indexOf(egg)).toBeLessThan(relay.published.indexOf(profile));
    expect(getTagValue(profile.tags, 'name')).toBe('Dana');
    expect(getTagValues(profile.tags, 'has')).toEqual([d]);
    expect(getTagValue(profile.tags, 'current_companion')).toBe(d);
    expect(getTagValue(profile.tags, 'blobbi_onboarding_done')).toBe('false');
    expect(relay.published).toHaveLength(2);

    // Home: the egg is here, selected on this device, with its missions one tap away.
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Pip: Egg/));
    expect(window.localStorage.getItem(getSelectedBlobbiKey(PUBKEY))).toBe(d);
    expect(document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]')).toHaveAttribute('data-blobbi-stage', 'egg');
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    expect(await screen.findByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'incubate');
  });

  it('keeps an existing profile whole: has merged, current_companion set, unknown tags and content kept', async () => {
    const existing = profileEvent({ has: ['blobbi-aaaaaaaaaaaa-0000000009'], currentCompanion: 'blobbi-aaaaaaaaaaaa-0000000009', xp: 120 });
    existing.tags.push(['custom_unknown', 'keep']);
    existing.content = '{"missions":{}}';
    relay.all = [kind0(), existing];
    const d = await reachTheEgg();
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1));
    const profile = published(KIND_BLOBBONAUT_PROFILE)[0];
    expect(getTagValues(profile.tags, 'has').sort()).toEqual(['blobbi-aaaaaaaaaaaa-0000000009', d].sort());
    expect(getTagValue(profile.tags, 'current_companion')).toBe(d);
    expect(getTagValue(profile.tags, 'xp')).toBe('120');
    expect(getTagValue(profile.tags, 'custom_unknown')).toBe('keep');
    expect(getTagValue(profile.tags, 'name')).toBe('Tester');
    expect(profile.content).toBe('{"missions":{}}');
    expect(getTagValue(egg().tags, 'name')).toBe('Egg');
  });

  it('never mints a second first Blobbi: one that appeared meanwhile is found by the fresh read and brought home', async () => {
    await reachTheEgg();
    // Another device adopted while this screen was open.
    relay.all.push(blobbiEvent('0000000042', { name: 'Elsewhere', stage: 'baby', createdAt: 1_790_000_000 }));
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    // The fresh read finds it, nothing is published, and the collection refresh brings it home.
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Elsewhere/));
    expect(relay.published).toHaveLength(0);
    expect(signCount).toBe(0);
  });

  it('a refused egg is an error and a retry with the same identity; nothing else is written', async () => {
    relay.failKinds = new Set([KIND_BLOBBI_STATE]);
    const d = await reachTheEgg();
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    expect(await screen.findByTestId('adoption-error')).toHaveTextContent(/refused kind 31124/);
    expect(relay.published).toHaveLength(0);
    expect(screen.getByTestId('adoption-preview')).toHaveAttribute('data-d', d);

    relay.failKinds = new Set();
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'd')).toBe(d);
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Egg: Egg/));
  });

  it('a refused profile write still leaves the egg real and shown; no second egg', async () => {
    relay.failKinds = new Set([KIND_BLOBBONAUT_PROFILE]);
    const d = await reachTheEgg();
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Egg: Egg/));
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'd')).toBe(d);
    expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(0);
  });

  it('validates the name and is keyboard-usable: Enter in the name field adopts', async () => {
    await reachTheEgg();
    const input = screen.getByTestId('adoption-name');
    await userEvent.type(input, 'x'.repeat(25));
    expect(screen.getByTestId('adoption-name-error')).toHaveTextContent(/under 24/);
    expect(screen.getByTestId('adoption-adopt')).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'Mo{Enter}');
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'name')).toBe('Mo');
  });
});

function egg(): NostrEvent {
  return published(KIND_BLOBBI_STATE)[0];
}
