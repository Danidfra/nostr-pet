/**
 * The animation playground (development only) plays the room's own
 * presentations without playing for them, and writes nothing: feeding (eager,
 * then bite after bite, then glad), petting (contentment, hearts), every
 * face by name, and each room transition to a chosen room.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

vi.hoisted(() => {
  (import.meta.env as Record<string, string>).VITE_BLOBBI_DEV_TOOLS = 'true';
});
const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));
const scene = vi.hoisted(() => ({
  state: { props: [] as { id: string; kind: string; bites?: { taken: number; of: number }; leaving?: boolean }[], kicks: 0 },
  fake: {
    setProps(props: { id: string; kind: string; bites?: { taken: number; of: number }; leaving?: boolean }[]) {
      scene.state.props = props;
    },
    kickProp() {
      scene.state.kicks += 1;
      return true;
    },
    propPosition: (id: string) => (scene.state.props.some((p) => p.id === id) ? { x: 5, z: 5 } : null),
    propResting: () => true,
    pick: () => ({ kind: 'floor' as const, x: 3, z: 3 }),
    floorAt: () => ({ x: 3, z: 3 }),
    requestWalk: () => Promise.resolve('arrived' as const),
    stopWalk: () => {},
    positionOf: () => ({ x: 4, z: 4 }),
    hop: () => {},
    playGesture: () => {},
    setActorGaze: () => {},
    setMainWanders: () => {},
    projectBlobbi: () => ({ x: 200, y: 320, pxPerTile: 40 }),
    projectFloor: () => ({ x: 200, y: 400, pxPerTile: 40 }),
    projectItemTop: () => ({ x: 150, y: 300, pxPerTile: 40 }),
    facingOf: () => 'front' as const,
    isWalking: () => false,
    actorModelDrawn: () => false,
    poke: () => {},
    toggleLamp: () => false,
    walkTo: () => {},
    findSpot: () => null,
  },
}));
vi.mock('@/features/room/hooks/useRoomScene', () => ({
  useRoomScene: () => ({ status: 'ready', sceneRef: { current: scene.fake } }),
  webglAvailable: () => false,
}));

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
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

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
  relay.published = [];
  scene.state.props = [];
  scene.state.kicks = 0;
  localStorage.clear();
});
afterEach(() => localStorage.clear());
const dish = () => scene.state.props.find((p) => p.kind === 'dish');

/** Every face the drawing wears from now on, in order. */
function watchFaces() {
  const faces: string[] = [];
  const read = () => document.querySelector('[data-room-blobbi="main"]')?.getAttribute('data-expression') ?? '';
  const observer = new MutationObserver(() => {
    const face = read();
    if (face && faces[faces.length - 1] !== face) faces.push(face);
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-expression'], childList: true });
  return { faces, stop: () => observer.disconnect() };
}

describe('the animation playground', () => {
  it('feeding: a dish appears, it notices (curious) and is eager, then bites (mouth open, then closed, eyes shut) take the food down, then glad; the dish goes; nothing written', async () => {
    renderRoom();
    await screen.findByTestId('room-bar');
    fireEvent.click(screen.getByTestId('dev-tools-open'));
    fireEvent.click(screen.getByTestId('dev-tools-tab-animations'));
    const watch = watchFaces();
    fireEvent.click(screen.getByTestId('playground-feed'));
    // The food is a thing in the room, on a dish, whole
    expect(dish()).toMatchObject({ bites: { taken: 0, of: 4 } });
    await waitFor(() => expect(dish()?.bites?.taken).toBe(4), { timeout: 4000 });
    await waitFor(() => expect(dish()).toBeUndefined(), { timeout: 3000 });
    await act(() => new Promise((r) => setTimeout(r, 300)));
    watch.stop();
    const faces = watch.faces.join(' ');
    // Curious, then eager (eased into "excited"), then the bites, alternating, then glad
    expect(faces).toMatch(/surprised":0\.55/);
    expect(faces).toMatch(/excited/);
    const open = watch.faces.filter((f) => f.includes('"mouth":"open"')).length;
    const closed = watch.faces.filter((f) => f.includes('"mouth":"grin"')).length;
    expect(open).toBeGreaterThanOrEqual(3);
    expect(closed).toBeGreaterThanOrEqual(3);
    expect(watch.faces.findIndex((f) => f.includes('"mouth":"open"'))).toBeGreaterThan(watch.faces.findIndex((f) => f.includes('excited')));
    expect(watch.faces[watch.faces.length - 1]).toMatch(/happy/);
    expect(relay.published).toEqual([]);
  }, 12_000);

  it('the ball: it drops into the room, the Blobbi comes, nudges it three times (a bop each), chasing it between; glad after; the ball stays; nothing written', async () => {
    renderRoom();
    await screen.findByTestId('room-bar');
    fireEvent.click(screen.getByTestId('dev-tools-open'));
    fireEvent.click(screen.getByTestId('dev-tools-tab-animations'));
    const watch = watchFaces();
    fireEvent.click(screen.getByTestId('playground-ball'));
    expect(scene.state.props.find((p) => p.kind === 'ball')).toBeDefined();
    await waitFor(() => expect(scene.state.kicks).toBe(3), { timeout: 6000 });
    await waitFor(() => expect(watch.faces[watch.faces.length - 1]).toMatch(/excited/), { timeout: 3000 });
    await act(() => new Promise((r) => setTimeout(r, 900)));
    watch.stop();
    expect(scene.state.props.find((p) => p.kind === 'ball')).toBeDefined();
    expect(relay.published).toEqual([]);
  }, 12_000);

  it('petting: contentment and a heart; faces by name; nothing written', async () => {
    renderRoom();
    await screen.findByTestId('room-bar');
    fireEvent.click(screen.getByTestId('dev-tools-open'));
    fireEvent.click(screen.getByTestId('dev-tools-tab-animations'));
    fireEvent.click(screen.getByTestId('playground-pet'));
    expect(screen.getByTestId('room-pet-heart')).toBeInTheDocument();
    expect(document.querySelector('[data-room-blobbi="main"]')?.getAttribute('data-expression')).toMatch(/"eyes":"closed".*"mouth":"smile"/);
    fireEvent.click(screen.getByTestId('dev-tools-tab-visual'));
    fireEvent.click(screen.getByTestId('playground-face-worried'));
    await waitFor(() => expect(document.querySelector('[data-room-blobbi="main"]')?.getAttribute('data-expression')).toMatch(/"sad":0\.55/), { timeout: 1000 });
    expect(relay.published).toEqual([]);
  });
});
