/**
 * Plays a `Recipe` through the Web Audio API. This is the only file that
 * knows an oscillator exists.
 *
 *   AudioContext   created lazily, the first time a sound is asked for and
 *                  never before (browsers keep a context made outside a
 *                  user gesture suspended; making it inside the tap that
 *                  wants the sound is what lets it play). One per page.
 *   resume         a suspended context is asked to resume (once at a time)
 *                  and the sound is NOT scheduled: nothing queues up to
 *                  play all at once later; the next gesture resumes it
 *   scheduling     every layer is an OscillatorNode with its pitch points
 *                  ramped exponentially over its duration and a GainNode
 *                  envelope (fast linear attack, hold, exponential release
 *                  to near-silence), all scheduled against `currentTime`
 *                  so the whole recipe is sample-accurate and needs no
 *                  timers; a layer's vibrato is a slow oscillator feeding
 *                  the pitch (so many cents either way); the chain is
 *                  layers → lowpass → dry + delay/wet → master →
 *                  destination, as in Ditto's munch
 *   variation      a `Variant` (from `variantOf`) scales every pitch and
 *                  every time, so one recipe is a slightly different noise
 *                  each playing
 *   cleanup        nodes disconnect when the last oscillator ends
 *   failure        never throws; a page without Web Audio plays nothing
 *
 * `createContext` is a seam so tests can hand in a recording fake.
 */
import type { Recipe, Variant } from './blobbi-voice';

const SILENCE = 0.0001;
const NO_VARIANT: Variant = { pitch: 1, time: 1 };

export interface VoiceEngine {
  /** Play a recipe now, varied as given (or as written). Returns false when nothing could be scheduled. */
  play: (recipe: Recipe, variant?: Variant) => boolean;
  /** Whether a context has been created yet (tests, and the "unlocked" question). */
  hasContext: () => boolean;
  /** Resume a suspended context from a user gesture, creating none. */
  resume: () => void;
  /** Let the audio hardware rest (a hidden page); the next play or gesture resumes it. */
  suspend?: () => void;
}

export function createVoiceEngine(createContext: () => AudioContext | null = defaultCreateContext): VoiceEngine {
  let ctx: AudioContext | null = null;
  // A play's own ask to resume, while unanswered: a second play does not ask again (a gesture always may)
  let asking = false;
  const askResume = (ac: AudioContext, fromGesture: boolean) => {
    if (asking && !fromGesture) return;
    asking = true;
    ac.resume()
      .catch(() => {})
      .finally(() => {
        asking = false;
      });
  };
  const context = (): AudioContext | null => {
    if (ctx) return ctx;
    try {
      ctx = createContext();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const play = (recipe: Recipe, variant: Variant = NO_VARIANT): boolean => {
    try {
      const ac = context();
      if (!ac) return false;
      // Suspended (made outside a gesture, or the browser's autoplay rule): ask once to resume and play NOTHING now; a
      // sound scheduled into a suspended context would wait and burst out with every other one at the first tap (M14.1)
      if (ac.state === 'suspended') {
        askResume(ac, false);
        return false;
      }
      const now = ac.currentTime;
      const pitch = variant.pitch > 0 ? variant.pitch : 1;
      const time = variant.time > 0 ? variant.time : 1;
      const seconds = (ms: number) => (ms / 1000) * time;
      const end = now + seconds(recipe.durationMs);

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
      master.gain.setValueAtTime(recipe.master, now + seconds(recipe.durationMs) * 0.82);
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
        const start = now + seconds(layer.offsetMs);
        const stop = start + seconds(layer.durationMs);
        const osc = ac.createOscillator();
        osc.type = layer.wave;
        osc.frequency.setValueAtTime(layer.hz[0] * pitch, start);
        if (layer.hz.length === 3) {
          osc.frequency.exponentialRampToValueAtTime(layer.hz[1] * pitch, start + seconds(layer.durationMs) * 0.42);
          osc.frequency.exponentialRampToValueAtTime(layer.hz[2] * pitch, stop);
        } else {
          osc.frequency.exponentialRampToValueAtTime(layer.hz[1] * pitch, stop);
        }
        const gain = ac.createGain();
        const attack = seconds(layer.attackMs ?? 6);
        gain.gain.setValueAtTime(SILENCE, start);
        gain.gain.linearRampToValueAtTime(layer.gain, start + attack);
        gain.gain.setValueAtTime(layer.gain, start + seconds(layer.durationMs) * (layer.hold ?? 0.35));
        gain.gain.exponentialRampToValueAtTime(SILENCE, stop);
        osc.connect(gain);
        gain.connect(lowpass);
        osc.start(start);
        osc.stop(stop);
        nodes.push(osc, gain);
        // The waver: a slow sine, scaled to so many cents of the layer's own pitch, added to its frequency
        if (layer.vibrato && layer.vibrato.cents > 0 && layer.vibrato.hz > 0) {
          const lfo = ac.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.setValueAtTime(layer.vibrato.hz, start);
          const depth = ac.createGain();
          const middle = (layer.hz.length === 3 ? layer.hz[1] : (layer.hz[0] + layer.hz[1]) / 2) * pitch;
          depth.gain.setValueAtTime(middle * (Math.pow(2, layer.vibrato.cents / 1200) - 1), start);
          lfo.connect(depth);
          depth.connect(osc.frequency);
          lfo.start(start);
          lfo.stop(stop);
          nodes.push(lfo, depth);
        }
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
      if (ctx && ctx.state === 'suspended') askResume(ctx, true);
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
