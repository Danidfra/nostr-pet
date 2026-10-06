import { deriveBlobbiSeedV1 } from '@blobbi-kit/core';
import { canonicalBlobbiV3Seed } from '@blobbi-kit/renderer';

/** The owner the sheet's seeds are derived for: a seed is a function of an owner, a `d` and a time, and these are nobody's. */
const SHEET_PUBKEY = 'd'.repeat(64);

export type SheetSource = 'reference' | 'seeds';

/**
 * Real seeds for a base label: the kit's own derivation (an owner, a `d`,
 * a time), so every row is a seed an adoption could really produce. A base
 * that already IS a seed (64 hexadecimal digits, pasted from an event) is
 * shown as itself, alone.
 */
export function sheetSeeds(base: string, count: number): { label: string; seed: string }[] {
  const pasted = canonicalBlobbiV3Seed(base);
  if (pasted) return [{ label: `${pasted.slice(0, 8)}…`, seed: pasted }];
  return Array.from({ length: count }, (_, i) => ({ label: `${base}-${i + 1}`, seed: deriveBlobbiSeedV1(SHEET_PUBKEY, `${base}-${i + 1}`, 0) }));
}

