/**
 * The Dev Lab (`/dev`): the real home inside an engineering layout, over
 * the fixture controller. Quick fixtures set generation and stage without
 * a reload, the lifecycle pipeline sets and performs, the generation is
 * shown explicitly and survives hatch and evolve, the movement lab drives
 * the game's own scene controller, pins are presentation only, the sound
 * lab plays without a write, and nothing can reach a relay.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';
import { SoundProvider } from '@/features/sound';
import NotFound from '@/pages/NotFound';
import { AppRouter } from '@/AppRouter';
import DevFixture from './DevFixture';
import DevLab from './DevLab';

const socket = vi.fn();

function renderLab(search = '?fixture=egg') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SoundProvider>
      <NostrLoginProvider storageKey="test:login">
        <QueryClientProvider client={client}>
          <DevFixture search={search} floatingPanel={false}>
            <MemoryRouter initialEntries={['/dev']}>
              <Routes>
                <Route path="/dev" element={<DevLab />} />
              </Routes>
            </MemoryRouter>
          </DevFixture>
        </QueryClientProvider>
      </NostrLoginProvider>
    </SoundProvider>,
  );
}

const actor = () => screen.getByTestId('blobbi-actor');
const renderer = () => actor().querySelector('[data-blobbi-renderer]') as HTMLElement;
const ready = () => waitFor(() => expect(screen.getByTestId('blobbi-actor')).toBeInTheDocument(), { timeout: 3000 });
const generation = () => screen.getByTestId('dev-lab-generation').textContent;

beforeEach(() => {
  vi.stubGlobal('WebSocket', socket);
});
afterEach(() => {
  vi.unstubAllGlobals();
  socket.mockClear();
});

describe('the Dev Lab page', () => {
  it('says what it is, shows the generation explicitly, mounts the real home, and never opens a socket', async () => {
    renderLab();
    await ready();
    expect(screen.getByTestId('dev-lab-banner')).toHaveTextContent('DEV FIXTURE — IN-MEMORY NOSTR');
    expect(generation()).toBe('Generation: V1');
    expect(screen.getByTestId('home-scene')).toBeInTheDocument();
    expect(screen.getByTestId('care-dock')).toBeInTheDocument();
    expect(screen.queryByTestId('dev-panel')).toBeNull();
    expect(socket).not.toHaveBeenCalled();
  });

  it('quick fixtures: V2 egg, V2 baby and V2 adult are one creature born V2; V1 stays V1; the drawing follows', async () => {
    renderLab();
    await ready();
    await userEvent.click(screen.getByTestId('dev-stage-egg-v2'));
    await waitFor(() => expect(generation()).toBe('Generation: V2'));
    expect(renderer()).toHaveAttribute('data-blobbi-stage', 'egg');
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2');
    await userEvent.click(screen.getByTestId('dev-stage-baby-v2'));
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby'));
    expect(generation()).toBe('Generation: V2');
    await userEvent.click(screen.getByTestId('dev-stage-adult-v2'));
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'adult'));
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2');
    expect(renderer().querySelectorAll('[data-part$="-leg"]')).toHaveLength(2);
    expect(renderer().querySelector('[data-part="ground-shadow"]')).toBeNull();
    await userEvent.click(screen.getByTestId('dev-stage-adult-v1'));
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v1'));
    expect(generation()).toBe('Generation: V1');
    expect(actor()).toHaveAttribute('data-generation', 'v1');
  });

  it('the V2 path through the real hooks: a V2 egg hatches into a V2 baby and evolves into a V2 adult; the V1 path stays V1', async () => {
    renderLab();
    await ready();
    for (const gen of ['v2', 'v1'] as const) {
      await userEvent.click(screen.getByTestId(`dev-stage-egg-${gen}`));
      await waitFor(() => expect(generation()).toBe(`Generation: ${gen.toUpperCase()}`));
      await userEvent.click(screen.getByTestId('dev-action-start-incubation'));
      await waitFor(() => expect(screen.getByTestId('dev-lifecycle-next')).toHaveTextContent('incubate'), { timeout: 3000 });
      await userEvent.click(screen.getByTestId('dev-missions-complete'));
      await waitFor(() => expect(screen.getByTestId('dev-lifecycle-ready')).toHaveTextContent('ready'), { timeout: 3000 });
      await userEvent.click(screen.getByTestId('dev-action-hatch'));
      await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby'), { timeout: 3000 });
      expect(generation()).toBe(`Generation: ${gen.toUpperCase()}`);
      await userEvent.click(screen.getByTestId('dev-missions-complete'));
      await waitFor(() => expect(screen.getByTestId('dev-lifecycle-ready')).toHaveTextContent('ready'), { timeout: 3000 });
      await userEvent.click(screen.getByTestId('dev-action-evolve'));
      await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'adult'), { timeout: 3000 });
      expect(generation()).toBe(`Generation: ${gen.toUpperCase()}`);
      expect(renderer()).toHaveAttribute('data-blobbi-generation', gen);
      expect(screen.getByTestId('dev-inspector-generation')).toHaveTextContent(gen.toUpperCase());
    }
    expect(socket).not.toHaveBeenCalled();
  });

  it('the lifecycle pipeline: each step is a Set that places the fixture there and lights up', async () => {
    renderLab();
    await ready();
    await userEvent.click(screen.getByTestId('dev-step-hatch-ready'));
    await waitFor(() => expect(screen.getByTestId('dev-lifecycle-ready')).toHaveTextContent('ready'), { timeout: 3000 });
    expect(screen.getByTestId('dev-step-hatch-ready')).toHaveAttribute('aria-current', 'step');
    expect(actor()).toHaveAttribute('data-egg-crack', 'heavy');
    await userEvent.click(screen.getByTestId('dev-step-evolution-ready'));
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby'));
    await waitFor(() => expect(screen.getByTestId('dev-lifecycle-ready')).toHaveTextContent('ready'), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /evolve!/i })).toBeInTheDocument();
  });

  it('the movement lab drives the game\'s own scene controller: a walk changes motion and facing on the actor, stop ends it, a turn faces it', async () => {
    renderLab('?fixture=adult-v2');
    await ready();
    await waitFor(() => expect(screen.getByTestId('dev-movement-state')).not.toHaveTextContent('no scene mounted'));
    await userEvent.click(screen.getByTestId('dev-walk-right'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-motion', 'walking'));
    expect(actor()).toHaveAttribute('data-facing', 'right');
    expect(screen.getByTestId('dev-movement-state')).toHaveTextContent('walking');
    await userEvent.click(screen.getByTestId('dev-walk-stop'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-motion', 'idle'));
    await userEvent.click(screen.getByTestId('dev-turn-back'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-facing', 'back'));
    expect(renderer().querySelector('[data-part="left-leg"]')).not.toBeNull();
    // Walking, turning, poking and animating are presentation: not one event was published.
    await userEvent.click(screen.getByTestId('dev-poke'));
    expect(screen.getByTestId('dev-published')).toHaveTextContent('0');
    expect(socket).not.toHaveBeenCalled();
  });

  it('pins override the presentation, not the data: a forced face leaves happiness alone; clearing hands the face back', async () => {
    renderLab('?fixture=baby');
    await ready();
    await userEvent.click(screen.getByTestId('dev-expression-upset'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-expression', 'upset'));
    expect(screen.getByTestId('dev-pins-active')).toBeInTheDocument();
    expect(screen.getByTestId('dev-stat-happiness')).toHaveValue('72');
    expect(screen.getByTestId('dev-inspector-stats')).toHaveTextContent('happiness 72');
    await userEvent.click(screen.getByTestId('dev-clear-pins'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-expression', 'neutral'));
    expect(screen.queryByTestId('dev-pins-active')).toBeNull();
  });

  it('the debug overlay draws into the real room canvas and can be turned off', async () => {
    renderLab('?fixture=baby');
    await ready();
    await userEvent.click(screen.getByTestId('dev-overlay-toggle'));
    await waitFor(() => expect(within(screen.getByTestId('room-canvas')).getByTestId('dev-overlay')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('dev-overlay-toggle'));
    await waitFor(() => expect(screen.queryByTestId('dev-overlay')).toBeNull());
  });

  it('the sound lab lists the voice\'s own recipes and plays without a care action or a write', async () => {
    renderLab('?fixture=baby');
    await ready();
    const before = screen.getByTestId('dev-published').textContent;
    for (const id of ['poke', 'upset', 'sleepy', 'eat', 'clean', 'hatch', 'evolve']) expect(screen.getByTestId(`dev-sound-${id}`)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('dev-sound-poke'));
    expect(screen.getByTestId('dev-sound-toggle')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('dev-published').textContent).toBe(before);
    expect(KIND_BLOBBI_STATE).toBeGreaterThan(0);
  });

  it('the inspector shows the parsed Blobbi and never a private key', async () => {
    renderLab('?fixture=baby');
    await ready();
    expect(screen.getByTestId('dev-inspector-stage')).toHaveTextContent('baby');
    expect(screen.getByTestId('dev-inspector-seed').textContent).toHaveLength(64);
    await userEvent.click(screen.getByTestId('dev-inspector-raw'));
    expect(screen.getByTestId('dev-inspector-tags')).toHaveTextContent('d = blobbi-aaaaaaaaaaaa-0000000001');
    expect(document.body.textContent).not.toMatch(/nsec1|private key/i);
  });
});

describe('without a dev build, /dev is nothing', () => {
  it('the router hands /dev to Not Found when no lab is provided, exactly like any unknown path', () => {
    const dev = render(
      <MemoryRouter initialEntries={['/dev']}>
        <AppRouter />
      </MemoryRouter>,
    ).container.textContent;
    document.body.innerHTML = '';
    const nowhere = render(
      <MemoryRouter initialEntries={['/nowhere']}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    ).container.textContent;
    expect(dev).toBe(nowhere);
    expect(dev).not.toMatch(/DEV FIXTURE/);
  });
});
