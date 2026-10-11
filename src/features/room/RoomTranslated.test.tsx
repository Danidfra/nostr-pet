/**
 * The room survives a page translator. Chrome's translation (and other
 * tools that rewrite text) replaces or wraps the text nodes React owns, for
 * example moving the room name into a `<font>` element. React then inserts
 * the next room's icon "before" a text node that is no longer a child of
 * its span, and the DOM throws `NotFoundError: The object can not be found
 * here` from `insertBefore` in the middle of a commit; with no boundary
 * that was a white page on an iPhone (Chrome for iOS, 2026-10-11). The
 * fix is structural: text that sits beside an element React swaps lives in
 * its own element, so React's insertion reference is an element, never a
 * bare text node. This test does what the translator does, then changes
 * rooms, repeatedly and quickly, and expects the room to stand.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => {
  (import.meta.env as Record<string, string>).VITE_BLOBBI_DEV_TOOLS = 'true';
});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

import AppRouter from '@/AppRouter';
import { ROOM_ORDER, roomById } from '@/features/home/rooms/rooms';

/** The room to the right of the living room, as the switcher goes. */
const NEXT = ROOM_ORDER[(ROOM_ORDER.indexOf('home') + 1) % ROOM_ORDER.length];
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [], metadata: undefined }),
}));

const relay = { all: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async () => {}),
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

/** What a page translator does to every text node it translates: the text moves inside a `<font>`. */
function translate(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) texts.push(node as Text);
    node = walker.nextNode();
  }
  for (const text of texts) {
    if (text.parentElement?.tagName === 'FONT') continue;
    const font = document.createElement('font');
    font.style.verticalAlign = 'inherit';
    text.parentNode?.replaceChild(font, text);
    font.appendChild(text);
  }
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' })];
  localStorage.clear();
});
// Only the console spy is restored by hand: `restoreAllMocks` would also empty the relay's `vi.fn` implementations
let quiet: { mockRestore: () => void } | null = null;
afterEach(() => {
  localStorage.clear();
  quiet?.mockRestore();
  quiet = null;
});

describe('the room under a page translator', () => {
  it('changes rooms, back and forth and quickly, after its text was moved into <font> elements: no DOM error, no crash card', async () => {
    quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoom();
    const shell = await screen.findByTestId('room-shell', {}, { timeout: 4000 });
    expect(shell).toHaveAttribute('data-room', 'home');
    translate(screen.getByTestId('room-switcher'));
    translate(screen.getByTestId('room-header'));
    expect(screen.getByTestId('room-label').querySelector('font')).not.toBeNull();

    // The next room: its icon is a different component, inserted before the room's name
    fireEvent.click(screen.getByTestId('room-nav-right'));
    await waitFor(() => expect(shell).toHaveAttribute('data-room', NEXT));
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(screen.getByTestId('room-label')).toHaveTextContent(roomById(NEXT).label);

    // Round the house and back, as fast as taps come, the translator at work after every change
    for (let i = 0; i < 2 * ROOM_ORDER.length; i++) {
      translate(screen.getByTestId('room-switcher'));
      fireEvent.click(screen.getByTestId(i % 3 === 2 ? 'room-nav-left' : 'room-nav-right'));
    }
    await waitFor(() => expect(screen.getByTestId('room-label')).toHaveTextContent(roomById(shell.getAttribute('data-room') as never).label));
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
  });

  it('the dev tools open and close, scenes switch rapidly and journeys start, with the whole page translated after every step', async () => {
    renderRoom();
    await screen.findByTestId('room-shell', {}, { timeout: 4000 });
    const step = (testId: string) => {
      translate(document.body);
      fireEvent.click(screen.getByTestId(testId));
    };
    step('dev-tools-open');
    // jsdom is a wide screen here: the panel stays up while scenes play, so every control is in reach
    step('dev-tools-tab-animations');
    for (const scene of ['big-jump', 'outside', 'floor-gag', 'behind-wall', 'quick', 'construct', 'big-jump']) step(`playground-scene-${scene}`);
    step('playground-cancel');
    step('playground-feed');
    step('playground-pet');
    step('dev-tools-tab-teleport');
    step('teleport-dev-leave');
    step('teleport-dev-arrive');
    step('teleport-dev-cancel');
    step('dev-tools-tab-visual');
    step('playground-face-worried');
    step('playground-face-clear');
    step('dev-tools-close');
    step('room-nav-right');
    step('room-nav-right');
    step('dev-tools-open');
    step('dev-tools-tab-room');
    step('dev-tools-close');
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.queryByTestId('room-crash')).toBeNull();
    expect(screen.getByTestId('room-shell')).toBeInTheDocument();
    expect(screen.getByTestId('dev-tools-open')).toBeInTheDocument();
  });
});
