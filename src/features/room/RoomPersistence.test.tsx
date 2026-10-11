/**
 * Decorating kept on this device (milestone 5), through the real `/room`
 * page and its decorator, with the WebGL scene faked: Save writes the
 * player's and Blobbi's document, a reload reads it back in every room,
 * Cancel and drafts write nothing, another Blobbi has its own rooms, a
 * stored document that cannot be read shows the defaults with a word, and
 * none of it is published.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { roomFurnitureFor } from './lib/room-furniture';
import { ROOM_STORE_PREFIX, roomStoreKey } from './lib/room-store';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));
vi.mock('@/features/room/hooks/useRoomScene', () => {
  const fake = {
    pick: () => null,
    floorAt: () => null,
    requestWalk: () => Promise.resolve('arrived'),
    stopWalk: () => {},
    positionOf: () => ({ x: 4, z: 4 }),
    hop: () => {},
    projectBlobbi: () => ({ x: 200, y: 320, pxPerTile: 40 }),
    projectFloor: () => ({ x: 200, y: 400, pxPerTile: 40 }),
    projectItemTop: () => ({ x: 150, y: 300, pxPerTile: 40 }),
    facingOf: () => 'front',
    isWalking: () => false,
    actorModelDrawn: () => false,
    findSpot: () => ({ at: 'floor', x: 5.5, y: 5.5 }),
  };
  return { useRoomScene: () => ({ status: 'ready', sceneRef: { current: fake } }), webglAvailable: () => false };
});

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f['#d'] || f['#d'].some((d) => e.tags.some((t) => t[0] === 'd' && t[1] === d)))))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
  }),
} as unknown as NPool;

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

const shell = () => screen.getByTestId('room-shell');
const goTo = (room: string) => {
  for (let i = 0; i < 5 && shell().dataset.room !== room; i++) fireEvent.click(screen.getByTestId('room-nav-right'));
  expect(shell()).toHaveAttribute('data-room', room);
};
/** The decorator's own count of the pieces in the room, read on opening it; closed again with Cancel. */
function piecesInRoom(): number {
  fireEvent.click(screen.getByRole('button', { name: /decorate this room/i }));
  const count = Number(/(\d+)\/\d+/.exec(screen.getByTestId('decorator-hint').textContent ?? '')![1]);
  fireEvent.click(screen.getByTestId('decorator-cancel'));
  return count;
}
function addAPlantAnd(finish: 'save' | 'cancel') {
  fireEvent.click(screen.getByRole('button', { name: /decorate this room/i }));
  fireEvent.click(screen.getByTestId('decorator-tab-plants'));
  fireEvent.click(screen.getByTestId('catalog-official:plant-small'));
  fireEvent.click(screen.getByTestId(finish === 'save' ? 'decorator-save' : 'decorator-cancel'));
}
/** The Blobbi's own address d tag, as its event states it. */
const dOf = (petId: string) => blobbiEvent(petId).tags.find((t) => t[0] === 'd')![1];
const keyFor = (petId: string) => roomStoreKey(PUBKEY, dOf(petId));
const storedKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(ROOM_STORE_PREFIX));

function signedIn(petId = '0000000001') {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent(petId, { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.published = [];
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('decorating kept on this device', () => {
  it('Save keeps a room through room switches and a reload; Cancel and the draft write nothing', async () => {
    signedIn();
    const first = renderRoom();
    await screen.findByTestId('room-care-panel');
    const defaults = roomFurnitureFor('home').length;
    addAPlantAnd('cancel');
    expect(storedKeys()).toEqual([]);
    expect(piecesInRoom()).toBe(defaults);
    addAPlantAnd('save');
    expect(storedKeys()).toEqual([keyFor('0000000001')]);
    expect(piecesInRoom()).toBe(defaults + 1);
    goTo('kitchen');
    expect(piecesInRoom()).toBe(roomFurnitureFor('kitchen').length);
    goTo('home');
    expect(piecesInRoom()).toBe(defaults + 1);
    first.unmount();
    // A reload: a new page, the same device
    renderRoom();
    await screen.findByTestId('room-care-panel');
    expect(piecesInRoom()).toBe(defaults + 1);
    goTo('care');
    expect(piecesInRoom()).toBe(roomFurnitureFor('care').length);
    expect(relay.published).toEqual([]);
  });

  it('another Blobbi has its own rooms: what one saved never shows for the other', async () => {
    signedIn('0000000001');
    const first = renderRoom();
    await screen.findByTestId('room-care-panel');
    addAPlantAnd('save');
    first.unmount();
    signedIn('0000000002');
    renderRoom();
    await screen.findByTestId('room-care-panel');
    expect(piecesInRoom()).toBe(roomFurnitureFor('home').length);
    expect(localStorage.getItem(keyFor('0000000002'))).toBeNull();
  });

  it('a stored document that cannot be read shows the defaults, says so, and the room works', async () => {
    signedIn();
    localStorage.setItem(keyFor('0000000001'), '{"v":1,"rooms":');
    renderRoom();
    await screen.findByTestId('room-care-panel');
    expect(screen.getByTestId('room-care-notice')).toHaveTextContent(/could not be read/);
    expect(piecesInRoom()).toBe(roomFurnitureFor('home').length);
    // Saving again replaces the unreadable document with a good one
    addAPlantAnd('save');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(keyFor('0000000001'))!).v).toBe(1));
  });

  it('pieces the catalog no longer has are left out, and the player is told', async () => {
    signedIn();
    localStorage.setItem(keyFor('0000000001'), JSON.stringify({ v: 1, rooms: { home: { furniture: [{ id: 'official:plant-small', at: 'floor', x: 2.5, y: 6.5 }, { id: 'official:jukebox', at: 'floor', x: 4, y: 4 }] } } }));
    renderRoom();
    await screen.findByTestId('room-care-panel');
    expect(screen.getByTestId('room-care-notice')).toHaveTextContent(/no longer available/);
    expect(piecesInRoom()).toBe(1);
  });
});
