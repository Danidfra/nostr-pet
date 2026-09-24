import type { ReactNode } from 'react';
import { Egg, RefreshCw } from 'lucide-react';
import { DITTO_BLOBBI_URL } from '@/config/ecosystem';
import { LoginPanel } from '@/components/auth/LoginPanel';
import { EnterIslandButton } from './EnterIslandButton';
import { HomeScene, SceneBackdrop } from './scene';

/** The room, empty, with something held up in front of it. */
function EmptyRoom({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HomeScene label={label} floorLabel="Floor" actor={null} foreground={<div className="flex h-full items-center justify-center px-4 pt-16 pb-8">{children}</div>}>
      <SceneBackdrop />
    </HomeScene>
  );
}

export function HomeSignedOut() {
  return (
    <EmptyRoom label="An empty home">
      <div className="home-glass w-full max-w-md space-y-4 rounded-3xl p-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">The home of your Blobbi</h1>
        <p className="text-sm text-muted-foreground">Sign in and your Blobbi will be waiting here.</p>
        <LoginPanel />
        <EnterIslandButton variant="secondary" />
      </div>
    </EmptyRoom>
  );
}

export function HomeLoading() {
  return (
    <EmptyRoom label="Looking for your Blobbi">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
        <div className="relative h-36 w-36">
          <div className="relative h-full w-full animate-pulse rounded-[45%] bg-foreground/10" />
        </div>
        <p className="scene-text text-sm text-foreground/80">Looking for your Blobbi…</p>
      </div>
    </EmptyRoom>
  );
}

export function HomeEmpty() {
  return (
    <EmptyRoom label="No Blobbi lives here yet">
      <div className="home-glass mx-auto w-full max-w-md space-y-4 rounded-3xl p-6 text-center">
        <Egg className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">No Blobbi lives here yet</h2>
        <p className="text-sm text-muted-foreground">Your home is ready. Adopt an egg and it will show up here.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={DITTO_BLOBBI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Adopt a Blobbi
          </a>
          <EnterIslandButton variant="secondary" />
        </div>
      </div>
    </EmptyRoom>
  );
}

interface HomeErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function HomeError({ error, onRetry }: HomeErrorProps) {
  const message = error instanceof Error ? error.message : 'The relays did not answer.';
  return (
    <EmptyRoom label="Could not reach your Blobbi">
      <section role="alert" className="home-glass mx-auto w-full max-w-md space-y-4 rounded-3xl border-destructive/40 p-6 text-center">
        <h2 className="text-xl font-semibold">Could not reach your Blobbi</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </section>
    </EmptyRoom>
  );
}
