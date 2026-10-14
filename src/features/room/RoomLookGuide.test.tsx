/**
 * Finding the Blobbi's look in the room (M14.3): the introduction shows the
 * two looks of the player's own Blobbi, the one-time guide leads from the
 * dock's Blobbi button to the Appearance card and never comes back, the card
 * stands out in the sheet, and the choice is remembered on this device.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { parseBlobbiEvent } from '@blobbi-kit/core';

import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { EXPERIENCE_STORAGE_KEY, ROOM_INTRO_STORAGE_KEY } from '@/lib/home-experience';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { APPEARANCE_STORAGE_KEY } from './lib/blobbi-appearance';
import { LOOK_GUIDE_LINE, LOOK_GUIDE_STORAGE_KEY } from './lib/look-guide';
import { genomeOf } from './lib/blobbi3d/identity';
import { RoomIntro } from './components/RoomIntro';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));
// jsdom has no WebGL: the room's own suites run without it. One test lets the introduction believe it has it, to see
// the model asked for with this Blobbi's genome (the stage then says it cannot draw, as a browser without it would)
const gl = vi.hoisted(() => ({ pretend: false }));
vi.mock('./hooks/useRoomScene', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./hooks/useRoomScene')>();
  return { ...mod, webglAvailable: () => gl.pretend || mod.webglAvailable() };
});

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const pool = {
  query: vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey))))),
  event: vi.fn(async (ev: NostrEvent) => {
    relay.published.push(ev);
  }),
} as unknown as NPool;

function renderRoom({ reduced = false }: { reduced?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion: reduced, idleEnabled: false, walkSpeed: 4 }}>
      <NostrLoginProvider storageKey="test:login">
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/room']}>
              <AppRouter />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
}

function signedInWith(stage: 'egg' | 'baby' | 'adult', generation: 'v1' | 'v2' | 'v3' = 'v3') {
  currentUser.user = { pubkey: PUBKEY, signer: {} };
  relay.all = [blobbiEvent('0000000001', { name: 'Brook', stage, state: 'active', visualGeneration: generation })];
}

const shell = () => screen.getByTestId('room-shell');
const intro = () => screen.findByTestId('mode-intro');
const guide = () => screen.queryByTestId('room-look-guide');
async function explore() {
  const dialog = await intro();
  fireEvent.click(within(dialog).getByTestId('mode-intro-explore'));
  expect(screen.queryByTestId('mode-intro')).toBeNull();
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  localStorage.clear();
  localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
  gl.pretend = false;
});
afterEach(() => localStorage.clear());

describe('the introduction shows both looks of this very Blobbi', () => {
  it('Classic and 3D Model side by side, the one in force marked, the line that they are one Blobbi, and the way to choose', async () => {
    signedInWith('adult');
    renderRoom();
    const dialog = await intro();
    const previews = within(dialog).getByTestId('mode-intro-previews');
    expect(previews).toHaveAttribute('data-current', '2d');
    const classic = within(previews).getByTestId('mode-intro-preview-2d');
    const model = within(previews).getByTestId('mode-intro-preview-3d');
    expect(classic).toHaveTextContent(/Classic/);
    expect(classic).toHaveTextContent(/familiar drawing/);
    expect(model).toHaveTextContent(/3D Model/);
    expect(model).toHaveTextContent(/experimental/);
    // The player's Blobbi, not a stand-in: the kit's renderer with this Blobbi's own instance
    expect(classic.querySelector('[data-blobbi-renderer]')).not.toBeNull();
    expect(classic.querySelector('[data-blobbi-instance="intro-2d-0000000001"], [id*="intro-2d-0000000001"], [data-blobbi-renderer]')).not.toBeNull();
    expect(within(classic).getByTestId('mode-intro-selected-2d')).toHaveTextContent('Selected');
    expect(within(model).queryByTestId('mode-intro-selected-3d')).toBeNull();
    // Without WebGL the 3D card says so instead of a placeholder character
    expect(within(model).getByTestId('mode-intro-preview-3d-note')).toHaveTextContent(/cannot draw 3D/);
    expect(within(dialog).getByTestId('mode-intro-appearance')).toHaveTextContent('Both are the same Brook, with the same care and the same story. Only the look here changes. Pick one above, or later: tap Brook in the dock, then Appearance.');
    // The words (the drawings carry the kit's stylesheet, which is not copy)
    const copy = dialog.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.mode-intro__frame').forEach((f) => f.remove());
    expect(copy.textContent).not.toContain(';');
    expect(copy.textContent).not.toMatch(/relay/i);
    expect(within(dialog).getByTestId('mode-intro-dismiss')).toBeChecked();
    expect(within(dialog).getByTestId('mode-intro-explore')).toHaveTextContent('Let’s explore');
    expect(relay.published).toEqual([]);
  });

  it('with 3D graphics, the 3D card asks the stage for this Blobbi\'s genome and stage, and a 3D choice in force is the one marked', () => {
    gl.pretend = true;
    const event = blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state: 'active', visualGeneration: 'v3' });
    const blobbi = parseBlobbiEvent(event)!;
    const genome = genomeOf(toBlobbiVisual(blobbi))!;
    const onExplore = vi.fn();
    render(<RoomIntro open blobbi={blobbi} appearance="3d" unavailable3d={null} onExplore={onExplore} />);
    const stage = screen.getByTestId('mode-intro-stage-3d');
    expect(stage).toHaveAttribute('data-seed', String(genome.seed));
    expect(stage).toHaveAttribute('data-view', 'front');
    expect(stage).toHaveAttribute('data-motion', 'idle');
    expect(stage).toHaveAttribute('aria-label', 'Brook in 3D');
    expect(screen.queryByTestId('mode-intro-preview-3d-note')).toBeNull();
    expect(screen.getByTestId('mode-intro-previews')).toHaveAttribute('data-current', '3d');
    expect(screen.getByTestId('mode-intro-selected-3d')).toBeInTheDocument();
    expect(screen.queryByTestId('mode-intro-selected-2d')).toBeNull();
    // Reduced motion: both previews hold still
    screen.getByTestId('mode-intro-explore').click();
    expect(onExplore).toHaveBeenCalledWith(true, null);
  });

  it('reduced motion stills both previews', () => {
    gl.pretend = true;
    const blobbi = parseBlobbiEvent(blobbiEvent('0000000001', { name: 'Brook', stage: 'adult', state: 'active', visualGeneration: 'v3' }))!;
    render(<RoomIntro open blobbi={blobbi} appearance="2d" unavailable3d={null} reducedMotion onExplore={() => {}} />);
    expect(screen.getByTestId('mode-intro-stage-3d')).toHaveAttribute('data-motion', 'still');
    expect(screen.getByTestId('mode-intro-preview-2d').querySelector('[data-blobbi-rig-motion="idle"], [data-blobbi-motion="idle"]')).toBeNull();
  });

  it('an egg\'s 3D card says the model comes with the hatch; V2 art says the model is for the newest art', async () => {
    signedInWith('egg');
    const first = renderRoom();
    let dialog = await intro();
    expect(within(dialog).getByTestId('mode-intro-preview-3d-note')).toHaveTextContent('The 3D model is ready once Brook hatches.');
    expect(within(dialog).getByTestId('mode-intro-preview-2d').querySelector('[data-blobbi-renderer]')).not.toBeNull();
    first.unmount();
    localStorage.removeItem(ROOM_INTRO_STORAGE_KEY);
    signedInWith('adult', 'v2');
    renderRoom();
    dialog = await intro();
    expect(within(dialog).getByTestId('mode-intro-preview-3d-note')).toHaveTextContent(/newest Blobbi art/);
  });
});

describe('the one-time guide to the Appearance card', () => {
  it('after the introduction the dock\'s Blobbi button glows with a bubble; tapping it opens the sheet with the card lit; the first touch of the card ends it; it never returns', async () => {
    signedInWith('adult');
    const first = renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    expect(guide()).toBeNull();
    await explore();
    const bubble = guide();
    expect(bubble).not.toBeNull();
    expect(bubble).toHaveTextContent(LOOK_GUIDE_LINE);
    expect(bubble).not.toHaveAttribute('data-reduced');
    expect(screen.getByTestId('room-bar-blobbi-slot')).toHaveAttribute('data-guide', 'true');
    expect(screen.getByTestId('room-bar-blobbi').className).toMatch(/look-guide__target/);
    // Remembered the moment it shows
    expect(localStorage.getItem(LOOK_GUIDE_STORAGE_KEY)).toBe('shown');
    // The bubble itself opens the sheet, like the button
    fireEvent.click(bubble!);
    const sheet = await screen.findByTestId('room-blobbi-sheet');
    expect(guide()).toBeNull();
    const card = within(sheet).getByTestId('room-appearance-section');
    expect(card).toHaveAttribute('data-hint', 'true');
    expect(card.className).toMatch(/look-card--lit/);
    fireEvent.pointerDown(within(card).getByTestId('room-appearance-3d'));
    expect(card).not.toHaveAttribute('data-hint');
    // Closed and opened again: no glow, no bubble, no lit card
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByTestId('room-blobbi-sheet')).toBeNull();
    expect(guide()).toBeNull();
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    expect(screen.getByTestId('room-appearance-section')).not.toHaveAttribute('data-hint');
    fireEvent.keyDown(screen.getByTestId('room-blobbi-sheet'), { key: 'Escape' });
    first.unmount();
    // Another visit: neither the introduction nor the guide
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    expect(guide()).toBeNull();
    expect(relay.published).toEqual([]);
  });

  it('is put away by another interaction (a touch anywhere else, or Escape), and the sheet then opens with nothing lit; the dock keeps working', async () => {
    signedInWith('adult');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    await explore();
    expect(guide()).not.toBeNull();
    fireEvent.pointerDown(shell());
    expect(guide()).toBeNull();
    expect(screen.getByTestId('room-bar-blobbi-slot')).not.toHaveAttribute('data-guide');
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    expect(screen.getByTestId('room-appearance-section')).not.toHaveAttribute('data-hint');
    fireEvent.keyDown(screen.getByTestId('room-blobbi-sheet'), { key: 'Escape' });
    // Once put away it does not come back, even though the introduction was the first
    expect(guide()).toBeNull();
    expect(localStorage.getItem(LOOK_GUIDE_STORAGE_KEY)).toBe('shown');
  });

  it('a touch on the Blobbi button itself is not "another interaction"; Escape is', async () => {
    signedInWith('adult');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    await explore();
    fireEvent.pointerDown(screen.getByTestId('room-bar-blobbi'));
    expect(guide()).not.toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(guide()).toBeNull();
  });

  it('"Don\'t show this again" unticked brings the introduction back next time, but the guide was once: it stays away', async () => {
    signedInWith('adult');
    const first = renderRoom();
    const dialog = await intro();
    fireEvent.click(within(dialog).getByTestId('mode-intro-dismiss'));
    fireEvent.click(within(dialog).getByTestId('mode-intro-explore'));
    expect(localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBeNull();
    expect(guide()).not.toBeNull();
    first.unmount();
    renderRoom();
    await explore();
    expect(guide()).toBeNull();
  });

  it('reduced motion: the bubble and the glow hold still, the lit card is a plain ring, and the stylesheet says so', async () => {
    signedInWith('adult');
    renderRoom({ reduced: true });
    await screen.findByTestId('room-blobbi-anchor');
    await explore();
    expect(guide()).toHaveAttribute('data-reduced', 'true');
    expect(screen.getByTestId('room-bar-blobbi').className).toMatch(/look-guide__target--still/);
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    const card = screen.getByTestId('room-appearance-section');
    expect(card).toHaveAttribute('data-hint', 'true');
    expect(card).toHaveAttribute('data-reduced', 'true');
    const css = readFileSync(join(__dirname, '..', '..', 'index.css'), 'utf8');
    expect(css).toMatch(/\.look-guide\[data-reduced='true'\], \.look-guide__target--still > div:first-child \{ animation: none !important; \}/);
    expect(css).toMatch(/\.look-card--lit\[data-reduced='true'\] \{ animation: none;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.look-guide, \.look-guide__target > div:first-child, \.look-card--lit \{ animation: none !important; \}/);
  });
});

describe('the Appearance card in the Blobbi sheet', () => {
  it('stands under the condition with its own icon, its label, the look in force named, both looks with the Blobbi small in each; the menu has no second one', async () => {
    signedInWith('adult');
    localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    const sheet = await screen.findByTestId('room-blobbi-sheet');
    const card = within(sheet).getByTestId('room-appearance-section');
    expect(within(card).getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(card.querySelector('.look-card__icon svg')).not.toBeNull();
    expect(within(card).getByTestId('room-appearance-current')).toHaveTextContent('Classic');
    expect(card).toHaveTextContent(/How Brook looks in the 3D room/);
    // Before Items and the Journey, after the condition; apart from the other Blobbis
    const items = within(sheet).getByTestId('room-open-items');
    expect(card.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const condition = within(sheet).getByRole('region', { name: 'Condition and progress' });
    expect(condition.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).queryByText('Your Blobbis')).toBeNull();
    // The options, labelled, each with the Blobbi in it
    expect(within(card).getByTestId('room-appearance-2d')).toHaveTextContent(/Classic/);
    expect(within(card).getByTestId('room-appearance-3d')).toHaveTextContent(/3D Model/);
    expect(within(card).getByTestId('room-appearance-thumb-2d').querySelector('[data-blobbi-renderer]')).not.toBeNull();
    expect(within(card).getByTestId('room-appearance-thumb-3d')).toBeInTheDocument();
    fireEvent.keyDown(sheet, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('room-menu'));
    const menu = await screen.findByTestId('menu-sheet');
    expect(within(menu).queryByTestId('room-appearance-panel')).toBeNull();
    expect(within(menu).queryByText('Appearance')).toBeNull();
  });

  it('choosing 3D Model is remembered on this device and nowhere else: the chip, the room and a fresh visit agree; nothing is published', async () => {
    signedInWith('adult');
    localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    const first = renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    expect(shell()).toHaveAttribute('data-blobbi-render', '2d');
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    fireEvent.click(screen.getByTestId('room-appearance-3d'));
    expect(screen.getByTestId('room-appearance-current')).toHaveTextContent('3D Model');
    expect(screen.getByTestId('room-appearance-current')).toHaveAttribute('data-appearance', '3d');
    expect(shell()).toHaveAttribute('data-blobbi-render', '3d');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('3d');
    first.unmount();
    renderRoom();
    await screen.findByTestId('room-blobbi-anchor');
    await waitFor(() => expect(shell()).toHaveAttribute('data-blobbi-render', '3d'));
    fireEvent.click(screen.getByTestId('room-bar-blobbi'));
    expect(screen.getByTestId('room-appearance-current')).toHaveTextContent('3D Model');
    expect(screen.getByTestId('room-appearance-3d')).toHaveAttribute('aria-checked', 'true');
    expect(relay.published).toEqual([]);
  });
});
