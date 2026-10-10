/**
 * What the 3D generator knows how to draw, checked against what the kit
 * says exists.
 *
 * The kit publishes its catalogue: the procedural algorithm's version, the
 * genome's version, and every trait kind (`HORN_KINDS`, `EAR_KINDS`,
 * `TAIL_KINDS`, `PATTERN_KINDS`, `MARK_KINDS`, antenna counts 0–2). This
 * module states, per kind, how the 3D generator handles it, and compares
 * the two lists: a kind the kit has and this table does not is reported,
 * as is a primitive part in the kit's geometry that the builders do not
 * know. In a dev build an unsupported Blobbi throws (`assertSupported`),
 * so a new trait shows up as a loud failure in the lab and the tests,
 * never as a quietly wrong character; in production it is reported once
 * and the model is drawn with what is known.
 */
import {
  EAR_KINDS,
  GENOME_VERSION,
  HORN_KINDS,
  MARK_KINDS,
  PATTERN_KINDS,
  PROCEDURAL_ALGORITHM_VERSION,
  TAIL_KINDS,
  buildBlobbiGeometry,
  type BlobbiMorphology,
} from '@blobbi-kit/renderer/procedural';

export type Support = 'full' | 'approximate' | 'partial' | 'unsupported';

export interface FeatureSupport {
  feature: string;
  support: Support;
  /** How it is built, and from what. */
  how: string;
}

/** The kit versions this generator was written against. */
export const KNOWN_ALGORITHM = 1;
export const KNOWN_GENOME = 1;

/** Every trait kind the kit lists, and how the 3D generator draws it. */
export const TRAIT_SUPPORT: Record<string, FeatureSupport> = {
  'antenna:0': { feature: 'No antenna', support: 'full', how: 'nothing drawn' },
  'antenna:1': { feature: 'One antenna', support: 'full', how: 'stalk swept along the kit centreline (front: across/up, side: forward), tip ball as deep as the side view draws it' },
  'antenna:2': { feature: 'Two antennae', support: 'full', how: 'as one, each from its own front and side drawing; asymmetry carried by the kit' },
  'horns:none': { feature: 'No horns', support: 'full', how: 'nothing drawn' },
  'horns:forehead': { feature: 'Forehead horn', support: 'approximate', how: 'the front view draws it pointing at the viewer, so its curve is taken from the side view and its place across from the back view; swept, tapered, rounded tip' },
  'horns:top': { feature: 'Top horns', support: 'full', how: 'swept along the kit centreline from the front (across/up) and side (forward) drawings; curl, taper, roundness from the outline' },
  'horns:side': { feature: 'Side horns', support: 'full', how: 'as top horns' },
  'ears:none': { feature: 'No ears', support: 'full', how: 'nothing drawn' },
  'ears:round': { feature: 'Round ears', support: 'approximate', how: 'the front view ellipses as flat ellipsoids (depth a third of the width: the kit draws no ear depth), placed in depth by the side view, inner ear on the front face' },
  'ears:pointed': { feature: 'Pointed ears', support: 'approximate', how: 'swept along the soft cone centreline the kit draws it around, flat across, with the flop the kit gives it; inner ear on the front face' },
  'tail:none': { feature: 'No tail', support: 'full', how: 'nothing drawn' },
  'tail:nub': { feature: 'Nub tail', support: 'full', how: 'ball as drawn in the side view, as wide as the back view draws it' },
  'tail:curl': { feature: 'Curl tail', support: 'full', how: 'stalk swept along the side view centreline (its curl is in that plane), accent tip ball' },
  'tail:leaf': { feature: 'Leaf tail', support: 'approximate', how: 'leaf ellipse from the side view, its width from the back view, vein as a tube on the near face' },
  'pattern:solid': { feature: 'Solid', support: 'full', how: 'body gradient only' },
  'pattern:spotted': { feature: 'Spots', support: 'approximate', how: 'front and back view spots painted on a texture wrapped round the body; the kit draws no spots in profile, so the sides take what the two views give' },
  'pattern:striped': { feature: 'Stripes', support: 'approximate', how: 'front and back view bands painted round the body' },
  'pattern:gradient': { feature: 'Gradient', support: 'full', how: 'painted from the kit start and strength' },
  'mark:none': { feature: 'No mark', support: 'full', how: 'nothing drawn' },
  'mark:star': { feature: 'Star mark', support: 'approximate', how: 'kit glyph outline restated (not exported), placed by the kit' },
  'mark:heart': { feature: 'Heart mark', support: 'approximate', how: 'as star' },
  'mark:sparkle': { feature: 'Sparkle mark', support: 'approximate', how: 'as star' },
  'mark:moon': { feature: 'Moon mark', support: 'approximate', how: 'as star' },
  'belly:true': { feature: 'Belly patch', support: 'full', how: 'kit radial gradient ellipse painted on the body' },
  'freckles:true': { feature: 'Freckles', support: 'full', how: 'kit dots painted on the body' },
};

