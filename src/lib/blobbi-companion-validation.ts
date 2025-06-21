import { Blobbi } from '@/types/blobbi';

/**
 * Validates if a Blobbi can be selected as the current companion.
 * A Blobbi can only be selected as companion if it is not in the egg stage.
 */
export function canBlobbiBeCompanion(blobbi: Blobbi | null | undefined): boolean {
  if (!blobbi) {
    return false;
  }
  
  // Blobbis in egg stage cannot be companions
  return blobbi.lifeStage !== 'egg';
}

/**
 * Gets a user-friendly message explaining why a Blobbi cannot be selected as companion.
 */
export function getCompanionValidationMessage(blobbi: Blobbi | null | undefined): string {
  if (!blobbi) {
    return 'Blobbi not found';
  }
  
  if (blobbi.lifeStage === 'egg') {
    return 'Eggs cannot be selected as companions. Wait for your Blobbi to hatch first!';
  }
  
  return 'This Blobbi can be selected as a companion';
}

/**
 * Validates a list of Blobbis and returns only those that can be companions.
 */
export function filterValidCompanions(blobbis: Blobbi[]): Blobbi[] {
  return blobbis.filter(canBlobbiBeCompanion);
}