/**
 * Plays a `Recipe` through the Web Audio API. This is the only file that
 * knows an oscillator exists.
 *
 *   AudioContext   created lazily, the first time a sound is asked for and
 *                  never before (browsers keep a context made outside a
 *                  user gesture suspended; making it inside the tap that
 *                  wants the sound is what lets it play). One per page.
 *   resume         a suspended context is resumed on each play; if the
 *                  browser refuses, the sound is simply not heard
 *   scheduling     every layer is an OscillatorNode with its pitch points
 *                  ramped exponentially over its duration and a GainNode
 *                  envelope (fast linear attack, hold, exponential release
 *                  to near-silence), all scheduled against `currentTime`
 *                  so the whole recipe is sample-accurate and needs no
 *                  timers; the chain is layers → lowpass → dry + delay/wet
 *                  → master → destination, as in Ditto's munch
 *   cleanup        nodes disconnect when the last oscillator ends
 *   failure        never throws; a page without Web Audio plays nothing
 *
 * `createContext` is a seam so tests can hand in a recording fake.
 */
import type { Recipe } from './blobbi-voice';

const SILENCE = 0.0001;

export interface VoiceEngine {
  /** Play a recipe now. Returns false when nothing could be scheduled. */
  play: (recipe: Recipe) => boolean;
  /** Whether a context has been created yet (tests, and the "unlocked" question). */
  hasContext: () => boolean;
  /** Resume a suspended context from a user gesture, creating none. */
  resume: () => void;
  /** Let the audio hardware rest (a hidden page); the next play or gesture resumes it. */
  suspend?: () => void;
}

export function createVoiceEngine(createContext: () => AudioContext | null = defaultCreateContext): VoiceEngine {
  let ctx: AudioContext | null = null;
  const context = (): AudioContext | null => {
    if (ctx) return ctx;
    try {
      ctx = createContext();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const play = (recipe: Recipe): boolean => {
    try {
      const ac = context();
      if (!ac) return false;
      if (ac.state === 'suspended') void ac.resume().catch(() => {});
      const now = ac.currentTime;
      const end = now + recipe.durationMs / 1000;

      const lowpass = ac.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(recipe.lowpassHz, now);
      lowpass.Q.setValueAtTime(0.55, now);
      const delay = ac.createDelay();
      delay.delayTime.setValueAtTime(0.018, now);
      const dry = ac.createGain();
      dry.gain.setValueAtTime(0.88, now);
      const wet = ac.createGain();
      wet.gain.setValueAtTime(0.12, now);
      const master = ac.createGain();
      master.gain.setValueAtTime(recipe.master, now);
      master.gain.setValueAtTime(recipe.master, now + (recipe.durationMs / 1000) * 0.82);
      master.gain.exponentialRampToValueAtTime(SILENCE, end);
      lowpass.connect(dry);
      lowpass.connect(delay);
      delay.connect(wet);
      dry.connect(master);
      wet.connect(master);
      master.connect(ac.destination);

      const nodes: AudioNode[] = [lowpass, delay, dry, wet, master];
      let last: OscillatorNode | null = null;
      let lastEnd = now;
      for (const layer of recipe.layers) {
        const start = now + layer.offsetMs / 1000;
        const stop = start + layer.durationMs / 1000;
        const osc = ac.createOscillator();
        osc.type = layer.wave;
        osc.frequency.setValueAtTime(layer.hz[0], start);
        if (layer.hz.length === 3) {
          osc.frequency.exponentialRampToValueAtTime(layer.hz[1], start + (layer.durationMs / 1000) * 0.42);
          osc.frequency.exponentialRampToValueAtTime(layer.hz[2], stop);
        } else {
          osc.frequency.exponentialRampToValueAtTime(layer.hz[1], stop);
        }
        const gain = ac.createGain();
        const attack = (layer.attackMs ?? 6) / 1000;
        gain.gain.setValueAtTime(SILENCE, start);
        gain.gain.linearRampToValueAtTime(layer.gain, start + attack);
        gain.gain.setValueAtTime(layer.gain, start + (layer.durationMs / 1000) * (layer.hold ?? 0.35));
        gain.gain.exponentialRampToValueAtTime(SILENCE, stop);
        osc.connect(gain);
        gain.connect(lowpass);
        osc.start(start);
        osc.stop(stop);
        nodes.push(osc, gain);
        if (stop >= lastEnd) {
          lastEnd = stop;
          last = osc;
        }
      }
      if (last) {
        last.onended = () => {
          for (const node of nodes) {
            try {
              node.disconnect();
            } catch {
              /* already gone */
            }
          }
        };
      }
      return true;
    } catch {
      return false;
    }
  };

  return {
    play,
    hasContext: () => ctx !== null,
    resume: () => {
      if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
    },
    suspend: () => {
      if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
    },
  };
}

function defaultCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}
