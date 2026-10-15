/**
 * Medicine (M15 care refinement): a short moment where the Blobbi stands,
 * never the bath and never a walk to the tub. The same in both homes, on
 * each home's own item path (the one write, the spend, the ledger):
 *
 *   dose      worried, the medicine goes to its mouth
 *   wiggle    a little wiggle as it takes it
 *   (the write: only now; a cancel before it writes nothing)
 *   relieved  once the write has landed: relieved, sparkles, "Treated"
 *
 * About 1.5 s with the write. Its own full-stat rule: refused when its
 * health is already full (not the bath's hygiene rule). The item's effects
 * are the catalog's, untouched.
 */
import { STAT_MAX } from '@blobbi-kit/core';
import { GESTURES } from '../scene/gestures';

export type MedicinePhase = 'dose' | 'wiggle' | 'relieved';

export const MEDICINE_MOMENT = {
  /** The medicine on its way to the mouth. */
  doseMs: 420,
  /** The wiggle as it takes it (the body gesture's own length). */
  wiggleMs: GESTURES.wiggle.durationMs,
  /** Relieved, with sparkles, after the write landed. */
  relievedMs: 520,
  /** Under reduced motion: no flight, no wiggle, a moment each. */
  reducedMs: 160,
} as const;

/** The face of each phase. */
export const MEDICINE_FACE = { dose: 'worried', wiggle: 'worried', relieved: 'relieved' } as const satisfies Record<MedicinePhase, string>;

/** Why medicine cannot be given now, or null: its health already full. */
export function medicineRefusal(name: string, health: number | undefined): string | null {
  return health !== undefined && health >= STAT_MAX ? `${name} is feeling fine. No medicine needed!` : null;
}

/** How long before the write: the dose and the wiggle (a beat each under reduced motion). */
export function beforeWriteMs(reducedMotion: boolean): number {
  return reducedMotion ? MEDICINE_MOMENT.reducedMs * 2 : MEDICINE_MOMENT.doseMs + MEDICINE_MOMENT.wiggleMs;
}
