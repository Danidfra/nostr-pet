import { useState } from 'react';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { HomeEmpty, HomeError, HomeLoading, HomeSignedOut } from '@/features/home/HomeStates';
import { GameShell, HudTop, MenuSheet } from '@/features/home/shell';
import { OnboardingFlow } from '@/features/onboarding';

/**
 * The one screen. The ready state hands everything to `BlobbiOverview`;
 * every other state keeps the same frame (HUD, room, menu) so the home is
 * the home even when it is empty or waiting. Signed out and empty are the
 * onboarding's: welcome, account, profile, adoption, in front of the room.
 */
export default function Home() {
  const home = useHomeBlobbi();
  const [menuOpen, setMenuOpen] = useState(false);

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
      top={<HudTop onOpenMenu={() => setMenuOpen(true)} />}
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
