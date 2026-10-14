/**
 * The guest's layers, above every page (M14.1).
 *
 * The save ceremony, the sign-in sheet a guest asked for, and the word about
 * a guest Blobbi kept apart from a signed-in account are asked for from
 * menus in BOTH homes (the 2D home and the 3D room) and from the worlds. They
 * are rendered here, once, beside the router's pages, so a request made in
 * either home is answered wherever the player is, and the ceremony is not
 * unmounted (and its save not run again) when the page under it changes:
 * signing in with the reserved key moves the room to the home, and a saved
 * Blobbi may move the home to the room.
 *
 * M14 rendered these inside the 2D home only, so the room's Save my Blobbi
 * and I already have an account set a request nobody showed.
 */
import { useContext, useEffect, useState } from 'react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { ExistingAccountScreen } from '@/features/onboarding/screens';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { SaveCeremony } from './SaveCeremony';
import { GuestConflictSheet, GuestRemoveSheet } from './GuestConflictSheet';
import { useFinishSave } from './useFinishSave';
import { useGuestScene } from './useGuestScene';
import { GuestStoreContext } from './guest-context';

/** Nothing without a guest store (a router rendered on its own, a test): the layers are the guest feature's. */
export function GuestLayers() {
  const store = useContext(GuestStoreContext);
  return store ? <GuestLayersInner /> : null;
}

function GuestLayersInner() {
  const { guest, saveOpen, saveDone, signInOpen, closeSignIn, conflict, deferConflict } = useGuestScene();
  // The conflict's destructive branch (M15): a separate sheet, back to the word on cancel, forgotten when the conflict ends
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    if (!conflict) setRemoving(false);
  }, [conflict]);
  // The signed-in account's collection cache, so the published Blobbi is home at once (the same query the pages read)
  const { updateCompanionEvent } = useHomeBlobbi();
  // A save that landed but was not read back yet is confirmed from here, whenever the app mounts
  useFinishSave();
  const sheet = conflict || signInOpen;
  return (
    <>
      {saveOpen && guest.doc && <SaveCeremony doc={guest.doc} updateCompanionEvent={updateCompanionEvent} onDone={saveDone} />}
      {sheet && (
        // The same frame as the pages' (`GameShell`), so a sheet rises over the game column on a desktop, the viewport on a phone
        <div className="game-shell guest-layers" data-testid="guest-layers">
          <div className="game-frame">
            <div className="game-column">
              {conflict && guest.doc && guest.loginPubkey && !removing && (
                <GuestConflictSheet open doc={guest.doc} onKeep={() => guest.rememberConflict(guest.loginPubkey!)} onLater={() => deferConflict(guest.loginPubkey!)} onRemove={() => setRemoving(true)} />
              )}
              {conflict && guest.doc && guest.loginPubkey && removing && <GuestRemoveSheet open doc={guest.doc} onCancel={() => setRemoving(false)} onRemove={() => guest.removeFromDevice()} />}
              {signInOpen && (
                <GameOverlay open onClose={closeSignIn} title="Welcome back" testId="guest-sign-in" size="tall">
                  <ExistingAccountScreen plain />
                </GameOverlay>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
