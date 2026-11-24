/**
 * The home's music: the Blobbi theme (the same tune as the promo video's
 * score), arranged as a slow music-box lullaby that can loop for as long as
 * the player stays. F major, 84 BPM, no drums.
 *
 * The tune is two phrases, question and answer, built on one cell (two quick
 * steps up, then a leap), easy to hum, landing on the tonic:
 *
 *   A  F F G A | C . A . | Bb A G F | G . . .        (asks, ends on the 2nd)
 *   B  F F G A | C . D . | C Bb A G | F . . .        (answers, ends home)
 *
 * One loop (about 60 s) is: a soft opening with the cell alone, the theme on
 * the music box, the theme an octave lower with a little bell answering, a
 * bridge of broken chords, and a breath of near silence before it starts
 * again. Pure data; `music-engine.ts` plays it.
 */
export const MUSIC_BPM = 84;
export const BEAT_SECONDS = 60 / MUSIC_BPM;

/** [note, start beat, length in beats] */
export type NoteEvent = readonly [note: string, start: number, length: number];

const PHRASE_A: readonly NoteEvent[] = [['F5', 0, 0.5], ['F5', 0.5, 0.5], ['G5', 1, 0.5], ['A5', 1.5, 0.5], ['C6', 2, 1], ['A5', 3, 1], ['Bb5', 4, 0.5], ['A5', 4.5, 0.5], ['G5', 5, 0.5], ['F5', 5.5, 0.5], ['G5', 6, 2]];
const PHRASE_B: readonly NoteEvent[] = [['F5', 0, 0.5], ['F5', 0.5, 0.5], ['G5', 1, 0.5], ['A5', 1.5, 0.5], ['C6', 2, 1], ['D6', 3, 1], ['C6', 4, 0.5], ['Bb5', 4.5, 0.5], ['A5', 5, 0.5], ['G5', 5.5, 0.5], ['F5', 6, 2]];
/** The opening cell alone, for the sparse start. */
const CELL: readonly NoteEvent[] = PHRASE_A.slice(0, 6);

/** One chord every two beats under a phrase: [bass root, chord tones]. */
type Chord = readonly [root: string, tones: readonly string[]];
const F: Chord = ['F2', ['F3', 'A3', 'C4']];
const BB: Chord = ['Bb2', ['Bb3', 'D4', 'F4']];
const C: Chord = ['C3', ['C4', 'E4', 'G4']];
const DM: Chord = ['D3', ['D4', 'F4', 'A4']];
const CHORDS_A: readonly Chord[] = [F, F, BB, C];
const CHORDS_B: readonly Chord[] = [F, BB, C, F];
const CHORDS_BRIDGE: readonly Chord[] = [BB, F, DM, C, BB, F, C, C];

export type Voice = 'box' | 'bell' | 'pad' | 'bass';

export interface ScoreEvent {
  voice: Voice;
  /** Note names; a pad plays several at once. */
  notes: readonly string[];
  /** Start, in beats from the loop's start. */
  at: number;
  /** Length in beats. */
  beats: number;
}

function transpose(note: string, octaves: number): string {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(note);
  return m ? `${m[1]}${Number(m[2]) + octaves}` : note;
}

function melody(phrase: readonly NoteEvent[], at: number, voice: Voice, octaves = 0): ScoreEvent[] {
  return phrase.map(([note, start, length]) => ({ voice, notes: [transpose(note, octaves)], at: at + start, beats: length }));
}

function harmony(chords: readonly Chord[], at: number, opts: { bass?: boolean; arpeggio?: boolean } = {}): ScoreEvent[] {
  return chords.flatMap(([root, tones], i): ScoreEvent[] => {
    const start = at + i * 2;
    const out: ScoreEvent[] = [{ voice: 'pad', notes: tones, at: start, beats: 2 }];
    if (opts.bass) out.push({ voice: 'bass', notes: [root], at: start, beats: 1.5 });
    if (opts.arpeggio) tones.forEach((tone, k) => out.push({ voice: 'bell', notes: [transpose(tone, 1)], at: start + k * 0.5, beats: 0.5 }));
    return out;
  });
}

/** A little bell answering the lower melody: the phrase's long notes, two octaves up, softly. */
function answer(phrase: readonly NoteEvent[], at: number): ScoreEvent[] {
  return phrase.filter(([, , length]) => length >= 1).map(([note, start]) => ({ voice: 'bell', notes: [transpose(note, 1)], at: at + start + 0.5, beats: 0.5 }));
}

function buildLoop(): { events: ScoreEvent[]; beats: number } {
  const events: ScoreEvent[] = [];
  let at = 0;
  // The opening: the pad alone, then the cell, twice
  events.push(...harmony(CHORDS_A, at));
  events.push(...melody(CELL, at + 4, 'box'));
  at += 8;
  events.push(...harmony(CHORDS_B, at));
  events.push(...melody(CELL, at + 4, 'box'));
  at += 8;
  // The theme on the music box
  for (const [phrase, chords] of [[PHRASE_A, CHORDS_A], [PHRASE_B, CHORDS_B]] as const) {
    events.push(...harmony(chords, at, { bass: true }), ...melody(phrase, at, 'box'));
    at += 8;
  }
  // The theme an octave lower, a bell answering
  for (const [phrase, chords] of [[PHRASE_A, CHORDS_A], [PHRASE_B, CHORDS_B]] as const) {
    events.push(...harmony(chords, at, { bass: true }), ...melody(phrase, at, 'box', -1), ...answer(phrase, at));
    at += 8;
  }
  // The bridge: broken chords
  events.push(...harmony(CHORDS_BRIDGE, at, { bass: true, arpeggio: true }));
  at += CHORDS_BRIDGE.length * 2;
  // The theme once more, and home
  events.push(...harmony(CHORDS_B, at, { bass: true }), ...melody(PHRASE_B, at, 'box'));
  at += 8;
  // A breath before the loop starts again
  events.push({ voice: 'pad', notes: F[1], at, beats: 4 });
  at += 8;
  return { events: events.sort((a, b) => a.at - b.at), beats: at };
}

export const HOME_LOOP = buildLoop();

const SEMITONE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** A note name ("Bb5") as a frequency in hertz (A4 = 440). */
export function noteHz(note: string): number {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(note);
  if (!m || !(m[1] in SEMITONE)) throw new Error(`not a note: ${note}`);
  const midi = (Number(m[2]) + 1) * 12 + SEMITONE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
