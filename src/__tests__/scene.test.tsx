/**
 * The living home, end to end: tapping the floor moves the Blobbi, the
 * renderer receives the composed presentation, idle and gaze run on their
 * own, care reactions show on the face, rest is walk-then-sleep, and none of
 * the behaviour layer ever publishes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these are its own tests, so it is the one opened
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, BLOBBONAUT_PROFILE_KINDS, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { HOME_SPOT, SceneSettingsProvider, placeOnFloor, type BlobbiSceneController, type SceneSettings } from '@/features/home/scene';
import { DEFAULT_SCENE_SETTINGS } from '@/features/home/scene/scene-settings';
import { paceFor } from '@/features/home/scene/motion-contract';
import { approachSpot } from '@/features/home/rooms';
import { STAGE_OBJECTS } from '@/features/home/space/home-space';
import { PUBKEY, blobbiEvent } from '@/test/fixtures';
import { chooseCare } from '@/test/care-ui';

/** Where the bed puts a sleeper when it comes out. */
const BED_SLEEP_SPOT = approachSpot(STAGE_OBJECTS.bed);

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

// ─── Relay double ────────────────────────────────────────────────────────────

const relay = { state: [] as NostrEvent[], published: [] as NostrEvent[] };
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const out: NostrEvent[] = [];
  for (const f of filters) {
    const kinds = f.kinds ?? [];
    if (kinds.includes(KIND_BLOBBI_STATE)) {
      const ds = f['#d'];
      out.push(...relay.state.filter((e) => !ds || ds.includes(getTagValue(e.tags, 'd') ?? '')));
    }
    if (kinds.some((k) => (BLOBBONAUT_PROFILE_KINDS as readonly number[]).includes(k))) out.push();
  }
  return out;
});
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  const d = getTagValue(ev.tags, 'd');
  if (ev.kind === KIND_BLOBBI_STATE) relay.state = [...relay.state.filter((e) => getTagValue(e.tags, 'd') !== d), ev];
});
const pool = { query, event } as unknown as NPool;

/** Fast walks so arrival is a few frames away; idle off unless a test turns it on. */
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
const brook = (state: 'active' | 'sleeping' = 'active') =>
  blobbiEvent('0000000001', { name: 'Brook', stage: 'baby', state, createdAt: NOW - 120, set: { hunger: '40', happiness: '50', hygiene: '45', energy: '70' } });

const actor = () => screen.getByTestId('blobbi-actor');
// Scoped to the actor: the HUD chip draws a small portrait through the same renderer.
const bodyBox = () => document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-body-box]') as HTMLElement;
const renderer = () => document.querySelector('[data-testid="blobbi-actor"] [data-blobbi-renderer]') as HTMLElement;
const published31124 = () => relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);

/** jsdom has no layout: give the scene a box so taps map to floor points. */
function giveSceneABox() {
  const scene = screen.getByTestId('room-canvas');
  scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  return scene;
}

async function ready() {
  await screen.findByRole('group', { name: /care for your blobbi/i });
  giveSceneABox();
  return actor();
}

beforeEach(() => {
  currentUser.user = { pubkey: PUBKEY, signer };
  relay.state = [brook()];
  relay.published = [];
  signCount = 0;
  query.mockClear();
  event.mockClear();
});

