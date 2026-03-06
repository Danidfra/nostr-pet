/**
 * Divine Blobbi Utilities
 *
 * This file re-exports from the egg module for backwards compatibility.
 * The actual implementation is now in src/egg/lib/blobbi-divine-utils.ts
 *
 * Note: The original functions accepted the full Blobbi type, but the module
 * now uses EggVisualBlobbi. Since EggVisualBlobbi is a subset of Blobbi,
 * the functions remain compatible.
 */

import { Blobbi } from '@/types/blobbi';
import {
  isDivineBlobbi as _isDivineBlobbi,
  isDivineEgg as _isDivineEgg,
  ensureDivineTags as _ensureDivineTags,
  syncDivineModelFields as _syncDivineModelFields,
  createDivineBlobbiProperties as _createDivineBlobbiProperties,
  validateDivineConsistency as _validateDivineConsistency,
  createTagMap,
  DIVINE_THEME,
  DIVINE_CROSSOVER_APP,
  DIVINE_BASE_COLOR,
  DIVINE_SPECIAL_MARK,
} from '@/egg';

// Re-export constants directly
export {
  createTagMap,
  DIVINE_THEME,
  DIVINE_CROSSOVER_APP,
  DIVINE_BASE_COLOR,
  DIVINE_SPECIAL_MARK,
};

// Wrapper functions that accept full Blobbi type for backwards compatibility
export function isDivineBlobbi(blobbi: Blobbi | null | undefined): boolean {
  return _isDivineBlobbi(blobbi);
}

export function isDivineEgg(blobbi: Blobbi | null | undefined): boolean {
  return _isDivineEgg(blobbi);
}

export function ensureDivineTags(blobbi: Blobbi): Blobbi {
  return _ensureDivineTags(blobbi) as Blobbi;
}

export function syncDivineModelFields(blobbi: Blobbi): Blobbi {
  return _syncDivineModelFields(blobbi) as Blobbi;
}

export function createDivineBlobbiProperties(overrides: Partial<Blobbi> = {}): Partial<Blobbi> {
  return _createDivineBlobbiProperties(overrides);
}

export function validateDivineConsistency(blobbi: Blobbi): { isValid: boolean; errors: string[] } {
  return _validateDivineConsistency(blobbi);
}
