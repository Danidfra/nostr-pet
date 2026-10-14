/**
 * Finding the Blobbi's look in the room (M14.3): the words and the rules of
 * the first visit's introduction, of the one-time guide that follows it,
 * and of the Appearance card they both point at. Everything here is this
 * device's and about presentation only: the Blobbi's identity, genome and
 * lifecycle are the same whichever look is chosen, and nothing is published.
 *
 *   the introduction      the room's first visit: two previews of the same
 *                         Blobbi (the familiar drawing, the 3D model), the
 *                         line that they are one Blobbi, "Let's explore"
 *   the guide             once per browser, right after the introduction
 *                         closes: the dock's Blobbi button glows, a small
 *                         bubble asks "Want to try another look?", the sheet
 *                         it opens lights its Appearance card for a moment
 *   the Appearance card   the Blobbi sheet's, under its own icon, with the
 *                         look in force named and shown
 *
 * The guide is remembered the moment it is shown, so it is never repeated:
 * not on the next visit, not after a reload, not when the introduction is
 * asked back by unticking "Don't show this again".
 */
import type { BlobbiAppearance } from './blobbi-appearance';

/** Whether the one-time guide was shown on this browser. Namespaced like the room's other keys. */
export const LOOK_GUIDE_STORAGE_KEY = 'blobbi:room:look-guide:v1';

/** The bubble by the dock's Blobbi button. */
export const LOOK_GUIDE_LINE = 'Want to try another look?';

/** How long the dock's bubble waits for a tap before it fades on its own. */
export const LOOK_GUIDE_DOCK_MS = 14_000;

/** How long the Appearance card stays lit once the sheet is open. */
export const LOOK_GUIDE_SHEET_MS = 3_200;

/** The two looks, as the player reads them everywhere: the introduction, the card, the chip. */
export const LOOK_OPTIONS: readonly { value: BlobbiAppearance; title: string; detail: string }[] = [
  { value: '2d', title: 'Classic', detail: 'The familiar drawing, here in the 3D room' },
  { value: '3d', title: '3D Model', detail: 'The whole Blobbi in 3D, experimental' },
];

export function lookTitle(appearance: BlobbiAppearance): string {
  return LOOK_OPTIONS.find((o) => o.value === appearance)?.title ?? 'Classic';
}

/** Which look the room draws: 3D only where this Blobbi has a model. */
export function shownLook(appearance: BlobbiAppearance, unavailable3d: string | null): BlobbiAppearance {
  return appearance === '3d' && !unavailable3d ? '3d' : '2d';
}

/** Why the introduction's 3D card shows a line instead of the model (an egg, V1/V2 art, no WebGL). */
export function previewNote3d(blobbi: { name: string; stage: string }, unavailable3d: string | null, webgl: boolean): string | null {
  if (blobbi.stage === 'egg') return `The 3D model is ready once ${blobbi.name} hatches.`;
  if (unavailable3d) return unavailable3d;
  if (!webgl) return 'This browser cannot draw 3D, so the room shows the drawing.';
  return null;
}

/** The guide's stages: the dock's bubble, then the card lit inside the sheet, then nothing. */
export type LookGuideStage = 'dock' | 'sheet';

/** Where the guide goes when the introduction closes: shown once, remembered at once. */
export function guideAfterIntro(alreadyShown: boolean): LookGuideStage | null {
  return alreadyShown ? null : 'dock';
}

/** Where the guide goes when the dock's Blobbi button is tapped. */
export function guideOnSheetOpen(stage: LookGuideStage | null): LookGuideStage | null {
  return stage === 'dock' ? 'sheet' : null;
}

export function readLookGuideShown(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(LOOK_GUIDE_STORAGE_KEY) === 'shown';
  } catch {
    return false;
  }
}

export function writeLookGuideShown(storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(LOOK_GUIDE_STORAGE_KEY, 'shown');
  } catch {
    /* the guide may show once more on this browser; nothing else is lost */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