describe('Scene: locomotion', () => {
  it('starts at home, idle, facing front, with the presentation on the renderer', async () => {
    renderHome();
    const a = await ready();
    expect(a).toHaveAttribute('data-motion', 'idle');
    expect(a).toHaveAttribute('data-facing', 'front');
    expect(parseFloat(a.style.left)).toBeCloseTo(parseFloat(placeOnFloor(HOME_SPOT).left));
    expect(renderer()).toHaveAttribute('data-blobbi-facing', 'front');
    expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'idle');
  });

  it('a tap on the floor walks the Blobbi there, facing the way it goes, and it faces the viewer again on arrival', async () => {
    renderHome();
    const a = await ready();
    const startLeft = a.style.left;
    // Left side of the floor band: x = 20%, y inside the band.
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 200, clientY: 420, detail: 1 });
    expect(a).toHaveAttribute('data-motion', 'walking');
    expect(a).toHaveAttribute('data-facing', 'left');
    expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'walking');
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'));
    expect(a.style.left).not.toBe(startLeft);
    expect(a).toHaveAttribute('data-x', '0.200');
    // Standing still, it faces the viewer: never left in profile after a walk.
    expect(a).toHaveAttribute('data-facing', 'front');
    expect(renderer()).toHaveAttribute('data-blobbi-facing', 'front');
    expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'idle');
  });

  it('walking up the floor shows its back, walking down it its front, and either way it ends facing the viewer', async () => {
    renderHome();
    const a = await ready();
    // Straight down the floor from where it stands (toward the viewer): the front of the floor band, same x.
    const x = Number(a.getAttribute('data-x')) * 1000;
    const startY = Number(a.getAttribute('data-y'));
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: x, clientY: 575, detail: 1 });
    expect(a).toHaveAttribute('data-motion', 'walking');
    expect(a).toHaveAttribute('data-facing', 'front');
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'));
    const down = Number(a.getAttribute('data-y'));
    expect(down).toBeGreaterThan(startY);
    expect(a).toHaveAttribute('data-facing', 'front');
    // And back up it (away): it shows its back while it goes, and turns round when it is there.
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: x, clientY: 380, detail: 1 });
    expect(a).toHaveAttribute('data-motion', 'walking');
    expect(a).toHaveAttribute('data-facing', 'back');
    expect(renderer()).toHaveAttribute('data-blobbi-facing', 'back');
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'));
    expect(Number(a.getAttribute('data-y'))).toBeLessThan(down);
    expect(a).toHaveAttribute('data-facing', 'front');
    expect(renderer()).toHaveAttribute('data-blobbi-facing', 'front');
  });

  it('with no override the app walks at the Blobbi\'s own gait: unhurried across the room, quicker up and down the floor', { timeout: 20_000 }, async () => {
    // The app's own settings carry no walking speed: it comes from the gait (`motion-contract.ts`).
    expect(DEFAULT_SCENE_SETTINGS.walkSpeed).toBeUndefined();
    renderHome({ idleEnabled: false });
    const a = await ready();
    const timed = async (clientX: number, clientY: number) => {
      const from = { x: Number(a.getAttribute('data-x')), y: Number(a.getAttribute('data-y')) };
      fireEvent.click(screen.getByTestId('scene-floor'), { clientX, clientY, detail: 1 });
      expect(a).toHaveAttribute('data-motion', 'walking');
      const started = performance.now();
      await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'), { timeout: 8_000 });
      const seconds = (performance.now() - started) / 1000;
      return { seconds, dx: Math.abs(Number(a.getAttribute('data-x')) - from.x), dy: Math.abs(Number(a.getAttribute('data-y')) - from.y), y: from.y };
    };
    // A short way across (a tenth of the floor), then up the floor.
    const startX = Number(a.getAttribute('data-x')) * 1000;
    const startY = (0.72 + Number(a.getAttribute('data-y')) * 0.25) * 600;
    const across = await timed(startX - 100, startY);
    const pace = paceFor('baby', 'v1', across.y);
    expect(across.dx).toBeCloseTo(0.1, 2);
    expect(across.seconds).toBeGreaterThan((across.dx / pace.side) * 0.8);
    expect(across.seconds).toBeLessThan((across.dx / pace.side) * 1.6);
    const along = await timed(Number(a.getAttribute('data-x')) * 1000, 380);
    expect(along.dy).toBeGreaterThan(0.2);
    expect(along.seconds).toBeGreaterThan((along.dy / pace.depth) * 0.8);
    expect(along.seconds).toBeLessThan((along.dy / pace.depth) * 1.6);
    // Up the floor covers more of it per second than across: the two are a gait's own paces, not one number.
    expect(along.dy / along.seconds).toBeGreaterThan((across.dx / across.seconds) * 2);
  });

  it('a walk that is interrupted leaves it facing the viewer too', async () => {
    let controller!: BlobbiSceneController;
    renderHome({ ...FAST, walkSpeed: 0.2, onController: (c) => void (c && (controller = c)) });
    const a = await ready();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 200, clientY: 420, detail: 1 });
    expect(a).toHaveAttribute('data-motion', 'walking');
    expect(a).toHaveAttribute('data-facing', 'left');
    // The walk is ended on the way (it is put where it stands): no arrival, and still it faces the viewer.
    act(() => controller.placeAt(controller.presentation.position));
    expect(a).toHaveAttribute('data-motion', 'idle');
    expect(a).toHaveAttribute('data-facing', 'front');
  });

  it('keyboard activation of the floor calls the Blobbi to the middle', async () => {
    renderHome();
    const a = await ready();
    fireEvent.click(screen.getByTestId('scene-floor'), { detail: 0 });
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'));
    expect(a).toHaveAttribute('data-x', '0.500');
  });

  it('under reduced motion the Blobbi is simply there', async () => {
    renderHome({ ...FAST, reducedMotion: true });
    const a = await ready();
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 800, clientY: 420, detail: 1 });
    expect(a).toHaveAttribute('data-motion', 'idle');
    expect(a).toHaveAttribute('data-x', '0.800');
    expect(a).toHaveAttribute('data-facing', 'front');
  });

  it('a sleeping Blobbi cannot be called', async () => {
    relay.state = [brook('sleeping')];
    renderHome();
    const a = await ready();
    expect(screen.getByTestId('scene-floor')).toBeDisabled();
    expect(a).toHaveAttribute('data-sleeping', 'true');
    expect(parseFloat(a.style.left)).toBeCloseTo(parseFloat(placeOnFloor(BED_SLEEP_SPOT).left));
  });
});

