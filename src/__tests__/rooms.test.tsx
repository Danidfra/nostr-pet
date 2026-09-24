/**
 * Rooms: device-local UI state. Moving between them publishes nothing, the
 * Blobbi keeps its identity and its kind 31124 state, the bed lives in the
 * bedroom and rest goes there, a sleeper is always in bed, and a swipe is
 * never a tap.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { BED_SLEEP_SPOT, HOME_SPOT, SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { roomById, roomStorageKey } from '@/features/home/rooms';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { OFFICIAL_APPLE, inventoryEvent, officialCareDefinition, resetInventoryFixtureIds } from '@/test/inventory-fixtures';

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
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

const FAST: Partial<SceneSettings> = { walkSpeed: 4, idleEnabled: false };

function renderHome(settings: Partial<SceneSettings> = FAST) {
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
const BROOK_D = 'blobbi-aaaaaaaaaaaa-0000000001';
const brook = (state: 'active' | 'sleeping' = 'active') => blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state, createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });

const actor = () => screen.getByTestId('blobbi-actor');
const scene = () => screen.getByTestId('home-scene');
const at = (a: HTMLElement) => ({ x: Number(a.getAttribute('data-x')), y: Number(a.getAttribute('data-y')) });

function giveSceneABox() {
  screen.getByTestId('room-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
}
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
  return actor();
}

function swipe(dx: number, dy = 0) {
  const s = scene();
  fireEvent.pointerDown(s, { pointerType: 'touch', clientX: 500, clientY: 300 });
  fireEvent.pointerUp(s, { pointerType: 'touch', clientX: 500 + dx, clientY: 300 + dy });
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook()];
  relay.published = [];
  signCount = 0;
  resetInventoryFixtureIds();
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});

describe('Rooms', () => {
  it('starts in the living room with the door, no bed, and the garden and bedroom next door', async () => {
    renderHome();
    const a = await ready();
    expect(scene()).toHaveAttribute('data-room', 'home');
    expect(scene()).toHaveAccessibleName("Brook's living room");
    expect(screen.getByTestId('scene-object-door')).toBeInTheDocument();
    expect(screen.queryByTestId('scene-object-bed')).toBeNull();
    expect(at(a)).toEqual(HOME_SPOT);
    expect(screen.getByTestId('room-arrow-left')).toHaveAccessibleName('Go to the garden');
    expect(screen.getByTestId('room-arrow-right')).toHaveAccessibleName('Go to the bedroom');
    expect(screen.getByTestId('room-dot-home')).toHaveAttribute('aria-current', 'location');
  });

  it('a chevron moves to the bedroom: the bed is there, the door is not, the Blobbi stands at the entry, nothing is written, and the choice is remembered on this device', async () => {
    const { unmount } = renderHome();
    let a = await ready();
    await userEvent.click(screen.getByTestId('room-arrow-right'));
    expect(scene()).toHaveAttribute('data-room', 'bedroom');
    expect(screen.getByTestId('scene-object-bed')).toBeInTheDocument();
    expect(screen.queryByTestId('scene-object-door')).toBeNull();
    expect(screen.queryByTestId('room-arrow-right')).toBeNull();
    expect(at(a)).toEqual(roomById('bedroom').entry);
    expect(a).toHaveAttribute('data-motion', 'idle');
    // The Blobbi is the same Blobbi: same renderer instance data, same name, same stage.
    expect(screen.getByTestId('blobbi-chip')).toHaveTextContent('Brook');
    expect(window.localStorage.getItem(roomStorageKey(PUBKEY, BROOK_D))).toBe('bedroom');
    await new Promise((r) => setTimeout(r, 100));
    expect(relay.published).toHaveLength(0);
    expect(query.mock.calls.filter(([filters]) => filters.some((f) => f.kinds?.includes(KIND_BLOBBI_STATE))).length).toBeLessThanOrEqual(2);

    unmount();
    renderHome();
    a = await ready();
    expect(scene()).toHaveAttribute('data-room', 'bedroom');
    expect(at(a)).toEqual(roomById('bedroom').entry);
  });

  it('a swipe changes rooms and is never a floor tap; a short or slanted drag is neither', async () => {
    renderHome();
    const a = await ready();
    swipe(-120);
    expect(scene()).toHaveAttribute('data-room', 'bedroom');
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 150, clientY: 500, detail: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(a).toHaveAttribute('data-motion', 'idle');
    expect(at(a)).toEqual(roomById('bedroom').entry);
    swipe(120);
    expect(scene()).toHaveAttribute('data-room', 'home');
    swipe(120);
    expect(scene()).toHaveAttribute('data-room', 'garden');
    swipe(120); // the end of the line
    expect(scene()).toHaveAttribute('data-room', 'garden');
    swipe(-30); // too short
    expect(scene()).toHaveAttribute('data-room', 'garden');
    swipe(-120, 90); // too slanted
    expect(scene()).toHaveAttribute('data-room', 'garden');
  });

  it('rest from the living room goes to the bedroom, walks to the bed, and only then sleeps', async () => {
    renderHome({ walkSpeed: 1.2, idleEnabled: false });
    const a = await ready();
    await userEvent.click(screen.getByTestId('care-rest'));
    expect(scene()).toHaveAttribute('data-room', 'bedroom');
    expect(a).toHaveAttribute('data-motion', 'walking');
    expect(event).not.toHaveBeenCalled();
    await waitFor(() => expect(relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(a).toHaveAttribute('data-sleeping', 'true'));
    expect(at(a)).toEqual(BED_SLEEP_SPOT);
    // Asleep: the room cannot be changed.
    expect(screen.getByTestId('room-arrow-left')).toBeDisabled();
    swipe(120);
    expect(scene()).toHaveAttribute('data-room', 'bedroom');
  });

  it('a sleeper is in bed in the bedroom whatever room was chosen, and wakes up there', async () => {
    window.localStorage.setItem(roomStorageKey(PUBKEY, BROOK_D), 'garden');
    relay.all = [brook('sleeping')];
    renderHome();
    const a = await ready();
    expect(scene()).toHaveAttribute('data-room', 'bedroom');
    expect(at(a)).toEqual(BED_SLEEP_SPOT);
    expect(screen.getByTestId('scene-object-bed')).toHaveAttribute('data-state', 'occupied');
    await userEvent.click(screen.getByTestId('care-rest'));
    await waitFor(() => expect(a).toHaveAttribute('data-sleeping', 'false'));
    // Awake again: back to the room the player had chosen, at its entry.
    await waitFor(() => expect(scene()).toHaveAttribute('data-room', 'garden'));
    expect(at(a)).toEqual(roomById('garden').entry);
  });

  it('changing rooms puts a walked-to item away without writing anything', async () => {
    relay.all = [brook(), officialCareDefinition('blobbi:food:apple', 'Apple', 'food', 'feed', { hunger: 25 }), inventoryEvent('blobbi:island', { [OFFICIAL_APPLE]: 2 })];
    renderHome({ walkSpeed: 0.02, idleEnabled: false });
    await ready();
    await userEvent.click(screen.getByTestId('action-items'));
    await userEvent.click(await screen.findByTestId('inventory-item-blobbi:food:apple'));
    await userEvent.click(screen.getByTestId('inventory-use'));
    await waitFor(() => expect(screen.getByTestId('scene-object-offer')).toHaveAttribute('data-state', 'walking'));
    // Arrows are off while an item is out; a swipe still moves (and puts the item away).
    expect(screen.getByTestId('room-arrow-left')).toBeDisabled();
    swipe(120);
    expect(scene()).toHaveAttribute('data-room', 'garden');
    expect(screen.queryByTestId('scene-object-offer')).toBeNull();
    await new Promise((r) => setTimeout(r, 200));
    expect(relay.published).toHaveLength(0);
  });
});
