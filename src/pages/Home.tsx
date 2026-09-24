import { useState } from 'react';
import { useAuthor } from '@/hooks/useAuthor';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { HomeEmpty, HomeError, HomeLoading, HomeSignedOut } from '@/features/home/HomeStates';
import { GameShell, HudTop, MenuSheet } from '@/features/home/shell';

/**
 * The one screen. The ready state hands everything to `BlobbiOverview`;
 * every other state keeps the same frame (HUD, room, menu) so the home is
 * the home even when it is empty or waiting.
 */
export default function Home() {
  const home = useHomeBlobbi();
  const [menuOpen, setMenuOpen] = useState(false);
  // Only a first-run profile needs a name; read the kind 0 lazily, never block on it.
  const author = useAuthor(home.status === 'empty' ? home.pubkey : undefined);

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

  return (
    <GameShell
      top={<HudTop onOpenMenu={() => setMenuOpen(true)} />}
      scene={
        <>
          {home.status === 'signed-out' && <HomeSignedOut />}
          {home.status === 'loading' && <HomeLoading />}
          {home.status === 'error' && <HomeError error={home.error} onRetry={home.refresh} />}
          {home.status === 'empty' && home.pubkey && (
            <HomeEmpty pubkey={home.pubkey} suggestedName={author.data?.metadata?.name || author.data?.metadata?.display_name || undefined} updateCompanionEvent={home.updateCompanionEvent} refresh={home.refresh} />
          )}
        </>
      }
      overlays={<MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />}
    />
  );
}
