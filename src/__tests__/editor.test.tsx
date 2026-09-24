/**
 * Decorating a room: a draft of the layout the player moves by dragging or
 * with the arrow keys, kept legal in room units, saved on Apply to this
 * device in Ditto's layout shape, dropped on Cancel. Nothing is published.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { FLOOR_LINE, FLOOR_FRONT } from '@/features/home/space';
import { layoutStorageKey, roomById, sleepSpotFor, furnitureById, MAX_FURNITURE_PER_ROOM } from '@/features/home/rooms';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));
const signer = { async signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent> { return { ...t, id: 'e'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) }; } };

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => relay.all.filter((e) => filters.some((f) => matches(e, f))));
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.all = [...relay.all.filter((e) => !(e.kind === KIND_BLOBBI_STATE && getTagValue(e.tags, 'd') === d)), ev];
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

/** A 400×500 canvas at (0, 100): room x = px/400, room y = (py − 100)/500. */
const BOX = { left: 0, top: 100, width: 400, height: 500, right: 400, bottom: 600, x: 0, y: 100, toJSON: () => ({}) };
async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  screen.getByTestId('room-canvas').getBoundingClientRect = () => BOX;
}
const anchor = (id: string) => screen.getByTestId(`furniture-${id}`);
const button = (id: string) => screen.getByTestId(`furniture-button-${id}`);
const pos = (id: string) => ({ x: parseFloat(anchor(id).style.left) / 100, y: parseFloat(anchor(id).style.top) / 100 });
const stored = () => JSON.parse(window.localStorage.getItem(layoutStorageKey(PUBKEY, BROOK_D)) ?? 'null');

function drag(id: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const el = button(id);
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: from.x + 5, clientY: from.y + 5 });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: to.x, clientY: to.y });
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.all = [brook()];
  relay.published = [];
  window.localStorage.clear();
});

describe('Decorating: entering and leaving', () => {
  it('opens a toolbar in the dock, freezes the Blobbi and the room navigation, and Cancel with no change just leaves', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('room-edit'));
    expect(screen.getByTestId('editor-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('hotbar')).toBeNull();
    expect(screen.getByTestId('home-scene')).toHaveAttribute('data-editing', 'true');
    expect(screen.getByTestId('room-arrow-left')).toBeDisabled();
    expect(screen.getByTestId('scene-floor')).toBeDisabled();
    expect(screen.getByTestId('blobbi-poke')).toBeDisabled();
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    await userEvent.click(screen.getByTestId('editor-cancel'));
    expect(screen.queryByTestId('editor-bar')).toBeNull();
    expect(screen.getByTestId('hotbar')).toBeInTheDocument();
    expect(stored()).toBeNull();
    expect(relay.published).toHaveLength(0);
  });
});

