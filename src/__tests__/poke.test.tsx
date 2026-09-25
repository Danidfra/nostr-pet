/**
 * Tapping the Blobbi (M10.2): the reaction is the standalone's policy over
 * stage, state, condition and patience; it shows as a local gesture and a
 * face; the mode decides how much of it shows; nothing is ever written.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import Home from '@/pages/Home';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { pokeReaction, POKE_PATIENCE } from '@/features/home/personality';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const signer = { async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> { return { ...t, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) }; } };
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }) }));

const relay = { all: [] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)))));
const event = vi.fn(async () => {});
const pool = { query, event } as unknown as NPool;

function renderHome(settings: Partial<SceneSettings> = { walkSpeed: 1.2, idleEnabled: false }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={settings}>
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
const brook = (opts: { stage?: 'egg' | 'baby' | 'adult'; state?: 'active' | 'sleeping'; set?: Record<string, string> } = {}) =>
  blobbiEvent('0000000001', { name: 'Brook', stage: opts.stage ?? 'baby', state: opts.state ?? 'active', createdAt: NOW - 120, set: { hunger: '60', happiness: '60', hygiene: '60', energy: '70', health: '80', ...opts.set } });
const actor = () => screen.getByTestId('blobbi-actor');
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
const poke = () => userEvent.click(screen.getByTestId('blobbi-poke'));

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook()];
  event.mockClear();
  query.mockClear();
});

describe('the poke policy (pure)', () => {
  const stats = { hunger: 60, happiness: 60, hygiene: 60, energy: 70, health: 80 };
  it('an egg wiggles and has no face to change; a sleeper stirs', () => {
    expect(pokeReaction({ stage: 'egg', state: 'active', stats, recentPokes: 1 })).toMatchObject({ mood: 'egg', gesture: 'wiggle', expression: null });
    expect(pokeReaction({ stage: 'baby', state: 'sleeping', stats, recentPokes: 1 })).toMatchObject({ mood: 'asleep', gesture: 'stir', expression: null });
  });
  it('a well Blobbi is glad; a hungry or hurt one recoils, upset; a tired one is sleepy; too many pokes annoy, with a line', () => {
    expect(pokeReaction({ stage: 'baby', state: 'active', stats, recentPokes: 1 })).toMatchObject({ mood: 'glad', gesture: 'bounce', expression: 'happy' });
    expect(pokeReaction({ stage: 'baby', state: 'active', stats: { ...stats, hunger: 10 }, recentPokes: 1 })).toMatchObject({ mood: 'grumpy', gesture: 'recoil', expression: 'upset' });
    expect(pokeReaction({ stage: 'adult', state: 'active', stats: { ...stats, health: 5 }, recentPokes: 1 })).toMatchObject({ mood: 'grumpy' });
    expect(pokeReaction({ stage: 'baby', state: 'active', stats: { ...stats, energy: 10 }, recentPokes: 1 })).toMatchObject({ mood: 'sleepy', gesture: 'stir', expression: 'sleepy' });
    const annoyed = pokeReaction({ stage: 'baby', state: 'active', stats, recentPokes: POKE_PATIENCE.count });
    expect(annoyed).toMatchObject({ mood: 'annoyed', gesture: 'recoil', expression: 'upset' });
    expect(annoyed.line).toMatch(/Enough|Stop|Not now/);
    expect(pokeReaction({ stage: 'baby', state: 'active', stats: undefined, recentPokes: 1 })).toMatchObject({ mood: 'glad' });
  });
});

describe('poking in the home', () => {
  it('an egg wiggles when tapped, keeps its shell state, and nothing is written', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Shell', stage: 'egg', createdAt: NOW - 60 })];
    renderHome();
    await ready();
    expect(actor()).not.toHaveAttribute('data-gesture');
    await poke();
    expect(actor()).toHaveAttribute('data-gesture', 'wiggle');
    expect(actor()).toHaveAttribute('data-expression', 'neutral');
    expect(actor()).toHaveAttribute('data-egg-crack', 'none');
    await waitFor(() => expect(actor()).not.toHaveAttribute('data-gesture'), { timeout: 2000 });
    expect(event).not.toHaveBeenCalled();
  });

  it('a baby bounces and smiles; a second tap restarts the gesture; nothing is written', async () => {
    renderHome();
    await ready();
    await poke();
    expect(actor()).toHaveAttribute('data-gesture', 'bounce');
    expect(actor()).toHaveAttribute('data-expression', 'happy');
    const key = actor().getAttribute('data-gesture-key');
    await poke();
    expect(actor().getAttribute('data-gesture-key')).not.toBe(key);
    expect(event).not.toHaveBeenCalled();
  });

  it('in poor condition the reaction is a grumpy recoil, not a smile', async () => {
    relay.all = [brook({ set: { hunger: '8' } })];
    renderHome();
    await ready();
    await poke();
    expect(actor()).toHaveAttribute('data-gesture', 'recoil');
    expect(actor()).toHaveAttribute('data-expression', 'upset');
  });

  it('a sleeper only stirs: eyes stay shut, no face reaction', async () => {
    relay.all = [brook({ state: 'sleeping' })];
    renderHome();
    await ready();
    await poke();
    expect(actor()).toHaveAttribute('data-gesture', 'stir');
    expect(actor()).toHaveAttribute('data-expression', 'neutral');
    expect(actor()).toHaveAttribute('data-sleeping', 'true');
  });

  it('while walking the renderer owns the body: a poke shows a face but no gesture', async () => {
    renderHome();
    await ready();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 100, clientY: 520, detail: 1 });
    expect(actor()).toHaveAttribute('data-motion', 'walking');
    await poke();
    expect(actor()).toHaveAttribute('data-expression', 'happy');
    expect(actor()).not.toHaveAttribute('data-gesture');
    expect(event).not.toHaveBeenCalled();
  });

  it('too many pokes: a recoil, an upset face and a word', async () => {
    renderHome();
    await ready();
    for (let i = 0; i < POKE_PATIENCE.count; i += 1) await poke();
    expect(actor()).toHaveAttribute('data-gesture', 'recoil');
    expect(actor()).toHaveAttribute('data-expression', 'upset');
    expect(screen.getByTestId('speech-bubble')).toHaveTextContent(/Enough|Stop|Not now/);
    expect(event).not.toHaveBeenCalled();
    expect(query.mock.calls.length).toBeGreaterThan(0);
  });

  it('there is one ground shadow under the Blobbi and no second glow', async () => {
    renderHome();
    await ready();
    expect(actor().querySelectorAll('.scene-actor__shadow')).toHaveLength(1);
    expect(actor().querySelector('.scene-actor__ground, .home-ground')).toBeNull();
  });
});
