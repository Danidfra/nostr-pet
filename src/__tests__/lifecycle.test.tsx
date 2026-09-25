/**
 * The lifecycle end to end against a relay double: an incubating egg with
 * the canonical missions, hatching through the ceremony (one publish, same
 * d and seed, stage baby), a failed hatch that leaves the egg an egg, the
 * exclusive ceremony mode, evolution to the seed's adult form, and a care
 * action that counts towards the missions inside its own republish.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  KIND_BLOBBI_STATE,
  KIND_BLOBBONAUT_PROFILE,
  BLOBBONAUT_PROFILE_KINDS,
  deriveAdultFormFromSeed,
  getTagValue,
  parseEvolutionContent,
  serializeEvolutionContent,
} from '@blobbi-kit/core';
import { KIND_COLOR_MOMENT, KIND_PROFILE_METADATA, KIND_THEME_DEFINITION, clearEvolutionFromStorage, createEvolveMissions, createHatchMissions } from '@blobbi-kit/react';

import Home from '@/pages/Home';
import { chooseCare } from '@/test/care-ui';
import { SceneSettingsProvider } from '@/features/home/scene';
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

// ─── Relay double: any kind, filtered by kinds / authors / #d ────────────────

const relay = { events: [] as NostrEvent[], published: [] as NostrEvent[], publishFails: false };

function matches(e: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(e.kind)) return false;
  if (f.authors && !f.authors.includes(e.pubkey)) return false;
  const ds = f['#d'];
  if (ds && !ds.includes(getTagValue(e.tags, 'd') ?? '')) return false;
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const out: NostrEvent[] = [];
  for (const f of filters) for (const e of relay.events) if (matches(e, f) && !out.includes(e)) out.push(e);
  return out;
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.publishFails) throw new Error('relay rejected the event');
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.events = [...relay.events.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.events = [...relay.events.filter((e) => !(BLOBBONAUT_PROFILE_KINDS as readonly number[]).includes(e.kind)), ev];
  else relay.events = [...relay.events, ev];
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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const D = 'blobbi-aaaaaaaaaaaa-0000000001';

function authored(kind: number, id: string, tags: string[][] = []): NostrEvent {
  return { id: id.padEnd(64, '0'), pubkey: PUBKEY, created_at: NOW - 10, kind, tags, content: '', sig: '0'.repeat(128) };
}

function incubatingEgg(interactions: number): NostrEvent {
  const missions = createHatchMissions().map((m) => (m.id === 'interactions' && 'count' in m ? { ...m, count: interactions } : m));
  const base = blobbiEvent('0000000001', { name: 'Shell', stage: 'egg', createdAt: NOW - 3_600, set: { progression_state: 'incubating' }, extra: [['progression_started_at', String(NOW - 3_000)]] });
  return { ...base, content: serializeEvolutionContent('', missions) };
}

function evolvingBaby(interactions: number): NostrEvent {
  const missions = createEvolveMissions().map((m) => (m.id === 'interactions' && 'count' in m ? { ...m, count: interactions } : m));
  const base = blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: NOW - 120, set: { progression_state: 'evolving' }, extra: [['progression_started_at', String(NOW - 100)]] });
  return { ...base, content: serializeEvolutionContent('', missions) };
}

const hatchMissionEvents = () => [authored(KIND_THEME_DEFINITION, 'theme1', [['d', 'my-theme']]), authored(KIND_COLOR_MOMENT, 'moment1')];
const evolveMissionEvents = () => [
  ...['t1', 't2', 't3'].map((id) => authored(KIND_THEME_DEFINITION, id, [['d', id]])),
  ...['c1', 'c2', 'c3'].map((id) => authored(KIND_COLOR_MOMENT, id)),
  authored(KIND_PROFILE_METADATA, 'meta1'),
];

const published31124 = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);
const renderer = () => document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]') as HTMLElement;
const actor = () => screen.getByTestId('blobbi-actor');

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.events = [];
  relay.published = [];
  relay.publishFails = false;
  signCount = 0;
  query.mockClear();
  event.mockClear();
  clearEvolutionFromStorage(PUBKEY, D);
});

/** The lifecycle panel lives in the Blobbi's sheet. Opens it and returns the panel. */
async function ready() {
  await screen.findByTestId('blobbi-chip');
  if (!screen.queryByTestId('blobbi-sheet')) await userEvent.click(screen.getByTestId('blobbi-chip'));
  await screen.findByTestId('lifecycle-panel');
  return screen.getByTestId('lifecycle-panel');
}
async function closeSheet() {
  if (screen.queryByTestId('blobbi-sheet')) await userEvent.keyboard('{Escape}');
}

