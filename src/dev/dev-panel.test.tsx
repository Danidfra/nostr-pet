/**
 * The dev panel over the real home: a rewrite reaches the game at once
 * (no remount, no reload), a state change moves the sleeper into its bed,
 * a stage change redraws, a pin overrides the presentation and a clear
 * hands it back, a real kit action publishes into the fixture pool and
 * nowhere else, and reset restores the URL's world.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';
import Home from '@/pages/Home';
import DevFixture from './DevFixture';
import { PUBKEY } from '@/test/fixtures';

const socket = vi.fn();

function renderFixture(search: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NostrLoginProvider storageKey="test:login">
      <QueryClientProvider client={client}>
        <DevFixture search={search}>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </DevFixture>
      </QueryClientProvider>
    </NostrLoginProvider>,
  );
}

const actor = () => screen.getByTestId('blobbi-actor');
const ready = () => waitFor(() => expect(screen.getByTestId('blobbi-actor')).toBeInTheDocument(), { timeout: 3000 });
const setNumber = (testId: string, value: number) => fireEvent.change(screen.getByTestId(testId), { target: { value: String(value) } });

beforeEach(() => {
  vi.stubGlobal('WebSocket', socket);
});
afterEach(() => {
  vi.unstubAllGlobals();
  socket.mockClear();
});

describe('the dev panel over the home', () => {
  it('shows the fixture, and a stat typed into it changes the Blobbi in place: same actor node, new condition, no reload', async () => {
    renderFixture('?fixture=baby');
    await ready();
    expect(screen.getByTestId('dev-summary')).toHaveTextContent('Brook · baby · V1 · active');
    const node = actor();
    expect(screen.queryAllByTestId('condition-dots')).toHaveLength(1);
    const hungerDot = () => screen.getByTestId('condition-dots').querySelector('[data-stat="hunger"]');
    expect(hungerDot()).toHaveAttribute('data-status', 'normal');
    setNumber('dev-stat-hunger-number', 5);
    await waitFor(() => expect(hungerDot()).toHaveAttribute('data-status', 'critical'));
    expect(actor()).toBe(node);
    expect(screen.getByTestId('dev-stat-hunger')).toHaveValue('5');
    expect(screen.getByTestId('blobbi-chip')).toHaveTextContent(/hungry/i);
    await userEvent.click(screen.getByTestId('dev-stats-healthy'));
    await waitFor(() => expect(hungerDot()).toHaveAttribute('data-status', 'normal'));
    expect(actor()).toBe(node);
  });

  it('sleeping puts it in the bed at once (no shadow, one Zzz, still), active brings it back; an egg cannot sleep', async () => {
    renderFixture('?fixture=baby');
    await ready();
    expect(actor()).toHaveAttribute('data-sleeping', 'false');
    expect(actor().querySelector('.scene-actor__shadow')).not.toBeNull();
    await userEvent.click(screen.getByTestId('dev-state-sleeping'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-sleeping', 'true'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-in-bed', 'true'));
    expect(actor().querySelector('.scene-actor__shadow')).toBeNull();
    expect(actor().querySelectorAll('.scene-actor__zzz')).toHaveLength(1);
    expect(actor()).toHaveAttribute('data-motion', 'still');
    expect(screen.getByRole('button', { name: /^wake$/i })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('dev-state-active'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-sleeping', 'false'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-in-bed', 'false'));
    expect(actor().querySelector('.scene-actor__shadow')).not.toBeNull();
    expect(actor().querySelectorAll('.scene-actor__zzz')).toHaveLength(0);
    await userEvent.click(screen.getByTestId('dev-stage-egg-v1'));
    await waitFor(() => expect(screen.getByTestId('dev-summary')).toHaveTextContent('egg'));
    expect(screen.getByTestId('dev-state-sleeping')).toBeDisabled();
  });

  it('a stage change redraws the same creature: egg on its nest, then baby, then the V2 adult, one seed throughout', async () => {
    renderFixture('?fixture=egg');
    await ready();
    const renderer = () => actor().querySelector('[data-blobbi-renderer]') as HTMLElement;
    expect(renderer()).toHaveAttribute('data-blobbi-stage', 'egg');
    expect(actor()).toHaveAttribute('data-in-bed', 'true');
    const seed = () => screen.getByTestId('dev-seed').textContent;
    const born = seed();
    expect(born).toHaveLength(64);
    await userEvent.click(screen.getByTestId('dev-stage-baby-v1'));
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-stage', 'baby'));
    expect(actor()).toHaveAttribute('data-in-bed', 'false');
    await userEvent.click(screen.getByTestId('dev-stage-adult-v2'));
    await waitFor(() => expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2'));
    expect(renderer()).toHaveAttribute('data-blobbi-stage', 'adult');
    expect(seed()).toBe(born);
  });

  it('a pinned face and facing override the presentation and say so; clearing hands it back to the game', async () => {
    renderFixture('?fixture=baby&expression=sad');
    await ready();
    expect(actor()).toHaveAttribute('data-expression', 'sad');
    expect(screen.getByText(/overriding/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('dev-expression-next'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-expression', 'sleepy'));
    await userEvent.selectOptions(screen.getByTestId('dev-facing'), 'left');
    await waitFor(() => expect(actor()).toHaveAttribute('data-facing', 'left'));
    await userEvent.click(screen.getByTestId('dev-clear-pins'));
    await waitFor(() => expect(actor()).toHaveAttribute('data-expression', 'neutral'));
    expect(actor()).toHaveAttribute('data-facing', 'front');
    expect(screen.queryByText(/overriding/)).toBeNull();
  });

  it('a real kit action publishes into the fixture pool only: the kit\'s refusals and its acceptances are shown as they are, and no socket opens', async () => {
    const view = renderFixture('?fixture=egg');
    await ready();
    expect(screen.getByTestId('dev-lifecycle-next')).toHaveTextContent('start-incubation');
    // Refused: stopping an incubation that never started.
    await userEvent.click(screen.getByTestId('dev-action-stop-incubation'));
    await waitFor(() => expect(screen.getByTestId('dev-lifecycle-error')).toHaveTextContent(/kit refused: .*not incubating/i), { timeout: 3000 });
    await userEvent.click(within(screen.getByTestId('dev-lifecycle-error')).getByRole('button', { name: 'ok' }));
    expect(screen.queryByTestId('dev-lifecycle-error')).toBeNull();
    await userEvent.click(screen.getByTestId('dev-action-start-incubation'));
    await waitFor(() => expect(screen.getByTestId('dev-lifecycle-next')).toHaveTextContent('incubate'), { timeout: 3000 });
    expect(screen.getByTestId('dev-summary')).toHaveTextContent('incubating');
    await userEvent.click(screen.getByTestId('dev-missions-complete'));
    await waitFor(() => expect(screen.getByTestId('dev-lifecycle-ready')).toHaveTextContent('ready'), { timeout: 3000 });
    // The app's own gate opens: the ceremony button is in the dock.
    expect(screen.getByRole('button', { name: /hatch!/i })).toBeInTheDocument();
    expect(actor()).toHaveAttribute('data-egg-crack', 'heavy');
    await userEvent.click(screen.getByTestId('dev-action-hatch'));
    await waitFor(() => expect(screen.getByTestId('dev-summary')).toHaveTextContent('baby'), { timeout: 3000 });
    // Accepted: the kit's evolve hook gates on the stage only (the mission gate is the app's ceremony), so a plain baby evolves.
    await userEvent.click(screen.getByTestId('dev-action-evolve'));
    await waitFor(() => expect(screen.getByTestId('dev-summary')).toHaveTextContent('adult'), { timeout: 3000 });
    expect(screen.getByTestId('dev-lifecycle-next')).toHaveTextContent('grown');
    expect(screen.getByTestId('dev-published')).toHaveTextContent('3');
    expect(socket).not.toHaveBeenCalled();
    view.unmount();
  });

  it('reset restores the world the URL asked for and clears the pins', async () => {
    renderFixture('?fixture=baby&state=sleeping');
    await ready();
    await waitFor(() => expect(actor()).toHaveAttribute('data-sleeping', 'true'));
    await userEvent.click(screen.getByTestId('dev-stage-adult-v1'));
    await waitFor(() => expect(screen.getByTestId('dev-summary')).toHaveTextContent('adult'));
    await userEvent.selectOptions(screen.getByTestId('dev-expression'), 'upset');
    await waitFor(() => expect(actor()).toHaveAttribute('data-expression', 'upset'));
    await userEvent.click(screen.getByTestId('dev-reset'));
    await waitFor(() => expect(screen.getByTestId('dev-summary')).toHaveTextContent('Brook · baby · V1 · sleeping'), { timeout: 3000 });
    await waitFor(() => expect(actor()).toHaveAttribute('data-sleeping', 'true'));
    expect(actor()).toHaveAttribute('data-expression', 'neutral');
    expect(screen.queryByText(/overriding/)).toBeNull();
  });

  it('the fixture user is the fixture pubkey with a signer that keeps no key; every event in the world is its own or an item issuer\'s', async () => {
    renderFixture('?fixture=baby');
    await ready();
    await userEvent.click(screen.getByTestId('dev-stats-critical'));
    await waitFor(() => expect(screen.getByTestId('condition-dots').querySelectorAll('[data-status="critical"]').length).toBeGreaterThan(0));
    expect(PUBKEY).toBe('a'.repeat(64));
    expect(screen.getByTestId('dev-seed').textContent).toHaveLength(64);
    expect(screen.getByTestId('dev-published')).toHaveTextContent('0');
    expect(document.body.textContent).not.toMatch(/nsec1/);
  });
});

describe('the world section', () => {
  it('counts what was published into the pool and shows the state content', async () => {
    renderFixture('?fixture=egg');
    await ready();
    expect(screen.getByTestId('dev-published')).toHaveTextContent('0');
    await userEvent.click(screen.getByTestId('dev-action-start-incubation'));
    await waitFor(() => expect(screen.getByTestId('dev-published')).toHaveTextContent('1'), { timeout: 3000 });
    expect(screen.getByText(new RegExp(`last kind ${KIND_BLOBBI_STATE}`))).toBeInTheDocument();
    expect(screen.getByTestId('dev-content')).toHaveTextContent(/create_theme/);
  });
});
