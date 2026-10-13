/**
 * The first Blobbi of an account, end to end against a relay double, on the
 * 2D home (where a first Blobbi is born since M13): a newcomer adopts an
 * egg, the theatre opens on it and the player's taps hatch it, with no
 * missions, through the kit's real hatch (one more kind 31124, same Blobbi, stage baby); the
 * V3 identity it was born with is on the baby unchanged; a reload shows the
 * baby and writes nothing; and none of it happens to an account that
 * already raised a Blobbi, whose eggs keep their missions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The 2D home (the default since M13), whatever this device has stored
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  BLOBBI_MIRRORED_COLOR_TAG_NAMES,
  BLOBBI_V3_ABSENT_TAG_NAMES,
  BLOBBI_V3_RETIRED_TAG_NAMES,
  KIND_BLOBBI_STATE,
  KIND_BLOBBONAUT_PROFILE,
  STAT_MAX,
  VISUAL_GENERATION_TAG,
  getTagValue,
  parseEvolutionContent,
  parseModernBlobbiEvent,
  serializeEvolutionContent,
  type BlobbiVisualGeneration,
} from '@blobbi-kit/core';
import { EVOLVE_MISSIONS, clearEvolutionFromStorage, createHatchMissions, planHatchTransition } from '@blobbi-kit/react';

import Home from '@/pages/Home';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PUBKEY, blobbiEvent, earlierBlobbiEvent, legacyShapeEvent, profileEvent } from '@/test/fixtures';
import { TAPS_TO_HATCH, TAP_SETTLE_MS } from '@/features/room/lib/hatch-theater';

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

// ─── Relay double ────────────────────────────────────────────────────────────

const relay = {
  all: [] as NostrEvent[],
  published: [] as NostrEvent[],
  publishFails: false,
  /** Reads of the whole 31124 collection (no `#d`) fail: the relays do not answer about the account. */
  collectionReadsFail: false,
  /** What only a collection read (no `#d`) turns up: a Blobbi the home has not seen. */
  onlyInCollectionReads: [] as NostrEvent[],
};
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
const isCollectionRead = (f: NostrFilter) => !!f.kinds?.includes(KIND_BLOBBI_STATE) && !f['#d'] && !f.ids;
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const collection = filters.some(isCollectionRead);
  if (collection && relay.collectionReadsFail) throw new Error('relays did not answer');
  const world = collection ? [...relay.all, ...relay.onlyInCollectionReads] : relay.all;
  const seen = new Set<string>();
  return world.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.publishFails) throw new Error('relay rejected the event');
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else if (ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => e.kind !== KIND_BLOBBONAUT_PROFILE), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

function renderHome({ reducedMotion = true }: { reducedMotion?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion, idleEnabled: false }}>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const D = 'blobbi-aaaaaaaaaaaa-0000000001';
const kind0 = (): NostrEvent => ({ id: 'k'.repeat(64), pubkey: PUBKEY, created_at: 1_700_000_000, kind: 0, tags: [], content: JSON.stringify({ name: 'Dana' }), sig: '0'.repeat(128) });
const published = (kind: number) => relay.published.filter((e) => e.kind === kind);
const actor = () => screen.getByTestId('blobbi-actor');
const drawing = () => actor().querySelector('[data-blobbi-renderer]') as HTMLElement;
/**
 * The creature as drawn, without its face of the moment: the newborn is
 * still beaming when the hatch reveals it, and a face is state, not identity.
 * Body, colours, horns, antennae, ears, tail and markings are all here.
 */
function creature(): string {
  const svg = drawing().querySelector('[data-blobbi-body-box] svg')!.cloneNode(true) as SVGElement;
  for (const part of svg.querySelectorAll('[data-part$="-eye"], [data-part="mouth"], [data-part$="-cheek"], [id$="-mouth"]')) part.remove();
  return svg.outerHTML;
}
const tagsNamed = (event: NostrEvent, names: readonly string[]) => event.tags.filter(([name]) => names.includes(name));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Longer than the lead before a first hatch plus the relay read that confirms it: if it were going to start, it has. */
const LONG_ENOUGH_MS = 2_000;
/** The whole first hatch under the test's reduced-motion timings, with room. */
const HATCH = { timeout: 8_000 };

/** An egg as adoption leaves it: incubating, with the hatch missions untouched (or partly done). */
function incubatingEgg(visualGeneration: BlobbiVisualGeneration, interactions = 0): NostrEvent {
  const missions = createHatchMissions().map((m) => (m.id === 'interactions' && 'count' in m ? { ...m, count: interactions } : m));
  const base = blobbiEvent('0000000001', { name: 'Shell', stage: 'egg', visualGeneration, set: { progression_state: 'incubating' }, extra: [['progression_started_at', '1757000100']] });
  return { ...base, content: serializeEvolutionContent('', missions) };
}

