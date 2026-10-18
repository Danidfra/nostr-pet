/**
 * The welcome as a scene (M12.2): a Blobbi that notices you and answers a
 * tap, a friend and an egg beside it, one line and two doors that work from
 * the very first frame (no cinematic to sit through), what Blobbi is one tap
 * away, reduced motion keeping the words and dropping the hops.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { SceneSettingsProvider } from '@/features/home/scene';
import { WelcomeScreen } from './screens';
import { WelcomeStage } from './WelcomeStage';
import { GREETING, GREETING_MS, INVITATION, REACTIONS, gazeToward, reactionFor } from './welcome-hero';

vi.mock('@/lib/relay-transport', () => ({ checkRelayTransport: () => null }));

function scene(reducedMotion = false) {
  const onCreate = vi.fn();
  const onExisting = vi.fn();
  render(
    <SceneSettingsProvider value={{ reducedMotion, idleEnabled: false }}>
      <WelcomeStage>
        <WelcomeScreen onCreate={onCreate} onExisting={onExisting} />
      </WelcomeStage>
    </SceneSettingsProvider>,
  );
  return { onCreate, onExisting };
}

afterEach(() => vi.useRealTimers());

describe('the welcome scene', () => {
  it('a Blobbi notices you, with a friend and an egg; the invitation and both doors work from the first frame', () => {
    const { onCreate, onExisting } = scene();
    const cast = screen.getByTestId('welcome-cast');
    expect(cast.querySelectorAll('[data-blobbi-renderer]')).toHaveLength(3);
    expect(screen.getByTestId('welcome-hero-says')).toHaveTextContent(GREETING);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(INVITATION);
    // Nothing to wait for: the doors are there and answer at once
    fireEvent.click(screen.getByTestId('onboarding-create'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('onboarding-existing'));
    expect(onExisting).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('onboarding-create')).toHaveTextContent('Meet your Blobbi!');
    expect(screen.getByTestId('onboarding-existing')).toHaveTextContent('I already have an account');
    expect(screen.getByTestId('onboarding-existing')).toHaveAccessibleDescription(/Welcome back/);
  });

  it('the greeting settles, then each tap brings the next reaction in turn, with its hop', () => {
    vi.useFakeTimers();
    scene();
    act(() => vi.advanceTimersByTime(GREETING_MS + 50));
    expect(screen.getByTestId('welcome-hero-says')).toHaveAttribute('data-shown', 'false');
    const body = within(screen.getByTestId('welcome-hero')).getByRole('button', { name: /say hello/i });
    const seen: string[] = [];
    for (let i = 0; i < REACTIONS.length + 1; i++) {
      fireEvent.click(body);
      seen.push(screen.getByTestId('welcome-hero-says').textContent ?? '');
      expect(body).toHaveAttribute('data-move', reactionFor(i).move);
    }
    expect(seen).toEqual([...REACTIONS.map((r) => r.line), REACTIONS[0].line]);
    // It settles again by itself
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.getByTestId('welcome-hero-says')).toHaveAttribute('data-shown', 'false');
  });

  it('reduced motion: the same words and faces, no hops', () => {
    scene(true);
    const body = within(screen.getByTestId('welcome-hero')).getByRole('button', { name: /say hello/i });
    fireEvent.click(body);
    expect(screen.getByTestId('welcome-hero-says')).toHaveTextContent(REACTIONS[0].line);
    expect(body).not.toHaveAttribute('data-move');
    expect(screen.getByTestId('welcome-hero')).toHaveAttribute('data-reduced', 'true');
  });

  it('the Blobbi is a button for the keyboard, and keeps its focus as it reacts', () => {
    scene();
    const body = within(screen.getByTestId('welcome-hero')).getByRole('button', { name: /say hello/i });
    body.focus();
    fireEvent.click(body);
    fireEvent.click(body);
    expect(document.activeElement).toBe(body);
  });

  it('what Blobbi and Nostr are is one tap away, in a sheet, not on the first screen', () => {
    scene();
    expect(screen.queryByText(/open network/)).toBeNull();
    fireEvent.click(screen.getByTestId('welcome-what-is-nostr'));
    const sheet = screen.getByTestId('welcome-about');
    expect(sheet).toHaveTextContent(/Nostr/);
    expect(sheet).toHaveTextContent(/One of a kind/);
    const source = within(sheet).getByRole('link', { name: 'Source code' });
    expect(source).toHaveAttribute('href', 'https://github.com/Danidfra/nostr-pet');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('where its eyes go', () => {
  it('toward the point, saturating far away, straight out when the point is on it', () => {
    expect(gazeToward({ x: 100, y: 100 }, { x: 100, y: 100 })).toEqual({ x: 0, y: 0 });
    expect(gazeToward({ x: 100, y: 100 }, { x: 230, y: 100 })).toEqual({ x: 0.5, y: 0 });
    expect(gazeToward({ x: 100, y: 100 }, { x: -2000, y: 4000 })).toEqual({ x: -1, y: 1 });
  });
});
