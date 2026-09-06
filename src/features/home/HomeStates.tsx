import type { ReactNode } from 'react';
import { Egg, RefreshCw } from 'lucide-react';
import { DITTO_BLOBBI_URL } from '@/config/ecosystem';
import { EnterIslandButton } from './EnterIslandButton';

/** The environment frame every non-ready state shares, so the home is the home even when empty. */
export function SceneFrame({ children }: { children: ReactNode }) {
  return (
    <section className="home-scene -mx-6 flex min-h-[70svh] flex-col items-center justify-center gap-8 px-6 py-10 sm:mx-0 sm:min-h-[520px] sm:rounded-[2rem]">
      {children}
    </section>
  );
}

export function HomeLoading() {
  return (
    <SceneFrame>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
        <div className="relative h-44 w-44">
          <div className="home-ground absolute -bottom-4 left-1/2 h-16 w-[140%] -translate-x-1/2 rounded-[100%]" aria-hidden />
          <div className="relative h-full w-full animate-pulse rounded-[45%] bg-foreground/10" />
        </div>
        <div className="h-6 w-32 animate-pulse rounded bg-foreground/10" />
        <p className="scene-text text-sm text-foreground/80">Looking for your Blobbi…</p>
      </div>
    </SceneFrame>
  );
}

export function HomeEmpty() {
  return (
    <SceneFrame>
      <div className="home-glass mx-auto max-w-md space-y-5 rounded-3xl p-8 text-center">
        <Egg className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">No Blobbi lives here yet</h2>
        <p className="text-sm text-muted-foreground">
          Your home is ready. Adopt an egg and it will show up here, then step out to the Island whenever you like.
        </p>
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
    </SceneFrame>
  );
}

interface HomeErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function HomeError({ error, onRetry }: HomeErrorProps) {
  const message = error instanceof Error ? error.message : 'The relays did not answer.';
  return (
    <SceneFrame>
      <section role="alert" className="home-glass mx-auto max-w-md space-y-4 rounded-3xl border-destructive/40 p-8 text-center">
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
    </SceneFrame>
  );
}