describe('Scene: gaze', () => {
  it('a mouse over the scene draws the eyes towards it, and leaving lets go', async () => {
    renderHome();
    await ready();
    const scene = screen.getByTestId('home-scene');
    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 900, clientY: 0 });
    await waitFor(() => expect(bodyBox().style.getPropertyValue('--blobbi-eye-x')).toBe('1'));
    fireEvent.pointerLeave(scene);
    await waitFor(() => expect(bodyBox().style.getPropertyValue('--blobbi-eye-x')).toBe(''));
  });

  it('a touch tap gives it something to look at without hover', async () => {
    renderHome();
    await ready();
    fireEvent.pointerDown(screen.getByTestId('home-scene'), { pointerType: 'touch', clientX: -900, clientY: 0 });
    await waitFor(() => expect(bodyBox().style.getPropertyValue('--blobbi-eye-x')).toBe('-1'));
  });
});

describe('Scene: idle', () => {
  it('left alone, it glances and strolls on its own; a tap takes priority', async () => {
    // Scripted beats (each plan is followed by one draw for the next delay):
    // rest | glance right | stroll right.
    const script = [0.95, 0.5, 0.1, 0.9, 0.5, 0, 0.5, 0.7, 0.9, 0.5, 0.5];
    const random = () => script.shift() ?? 0.95;
    renderHome({ walkSpeed: 4, idleEnabled: true, idle: { inactivityMs: 30, intervalMs: 30 }, random });
    const a = await ready();
    await waitFor(() => expect(bodyBox().style.getPropertyValue('--blobbi-eye-x')).not.toBe(''), { timeout: 2000 });
    await waitFor(() => expect(a).not.toHaveAttribute('data-x', '0.500'), { timeout: 2000 });
    expect(event).not.toHaveBeenCalled();
  });
});

describe('Scene: reactions', () => {
  it('feeding puts a happy face on; the baseline is neutral', async () => {
    renderHome();
    const a = await ready();
    expect(a).toHaveAttribute('data-expression', 'neutral');
    await chooseCare('feed');
    await waitFor(() => expect(a).toHaveAttribute('data-expression', 'happy'));
    expect(published31124()).toHaveLength(1);
  });

  it('a poke makes it happy and publishes nothing', async () => {
    renderHome();
    const a = await ready();
    await userEvent.click(screen.getByRole('img', { name: 'Brook' }));
    expect(a).toHaveAttribute('data-expression', 'happy');
    expect(event).not.toHaveBeenCalled();
  });
});

