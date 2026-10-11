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
 * Durations are short on purpose (the longest creature noise, eat, is
 * 1.24 s; a journey is told in short cues, played on its timeline).
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
  /**
   * A poke: a small creature noticing a touch. The voice is the munch's
   * hum (the triangle "nyum~"), here lifted into a short question, "hm?",
   * with the munch's soft close-smack under it for body. Hum-led and low,
   * so it is a creature, not an interface beep; the upset and sleepy pokes
   * below are the same two layers with the hum pushed down or slowed.
   */
  poke: { durationMs: 280, master: 0.34, lowpassHz: 1800, layers: [pop(0, 360, 300, 70, 0.09), hum(20, [430, 560, 500], 200, 0.09)] },
  /** Glad: two pops, the second higher. */
  happy: { durationMs: 320, master: 0.36, lowpassHz: 2000, layers: [pop(0, 520, 620, 80, 0.12), pop(140, 640, 780, 90, 0.11), hum(40, [700, 820, 760], 150, 0.045)] },
  /** Excited: three quick rising pops, brighter. */
  excited: { durationMs: 420, master: 0.36, lowpassHz: 2400, layers: [pop(0, 560, 680, 70, 0.12), pop(110, 660, 800, 70, 0.11), pop(220, 780, 960, 90, 0.11), hum(30, [720, 900, 820], 220, 0.045)] },
  /** Displeased: the poke's voice pushed down, a short "hmph": the hum falls, the smack sits lower. */
  upset: { durationMs: 300, master: 0.34, lowpassHz: 1500, layers: [hum(0, [520, 380, 300], 200, 0.075), pop(30, 330, 240, 90, 0.09)] },
  /** Sleepy: the poke's voice slowed and sunk, "mmm…": one long low hum, the smack stretched under it. */
  sleepy: { durationMs: 520, master: 0.3, lowpassHz: 1400, layers: [hum(0, [340, 300, 230], 460, 0.07), pop(0, 300, 240, 200, 0.05)] },
  /** Hatch: a small rising run, the last pop held. */
  hatch: { durationMs: 700, master: 0.38, lowpassHz: 2400, layers: [pop(0, 440, 520, 90, 0.11), pop(150, 560, 660, 90, 0.11), pop(300, 700, 840, 120, 0.12), hum(340, [840, 980, 900], 320, 0.05)] },
  /** A drink: a sip that rises (the hum lifted and quickened), two small gulps after it. */
  drink: { durationMs: 480, master: 0.32, lowpassHz: 2000, layers: [hum(0, [420, 640, 560], 200, 0.06), pop(210, 520, 600, 60, 0.06), pop(330, 560, 640, 60, 0.05)] },
  /** Choosing an item: the smallest tick, high and quiet. */
  select: { durationMs: 70, master: 0.22, lowpassHz: 2400, layers: [pop(0, 880, 980, 45, 0.06)] },
  /** Picking an item up: a short pop that rises, "hup". */
  pickup: { durationMs: 110, master: 0.26, lowpassHz: 2400, layers: [pop(0, 520, 760, 75, 0.08)] },
  /** Setting it down: a soft low pop that falls, with a breath of hum under it. */
  drop: { durationMs: 170, master: 0.28, lowpassHz: 1600, layers: [pop(0, 320, 210, 95, 0.1), hum(10, [260, 220, 200], 120, 0.03)] },
  /** Going to another room: a gentle swish, the hum gliding up and settling, a light tap at its end. */
  room: { durationMs: 330, master: 0.24, lowpassHz: 1800, layers: [hum(0, [380, 520, 460], 260, 0.05), pop(150, 600, 700, 60, 0.04)] },
  /** A piece of furniture answering a tap: a low wooden knock, twice, the second quieter. */
  knock: { durationMs: 170, master: 0.3, lowpassHz: 1300, layers: [pop(0, 240, 200, 60, 0.1), pop(75, 300, 260, 50, 0.05)] },
  /** A piece set down while decorating: a settled pop and a small lift. */
  place: { durationMs: 150, master: 0.28, lowpassHz: 1900, layers: [pop(0, 420, 360, 70, 0.09), pop(65, 560, 620, 50, 0.05)] },
  /** A room saved: a two-note chime, the second higher and held. */
  save: { durationMs: 380, master: 0.3, lowpassHz: 2400, layers: [pop(0, 660, 700, 90, 0.08), pop(120, 880, 940, 140, 0.08), hum(120, [880, 990, 940], 220, 0.03)] },
  /** Not possible: a short low "nuh", never a buzzer. */
  invalid: { durationMs: 190, master: 0.26, lowpassHz: 1300, layers: [hum(0, [300, 260, 240], 160, 0.05)] },
  /** A journey's first cue: gathering itself, eyes shut. A hum that swells, low and patient. */
  gather: { durationMs: 640, master: 0.24, lowpassHz: 2000, layers: [hum(0, [300, 380, 460], 620, 0.045), hum(200, [380, 460, 520], 420, 0.025)] },
  /**
   * Rising away as the body dissolves top to bottom: a shimmer of small pops
   * that climbs, quieter as it goes, and a light whoosh up at the end.
   * Magic, not lasers.
   */
  rise: {
    durationMs: 1260,
    master: 0.24,
    lowpassHz: 2400,
    layers: [...[0, 1, 2, 3, 4, 5, 6].map((i) => pop(i * 115, 640 + i * 70, 760 + i * 60, 60, 0.04 - i * 0.003)), hum(860, [700, 950, 1180], 380, 0.025)],
  },
  /** Coming down: the shimmer falling, then a soft settling hum as the body forms bottom to top. */
  descend: {
    durationMs: 1240,
    master: 0.24,
    lowpassHz: 2400,
    layers: [...[0, 1, 2, 3, 4, 5].map((i) => pop(i * 90, 1150 - i * 80, 1050 - i * 80, 60, 0.035)), hum(420, [520, 440, 480], 800, 0.035)],
  },
  /** It worked: the glad two pops, a little brighter, as the eyes open. */
  tada: { durationMs: 360, master: 0.3, lowpassHz: 2400, layers: [pop(0, 620, 720, 80, 0.11), pop(120, 760, 900, 110, 0.11), hum(20, [760, 880, 820], 220, 0.035)] },
  /** Evolve: the same run, one step further and longer. */
  evolve: { durationMs: 960, master: 0.38, lowpassHz: 2400, layers: [pop(0, 440, 520, 90, 0.11), pop(150, 560, 660, 90, 0.11), pop(300, 700, 840, 90, 0.11), pop(450, 880, 1040, 140, 0.12), hum(480, [1000, 1180, 1080], 440, 0.05)] },
};
