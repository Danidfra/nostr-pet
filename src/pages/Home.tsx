import { LoginPanel } from '@/components/auth/LoginPanel';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { BlobbiOverview } from '@/features/home/BlobbiOverview';
import { BlobbiSelector } from '@/features/home/BlobbiSelector';
import { HomeEmpty, HomeError, HomeLoading } from '@/features/home/HomeStates';
import { EnterIslandButton } from '@/features/home/EnterIslandButton';

function SignedOut() {
  return (
    <div className="flex flex-col items-center gap-10 py-6">
      <div className="max-w-xl space-y-3 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">The home of your Blobbi</h1>
        <p className="text-muted-foreground">
          Check on your companion, see how it is doing, and step out to Blobbi Island when you are ready.
        </p>
      </div>
      <LoginPanel />
      <EnterIslandButton variant="secondary" />
    </div>
  );
}

export default function Home() {
  const home = useHomeBlobbi();

  return (
    <main className="container py-8 sm:py-12">
      {home.status === 'signed-out' && <SignedOut />}
      {home.status === 'loading' && <HomeLoading />}
      {home.status === 'error' && <HomeError error={home.error} onRetry={home.refresh} />}
      {home.status === 'empty' && <HomeEmpty />}
      {home.status === 'ready' && home.current && (
        <div className="flex flex-col items-center gap-8">
          <BlobbiSelector companions={home.companions} currentD={home.current.d} onSelect={home.select} />
          <BlobbiOverview blobbi={home.current} profile={home.profile} />
        </div>
      )}
    </main>
  );
}
