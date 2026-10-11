import { useCallback, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { HomeEmpty, HomeError, HomeLoading, HomeSignedOut } from '@/features/home/HomeStates';
import { GameShell, HudTop, MenuSheet } from '@/features/home/shell';
import { OnboardingFlow } from '@/features/onboarding';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { ROOM_PATH, cameFromRoom, readExperience } from '@/lib/home-experience';

/**
 * The one screen. The ready state hands everything to `BlobbiOverview`;
 * every other state keeps the same frame (HUD, room, menu) so the home is
 * the home even when it is empty or waiting. Signed out and empty are the
 * onboarding's: welcome, account, profile, adoption, in front of the room.
 *
 * A player who chose to open on the 3D room (the menu; never chosen for
 * them) is taken there once they have a Blobbi, except when they have just
 * come back from it: the classic home is always one tap away.
 */
export default function Home() {
  const home = useHomeBlobbi();
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
  const [opensOnRoom] = useState(() => readExperience() === 'room');

  if (opensOnRoom && home.status === 'ready' && home.current && !cameFromRoom(location.state)) {
    return <Navigate to={ROOM_PATH} replace />;
  }

  if (home.status === 'ready' && home.current) {
    return (
      <BlobbiOverview
        blobbi={home.current}
        companions={home.companions}
        profile={home.profile}
        pubkey={home.pubkey}
        onSelect={home.select}
        updateCompanionEvent={home.updateCompanionEvent}
        refresh={home.refresh}
        connection={connection}
      />
    );
  }

  const onboarding = (
    <OnboardingFlow
      pubkey={home.pubkey}
      hasBlobbi={home.status === 'empty' ? false : home.status === 'ready' ? true : undefined}
      updateCompanionEvent={home.updateCompanionEvent}
      refresh={home.refresh}
      loading={<p className="scene-text text-center text-sm text-foreground/80">One moment…</p>}
    />
  );

  return (
    <GameShell
      top={<HudTop onOpenMenu={() => setMenuOpen(true)} connection={connection} />}
      scene={
        <>
          {home.status === 'signed-out' && <HomeSignedOut>{onboarding}</HomeSignedOut>}
          {home.status === 'loading' && <HomeLoading />}
          {home.status === 'error' && <HomeError error={home.error} onRetry={home.refresh} />}
          {home.status === 'empty' && <HomeEmpty>{onboarding}</HomeEmpty>}
        </>
      }
      overlays={<MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />}
    />
  );
}