/** The theatre (M12.3, on the 2D home since M13): it opens by itself on the first egg; nothing is written until the taps. */
const theaterOpens = () => screen.findByTestId('hatch-theater', {}, HATCH);
/** The player's taps on the egg in the theatre, each a moment after the last. */
async function tapTheShell(times: number = TAPS_TO_HATCH) {
  for (let i = 0; i < times; i++) {
    await userEvent.click(screen.getByTestId('hatch-theater-egg'));
    await act(() => pause(TAP_SETTLE_MS + 30));
  }
}
/** The first hatch, as the player does it: the theatre opens by itself, nothing written while it waits, four taps. */
async function tapHatch() {
  const writes = relay.published.length;
  await theaterOpens();
  await act(() => pause(500));
  expect(relay.published).toHaveLength(writes);
  await tapTheShell();
}
const theaterGone = () => waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), HATCH);

async function adoptFromScratch(name = 'Pip') {
  renderHome();
  // No Blobbi yet: the egg itself, straight away (M12.3)
  await screen.findByTestId('adoption-preview');
  await userEvent.type(screen.getByTestId('adoption-name'), name);
  await userEvent.click(screen.getByTestId('adoption-adopt'));
  await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
  return published(KIND_BLOBBI_STATE)[0];
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [kind0()];
  relay.published = [];
  relay.publishFails = false;
  relay.collectionReadsFail = false;
  relay.onlyInCollectionReads = [];
  signCount = 0;
  window.localStorage.clear();
  clearEvolutionFromStorage(PUBKEY, D);
  query.mockClear();
  event.mockClear();
});

describe('A fresh account: the first Blobbi is ready to hatch at once, and the player begins it', () => {
  it('adopt → the egg on its nest in the 2D home → the theatre opens, four taps → the hatch runs with no missions → a V3 baby, same identity', { timeout: 20_000 }, async () => {
    const egg = await adoptFromScratch();
    expect(getTagValue(egg.tags, 'stage')).toBe('egg');
    expect(getTagValue(egg.tags, VISUAL_GENERATION_TAG)).toBe('v3');

    // First it is simply an egg, at home.
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
    expect(actor()).toHaveAttribute('data-egg-crack', 'none');
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);

    // The theatre opens on it and waits for the player: nothing is written until the last tap.
    await tapHatch();
    // The hatch: said in words while it runs, and ONE more kind 31124.
    const caption = screen.getByTestId('hatch-theater-caption');
    expect(caption).toHaveAttribute('role', 'status');
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(2), HATCH);
    const baby = published(KIND_BLOBBI_STATE)[1];

    // A real lifecycle transition: the same Blobbi, a baby now, as the kit's hatch writes it.
    expect(getTagValue(baby.tags, 'd')).toBe(getTagValue(egg.tags, 'd'));
    expect(getTagValue(baby.tags, 'stage')).toBe('baby');
    expect(getTagValue(baby.tags, 'state')).toBe('active');
    for (const stat of ['hunger', 'happiness', 'health', 'hygiene', 'energy']) expect(getTagValue(baby.tags, stat)).toBe(String(STAT_MAX));
    expect(getTagValue(baby.tags, 'progression_state')).toBe('evolving');
    expect(parseEvolutionContent(baby.content).map((m) => m.id).sort()).toEqual(EVOLVE_MISSIONS.map((m) => m.id).sort());
    // Exactly the kit's own plan for this egg at that moment, finished the way every publish here is.
    const now = Number(getTagValue(baby.tags, 'last_interaction'));
    const plan = planHatchTransition({ companion: parseModernBlobbiEvent(egg)!, content: egg.content, allTags: egg.tags, profileAllTags: [] }, now);
    expect(baby.tags).toEqual(finalizeTemplate(plan.event, baby.created_at).tags);
    expect(baby.content).toBe(plan.event.content);

    // The V3 identity is the egg's: its address (the same d) under Algorithm 1; no algorithm, colour, trait or seed tag on either.
    expect(tagsNamed(baby, ['d'])).toEqual(tagsNamed(egg, ['d']));
    expect(tagsNamed(baby, BLOBBI_V3_ABSENT_TAG_NAMES)).toEqual([]);
    expect(tagsNamed(egg, BLOBBI_V3_ABSENT_TAG_NAMES)).toEqual([]);
    for (const name of ['name', VISUAL_GENERATION_TAG]) expect(tagsNamed(baby, [name])).toEqual(tagsNamed(egg, [name]));
    expect(getTagValue(baby.tags, VISUAL_GENERATION_TAG)).toBe('v3');
    expect(parseModernBlobbiEvent(baby)!.v3Identity).toEqual(parseModernBlobbiEvent(egg)!.v3Identity);
    expect(parseModernBlobbiEvent(baby)!.v3Identity!.missing).toEqual([]);

    // The home shows what the event says: a V3 baby, and the ceremony ends.
    await theaterGone();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'baby'), HATCH);
    expect(drawing()).toHaveAttribute('data-blobbi-generation', 'v3');
    expect(actor()).toHaveAttribute('data-stage', 'baby');
    expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Pip: Baby/);

    // Nothing else was written: the egg, its note in the profile, the hatch.
    expect(relay.published.map((e) => e.kind)).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_BLOBBI_STATE]);
    await pause(LONG_ENOUGH_MS);
    expect(relay.published).toHaveLength(3);
  });

  it('a reload after the hatch shows the same baby and writes nothing', { timeout: 20_000 }, async () => {
    const egg = await adoptFromScratch();
    await tapHatch();
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(2), HATCH);
    await theaterGone();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'baby'), HATCH);
    const before = creature();
    const baby = published(KIND_BLOBBI_STATE)[1];

    // A new visit: nothing kept but what the relays hold.
    document.body.innerHTML = '';
    window.localStorage.clear();
    clearEvolutionFromStorage(PUBKEY, getTagValue(egg.tags, 'd')!);
    renderHome();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'baby'));
    expect(drawing()).toHaveAttribute('data-blobbi-generation', 'v3');
    expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Pip: Baby/);
    // The same creature: the drawing is the one the hatch revealed, from the same event.
    expect(relay.all.find((e) => e.kind === KIND_BLOBBI_STATE)).toBe(baby);
    await waitFor(() => expect(creature()).toBe(before));

    await pause(LONG_ENOUGH_MS);
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(relay.published).toHaveLength(3);
    // And it is on the normal path now: growing up is the evolve missions'.
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    expect(await screen.findByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'evolve-tasks');
    expect(screen.queryByTestId('lifecycle-first-blobbi')).toBeNull();
  });
});

