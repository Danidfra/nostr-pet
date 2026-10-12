/**
 * The Blobbi's voice, as data.
 *
 * One small, soft creature. Every vocal sound is made of the same blocks,
 * so they are plainly one voice and not a set of notifications:
 *
 *   coo    a sine that glides through two or three pitches with a gentle
 *          vibrato (a few hertz, a few tens of cents): the body of the
 *          voice, its "hmm", "mmm", "oo". Warm because it is a sine under
 *          a lowpass; alive because it wavers a little
 *   bright a triangle an octave up at a fraction of the coo's gain: the
 *          breath and edge of the voice, so it is not a pure tone
 *   peep   a short sine pop that leaps between two pitches with a fast
 *          attack: the consonants of the voice, its "mi", "pi", "ta"
 *   chew   Ditto's feeding blocks (`src/blobbi/ui/lib/munchSound.ts`), the
 *          one Blobbi sound the ecosystem already had: a pop as the mouth
 *          opens, a hum as it chews, a softer pop as it closes
 *
 * and one signal chain: layers → lowpass (1.5–2.2 kHz, so nothing is
 * shrill) → a little 18 ms delay mixed in quietly (a hint of room) →
 * master gain that fades out at the end. Pitch contours carry the feeling:
 * up at the end is a question (curious), two rising notes are glad, a
 * trill is excitement, a long waver that rises and settles is contentment,
 * a fall is displeasure, slow and low is sleepy. Nothing is a word.
 *
 * Every vocal sound varies a little each time (`variation`: up to so many
 * semitones either way, up to so much longer or shorter), so a creature
 * fed three times does not make the same noise three times. The room's
 * own sounds (what the player's hands do) are plainer and do not vary.
 *
 * Nothing here touches an AudioContext; `voice-engine.ts` plays a recipe.
 * Durations are short on purpose (the longest, the munch, is 1.24 s; a
 * journey is told in short cues, played on its timeline).
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
  /** A waver of the pitch: so many times a second, so many cents either way. */
  vibrato?: { hz: number; cents: number };
}

export interface Recipe {
  /** Whole sound, from first layer start to the tail's end. */
  durationMs: number;
  master: number;
  lowpassHz: number;
  layers: readonly Layer[];
  /** How much each playing may differ: pitch in semitones either way, time as a fraction longer or shorter. */
  variation?: { pitch?: number; time?: number };
}

/** A playing's own difference from the recipe: a pitch factor and a time factor, from `variantOf`. */
export interface Variant {
  pitch: number;
  time: number;
}

