/**
 * Plays the home's music (`theme.ts`) through Web Audio, synthesised on the
 * spot like the Blobbi's voice: no files, no fetch.
 *
 *   context      its own AudioContext, created on the first `start()` (which
 *                the provider calls from a user gesture, so autoplay rules
 *                let it run)
 *   scheduling   a look-ahead scheduler: every 150 ms, the notes falling in
 *                the next 1.2 s are scheduled against `currentTime`, so the
 *                timing is sample-accurate and a busy main thread only
 *                delays the scheduling, never a note
 *   voices       a music box (sine and a quiet octave, fast attack, long
 *                ring), a bell (higher, shorter), a soft pad (filtered
 *                triangles, slow attack) and a round sine bass, into one bus
 *                with a gentle echo and a lowpass
 *   start/stop   a fade in over 2.5 s and out over 0.8 s; stopping cancels
 *                the scheduler and lets what is sounding fade
 *   failure      never throws; without Web Audio nothing plays
 *
 * `createContext` and the timer functions are seams for tests.
 */
import { BEAT_SECONDS, HOME_LOOP, noteHz, type ScoreEvent } from './theme';

const SILENCE = 0.0001;
const LOOKAHEAD_S = 1.2;
const TICK_MS = 150;
const FADE_IN_S = 2.5;
const FADE_OUT_S = 0.8;
/** The music sits well under the Blobbi's voice. */
export const MUSIC_VOLUME = 0.32;

export interface MusicEngine {
  /** Start (or resume) the music with a fade in. Returns false when nothing could play. */
  start: () => boolean;
  /** Fade out and stop scheduling. */
  stop: () => void;
  isPlaying: () => boolean;
}

interface Timers {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

const defaultTimers: Timers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
};

function defaultCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function createMusicEngine(createContext: () => AudioContext | null = defaultCreateContext, timers: Timers = defaultTimers): MusicEngine {
  let ctx: AudioContext | null = null;
  let bus: { master: GainNode; input: AudioNode } | null = null;
  let timer: unknown = null;
  let loopStart = 0;
  let nextIndex = 0;
  let playing = false;

  const context = (): AudioContext | null => {
    if (ctx) return ctx;
    try {
      ctx = createContext();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const makeBus = (ac: AudioContext) => {
    const master = ac.createGain();
    master.gain.setValueAtTime(SILENCE, ac.currentTime);
    const lowpass = ac.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(4200, ac.currentTime);
    // A soft echo: a little of the bus comes back a dotted eighth later, quieter each time
    const delay = ac.createDelay(2);
    delay.delayTime.setValueAtTime(BEAT_SECONDS * 0.75, ac.currentTime);
    const feedback = ac.createGain();
    feedback.gain.setValueAtTime(0.28, ac.currentTime);
    const wet = ac.createGain();
    wet.gain.setValueAtTime(0.22, ac.currentTime);
    const input = ac.createGain();
    input.connect(lowpass);
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(lowpass);
    lowpass.connect(master);
    master.connect(ac.destination);
    return { master, input };
  };

  const tone = (ac: AudioContext, out: AudioNode, wave: OscillatorType, hz: number, start: number, peak: number, attack: number, ring: number) => {
    const osc = ac.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(hz, start);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(SILENCE, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(SILENCE, start + attack + ring);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + attack + ring + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  };

  const playEvent = (ac: AudioContext, out: AudioNode, event: ScoreEvent, start: number) => {
    const seconds = event.beats * BEAT_SECONDS;
    for (const note of event.notes) {
      const hz = noteHz(note);
      switch (event.voice) {
        case 'box':
          tone(ac, out, 'sine', hz, start, 0.2, 0.004, Math.max(1.1, seconds * 1.8));
          tone(ac, out, 'sine', hz * 2.001, start, 0.05, 0.003, 0.5);
          tone(ac, out, 'triangle', hz * 4, start, 0.012, 0.002, 0.18);
          break;
        case 'bell':
          tone(ac, out, 'sine', hz, start, 0.07, 0.003, 0.7);
          tone(ac, out, 'sine', hz * 3.01, start, 0.015, 0.002, 0.25);
          break;
        case 'pad':
          tone(ac, out, 'triangle', hz, start, 0.028, Math.min(0.9, seconds * 0.4), seconds + 0.6);
          tone(ac, out, 'sine', hz * 1.003, start, 0.02, Math.min(0.9, seconds * 0.4), seconds + 0.6);
          break;
        case 'bass':
          tone(ac, out, 'sine', hz, start, 0.12, 0.02, seconds + 0.2);
          break;
      }
    }
  };

  const schedule = () => {
    const ac = ctx;
    if (!ac || !bus || !playing) return;
    const loopSeconds = HOME_LOOP.beats * BEAT_SECONDS;
    const horizon = ac.currentTime + LOOKAHEAD_S;
    // Walk the score from where the last tick stopped, into the next loops when the horizon reaches them
    for (;;) {
      if (nextIndex >= HOME_LOOP.events.length) {
        nextIndex = 0;
        loopStart += loopSeconds;
      }
      const event = HOME_LOOP.events[nextIndex];
      const at = loopStart + event.at * BEAT_SECONDS;
      if (at > horizon) break;
      if (at >= ac.currentTime - 0.05) playEvent(ac, bus.input, event, Math.max(at, ac.currentTime));
      nextIndex++;
    }
  };

  const start = (): boolean => {
    try {
      const ac = context();
      if (!ac) return false;
      if (ac.state === 'suspended') void ac.resume().catch(() => {});
      if (!bus) bus = makeBus(ac);
      if (playing) return true;
      playing = true;
      const now = ac.currentTime;
      bus.master.gain.cancelScheduledValues(now);
      bus.master.gain.setValueAtTime(Math.max(SILENCE, bus.master.gain.value), now);
      bus.master.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + FADE_IN_S);
      // Every start begins the loop from its soft opening
      loopStart = now + 0.1;
      nextIndex = 0;
      schedule();
      timer = timers.setInterval(schedule, TICK_MS);
      return true;
    } catch {
      playing = false;
      return false;
    }
  };

  const stop = () => {
    playing = false;
    if (timer !== null) {
      timers.clearInterval(timer);
      timer = null;
    }
    try {
      if (ctx && bus) {
        const now = ctx.currentTime;
        bus.master.gain.cancelScheduledValues(now);
        bus.master.gain.setValueAtTime(Math.max(SILENCE, bus.master.gain.value), now);
        bus.master.gain.exponentialRampToValueAtTime(SILENCE, now + FADE_OUT_S);
      }
    } catch {
      /* silence is fine */
    }
    // Once faded, let the audio hardware rest (battery, the phone's audio session) until the next start
    const ac = ctx;
    if (ac) setTimeout(() => {
      if (!playing && ac.state === 'running') void ac.suspend().catch(() => {});
    }, FADE_OUT_S * 1000 + 250);
  };

  return { start, stop, isPlaying: () => playing };
}