describe('The rule is about the account, not about the generation', () => {
  for (const generation of ['v1', 'v2'] as const) {
    it(`a lone ${generation.toUpperCase()} egg (an account from before V3, missions half done) hatches the same way and stays ${generation.toUpperCase()}`, { timeout: 20_000 }, async () => {
      const egg = incubatingEgg(generation, 3);
      relay.all = [kind0(), egg, profileEvent({ has: [D], currentCompanion: D })];
      renderHome();
      await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
      await tapHatch();
      await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1), HATCH);
      const baby = published(KIND_BLOBBI_STATE)[0];
      expect(getTagValue(baby.tags, 'stage')).toBe('baby');
      expect(getTagValue(baby.tags, 'd')).toBe(D);
      expect(getTagValue(baby.tags, 'seed')).toBe(getTagValue(egg.tags, 'seed'));
      // Its generation is said the way it always was (V1: not at all), and nothing of V3 is added.
      expect(tagsNamed(baby, [VISUAL_GENERATION_TAG])).toEqual(tagsNamed(egg, [VISUAL_GENERATION_TAG]));
      expect(tagsNamed(baby, BLOBBI_V3_RETIRED_TAG_NAMES)).toEqual([]);
      // Its colour tags are still the seed's mirrors, as on the egg.
      expect(tagsNamed(baby, BLOBBI_MIRRORED_COLOR_TAG_NAMES)).toEqual(tagsNamed(egg, BLOBBI_MIRRORED_COLOR_TAG_NAMES));
      await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'baby'), HATCH);
      expect(parseModernBlobbiEvent(baby)!.visualGeneration).toBe(generation);
      expect(relay.published).toHaveLength(1);
    });
  }
});