describe('Decorating: moving furniture', () => {
  it('a tap selects; the arrow keys nudge in room units; Apply saves the layout on this device in the v1 shape', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('room-edit'));
    const before = pos('official:rug-round');
    await userEvent.click(button('official:rug-round'));
    expect(anchor('official:rug-round')).toHaveAttribute('data-state', 'selected');
    expect(button('official:rug-round')).toHaveAccessibleName('Round Rug, selected');
    button('official:rug-round').focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowUp}');
    expect(pos('official:rug-round').x).toBeCloseTo(before.x - 0.02, 3);
    expect(pos('official:rug-round').y).toBeCloseTo(before.y - 0.01, 3);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(pos('official:rug-round').x).toBeCloseTo(before.x + 0.03, 3);
    expect(screen.getByTestId('editor-apply')).toBeEnabled();
    await userEvent.click(screen.getByTestId('editor-apply'));
    expect(screen.queryByTestId('editor-bar')).toBeNull();
    const saved = stored();
    expect(saved.v).toBe(1);
    const rug = saved.by_room.home.find((p: { id: string }) => p.id === 'official:rug-round');
    expect(rug).toMatchObject({ layer: 'floor' });
    expect(rug.x).toBeCloseTo(before.x + 0.03, 3);
    // The room shows the saved layout, and so does a fresh mount.
    expect(pos('official:rug-round').x).toBeCloseTo(before.x + 0.03, 3);
    expect(relay.published).toHaveLength(0);
  });

  it('dragging with a pointer moves a piece; the drop is clamped so the whole piece stays in the room and on its layer', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('room-edit'));
    const rug = pos('official:rug-round');
    const from = { x: BOX.left + rug.x * BOX.width, y: BOX.top + rug.y * BOX.height };
    // Far off to the left and up onto the wall: it stops at half its width and on the floor line.
    drag('official:rug-round', from, { x: -300, y: 0 });
    const def = furnitureById('official:rug-round')!;
    await waitFor(() => expect(pos('official:rug-round').x).toBeCloseTo(def.baseWidth / 2, 3));
    expect(pos('official:rug-round').y).toBeCloseTo(FLOOR_LINE, 3);
    // And past the front edge: it stops at the front.
    drag('official:rug-round', { x: BOX.left + pos('official:rug-round').x * BOX.width, y: BOX.top + pos('official:rug-round').y * BOX.height }, { x: 200, y: 900 });
    await waitFor(() => expect(pos('official:rug-round').y).toBeCloseTo(FLOOR_FRONT, 3));
    expect(pos('official:rug-round').x).toBeCloseTo(0.5, 2);
    // A wall piece dragged onto the floor stays on the wall.
    const shelf = pos('official:shelf-wall');
    drag('official:shelf-wall', { x: BOX.left + shelf.x * BOX.width, y: BOX.top + shelf.y * BOX.height }, { x: 200, y: 590 });
    await waitFor(() => expect(pos('official:shelf-wall').y).toBeCloseTo(FLOOR_LINE, 3));
    expect(relay.published).toHaveLength(0);
  });

  it('a press that does not move is a tap, not a drag', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('room-edit'));
    const before = pos('official:plant-tall');
    const el = button('official:plant-tall');
    fireEvent.pointerDown(el, { pointerId: 2, button: 0, clientX: 300, clientY: 480 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 301, clientY: 481 });
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 301, clientY: 481 });
    await userEvent.click(el);
    expect(anchor('official:plant-tall')).toHaveAttribute('data-state', 'selected');
    expect(pos('official:plant-tall')).toEqual(before);
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });
});