/** Primitive parts the 3D builders know, by the kit's own part names. */
export const KNOWN_PRIMS = new Set([
  'antenna-stalk', 'antenna-tip', 'antenna-highlight', 'antenna-root', 'antenna-root-shade',
  'horn-body', 'horn-highlight', 'horn-root',
  'ear-outer', 'ear-inner', 'ear-root-shade',
  'tail-nub', 'tail-highlight', 'tail-curl', 'tail-tip', 'tail-leaf', 'tail-vein',
]);

/** Which of the kit's trait kinds this table does not cover. Empty when in step. */
export function unknownKinds(): string[] {
  const lists: [string, readonly string[]][] = [
    ['horns', HORN_KINDS], ['ears', EAR_KINDS], ['tail', TAIL_KINDS], ['pattern', PATTERN_KINDS], ['mark', MARK_KINDS],
  ];
  const out: string[] = [];
  for (const [trait, kinds] of lists) for (const kind of kinds) if (!(`${trait}:${kind}` in TRAIT_SUPPORT)) out.push(`${trait}:${kind}`);
  if (PROCEDURAL_ALGORITHM_VERSION !== KNOWN_ALGORITHM) out.push(`algorithm:${PROCEDURAL_ALGORITHM_VERSION}`);
  if (GENOME_VERSION !== KNOWN_GENOME) out.push(`genome:${GENOME_VERSION}`);
  return out;
}

/** What one morphology asks for that the generator does not know: unknown kinds or unknown parts in any view. */
export function unsupportedIn(m: BlobbiMorphology): string[] {
  const out = new Set(unknownKinds());
  const kinds = [
    `antenna:${m.antennae.length}`,
    `horns:${m.horns?.kind ?? 'none'}`,
    `ears:${m.ears?.kind ?? 'none'}`,
    `tail:${m.tail?.kind ?? 'none'}`,
    `pattern:${m.pattern}`,
    `mark:${m.mark?.kind ?? 'none'}`,
  ];
  for (const k of kinds) if (!(k in TRAIT_SUPPORT)) out.add(k);
  for (const view of ['front', 'back', 'side'] as const) {
    const geo = buildBlobbiGeometry(m, { view });
    for (const a of geo.appendages) for (const p of a.prims) if (!KNOWN_PRIMS.has(p.part)) out.add(`part:${p.part}`);
  }
  return [...out];
}

export class UnsupportedMorphologyError extends Error {
  constructor(readonly missing: string[]) {
    super(`The 3D Blobbi does not know how to draw: ${missing.join(', ')}`);
    this.name = 'UnsupportedMorphologyError';
  }
}

const reported = new Set<string>();

/** Throw in a dev build (and in tests) when the morphology needs something unknown; report once otherwise. */
export function assertSupported(m: BlobbiMorphology, strict = import.meta.env.DEV): void {
  const missing = unsupportedIn(m);
  if (missing.length === 0) return;
  if (strict) throw new UnsupportedMorphologyError(missing);
  const key = missing.join(',');
  if (!reported.has(key)) {
    reported.add(key);
    console.warn(`[blobbi-3d] ${new UnsupportedMorphologyError(missing).message}`);
  }
}
