import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SoundProvider, useSound } from './SoundProvider';
import { SOUND_FILES, SOUND_STORAGE_KEY } from './sounds';

function Probe() {
  const sound = useSound();
  return (
    <div>
      <span data-testid="enabled">{String(sound.enabled)}</span>
      <button type="button" onClick={() => sound.setEnabled(!sound.enabled)}>
        toggle
      </button>
      <button type="button" onClick={() => sound.play('eat')}>
        eat
      </button>
    </div>
  );
}

describe('SoundProvider', () => {
  afterEach(() => window.localStorage.clear());

  it('is off by default, plays nothing while off, and remembers the choice on this device', () => {
    const plays: string[] = [];
    const createAudio = vi.fn((src: string) => ({ volume: 1, play: () => void plays.push(src) }));
    render(
      <SoundProvider createAudio={createAudio}>
        <Probe />
      </SoundProvider>,
    );
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    act(() => screen.getByRole('button', { name: 'eat' }).click());
    expect(plays).toEqual([]);

    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe('on');
    act(() => screen.getByRole('button', { name: 'eat' }).click());
    expect(plays).toEqual([SOUND_FILES.eat]);
  });

  it('never throws or blocks when a sound cannot play', () => {
    window.localStorage.setItem(SOUND_STORAGE_KEY, 'on');
    const createAudio = () => ({
      volume: 1,
      play: () => Promise.reject(new Error('NotAllowedError')),
    });
    render(
      <SoundProvider createAudio={createAudio}>
        <Probe />
      </SoundProvider>,
    );
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
    expect(() => act(() => screen.getByRole('button', { name: 'eat' }).click())).not.toThrow();
  });

  it('is a silent no-op without a provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    expect(() => act(() => screen.getByRole('button', { name: 'eat' }).click())).not.toThrow();
  });
});
