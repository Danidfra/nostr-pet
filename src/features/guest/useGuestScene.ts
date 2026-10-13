/**
 * What the guest's layers show right now, decided once from the record, the
 * login store and what a menu asked for (`GuestUi`). Shared by `GuestLayers`
 * (which renders them, above every page) and by the pages, which only need
 * to know whether the ceremony is on (the home must not send the player to
 * the room under it) or a save is under way with nothing published yet.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useGuest, useGuestUi } from './useGuest';

export function useGuestScene() {
  const guest = useGuest();
  const ui = useGuestUi();
  const guestActive = guest.mode === 'active';
  const saveStage = guest.doc?.migration?.stage ?? null;
  // Published (confirmed or not): the home is the account's; what remains is a read, or the celebration
  const saveLanded = saveStage === 'verifying' || saveStage === 'done';
  // Signed in with the guest's own key while the save is still under way: the home waits for the ceremony, never
  // offers an egg (the relays know nothing of this account yet; the Blobbi is about to be published)
  const promoting = guest.mode === 'promoting' && saveStage !== null && !saveLanded;
  // The ceremony: asked for from a menu or an invitation (its intro), under way (its stage is remembered, so a refresh
  // resumes it), or landed on this visit (its celebration; a refresh after that lands at home, `useFinishSave`)
  const sawSaveUnderWay = useRef(false);
  if (saveStage !== null && !saveLanded) sawSaveUnderWay.current = true;
  const saveOpen = !!guest.doc && (guestActive || guest.mode === 'promoting') && (ui.request === 'save' || (saveStage !== null && (!saveLanded || sawSaveUnderWay.current)));
  const saveDone = useCallback(() => {
    sawSaveUnderWay.current = false;
    ui.clearRequest();
  }, [ui]);
  const signInOpen = ui.request === 'sign-in' && guestActive;
  const clearRequest = ui.clearRequest;
  // A sign-in from the guest's menu landed: the sheet has done its work
  useEffect(() => {
    if (ui.request === 'sign-in' && guest.loginPubkey) clearRequest();
  }, [ui.request, guest.loginPubkey, clearRequest]);
  const conflict = guest.mode === 'dormant' && !!guest.doc && !!guest.loginPubkey && !guest.doc.conflicts.includes(guest.loginPubkey);

  return { guest, guestActive, promoting, saveOpen, saveDone, signInOpen, closeSignIn: clearRequest, conflict };
}