/** The recipe's variation realized from two numbers in [0, 1): what the engine scales by. */
export function variantOf(recipe: Pick<Recipe, 'variation'>, r1: number, r2: number): Variant {
  const semitones = (recipe.variation?.pitch ?? 0) * (r1 * 2 - 1);
  const stretch = (recipe.variation?.time ?? 0) * (r2 * 2 - 1);
  return { pitch: Math.pow(2, semitones / 12), time: 1 + stretch };
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

/** The voice's building blocks. */
const peep = (offsetMs: number, from: number, to: number, durationMs = 80, gain = 0.11): Layer => ({ wave: 'sine', offsetMs, durationMs, hz: [from, to], gain, attackMs: 7, hold: 0.4 });
const coo = (offsetMs: number, hz: readonly [number, number, number] | readonly [number, number], durationMs: number, gain = 0.085, vibrato: Layer['vibrato'] = { hz: 5.6, cents: 22 }): Layer => ({ wave: 'sine', offsetMs, durationMs, hz, gain, attackMs: 28, hold: 0.6, vibrato });
/** The breath over a coo: the same contour an octave up, quiet, as a triangle. */
const bright = (c: Layer, share = 0.3): Layer => ({ ...c, wave: 'triangle', hz: c.hz.map((h) => h * 2) as unknown as Layer['hz'], gain: c.gain * share });
/** A coo with its breath. */
const voiced = (c: Layer, share = 0.3): Layer[] => [c, bright(c, share)];
/** The room's plain pop. */
const pop = (offsetMs: number, from: number, to: number, durationMs = 80, gain = 0.12): Layer => ({ wave: 'sine', offsetMs, durationMs, hz: [from, to], gain, attackMs: 6, hold: 0.35 });
const hum = (offsetMs: number, hz: readonly [number, number, number], durationMs = 130, gain = 0.055): Layer => ({ wave: 'triangle', offsetMs, durationMs, hz, gain, attackMs: 20, hold: 0.55 });

/** How much a vocal sound may vary: a little, so it is recognizably the same noise, never the same recording. */
const VOCAL = { pitch: 0.8, time: 0.08 } as const;

export const VOICE: Record<import('./sounds').BlobbiSoundId, Recipe> = {
  // ─── The voice ───
  /** "Hmm?": a coo that dips and lifts at its end, the question in it; a small creature noticing something. */
  curious: { durationMs: 360, master: 0.32, lowpassHz: 1800, variation: VOCAL, layers: [...voiced(coo(0, [340, 310, 430], 330, 0.085, { hz: 5, cents: 18 }), 0.28)] },
  /** A touch: a soft "boop", the smallest glad note, with the hum of the body under it. */
  poke: { durationMs: 240, master: 0.3, lowpassHz: 1800, variation: VOCAL, layers: [peep(0, 420, 470, 70, 0.1), coo(30, [380, 410, 390], 190, 0.06, undefined)] },
  /** Glad: two notes, the second higher and held a little, "mi-mii", each with its breath. */
  happy: { durationMs: 420, master: 0.34, lowpassHz: 2000, variation: VOCAL, layers: [peep(0, 430, 500, 80, 0.1), ...voiced(coo(90, [520, 600, 580], 290, 0.085, { hz: 6, cents: 20 }), 0.32)] },
  /** Excited: three quick rising notes and a trill at the top, bright, the eyes wide. */
  excited: { durationMs: 520, master: 0.34, lowpassHz: 2200, variation: VOCAL, layers: [peep(0, 480, 560, 65, 0.1), peep(95, 560, 660, 65, 0.1), peep(190, 660, 760, 70, 0.1), ...voiced(coo(250, [740, 800, 720], 260, 0.075, { hz: 9, cents: 40 }), 0.35)] },
  /** Playful: two bright little chirps, "pi-pi", the second a bounce up; a creature with a ball. */
  chirp: { durationMs: 300, master: 0.32, lowpassHz: 2200, variation: { pitch: 1.2, time: 0.1 }, layers: [peep(0, 620, 700, 60, 0.1), peep(110, 680, 860, 90, 0.1), bright(coo(120, [700, 820, 760], 150, 0.05, { hz: 8, cents: 30 }), 0.5)] },
  /** One bite: Ditto's chew, once (the mouth opening on it, the chew, the mouth closing), a touch softer. */
  bite: { durationMs: CHEW_CYCLE_MS, master: 0.34, lowpassHz: 1900, variation: { pitch: 1, time: 0.06 }, layers: [{ ...OPEN_POP, gain: 0.115 }, HUM, CLOSE_SMACK] },
  /** Ditto's munch, whole: four decaying chews (the classic home's feeding). */
  eat: { durationMs: 4 * CHEW_CYCLE_MS + 40, master: 0.38, lowpassHz: 1900, layers: chew() },
  /** Satisfied, after food: "mmm~", a long coo that settles and lifts a little at the end, and a small lick. */
  yum: { durationMs: 620, master: 0.32, lowpassHz: 1600, variation: VOCAL, layers: [...voiced(coo(0, [360, 330, 380], 520, 0.09, { hz: 5.2, cents: 28 }), 0.22), peep(520, 460, 520, 60, 0.045)] },
  /** Petted: a purr, a low coo that wavers, swells and settles, its breath barely there. */
  pet: { durationMs: 680, master: 0.26, lowpassHz: 1400, variation: { pitch: 0.6, time: 0.1 }, layers: [...voiced(coo(0, [290, 330, 300], 640, 0.09, { hz: 6.4, cents: 36 }), 0.16), coo(120, [305, 340, 310], 480, 0.035, { hz: 6.4, cents: 36 })] },
  /** Displeased: a short "hmph", a coo pushed down, falling, its breath thin. */
  upset: { durationMs: 320, master: 0.32, lowpassHz: 1500, variation: VOCAL, layers: [...voiced(coo(0, [430, 340, 280], 260, 0.085, { hz: 4.5, cents: 14 }), 0.15), peep(40, 300, 240, 80, 0.06)] },
  /** Sleepy: "mmm…", one long low coo sinking slowly, its waver slow. */
  sleepy: { durationMs: 620, master: 0.28, lowpassHz: 1300, variation: { pitch: 0.5, time: 0.1 }, layers: [...voiced(coo(0, [320, 300, 240], 580, 0.085, { hz: 3.6, cents: 24 }), 0.12)] },
  /** "!": two quick notes up, wide-eyed. */
  surprise: { durationMs: 220, master: 0.3, lowpassHz: 2200, variation: VOCAL, layers: [peep(0, 620, 800, 60, 0.09), peep(85, 780, 980, 90, 0.085), bright(coo(90, [800, 900, 860], 120, 0.04, { hz: 8, cents: 30 }), 0.5)] },
  /** Hatch: a small rising run, the last note held with a waver. */
  hatch: { durationMs: 760, master: 0.36, lowpassHz: 2200, variation: { pitch: 0.4 }, layers: [peep(0, 440, 520, 90, 0.1), peep(150, 560, 660, 90, 0.1), peep(300, 700, 840, 120, 0.11), ...voiced(coo(340, [840, 900, 860], 400, 0.07, { hz: 6, cents: 24 }), 0.3)] },
  /** Evolve: the same run, one step further and longer. */
  evolve: { durationMs: 1020, master: 0.36, lowpassHz: 2200, variation: { pitch: 0.4 }, layers: [peep(0, 440, 520, 90, 0.1), peep(150, 560, 660, 90, 0.1), peep(300, 700, 840, 90, 0.1), peep(450, 880, 1040, 140, 0.11), ...voiced(coo(480, [1000, 1080, 1020], 520, 0.065, { hz: 6, cents: 24 }), 0.3)] },
  /** Bath: three quick bubbles, each a little higher, with a watery coo under them. */
  clean: { durationMs: 540, master: 0.32, lowpassHz: 2200, variation: VOCAL, layers: [pop(0, 560, 720, 70, 0.09), coo(20, [600, 740, 620], 220, 0.045, { hz: 7, cents: 30 }), pop(160, 620, 800, 70, 0.085), pop(330, 700, 900, 70, 0.08)] },
  /** A drink: a sip that rises (a coo lifted and quickened), two small gulps after it. */
  drink: { durationMs: 500, master: 0.3, lowpassHz: 1900, variation: VOCAL, layers: [coo(0, [420, 640, 560], 210, 0.065, { hz: 7, cents: 20 }), pop(220, 520, 600, 60, 0.06), pop(340, 560, 640, 60, 0.05)] },

  // ─── The room's own ───
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
  /** A ball struck: a soft round "bop", low and short, with the tick of the toe on it. */
  kick: { durationMs: 140, master: 0.3, lowpassHz: 1500, variation: { pitch: 1, time: 0.05 }, layers: [pop(0, 210, 140, 90, 0.12), pop(0, 820, 420, 26, 0.045)] },
  /** A crack in an egg's shell: a small dry tick and a smaller one after it, never sharp. */
  crack: { durationMs: 150, master: 0.26, lowpassHz: 2000, variation: { pitch: 1.5, time: 0.05 }, layers: [pop(0, 1400, 700, 30, 0.07), pop(55, 1100, 560, 35, 0.045), pop(0, 300, 220, 60, 0.05)] },
  /** A ball landing or meeting a wall: a smaller bop. */
  bounce: { durationMs: 100, master: 0.24, lowpassHz: 1400, variation: { pitch: 1.5 }, layers: [pop(0, 250, 170, 60, 0.09)] },

  // ─── Journeys and scenes ───
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
  /** It worked: the glad two notes, a little brighter, as the eyes open. */
  tada: { durationMs: 400, master: 0.3, lowpassHz: 2200, variation: VOCAL, layers: [peep(0, 560, 660, 80, 0.1), ...voiced(coo(110, [700, 800, 760], 280, 0.08, { hz: 6, cents: 22 }), 0.3)] },
  /** Getting ready to jump: a low squeeze that rises a little, as it crouches. */
  crouch: { durationMs: 260, master: 0.24, lowpassHz: 1600, variation: VOCAL, layers: [coo(0, [260, 290, 330], 240, 0.06, { hz: 5, cents: 14 })] },
  /** Off it goes: a springy note that leaps up, and a little coo trailing after. */
  jump: { durationMs: 300, master: 0.28, lowpassHz: 2200, variation: VOCAL, layers: [peep(0, 360, 760, 120, 0.1), coo(50, [520, 720, 900], 220, 0.035, { hz: 7, cents: 20 })] },
  /** Landing: a soft thump and a small bounce, never a crash. */
  land: { durationMs: 200, master: 0.32, lowpassHz: 1200, layers: [pop(0, 250, 200, 100, 0.14), pop(80, 320, 270, 70, 0.05)] },
  /** Falling out of view: a whistle that slides down, cartoon, not alarming. */
  fall: { durationMs: 600, master: 0.22, lowpassHz: 2200, variation: VOCAL, layers: [coo(0, [1050, 760, 400], 580, 0.045, { hz: 7, cents: 30 })] },
  /** Coming out from behind the wall: "ta!", two bright notes. */
  peek: { durationMs: 220, master: 0.26, lowpassHz: 2200, variation: VOCAL, layers: [peep(0, 560, 680, 60, 0.085), peep(80, 700, 840, 100, 0.08)] },
};
