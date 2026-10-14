/**
 * When to invite a guest to save their Blobbi (M15), in one place for both
 * homes.
 *
 * M14 asked as soon as one care action had landed and the home was quiet
 * for a few seconds: too early, before the player had any reason to care
 * about keeping the Blobbi. The invitation now waits for
 *
 *   - a hatched Blobbi,
 *   - one landed care action,
 *   - about five minutes of ACTIVE play: time with the tab visible and the
 *     window focused, counted here and kept in the record
 *     (`invite.activeMs`), so it adds up across visits and never counts a
 *     tab left open in the background,
 *   - a quiet moment: nothing walking or being used, no ceremony, no sheet
 *     or other blocking layer, the Blobbi awake (the page says what quiet
 *     means for it; the blocking-layer queue is read here),
 *
 * and asks once per visit. "Maybe later" rests it for about a day
 * (`INVITE_REST_MS`); "Don't ask again" turns the automatic invitation off
 * in this browser for good (`invite.optOut`). The menu and the status pill
 * keep the way to save whenever the player wants it.
 *
 * Active time is accumulated in memory and written to the record every
 * `INVITE_FLUSH_MS`, when the tab hides or loses focus, and when the hook
 * unmounts, so a refresh loses at most one stretch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlockingLayerOpen } from '@/lib/blocking-layer';
import { INVITE_DELAY_MS, inviteDue } from './guest-session';
import { useGuest, useGuestUi } from './useGuest';

/** How often a running stretch of active play is written to the record. */
export const INVITE_FLUSH_MS = 15_000;

export interface SaveInviteInput {
  /** The Blobbi has hatched (an egg is never asked for). */
  hatched: boolean;
  /** The home is quiet by the page's own account: nothing busy, no ceremony, nothing of its own open, the Blobbi awake. */
  quiet: boolean;
}

export interface SaveInvite {
  /** Show the invitation now. */
  open: boolean;
  save: () => void;
  later: () => void;
  never: () => void;
}

/** Active play: the document visible and its window focused. */
export function isActivePlay(doc: Document = document): boolean {
  if (doc.visibilityState !== 'visible') return false;
  return typeof doc.hasFocus === 'function' ? doc.hasFocus() : true;
}

export function useSaveInvite({ hatched, quiet }: SaveInviteInput): SaveInvite {
  const guest = useGuest();
  const ui = useGuestUi();
  const guestActive = guest.mode === 'active';
  const blocking = useBlockingLayerOpen();
  const [shown, setShown] = useState(false);
  const askedThisVisit = useRef(false);

  // ── active time ───────────────────────────────────────────────────────
  const { addActiveTime } = guest;
  useEffect(() => {
    if (!guestActive || typeof document === 'undefined') return;
    let since: number | null = isActivePlay() ? Date.now() : null;
    const flush = () => {
      if (since === null) return;
      const now = Date.now();
      const stretch = now - since;
      since = now;
      if (stretch > 0) addActiveTime(stretch);
    };
    const check = () => {
      if (isActivePlay()) {
        if (since === null) since = Date.now();
      } else if (since !== null) {
        flush();
        since = null;
      }
    };
    const interval = setInterval(() => {
      check();
      flush();
    }, INVITE_FLUSH_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('blur', check);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('blur', check);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [guestActive, addActiveTime]);

  // ── the ask ───────────────────────────────────────────────────────────
  const invite = guest.doc?.invite;
  const careCount = guest.doc?.care.count ?? 0;
  const activeMs = invite?.activeMs ?? 0;
  const dismissedAt = invite?.dismissedAt ?? null;
  const optOut = invite?.optOut ?? false;
  const migrationBegun = !!guest.doc?.migration;
  const stillQuiet = quiet && !blocking;
  useEffect(() => {
    if (!guestActive || shown || askedThisVisit.current || !stillQuiet) return;
    if (!inviteDue({ hatched, careCount, activeMs, dismissedAt, optOut, migrationBegun, now: Date.now() })) return;
    const timer = setTimeout(() => {
      askedThisVisit.current = true;
      setShown(true);
    }, INVITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [guestActive, shown, stillQuiet, hatched, careCount, activeMs, dismissedAt, optOut, migrationBegun]);

  const { requestSave } = ui;
  const { dismissInvite, optOutInvite } = guest;
  const save = useCallback(() => {
    setShown(false);
    requestSave();
  }, [requestSave]);
  const later = useCallback(() => {
    setShown(false);
    dismissInvite();
  }, [dismissInvite]);
  const never = useCallback(() => {
    setShown(false);
    optOutInvite();
  }, [optOutInvite]);

  // Shown, but never over a sheet or another blocking layer: it steps aside and is back when the layer closes
  return { open: shown && guestActive && !blocking, save, later, never };
}
