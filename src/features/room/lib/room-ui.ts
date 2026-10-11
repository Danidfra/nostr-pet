/**
 * Ditto's room UI classes (`ditto/src/blobbi/rooms/lib/room-layout.ts`),
 * verbatim, so the dock, its buttons and its carousel are drawn exactly as
 * Ditto draws them. Sizes are in `em` from the dock's container-scaled font
 * (`.room-dock`, Ditto's `ROOM_DOCK_SCALE`).
 */

/**
 * The bottom action bar in every room. Ditto's page hides the mobile bottom
 * nav, so below the `sidebar` breakpoint the bar only pads past the safe area.
 */
export const ROOM_BOTTOM_BAR_CLASS =
  'relative z-10 px-3 sm:px-6 pt-[1em] sidebar:pt-[1.4em] pb-[calc(var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+0.5rem)] sidebar:pb-5';

/** Fixed-width side slot in a bottom bar, so the center carousel stays centered. */
export const ROOM_ACTION_SLOT = 'w-[4.75em] shrink-0';

import { CONTROL_SURFACE, GUIDE_HIGHLIGHT } from '@/features/care-ui/ui';

/** Floating control surface: readable contrast over any room background, light or dark. */
export const ROOM_CONTROL_SURFACE = CONTROL_SURFACE;

/** Guide highlight: a ring that pulses gently (not on elements positioned by transform). */
export const ROOM_GUIDE_HIGHLIGHT = GUIDE_HIGHLIGHT;
