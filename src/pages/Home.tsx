import { useCallback, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { HomeError, HomeLoading } from '@/features/home/HomeStates';
import { WelcomeStage } from '@/features/onboarding/WelcomeStage';
import { GameShell, HudTop, MenuSheet } from '@/features/home/shell';
import { OnboardingFlow, useOnboardingSession } from '@/features/onboarding';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { ROOM_PATH, cameFromRoom, readExperience } from '@/lib/home-experience';

/**
 * The one screen. The ready state hands everything to `BlobbiOverview`;
 * every other state keeps the same frame (HUD, room, menu) so the home is
 * the home even when it is empty or waiting. Signed out and empty are the
 * onboarding's: welcome, account, the egg, in front of the room.
 *
 * The room is the home (M11): a player with a Blobbi is taken there, unless
 * they chose the classic home in its menu, or have just come back from the
 * room on purpose (its menu's Classic home): the legacy home stays reachable.
 * Signed out or with no Blobbi yet, this is the way in: the welcome stage,
 * the account, the egg; adopting lands the player in the room, where the
 * first egg hatches. The way in stays mounted through the read that follows
 * signing in, so the egg comes straight after the key.
 */
export default function Home({ classic = false }: { classic?: boolean } = {}) {
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
  const [opensOnRoom] = useState(() => !classic && readExperience() === 'room');
  // The way in keeps its door here, where it survives the read that follows signing in (see `OnboardingSession`)
  const session = useOnboardingSession(home.pubkey);
  // Signed out, or no Blobbi, or a door was just taken and the first read is out: the way in, in its world, never a
  // detour through the loading home (which would also drop the flow's own place)
  const inWayIn = home.status === 'signed-out' || home.status === 'empty' || (home.status === 'loading' && session.choice !== null);

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
      session={session}
      pubkey={home.pubkey}
      hasBlobbi={home.status === 'empty' ? false : home.status === 'ready' ? true : undefined}
      updateCompanionEvent={home.updateCompanionEvent}
      refresh={home.refresh}
      loading={<p className="scene-text text-center text-sm text-foreground/80">One moment…</p>}
    />
  );

  return (
    <GameShell
      top={inWayIn ? <WelcomeTop onOpenMenu={() => setMenuOpen(true)} /> : <HudTop onOpenMenu={() => setMenuOpen(true)} connection={connection} />}
      scene={
        <>
          {inWayIn && <WelcomeStage>{onboarding}</WelcomeStage>}
          {home.status === 'loading' && !inWayIn && <HomeLoading />}
          {home.status === 'error' && <HomeError error={home.error} onRetry={home.refresh} />}
        </>
      }
      overlays={<MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />}
    />
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
