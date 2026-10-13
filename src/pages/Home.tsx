import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { HomeError, HomeLoading } from '@/features/home/HomeStates';
import { WelcomeStage } from '@/features/onboarding/WelcomeStage';
import { GameOverlay, GameShell, HudTop, MenuSheet } from '@/features/home/shell';
import { ExistingAccountScreen } from '@/features/onboarding/screens';
import { OnboardingFlow, useOnboardingSession } from '@/features/onboarding';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { ROOM_PATH, cameFromRoom, readExperience } from '@/lib/home-experience';
import { useGuest, useGuestUi } from '@/features/guest';
import { SaveCeremony } from '@/features/guest/SaveCeremony';
import { GuestConflictSheet } from '@/features/guest/GuestConflictSheet';
import { useFinishSave } from '@/features/guest/useFinishSave';

/**
 * The one screen. The ready state hands everything to `BlobbiOverview`;
 * every other state keeps the same frame (HUD, room, menu) so the home is
 * the home even when it is empty or waiting. Signed out and empty are the
 * onboarding's: welcome, the egg, in front of the room.
 *
 * The 2D home is the home (M13): a first Blobbi is born here, and the 3D
 * room is the player's choice (the menu's Explore in 3D, or Open in 3D). A
 * player who chose the room is taken there, unless they have just come back
 * from it on purpose.
 *
 * Play first, save later (M14). A newcomer meets their Blobbi as a GUEST: the
 * welcome's door opens a guest record on this device, the egg comes at once
 * (for the key reserved with it), it hatches under the player's taps and is
 * cared for, all on this device, nothing published. Saving (`SaveCeremony`)
 * is the player's choice, offered after real care and always from the menu:
 * the key, a profile, then the Blobbi and the profile published under that
 * very key, the same address and the same look. Signing into an account one
 * already has stays what it was; a guest Blobbi on the device is then said
 * once and kept apart (`GuestConflictSheet`), never merged.
 */
export default function Home({ classic = false }: { classic?: boolean } = {}) {
  const home = useHomeBlobbi();
  const guest = useGuest();
  const ui = useGuestUi();
  // A save that landed but was not read back yet is confirmed from here, whenever the home mounts
  useFinishSave();
  const [menuOpen, setMenuOpen] = useState(false);
  // Connection health for the HUD: a retry forgets past failures and re-reads.
  const { health, reset } = useRelayHealth();
  const refresh = home.refresh;
  const retry = useCallback(() => {
    reset();
    refresh();
  }, [reset, refresh]);
  const connection = useMemo(() => ({ level: health.level, online: health.online, onRetry: retry }), [health.level, health.online, retry]);
  const location = useLocation();
  const [opensOnRoom] = useState(() => !classic && readExperience() === 'room');
  // The way in keeps its door here, where it survives the read that follows signing in (see `OnboardingSession`)
  const session = useOnboardingSession(home.pubkey);

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
  const playAsGuest = useCallback(() => guest.start() !== null, [guest]);

  // Signed out, or no Blobbi, or a door was just taken and the first read is out: the way in, in its world, never a
  // detour through the loading home (which would also drop the flow's own place)
  const inWayIn = home.status === 'signed-out' || home.status === 'empty' || (home.status === 'loading' && session.choice !== null);

  if (opensOnRoom && home.status === 'ready' && home.current && !cameFromRoom(location.state) && !saveOpen) {
    return <Navigate to={ROOM_PATH} replace />;
  }

  // The guest's layers stand beside the home, at one place in the tree whatever the home shows, so the ceremony is
  // not made again (and its save not run again) when the home changes from the way in to the Blobbi
  const guestLayers = (
    <>
      {saveOpen && guest.doc && <SaveCeremony doc={guest.doc} updateCompanionEvent={home.updateCompanionEvent} onDone={saveDone} />}
      {conflict && guest.doc && guest.loginPubkey && <GuestConflictSheet open doc={guest.doc} onKeep={() => guest.rememberConflict(guest.loginPubkey!)} onRemove={() => guest.clear()} />}
      {signInOpen && (
        <GameOverlay open onClose={clearRequest} title="Welcome back" testId="guest-sign-in" size="tall">
          <ExistingAccountScreen plain />
        </GameOverlay>
      )}
    </>
  );

  if (home.status === 'ready' && home.current && !promoting) {
    return (
      <>
        <BlobbiOverview
          blobbi={home.current}
          companions={home.companions}
          profile={home.profile}
          pubkey={home.pubkey}
          onSelect={home.select}
          updateCompanionEvent={home.updateCompanionEvent}
          refresh={home.refresh}
          connection={guestActive ? undefined : connection}
        />
        {guestLayers}
      </>
    );
  }

  const onboarding = (
    <OnboardingFlow
      session={session}
      pubkey={home.pubkey}
      hasBlobbi={home.status === 'empty' ? false : home.status === 'ready' ? true : undefined}
      updateCompanionEvent={home.updateCompanionEvent}
      refresh={home.refresh}
      loading={<p className="scene-text text-center text-sm text-foreground/80">One moment…</p>}
      onPlayAsGuest={playAsGuest}
      guest={guestActive}
    />
  );

  return (
    <>
      <GameShell
        top={inWayIn || promoting ? <WelcomeTop onOpenMenu={() => setMenuOpen(true)} /> : <HudTop onOpenMenu={() => setMenuOpen(true)} connection={connection} />}
        scene={
          <>
            {promoting && <WelcomeStage>{null}</WelcomeStage>}
            {!promoting && inWayIn && <WelcomeStage>{onboarding}</WelcomeStage>}
            {!promoting && home.status === 'loading' && !inWayIn && <HomeLoading />}
            {!promoting && home.status === 'error' && <HomeError error={home.error} onRetry={home.refresh} />}
          </>
        }
        overlays={<MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />}
      />
      {guestLayers}
    </>
  );
}

/** Over the welcome: only the menu (sound, lighting), out of the way; the logo is in the scene. */
function WelcomeTop({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="welcome-top" data-testid="hud-top">
      <button type="button" className="hud-icon-button" onClick={onOpenMenu} aria-label="Menu" data-testid="menu-button">
        <Menu className="h-5 w-5" aria-hidden />
      </button>
    </header>
  );
}
