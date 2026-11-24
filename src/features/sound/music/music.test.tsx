import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { fakeAudioContext } from '@/test/fake-audio';
import { SoundProvider, useSound } from '../SoundProvider';
import { MUSIC_STORAGE_KEY } from '../sounds';
import { createVoiceEngine } from '../voice-engine';
import { createMusicEngine, MUSIC_VOLUME } from './music-engine';
import { BEAT_SECONDS, HOME_LOOP, noteHz } from './theme';

function manualTimers() {
  const ticks: Array<() => void> = [];
  return {
    ticks,
    timers: {
      setInterval: (fn: () => void) => {
        ticks.push(fn);
        return ticks.length;
      },
      clearInterval: (id: unknown) => {
        ticks[(id as number) - 1] = () => {};
      },
    },
  };
}

describe('the theme', () => {
  it('names real notes, and A4 is 440 Hz', () => {
    expect(noteHz('A4')).toBeCloseTo(440);
    expect(noteHz('F5')).toBeCloseTo(698.46, 1);
    expect(noteHz('Bb2')).toBeCloseTo(116.54, 1);
    for (const event of HOME_LOOP.events) for (const note of event.notes) expect(() => noteHz(note)).not.toThrow();
  });

  it('is one loop of whole bars, every event inside it, in time order', () => {
    expect(HOME_LOOP.beats % 4).toBe(0);
    const starts = HOME_LOOP.events.map((e) => e.at);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const event of HOME_LOOP.events) expect(event.at + event.beats).toBeLessThanOrEqual(HOME_LOOP.beats);
    // About a minute before it repeats
    expect(HOME_LOOP.beats * BEAT_SECONDS).toBeGreaterThan(45);
  });
});

describe('the music engine', () => {
  it('fades in, schedules only the next moment of the score, keeps going tick by tick, and fades out on stop', () => {
    const ctx = fakeAudioContext();
    const { ticks, timers } = manualTimers();
    const engine = createMusicEngine(() => ctx as unknown as AudioContext, timers);
    expect(engine.start()).toBe(true);
    expect(engine.isPlaying()).toBe(true);
    const master = ctx.nodes.find((n) => n.kind === 'gain' && n.gain!.events.some(([kind, v]) => kind === 'lin' && v === MUSIC_VOLUME));
    expect(master).toBeDefined();
    const firstBatch = ctx.nodes.filter((n) => n.kind === 'osc').length;
    expect(firstBatch).toBeGreaterThan(0);
    // Nothing is scheduled further than the look-ahead
    for (const osc of ctx.nodes.filter((n) => n.kind === 'osc')) expect(osc.started!).toBeLessThanOrEqual(ctx.currentTime + 1.3);
    // Time passes: the next tick schedules more
    ctx.currentTime += 4;
    ticks[0]();
    expect(ctx.nodes.filter((n) => n.kind === 'osc').length).toBeGreaterThan(firstBatch);
    // Stop: a fade to silence, and no more scheduling
    engine.stop();
    expect(engine.isPlaying()).toBe(false);
    expect(master!.gain!.events.at(-1)![0]).toBe('exp');
    const count = ctx.nodes.length;
    ctx.currentTime += 4;
    ticks[0]();
    expect(ctx.nodes.length).toBe(count);
  });

  it('wraps around to the start of the loop', () => {
    const ctx = fakeAudioContext();
    const { ticks, timers } = manualTimers();
    const engine = createMusicEngine(() => ctx as unknown as AudioContext, timers);
    engine.start();
    const loopSeconds = HOME_LOOP.beats * BEAT_SECONDS;
    for (let s = 0; s < loopSeconds + 10; s += 0.5) {
      ctx.currentTime += 0.5;
      ticks[0]();
    }
    // The opening's first melody note (F5) sounds again after the loop
    const f5 = noteHz('F5');
    const late = ctx.nodes.filter((n) => n.kind === 'osc' && n.started! > 10 + loopSeconds && Math.abs(n.frequency!.events[0][1] - f5) < 0.01);
    expect(late.length).toBeGreaterThan(0);
    engine.stop();
  });

  it('plays nothing, and does not throw, without Web Audio', () => {
    const engine = createMusicEngine(() => null);
    expect(engine.start()).toBe(false);
    expect(() => engine.stop()).not.toThrow();
  });
});

function Probe() {
  const sound = useSound();
  return (
    <button type="button" onClick={() => sound.setMusic(!sound.music)}>
      music {String(sound.music)}
    </button>
  );
}

describe('music in the provider', () => {
  afterEach(() => window.localStorage.clear());

  function setup() {
    const music = { start: vi.fn(() => true), stop: vi.fn(), isPlaying: vi.fn(() => false) };
    render(
      <SoundProvider engine={createVoiceEngine(() => null)} musicEngine={music}>
        <Probe />
      </SoundProvider>,
    );
    return music;
  }

  it('is on by default but waits for the first tap (autoplay), and the choice is kept on this device', () => {
    const music = setup();
    expect(screen.getByRole('button')).toHaveTextContent('music true');
    expect(music.start).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(music.start).toHaveBeenCalled();
    act(() => screen.getByRole('button').click());
    expect(window.localStorage.getItem(MUSIC_STORAGE_KEY)).toBe('off');
    expect(music.stop).toHaveBeenCalled();
    music.start.mockClear();
    fireEvent.pointerDown(document.body);
    expect(music.start).not.toHaveBeenCalled();
  });

  it('a stored off stays off; turning it on from the menu starts it at once', () => {
    window.localStorage.setItem(MUSIC_STORAGE_KEY, 'off');
    const music = setup();
    expect(screen.getByRole('button')).toHaveTextContent('music false');
    act(() => screen.getByRole('button').click());
    expect(music.start).toHaveBeenCalled();
    expect(window.localStorage.getItem(MUSIC_STORAGE_KEY)).toBe('on');
  });

  it('rests while the page is hidden and comes back with it', () => {
    const music = setup();
    fireEvent.pointerDown(document.body);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(music.stop).toHaveBeenCalled();
    hidden.mockReturnValue(false);
    music.start.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(music.start).toHaveBeenCalled();
    hidden.mockRestore();
  });
});
