/**
 * The canonical words for stats, care verbs and stages, in the page's
 * language: one place for every screen that names them (the 2D home, the 3D
 * room). Functions, never tables: a word is looked up when it is shown.
 */
import type { BlobbiCompanion, BlobbiStats } from '@blobbi-kit/core';
import { t } from '@/i18n';

export type StatName = keyof BlobbiStats;
export type StatLevel = 'normal' | 'warning' | 'critical';
/** The care verbs as buttons say them; `wake` is Rest for a sleeping Blobbi. */
export type CareWord = 'feed' | 'play' | 'clean' | 'rest' | 'wake';

/** A stat's label on a ring or a meter ("Food", "Joy", "Clean", "Energy", "Health"). */
export function statLabel(stat: StatName): string {
  return t(`home.stats.label.${stat}`);
}

/** A stat as a word inside a line ("+10 food"). */
export function statWord(stat: StatName): string {
  return t(`home.stats.word.${stat}`);
}

/** What a low stat makes the Blobbi ("hungry", "tired"). */
export function needWord(stat: StatName): string {
  return t(`home.stats.need.${stat}`);
}

/** A stat's level as a word ("fine", "low", "very low"). */
export function statLevelWord(level: StatLevel): string {
  return t(`home.stats.status.${level}`);
}

/** A care verb's label ("Feed", "Play", "Care", "Rest", "Wake"). */
export function careLabel(action: CareWord): string {
  return t(`home.care.${action}`);
}

/** A stage's label ("Egg", "Baby", "Adult"). */
export function stageLabel(stage: BlobbiCompanion['stage']): string {
  return t(`home.stage.${stage}`);
}