describe('Lifecycle: egg', () => {
  it('an incubating egg draws as an egg, lists the canonical missions, and is not ready until they are done', async () => {
    relay.events = [incubatingEgg(3), profileEvent({ has: [D], currentCompanion: D })];
    renderHome();
    const panel = await ready();
    expect(renderer()).toHaveAttribute('data-blobbi-stage', 'egg');
    expect(actor()).toHaveAttribute('data-egg-crack', 'none');
    expect(panel).toHaveAttribute('data-next', 'incubate');
    expect(screen.getByTestId('lifecycle-task-interactions')).toHaveTextContent('3/7');
    expect(screen.getByTestId('lifecycle-hatch')).toBeDisabled();
    // An egg cannot be called around.
    expect(screen.getByTestId('scene-floor')).toBeDisabled();
    expect(actor()).toHaveAttribute('data-x', '0.500');
  });

  it('with every mission done the shell is heavily cracked and Hatch is offered', async () => {
    relay.events = [incubatingEgg(7), profileEvent({ has: [D], currentCompanion: D }), ...hatchMissionEvents()];
    renderHome();
    const panel = await ready();
    await waitFor(() => expect(panel).toHaveAttribute('data-next', 'hatch'));
    expect(actor()).toHaveAttribute('data-egg-crack', 'heavy');
    expect(screen.getByTestId('lifecycle-hatch')).toBeEnabled();
  });

  it('hatching publishes one kind 31124 with the same d and seed, stage baby, and reveals a baby', async () => {
    const egg = incubatingEgg(7);
    relay.events = [egg, profileEvent({ has: [D], currentCompanion: D }), ...hatchMissionEvents()];
    renderHome();
    const panel = await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-hatch')).toBeEnabled());

    await userEvent.click(screen.getByTestId('lifecycle-hatch')); // closes the sheet and starts the ceremony
    expect(screen.queryByTestId('blobbi-sheet')).toBeNull();
    await userEvent.click(screen.getByTestId('action-hatch')); // a second press is ignored (disabled during the ceremony)
    await waitFor(() => expect(published31124()).toHaveLength(1), { timeout: 3_000 });
    const baby = published31124()[0];
    expect(getTagValue(baby.tags, 'd')).toBe(D);
    expect(getTagValue(baby.tags, 'seed')).toBe(getTagValue(egg.tags, 'seed'));
    expect(getTagValue(baby.tags, 'stage')).toBe('baby');
    expect(getTagValue(baby.tags, 'progression_state')).toBe('evolving');
    expect(parseEvolutionContent(baby.content).map((m) => m.id)).toContain('interactions');

    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby'));
    expect(published31124()).toHaveLength(1);
    await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'evolve-tasks'));
    expect(screen.getByTestId('stage-badge')).toHaveTextContent('Baby');
    void panel;
  });

  it('a hatch whose publish fails leaves the egg an egg and says so', async () => {
    relay.events = [incubatingEgg(7), profileEvent({ has: [D], currentCompanion: D }), ...hatchMissionEvents()];
    relay.publishFails = true;
    renderHome();
    const panel = await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-hatch')).toBeEnabled());
    await userEvent.click(screen.getByTestId('lifecycle-hatch'));
    await waitFor(() => expect(screen.getByTestId('ceremony-error')).toHaveTextContent(/relay rejected/), { timeout: 3_000 });
    expect(renderer()).toHaveAttribute('data-blobbi-stage', 'egg');
    expect(published31124()).toHaveLength(0);
    void panel;
    await ready();
    expect(screen.getByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'hatch');
    expect(screen.getByTestId('lifecycle-hatch')).toBeEnabled(); // the ceremony is over; try again is allowed
  });

  it('during the ceremony the home is exclusive: no care, no taps, one write', async () => {
    relay.events = [incubatingEgg(7), profileEvent({ has: [D], currentCompanion: D }), ...hatchMissionEvents()];
    let release: (() => void) | null = null;
    event.mockImplementationOnce(async (ev: NostrEvent) => {
      await new Promise<void>((r) => {
        release = r;
      });
      relay.published.push(ev);
      relay.events = [...relay.events.filter((e) => e.kind !== KIND_BLOBBI_STATE), ev];
    });
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-hatch')).toBeEnabled());
    await userEvent.click(screen.getByTestId('lifecycle-hatch'));
    await waitFor(() => expect(event).toHaveBeenCalledTimes(1), { timeout: 3_000 });
    // Publishing is in flight: everything else waits.
    expect(screen.getByTestId('care-clean')).toBeDisabled();
    expect(screen.getByTestId('care-rest')).toBeDisabled();
    expect(screen.getByTestId('scene-floor')).toBeDisabled();
    expect(screen.getByTestId('blobbi-poke')).toBeDisabled();
    expect(screen.getByTestId('action-hatch')).toBeDisabled();
    expect(screen.getByTestId('scene-object-door').querySelector('button')).toBeDisabled();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 100, clientY: 400, detail: 1 });
    expect(actor()).toHaveAttribute('data-x', '0.500');
    release!();
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby'));
    expect(event).toHaveBeenCalledTimes(1);
  });

  it('cleaning an incubating egg counts towards the missions inside the care republish', async () => {
    relay.events = [incubatingEgg(6), profileEvent({ has: [D], currentCompanion: D })];
    renderHome();
    await ready();
    expect(screen.getByTestId('lifecycle-task-interactions')).toHaveTextContent('6/7');
    await closeSheet();
    await chooseCare('clean');
    await waitFor(() => expect(published31124()).toHaveLength(1));
    const missions = parseEvolutionContent(published31124()[0].content);
    const interactions = missions.find((m) => m.id === 'interactions');
    expect(interactions && 'count' in interactions ? interactions.count : undefined).toBe(7);
    expect(getTagValue(published31124()[0].tags, 'stage')).toBe('egg');
    await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-task-interactions')).toHaveAttribute('data-completed', 'true'));
  });
});