describe('An account that already raised a Blobbi: a later egg keeps the normal rules', () => {
  it('does not hatch by itself, shows its missions, and Hatch stays locked until they are done', { timeout: 20_000 }, async () => {
    relay.all = [kind0(), incubatingEgg('v3', 3), earlierBlobbiEvent(), profileEvent({ has: [D], currentCompanion: D })];
    renderHome();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
    await pause(LONG_ENOUGH_MS);
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(relay.published).toHaveLength(0);
    expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg');
    expect(screen.queryByTestId('action-hatch')).toBeNull();

    await userEvent.click(screen.getByTestId('blobbi-chip'));
    const panel = await screen.findByTestId('lifecycle-panel');
    expect(panel).toHaveAttribute('data-next', 'incubate');
    expect(panel).not.toHaveAttribute('data-first-blobbi');
    expect(screen.queryByTestId('lifecycle-first-blobbi')).toBeNull();
    expect(screen.getByTestId('lifecycle-task-interactions')).toHaveTextContent('3/7');
    expect(screen.getByTestId('lifecycle-hatch')).toBeDisabled();
    expect(screen.getByTestId('lifecycle-stop-incubation')).toBeEnabled();
  });

  it('a hatched Blobbi the home did not show (a legacy one) is found by the relay read: no shortcut', { timeout: 20_000 }, async () => {
    // The home's collection is modern-only, so it holds the egg alone; the account's history says otherwise.
    relay.all = [kind0(), incubatingEgg('v3'), profileEvent({ has: [D], currentCompanion: D })];
    renderHome();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
    relay.onlyInCollectionReads = [legacyShapeEvent()];
    // The player taps; the relays are read right before any write, and they say this is not the first Blobbi
    await tapHatch();
    expect(await screen.findByTestId('hatch-theater-failed', {}, HATCH)).toBeInTheDocument();
    await pause(LONG_ENOUGH_MS);
    expect(relay.published).toHaveLength(0);
    await userEvent.click(screen.getByTestId('hatch-theater-later'));
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg');
    // The answer stands: the egg is a later egg from here on, with its missions.
    await waitFor(() => expect(screen.queryByTestId('action-hatch')).toBeNull());
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    expect(await screen.findByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'incubate');
    expect(screen.getByTestId('lifecycle-hatch')).toBeDisabled();
  });
});

describe('When the relays do not cooperate', () => {
  it('relays that do not answer about the account: nothing is assumed, nothing is written', { timeout: 20_000 }, async () => {
    relay.all = [kind0(), incubatingEgg('v3'), profileEvent({ has: [D], currentCompanion: D })];
    renderHome();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
    relay.collectionReadsFail = true;
    await tapHatch();
    // Every retry of the read, then the theatre says the egg could not be confirmed; nothing written
    expect(await screen.findByTestId('hatch-theater-failed', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(relay.published).toHaveLength(0);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'egg');
    // Still its first Blobbi: Try again works once the relays answer.
    relay.collectionReadsFail = false;
    await userEvent.click(screen.getByTestId('hatch-theater-retry'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1), HATCH);
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'baby'), HATCH);
  });

  it('an egg whose account has no Blobbonaut profile on the relays is left alone: the hatch could not land', { timeout: 20_000 }, async () => {
    relay.all = [kind0(), incubatingEgg('v3')];
    renderHome();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
    await pause(LONG_ENOUGH_MS);
    expect(relay.published).toHaveLength(0);
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
    expect(screen.queryByTestId('ceremony-error')).toBeNull();
  });

  it('a hatch that does not land leaves the egg an egg, says so, is not retried by itself, and can be retried by hand', { timeout: 20_000 }, async () => {
    relay.all = [kind0(), incubatingEgg('v3'), profileEvent({ has: [D], currentCompanion: D })];
    relay.publishFails = true;
    renderHome();
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg'));
    await tapHatch();
    expect(await screen.findByTestId('hatch-theater-failed', {}, HATCH)).toHaveTextContent(/relay rejected|did not hatch/);
    expect(screen.getByTestId('hatch-theater-actor')).toHaveAttribute('data-stage', 'egg');
    const attempts = event.mock.calls.length;
    expect(attempts).toBe(1);
    await pause(LONG_ENOUGH_MS);
    expect(event.mock.calls.length).toBe(attempts);

    // Later: the egg stays an egg on its nest, and the dock's Hatch! opens the theatre again, by hand
    await userEvent.click(screen.getByTestId('hatch-theater-later'));
    expect(drawing()).toHaveAttribute('data-blobbi-stage', 'egg');
    relay.publishFails = false;
    await userEvent.click(screen.getByTestId('action-hatch'));
    await theaterOpens();
    await tapTheShell();
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1), HATCH);
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'stage')).toBe('baby');
    await waitFor(() => expect(drawing()).toHaveAttribute('data-blobbi-stage', 'baby'), HATCH);
  });
});

// The shell cracking on screen, with and without motion, is the theatre's: HatchTheater.test.tsx and
// m13-born-in-2d.test.tsx. The home's own hatch ceremony no longer plays a hatch (the evolution keeps it).