describe('Scene: rest is walk-then-sleep', () => {
  it('walks to the bed first and only publishes sleep on arrival', async () => {
    renderHome({ walkSpeed: 1.2, idleEnabled: false });
    const a = await ready();
    const before = query.mock.calls.length;
    await userEvent.click(screen.getByTestId('care-rest'));
    expect(a).toHaveAttribute('data-motion', 'walking');
    expect(event).not.toHaveBeenCalled();
    expect(query.mock.calls.length).toBe(before);
    expect(screen.getByTestId('care-rest')).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(published31124()).toHaveLength(1), { timeout: 3000 });
    expect(getTagValue(published31124()[0].tags, 'state')).toBe('sleeping');
    await waitFor(() => expect(a).toHaveAttribute('data-sleeping', 'true'));
    expect(a).toHaveAttribute('data-x', BED_SLEEP_SPOT.x.toFixed(3));
    expect(a).toHaveAttribute('data-motion', 'still');
    expect(bodyBox()).not.toHaveAttribute('data-blobbi-motion');

    await userEvent.click(screen.getByTestId('care-rest'));
    await waitFor(() => expect(published31124()).toHaveLength(2));
    expect(getTagValue(published31124()[1].tags, 'state')).toBe('active');
    await waitFor(() => expect(a).toHaveAttribute('data-sleeping', 'false'));
    expect(a).toHaveAttribute('data-motion', 'idle');
    expect(a).toHaveAttribute('data-x', BED_SLEEP_SPOT.x.toFixed(3));
  });

  it('a tap elsewhere on the way to bed cancels the sleep: nothing is published', async () => {
    renderHome({ walkSpeed: 1.2, idleEnabled: false });
    const a = await ready();
    await userEvent.click(screen.getByTestId('care-rest'));
    expect(a).toHaveAttribute('data-motion', 'walking');
    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 150, clientY: 500, detail: 1 });
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'), { timeout: 3000 });
    expect(a).toHaveAttribute('data-x', '0.150');
    expect(event).not.toHaveBeenCalled();
    expect(screen.getByTestId('care-rest')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('under reduced motion rest publishes without delay', async () => {
    renderHome({ ...FAST, reducedMotion: true });
    await ready();
    await userEvent.click(screen.getByTestId('care-rest'));
    await waitFor(() => expect(published31124()).toHaveLength(1));
    expect(getTagValue(published31124()[0].tags, 'state')).toBe('sleeping');
  });
});

describe('Scene: Nostr boundary', () => {
  it('walking, looking, idling, turning and reacting publish nothing and read nothing', async () => {
    // Beats: turn | glance | stroll (each followed by a delay draw).
    const script = [0.5, 0.5, 0.5, 0.1, 0.5, 0.5, 0, 0.5, 0.7, 0.9, 0.9, 0.5];
    const random = () => script.shift() ?? 0.95;
    renderHome({ walkSpeed: 4, idleEnabled: true, idle: { inactivityMs: 30, intervalMs: 30 }, random });
    const a = await ready();
    const reads = query.mock.calls.length;
    const scene = screen.getByTestId('home-scene');

    fireEvent.click(screen.getByTestId('scene-floor'), { clientX: 300, clientY: 420, detail: 1 });
    await waitFor(() => expect(a).toHaveAttribute('data-motion', 'idle'));
    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 900, clientY: 0 });
    fireEvent.pointerDown(scene, { pointerType: 'touch', clientX: 0, clientY: 0 });
    await userEvent.click(screen.getByRole('img', { name: 'Brook' }));
    // Let idle take a few beats (a turn, a glance, a stroll).
    await waitFor(() => expect(a).not.toHaveAttribute('data-facing', 'left'), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));

    expect(event).not.toHaveBeenCalled();
    expect(query.mock.calls.length).toBe(reads);
    expect(relay.published).toHaveLength(0);
  });
});
