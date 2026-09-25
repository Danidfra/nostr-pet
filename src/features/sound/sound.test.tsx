import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SoundProvider, useSound } from './SoundProvider';
import { SOUND_STORAGE_KEY } from './sounds';
import { createVoiceEngine } from './voice-engine';
import { fakeAudioContext } from '@/test/fake-audio';

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

  it('is off by default, creates no AudioContext and plays nothing while off, and remembers the choice on this device', () => {
    let created = 0;
    const ctx = fakeAudioContext();
    const engine = createVoiceEngine(() => {
      created += 1;
      return ctx as unknown as AudioContext;
    });
    render(
      <SoundProvider engine={engine}>
        <Probe />
      </SoundProvider>,
    );
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    act(() => screen.getByRole('button', { name: 'eat' }).click());
    expect(created).toBe(0);
    expect(ctx.nodes).toHaveLength(0);
    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe('on');
    // Turning it on creates nothing yet; the first play, inside the tap, does.
    expect(created).toBe(0);
    act(() => screen.getByRole('button', { name: 'eat' }).click());
    expect(created).toBe(1);
    expect(ctx.nodes.filter((n) => n.kind === 'osc')).toHaveLength(12);
    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe('off');
    act(() => screen.getByRole('button', { name: 'eat' }).click());
    expect(ctx.nodes.filter((n) => n.kind === 'osc')).toHaveLength(12);
  });

  it('while on, a pointer or key event resumes a context the browser suspended', () => {
    const ctx = fakeAudioContext('suspended');
    const engine = createVoiceEngine(() => ctx as unknown as AudioContext);
    window.localStorage.setItem(SOUND_STORAGE_KEY, 'on');
    render(
      <SoundProvider engine={engine}>
        <Probe />
      </SoundProvider>,
    );
    fireEvent.pointerDown(window);
    expect(ctx.resumes).toBe(0); // no context yet: nothing to resume, nothing created
    act(() => screen.getByRole('button', { name: 'eat' }).click());
    expect(ctx.resumes).toBe(1);
    ctx.state = 'suspended';
    fireEvent.keyDown(window, { key: 'a' });
    expect(ctx.resumes).toBe(2);
  });

  it('a page without Web Audio plays nothing and breaks nothing', () => {
    const engine = createVoiceEngine(() => null);
    window.localStorage.setItem(SOUND_STORAGE_KEY, 'on');
    render(
      <SoundProvider engine={engine}>
        <Probe />
      </SoundProvider>,
    );
    expect(() => act(() => screen.getByRole('button', { name: 'eat' }).click())).not.toThrow();
  });
});
