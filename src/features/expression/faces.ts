/**
 * The faces a Blobbi can make, by name, in the kit's own vocabulary.
 *
 * A name says what the moment is (curious, worried, affectionate); the face
 * is the kit's: a preset, a blend of presets (drawn continuously by V3
 * art, the dominant preset by V1/V2), or explicit parts (eyes closed, a
 * smile, a blush). Nothing here draws or invents a shape: the 2D drawing
 * hands the expression to `BlobbiRenderer`, and the 3D model asks the kit's
 * procedural face for the same expression (`proceduralFace`), so both are
 * the kit's own face for the moment.
 *
 * Blends are weighted so the dominant preset is at least half: V1 and V2
 * art, which cannot blend, then draw that preset rather than neutral.
 */
import type { BlobbiEmotion, BlobbiExpression, BlobbiExpressionParts } from '@blobbi-kit/renderer';

export type ExpressionName =
  | 'happy'
  | 'curious'
  | 'surprised'
  | 'worried'
  | 'concentrating'
  | 'relieved'
  | 'sleepy'
  | 'affectionate'
  | 'excited'
  | 'sad'
  | 'upset'
  | 'chewing'
  | 'munching'
  | 'impact';

export const EXPRESSIONS: Readonly<Record<ExpressionName, BlobbiExpression>> = {
  happy: 'happy',
  excited: 'excited',
  sad: 'sad',
  upset: 'upset',
  sleepy: 'sleepy',
  surprised: 'surprised',
  // Brows up, eyes a little wide, a small open smile: interested, not alarmed
  curious: { blend: { surprised: 0.55, happy: 0.45 } },
  // The brows' inner ends up, wide eyes, the mouth unsure: "uh oh"
  worried: { blend: { sad: 0.55, surprised: 0.45 } },
  // Eyes shut tight, brows down, mouth set, cheeks flushed with effort
  concentrating: { eyes: 'closed', mouth: 'flat', brows: 'lowered', blush: 'strong' },
  // Softened eyes, a smile: the breath out after
  relieved: { blend: { happy: 0.7, sleepy: 0.3 } },
  // Eyes closed in contentment, smiling, blushing
  affectionate: { eyes: 'closed', mouth: 'smile', brows: 'raised', blush: 'soft' },
  // Eating: the mouth open on a bite, then closed on it, eyes shut with the pleasure of it
  chewing: { eyes: 'closed', mouth: 'open', brows: 'raised', blush: 'soft' },
  munching: { eyes: 'closed', mouth: 'grin', brows: 'raised', blush: 'soft' },
  // The bump of a landing: eyes screwed shut, mouth a line
  impact: { eyes: 'closed', mouth: 'flat', brows: 'lowered', blush: 'none' },
};

/** The kit procedural face's input for an expression: emotion weights, or explicit parts (what `buildBlobbiGeometry`'s state takes). */
export interface ProceduralFace {
  expression: Partial<Record<Exclude<BlobbiEmotion, 'neutral'>, number>>;
  face?: BlobbiExpressionParts;
}

/** The same expression as the kit's procedural face takes it (the 3D model's), or null for the neutral face. */
export function proceduralFace(expression: BlobbiExpression | null | undefined): ProceduralFace | null {
  if (!expression || expression === 'neutral') return null;
  if (typeof expression === 'string') return { expression: { [expression]: 1 } };
  if ('blend' in expression) return { expression: { ...expression.blend } };
  return { expression: {}, face: { ...expression } };
}

/** A stable key for a face (weights to a quarter), so a model builds each face it shows once. */
export function faceKey(face: ProceduralFace | null): string {
  if (!face) return 'neutral';
  const weights = Object.entries(face.expression)
    .filter(([, w]) => (w ?? 0) > 0.01)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, w]) => `${k}:${(Math.round((w ?? 0) * 4) / 4).toFixed(2)}`)
    .join(',');
  const parts = face.face ? Object.entries(face.face).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',') : '';
  return `${weights}|${parts}`;
}