describe('Lifecycle: baby → adult', () => {
  it('a baby that is not evolving can start; an evolving baby with every mission done evolves into the seed\'s adult form', async () => {
    relay.events = [blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', createdAt: NOW - 120 }), profileEvent({ has: [D], currentCompanion: D })];
    renderHome();
    let panel = await ready();
    expect(panel).toHaveAttribute('data-next', 'start-evolution');
    await userEvent.click(screen.getByTestId('lifecycle-start-evolution'));
    await waitFor(() => expect(published31124()).toHaveLength(1));
    expect(getTagValue(published31124()[0].tags, 'progression_state')).toBe('evolving');
    await waitFor(() => expect(screen.getByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'evolve-tasks'));

    // Now with every mission done (a fresh session: the store from the first half is gone).
    relay.events = [evolvingBaby(21), profileEvent({ has: [D], currentCompanion: D }), ...evolveMissionEvents()];
    relay.published = [];
    clearEvolutionFromStorage(PUBKEY, D);
    document.body.innerHTML = '';
    renderHome();
    panel = await ready();
    await waitFor(() => expect(panel).toHaveAttribute('data-next', 'evolve'));
    const seed = getTagValue(evolvingBaby(21).tags, 'seed')!;
    await userEvent.click(screen.getByTestId('lifecycle-evolve')); // closes the sheet, starts the ceremony
    await waitFor(() => expect(published31124()).toHaveLength(1), { timeout: 3_000 });
    const adult = published31124()[0];
    expect(getTagValue(adult.tags, 'd')).toBe(D);
    expect(getTagValue(adult.tags, 'seed')).toBe(seed);
    expect(getTagValue(adult.tags, 'stage')).toBe('adult');
    expect(getTagValue(adult.tags, 'adult_type')).toBe(deriveAdultFormFromSeed(seed));
    expect(getTagValue(adult.tags, 'progression_state')).toBe('none');
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'adult'));
    await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'grown'));
  });

  it('a failed evolve keeps the baby a baby', async () => {
    relay.events = [evolvingBaby(21), profileEvent({ has: [D], currentCompanion: D }), ...evolveMissionEvents()];
    relay.publishFails = true;
    renderHome();
    await ready();
    await waitFor(() => expect(screen.getByTestId('lifecycle-evolve')).toBeEnabled());
    await userEvent.click(screen.getByTestId('lifecycle-evolve'));
    await waitFor(() => expect(screen.getByTestId('ceremony-error')).toHaveTextContent(/relay rejected/), { timeout: 3_000 });
    expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby');
    expect(published31124()).toHaveLength(0);
  });
});
