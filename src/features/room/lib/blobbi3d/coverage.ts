/**
 * Fixtures that cover the canonical V3 feature space, built only through
 * the kit's own genome API: `generateGenome` with a semantic identity (the
 * same way the kit's `blobbiV3Genome` states trait kinds), and genomes
 * whose genes are pushed to the kit's bounds (`clampGene`'s ±1, which
 * `deriveMorphology` maps onto each gene's documented range). Nothing here
 * is a second genome algorithm: it chooses inputs, the kit does the rest.
 */
import {
  ANTENNA_GENES,
  EAR_KINDS,
  HORN_GENES,
  HORN_KINDS,
  MARK_KINDS,
  MORPHOLOGY_GENES,
  PATTERN_KINDS,
  TAIL_GENES,
  TAIL_KINDS,
  generateGenome,
  type BlobbiGenome,
} from '@blobbi-kit/renderer/procedural';

export interface Fixture {
  id: string;
  label: string;
  /** What it is there to show. */
  focus: string;
  genome: BlobbiGenome;
}

type Semantic = Exclude<Parameters<typeof generateGenome>[0], string>;

function semantic(id: string, label: string, focus: string, traits: Omit<Semantic, 'seed'>, seed = `coverage-${id}`): Fixture {
  return { id, label, focus, genome: generateGenome({ seed, ...traits }) };
}

/** One fixture per trait kind the kit lists (and both antenna counts), on an otherwise plain Blobbi. */
export function traitFixtures(): Fixture[] {
  const plain = { antenna: 'none', horns: 'none', ears: 'none', tail: 'none', pattern: 'solid', mark: 'none', belly: false, freckles: false } as const;
  const out: Fixture[] = [];
  for (const antenna of ['single', 'double'] as const) out.push(semantic(`antenna-${antenna}`, `Antenna: ${antenna}`, 'antenna', { ...plain, antenna }));
  for (const horns of HORN_KINDS.filter((k) => k !== 'none')) out.push(semantic(`horns-${horns}`, `Horns: ${horns}`, 'horns', { ...plain, horns }));
  for (const ears of EAR_KINDS.filter((k) => k !== 'none')) out.push(semantic(`ears-${ears}`, `Ears: ${ears}`, 'ears', { ...plain, ears }));
  for (const tail of TAIL_KINDS.filter((k) => k !== 'none')) out.push(semantic(`tail-${tail}`, `Tail: ${tail}`, 'tail', { ...plain, tail }));
  for (const pattern of PATTERN_KINDS) out.push(semantic(`pattern-${pattern}`, `Pattern: ${pattern}`, 'pattern', { ...plain, pattern }));
  for (const mark of MARK_KINDS.filter((k) => k !== 'none')) out.push(semantic(`mark-${mark}`, `Mark: ${mark}`, 'mark', { ...plain, mark }));
  out.push(semantic('belly', 'Belly patch', 'belly', { ...plain, belly: true }));
  out.push(semantic('freckles', 'Freckles', 'freckles', { ...plain, freckles: true }));
  return out;
}

/**
 * Every pair of appendage kinds the kit can combine (antennae, horns, ears,
 * tails): where two parts share the crown or the back, they can collide.
 */
export function pairFixtures(): Fixture[] {
  const antennae = ['none', 'single', 'double'] as const;
  const horns = HORN_KINDS;
  const ears = EAR_KINDS;
  const tails = TAIL_KINDS;
  const out: Fixture[] = [];
  const base = { pattern: 'solid', mark: 'none', belly: false, freckles: false } as const;
  for (const antenna of antennae) for (const h of horns) out.push(semantic(`pair-a${antenna}-h${h}`, `${antenna} + ${h}`, 'crown pair', { ...base, antenna, horns: h, ears: 'none', tail: 'none' }));
  for (const h of horns) for (const e of ears) out.push(semantic(`pair-h${h}-e${e}`, `${h} + ${e} ears`, 'crown pair', { ...base, antenna: 'none', horns: h, ears: e, tail: 'none' }));
  for (const e of ears) for (const t of tails) out.push(semantic(`pair-e${e}-t${t}`, `${e} ears + ${t}`, 'body pair', { ...base, antenna: 'double', horns: 'none', ears: e, tail: t }));
  return out;
}

/**
 * The bounds: every morphology gene at -1 and at +1 at once, and each trait
 * gene too, with every appendage present so its extremes are exercised.
 */
export function extremeFixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (const sign of [-1, 1] as const) {
    for (const [horns, ears, tail] of [['top', 'pointed', 'curl'], ['side', 'round', 'leaf'], ['forehead', 'none', 'nub']] as const) {
      const g = generateGenome({ seed: `extreme-${sign}-${horns}`, antenna: 'double', horns, ears, tail, pattern: 'striped', mark: 'star', belly: true, freckles: true });
      for (const name of MORPHOLOGY_GENES) g.morphology[name] = sign;
      for (const name of ANTENNA_GENES) g.traits.antenna[name] = sign;
      for (const name of HORN_GENES) g.traits.horns[name] = sign;
      for (const name of TAIL_GENES) g.traits.tail[name] = sign;
      g.traits.ears.size = sign;
      g.traits.ears.tilt = sign;
      g.traits.ears.flop = sign;
      g.traits.ears.position = sign;
      out.push({ id: `extreme-${sign < 0 ? 'min' : 'max'}-${horns}`, label: `${sign < 0 ? 'Min' : 'Max'} genes, ${horns} horns, ${ears} ears, ${tail} tail`, focus: 'bounds', genome: g });
    }
  }
  return out;
}
