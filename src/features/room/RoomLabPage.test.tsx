/**
 * The `/room/3d-lab` route: a dev route beside `/room`, isolated from the
 * home. It shows three fixed identities (and the signed-in V3 Blobbi), the
 * 2D drawing and the 3D model of each, front, side and back, a stage with
 * view and motion controls, and the room with a 2D/3D switch. Opening it
 * and using it publishes nothing and writes nothing to localStorage.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { readFileSync } from 'node:fs';

import AppRouter from '@/AppRouter';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';

const currentUser = vi.hoisted(() => ({ user: undefined as { pubkey: string; signer: unknown } | undefined }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser.user, users: currentUser.user ? [currentUser.user] : [] }),
}));

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]) => relay.all.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)))));
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
});
const pool = { query, event } as unknown as NPool;

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: pool }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>,
  );
}

beforeAll(() => {
  // jsdom: no WebGL, no 2D canvas. The stages say so; the model is still built.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

beforeEach(() => {
  relay.all = [];
  relay.published = [];
  currentUser.user = undefined;
});

function storageKeys(): string[] {
  return Object.keys(localStorage).filter((k) => k !== 'test:login').sort();
}

describe('the /room/3d-lab route', () => {
  it('is gated like /room: a dev build only, lazily, and the router never imports the dev tools', () => {
    const router = readFileSync('src/AppRouter.tsx', 'utf8');
    expect(router).toMatch(/const RoomLab = import\.meta\.env\.DEV \? lazy\(\(\) => import\('@\/features\/room\/RoomLabPage'\)\) : null;/);
    expect(router).not.toMatch(/dev\//);
    const page = readFileSync('src/features/room/RoomLabPage.tsx', 'utf8');
    expect(page).not.toMatch(/from '@\/dev\//);
    expect(page).not.toMatch(/localStorage|sessionStorage|useNostrPublish|\.event\(/);
  });

  it('shows three fixed identities as 2D drawings and 3D stages, front, side and back, with the stage controls', async () => {
    const before = storageKeys();
    renderAt('/room/3d-lab');
    await waitFor(() => expect(screen.getByTestId('room-lab')).toBeInTheDocument());
    for (const id of ['one', 'two', 'three']) expect(screen.getByTestId(`lab-identity-${id}`)).toBeInTheDocument();
    expect(screen.queryByTestId('lab-identity-mine')).toBeNull();
    const seed = screen.getByTestId('lab-seed').textContent;
    for (const v of ['front', 'side', 'back']) {
      const column = screen.getByTestId(`lab-compare-${v}`);
      expect(within(column).getByTestId(`lab-2d-${v}`).querySelector('[data-blobbi-generation="v3"]')).not.toBeNull();
      const stage = within(column).getByTestId(`lab-stage-${v}`);
      expect(stage).toHaveAttribute('data-view', v);
      expect(stage).toHaveAttribute('data-motion', 'still');
      expect(stage).toHaveAttribute('data-stage', 'unavailable');
    }
    // Another identity: another seed, in every panel
    fireEvent.click(screen.getByTestId('lab-identity-two'));
    expect(screen.getByTestId('lab-seed').textContent).not.toBe(seed);
    expect(screen.getByTestId('lab-stage-front')).toHaveAttribute('data-seed', expect.stringContaining(screen.getByTestId('lab-seed').textContent!.slice(5, 21)));
    // The same identity again is the same seed
    fireEvent.click(screen.getByTestId('lab-identity-one'));
    expect(screen.getByTestId('lab-seed').textContent).toBe(seed);
    // The stage controls
    const main = screen.getByTestId('lab-stage-main');
    expect(main).toHaveAttribute('data-view', 'turn');
    fireEvent.click(screen.getByTestId('lab-view-back'));
    expect(main).toHaveAttribute('data-view', 'back');
    fireEvent.click(screen.getByTestId('lab-motion-walking'));
    expect(main).toHaveAttribute('data-motion', 'walking');
    fireEvent.click(screen.getByTestId('lab-life-baby'));
    expect(screen.getByTestId('lab-life-baby')).toHaveAttribute('aria-pressed', 'true');
    // The gaze: at rest until the eyes are told to follow the pointer
    expect(main).toHaveAttribute('data-tracking', 'rest');
    fireEvent.click(screen.getByTestId('lab-gaze-track'));
    expect(main).toHaveAttribute('data-tracking', 'pointer');
    fireEvent.click(screen.getByTestId('lab-gaze-rest'));
    expect(main).toHaveAttribute('data-tracking', 'rest');
    expect(relay.published).toEqual([]);
    expect(event).not.toHaveBeenCalled();
    expect(storageKeys()).toEqual(before);
  });

  it('draws the comparison matrix on request: nine addresses as adults and babies, each the kit\'s drawing beside three 3D stills', async () => {
    renderAt('/room/3d-lab');
    await waitFor(() => expect(screen.getByTestId('room-lab')).toBeInTheDocument());
    expect(screen.queryByTestId('lab-matrix')).toBeNull();
    fireEvent.click(screen.getByTestId('lab-matrix-toggle'));
    const matrix = screen.getByTestId('lab-matrix');
    const rows = matrix.querySelectorAll('[data-testid^="lab-matrix-adult-"], [data-testid^="lab-matrix-baby-"]');
    const rowIds = [...rows].map((r) => r.getAttribute('data-testid')!).filter((id) => /^lab-matrix-(adult|baby)-\d+$/.test(id));
    expect(rowIds.filter((id) => id.includes('adult'))).toHaveLength(9);
    expect(rowIds.filter((id) => id.includes('baby'))).toHaveLength(9);
    // Nine different Blobbis, each the same seed as an adult and as a baby
    const seeds = (stage: string) => rowIds.filter((id) => id.includes(stage)).map((id) => screen.getByTestId(id).getAttribute('data-seed'));
    expect(new Set(seeds('adult')).size).toBe(9);
    expect(seeds('baby')).toEqual(seeds('adult'));
    for (const id of rowIds) {
      expect(screen.getByTestId(`${id}-2d`).querySelector('[data-blobbi-generation="v3"]')).not.toBeNull();
      for (const view of ['front', 'side', 'back']) expect(screen.getByTestId(`${id}-${view}`)).toHaveAttribute('data-still', 'unavailable');
    }
    expect(relay.published).toEqual([]);
  });

  it('draws the Blobbi in the room as the 2D drawing or the 3D model, switched without leaving the room', async () => {
    renderAt('/room/3d-lab');
    await waitFor(() => expect(screen.getByTestId('room-shell')).toBeInTheDocument());
    const shell = screen.getByTestId('room-shell');
    expect(shell).toHaveAttribute('data-blobbi-render', '2d');
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('lab-render-3d'));
    expect(screen.getByTestId('room-shell')).toBe(shell);
    expect(shell).toHaveAttribute('data-blobbi-render', '3d');
    expect(screen.queryByTestId('room-blobbi-anchor')).toBeNull();
    fireEvent.click(screen.getByTestId('lab-render-2d'));
    expect(shell).toHaveAttribute('data-blobbi-render', '2d');
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    expect(relay.published).toEqual([]);
  });

  it('adds the signed-in V3 Blobbi to the identities, and leaves /room and the home as they were', async () => {
    currentUser.user = { pubkey: PUBKEY, signer: {} };
    relay.all = [blobbiEvent('0000000007', { name: 'Mine', stage: 'adult', visualGeneration: 'v3' })];
    renderAt('/room/3d-lab');
    await waitFor(() => expect(screen.getByTestId('lab-identity-mine')).toBeInTheDocument());
    expect(screen.getByTestId('lab-identity-mine')).toHaveTextContent('Mine (yours)');
    fireEvent.click(screen.getByTestId('lab-identity-mine'));
    expect(screen.getByTestId('lab-room-dock')).toBeInTheDocument();
    expect(relay.published).toEqual([]);
  });
});