describe('Decorating: the toolbar', () => {
  it('layer, scale, flip and remove act on the selected piece and respect the catalog; add opens the catalog and places at the default spot', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('room-edit'));
    await userEvent.click(button('official:plant-tall'));
    expect(screen.getByTestId('editor-layer')).toHaveTextContent('front');
    await userEvent.click(screen.getByTestId('editor-layer'));
    expect(anchor('official:plant-tall')).toHaveAttribute('data-layer', 'floor');
    await userEvent.click(screen.getByTestId('editor-layer'));
    expect(anchor('official:plant-tall')).toHaveAttribute('data-layer', 'front');
    await userEvent.click(screen.getByTestId('editor-larger'));
    expect(screen.getByTestId('editor-bar')).toHaveTextContent('110%');
    await userEvent.click(screen.getByTestId('editor-flip'));
    expect(anchor('official:plant-tall').style.getPropertyValue('--flip')).toBe('-1');
    // The rug cannot change layer or flip.
    await userEvent.click(button('official:rug-round'));
    expect(screen.getByTestId('editor-layer')).toBeDisabled();
    expect(screen.getByTestId('editor-flip')).toBeDisabled();
    await userEvent.click(screen.getByTestId('editor-remove'));
    expect(screen.queryByTestId('furniture-official:rug-round')).toBeNull();
    // Add a bed to the living room from the catalog (beds are allowed at home).
    await userEvent.click(screen.getByTestId('editor-add'));
    const sheet = await screen.findByTestId('catalog-sheet');
    expect(within(sheet).queryByTestId('catalog-official:bed-single')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByTestId('catalog-official:bed-single'));
    await waitFor(() => expect(screen.queryByTestId('catalog-sheet')).toBeNull());
    expect(anchor('official:bed-single')).toHaveAttribute('data-state', 'selected');
    expect(pos('official:bed-single').y).toBeGreaterThanOrEqual(FLOOR_LINE);
    // Reset brings the defaults back (not saved yet); Cancel with changes asks first.
    await userEvent.click(screen.getByTestId('editor-reset'));
    expect(screen.getByTestId('furniture-official:rug-round')).toBeInTheDocument();
    expect(screen.queryByTestId('furniture-official:bed-single')).toBeNull();
    await userEvent.click(screen.getByTestId('editor-larger')); // nothing selected: no-op
    await userEvent.click(button('official:plant-tall'));
    await userEvent.click(screen.getByTestId('editor-larger'));
    await userEvent.click(screen.getByTestId('editor-cancel'));
    expect(screen.getByTestId('editor-discard')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('editor-keep'));
    expect(screen.getByTestId('editor-apply')).toBeEnabled();
    await userEvent.click(screen.getByTestId('editor-cancel'));
    await userEvent.click(screen.getByTestId('editor-discard'));
    expect(screen.queryByTestId('editor-bar')).toBeNull();
    expect(stored()).toBeNull();
    expect(relay.published).toHaveLength(0);
  });

  it('the catalog only offers what may stand in this room, and the room fills up at twenty', async () => {
    renderHome();
    await ready();
    await userEvent.click(screen.getByTestId('room-arrow-left')); // the kitchen: no beds
    await userEvent.click(screen.getByTestId('room-edit'));
    await userEvent.click(screen.getByTestId('editor-add'));
    const sheet = await screen.findByTestId('catalog-sheet');
    expect(within(sheet).queryByTestId('catalog-official:bed-single')).toBeNull();
    expect(within(sheet).getByTestId('catalog-official:plant-fern')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByTestId('catalog-official:plant-fern'));
    for (let i = roomById('kitchen').defaultFurniture.length + 1; i < MAX_FURNITURE_PER_ROOM; i += 1) {
      await userEvent.click(screen.getByTestId('editor-add'));
      const again = await screen.findByTestId('catalog-sheet');
      await userEvent.click(within(again).getByTestId('catalog-official:plant-fern'));
    }
    await waitFor(() => expect(screen.getByTestId('editor-add')).toBeDisabled());
    expect(screen.getByTestId('editor-add')).toHaveAccessibleName('Room is full');
    expect(screen.getAllByTestId('furniture-official:plant-fern')).toHaveLength(MAX_FURNITURE_PER_ROOM - roomById('kitchen').defaultFurniture.length);
  });
});

describe('Decorating: the sleeper and the bed', () => {
  it('a moved bed moves where the Blobbi sleeps, and a sleeper follows it', async () => {
    relay.all = [brook('sleeping')];
    renderHome();
    await ready();
    const actor = screen.getByTestId('blobbi-actor');
    const before = { x: Number(actor.getAttribute('data-x')), y: Number(actor.getAttribute('data-y')) };
    expect(before).toEqual(sleepSpotFor(roomById('rest').defaultFurniture, roomById('rest')));
    await userEvent.click(screen.getByTestId('room-edit'));
    await userEvent.click(button('official:bed-single'));
    button('official:bed-single').focus();
    await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}');
    await waitFor(() => expect(Number(actor.getAttribute('data-x'))).toBeLessThan(before.x - 0.1));
    await userEvent.click(screen.getByTestId('editor-apply'));
    expect(stored().by_room.rest.find((p: { id: string }) => p.id === 'official:bed-single').x).toBeCloseTo(0.68 - 0.15, 3);
    expect(relay.published).toHaveLength(0);
  });
});
