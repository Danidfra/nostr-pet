/**
 * The World Travel hand-off in this page's address, taken out of it as early
 * as the app runs (`src/main.tsx` imports this module before the app), so
 * nothing else sees the fragment and a reload, Back or a copied address never
 * carries it again. Kept in memory only, for the travel session to honour
 * once it has confirmed the Blobbi's place (`useHomeTravel`), or to drop. No
 * imports beyond the hand-off module: this must run before React.
 */
import { readHandoff } from './world-travel-handoff';
import type { NostrEvent } from '@blobbi-kit/core';

let captured: NostrEvent | null = typeof location !== 'undefined' && typeof history !== 'undefined' ? readHandoff(location, history) : null;

/** The hand-off this page opened with, until it is dropped (honoured, rejected or expired). */
export function peekHandoff(): NostrEvent | null {
  return captured;
}

export function dropHandoff(): void {
  captured = null;
}

/** Tests: as if the page had opened with this hand-off (null: none). */
export function setCapturedHandoff(event: NostrEvent | null): void {
  captured = event;
}
