/**
 * The Blobbi's voice, as data.
 *
 * Every sound is built from two building blocks taken from Ditto's feeding
 * sound (`src/blobbi/ui/lib/munchSound.ts`), which is the one Blobbi sound
 * the ecosystem already has:
 *
 *   pop   a sine that glides between two pitches over a few tens of
 *         milliseconds with a fast attack and an exponential release: the
 *         "nom" when the mouth opens, the softer "mm" when it closes
 *   hum   a triangle that glides through three pitches over ~100 ms with
 *         a gentler envelope: the "nyum~" that bridges the two pops
 *
 * and one signal chain: layers → lowpass (~1.9 kHz, so nothing is shrill)
 * → a little 18 ms delay mixed in quietly (a hint of room) → master gain
 * that fades out at the end. `eat` IS Ditto's munch, cycle for cycle; the
 * rest are the same blocks in other shapes: a short upward pop is
 * curious, two rising pops are glad, a slow low hum is sleepy, a falling
 * triangle is displeased, a rising run of pops is a small fanfare.
 *
 * Nothing here touches an AudioContext; `voice-engine.ts` plays a recipe.
 * Durations are short on purpose (the longest, eat, is 1.24 s).
 */
export type Wave = 'sine' | 'triangle';

export interface Layer {
  wave: Wave;
  /** When the layer starts, from the sound's start. */
  offsetMs: number;
  durationMs: number;
  /** Pitch points spread evenly over the duration: two for a glide, three for a swell. */
  hz: readonly [number, number] | readonly [number, number, number];
  /** Peak gain before the master. */
  gain: number;
  /** Attack time; the release starts at `hold` (a fraction of the duration) and decays to silence. */
  attackMs?: number;
  hold?: number;
}

export interface Recipe {
  /** Whole sound, from first layer start to the tail's end. */
  durationMs: number;
  master: number;
  lowpassHz: number;
  layers: readonly Layer[];
}

// Ditto's three chew layers and the per-cycle decay, verbatim.
const OPEN_POP = { wave: 'sine', offsetMs: 0, durationMs: 72, hz: [520, 370], gain: 0.13, attackMs: 6, hold: 0.35 } as const;
const CLOSE_SMACK = { wave: 'sine', offsetMs: 140, durationMs: 55, hz: [400, 310], gain: 0.065, attackMs: 6, hold: 0.35 } as const;
const HUM = { wave: 'triangle', offsetMs: 30, durationMs: 130, hz: [740, 840, 680], gain: 0.055, attackMs: 20, hold: 0.55 } as const;
const CHEW_CYCLE_MS = 300;
const CYCLE_GAINS = [1, 0.7, 0.52, 0.38] as const;

function chew(): Layer[] {
  const layers: Layer[] = [];
  CYCLE_GAINS.forEach((cg, i) => {
    const at = i * CHEW_CYCLE_MS;
    for (const l of [OPEN_POP, HUM, CLOSE_SMACK]) layers.push({ ...l, offsetMs: at + l.offsetMs, gain: l.gain * cg });
  });
  return layers;
}

const pop = (offsetMs: number, from: number, to: number, durationMs = 80, gain = 0.12): Layer => ({ wave: 'sine', offsetMs, durationMs, hz: [from, to], gain, attackMs: 6, hold: 0.35 });
const hum = (offsetMs: number, hz: readonly [number, number, number], durationMs = 130, gain = 0.055): Layer => ({ wave: 'triangle', offsetMs, durationMs, hz, gain, attackMs: 20, hold: 0.55 });

export const VOICE: Record<import('./sounds').BlobbiSoundId, Recipe> = {
  /** Ditto's munch: four decaying chews. */
  eat: { durationMs: 4 * CHEW_CYCLE_MS + 40, master: 0.38, lowpassHz: 1900, layers: chew() },
  /** Bath: three quick bubbles, each a little higher, with a watery hum under them. */
  clean: { durationMs: 520, master: 0.34, lowpassHz: 2200, layers: [pop(0, 560, 720, 70, 0.1), hum(20, [620, 760, 640], 160, 0.04), pop(150, 620, 800, 70, 0.09), pop(310, 700, 900, 70, 0.08)] },
  /** A curious "boop?": one pop bending up, a short hum after it. */
  poke: { durationMs: 220, master: 0.34, lowpassHz: 2000, layers: [pop(0, 480, 640, 90, 0.12), hum(60, [640, 720, 690], 110, 0.04)] },
  /** Glad: two pops, the second higher. */
  happy: { durationMs: 320, master: 0.36, lowpassHz: 2000, layers: [pop(0, 520, 620, 80, 0.12), pop(140, 640, 780, 90, 0.11), hum(40, [700, 820, 760], 150, 0.045)] },
  /** Excited: three quick rising pops, brighter. */
  excited: { durationMs: 420, master: 0.36, lowpassHz: 2400, layers: [pop(0, 560, 680, 70, 0.12), pop(110, 660, 800, 70, 0.11), pop(220, 780, 960, 90, 0.11), hum(30, [720, 900, 820], 220, 0.045)] },
  /** Displeased: a falling triangle, a low pop under it. */
  upset: { durationMs: 340, master: 0.34, lowpassHz: 1600, layers: [hum(0, [460, 380, 250], 260, 0.07), pop(40, 360, 260, 120, 0.09)] },
  /** Sleepy: one slow, low hum that sinks. */
  sleepy: { durationMs: 520, master: 0.3, lowpassHz: 1400, layers: [hum(0, [340, 300, 230], 460, 0.07), pop(0, 300, 240, 200, 0.05)] },
  /** Hatch: a small rising run, the last pop held. */
  hatch: { durationMs: 700, master: 0.38, lowpassHz: 2400, layers: [pop(0, 440, 520, 90, 0.11), pop(150, 560, 660, 90, 0.11), pop(300, 700, 840, 120, 0.12), hum(340, [840, 980, 900], 320, 0.05)] },
  /** Evolve: the same run, one step further and longer. */
  evolve: { durationMs: 960, master: 0.38, lowpassHz: 2400, layers: [pop(0, 440, 520, 90, 0.11), pop(150, 560, 660, 90, 0.11), pop(300, 700, 840, 90, 0.11), pop(450, 880, 1040, 140, 0.12), hum(480, [1000, 1180, 1080], 440, 0.05)] },
};
