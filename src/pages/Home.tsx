import { LoginPanel } from '@/components/auth/LoginPanel';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { HomeEmpty, HomeError, HomeLoading, SceneFrame } from '@/features/home/HomeStates';
import { EnterIslandButton } from '@/features/home/EnterIslandButton';

function SignedOut() {
  return (
    <SceneFrame>
      <div className="max-w-xl space-y-3 text-center">
        <h1 className="scene-text text-3xl font-bold sm:text-4xl">The home of your Blobbi</h1>
        <p className="scene-text text-foreground/80">Check on your companion, care for it, and step out to Blobbi Island when you are ready.</p>
      </div>
      <LoginPanel />
      <EnterIslandButton variant="secondary" />
    </SceneFrame>
  );
}

export default function Home() {
  const home = useHomeBlobbi();

  return (
    <main className="container py-4 sm:py-8">
      {home.status === 'signed-out' && <SignedOut />}
      {home.status === 'loading' && <HomeLoading />}
      {home.status === 'error' && <HomeError error={home.error} onRetry={home.refresh} />}
      {home.status === 'empty' && <HomeEmpty />}
      {home.status === 'ready' && home.current && (
        <BlobbiOverview
          blobbi={home.current}
          companions={home.companions}
          profile={home.profile}
          pubkey={home.pubkey}
          onSelect={home.select}
          updateCompanionEvent={home.updateCompanionEvent}
          refresh={home.refresh}
        />
      )}
    </main>
  );
}
