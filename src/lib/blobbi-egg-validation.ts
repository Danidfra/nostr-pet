/**
 * Blobbi Egg Validation
 *
 * This file re-exports from the blobbi-egg module for backwards compatibility.
 * The actual implementation is now in src/blobbi-egg/lib/blobbi-egg-validation.ts
 */

export {
  // Validation functions
  isValidBaseColor,
  isValidSecondaryColor,
  isValidSize,
  isValidPattern,
  isValidEggStatus,
  isValidSpecialMark,
  isValidTitle,
  isValidEyeColor,
  // Rarity functions
  getColorRarity,
  getSizeRarity,
  getSpecialMarkRarity,
  getTitleRarity,
  getEyeColorRarity,
  // Validation
  validateEggProperties,
  // Constants
  VALID_BASE_COLORS,
  VALID_SECONDARY_COLORS,
  VALID_SIZES,
  VALID_PATTERNS,
  VALID_EGG_STATUSES,
  VALID_SPECIAL_MARKS,
  VALID_TITLES,
  VALID_EYE_COLORS,
  ALL_VALID_BASE_COLORS,
  ALL_VALID_SECONDARY_COLORS,
  ALL_VALID_SIZES,
  ALL_VALID_SPECIAL_MARKS,
  ALL_VALID_TITLES,
  ALL_VALID_EYE_COLORS,
} from '@/blobbi-egg';

export type { EggValidationResult } from '@/blobbi-egg';
