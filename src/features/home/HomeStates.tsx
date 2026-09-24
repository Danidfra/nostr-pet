import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import type { NostrEvent } from '@blobbi-kit/core';
import { LoginPanel } from '@/components/auth/LoginPanel';
import { AdoptionFlow, WhatIsBlobbi } from '@/features/adoption';
import { EnterIslandButton } from './EnterIslandButton';
import { HomeScene, SceneBackdrop } from './scene';

/** The room, empty, with something held up in front of it. */
function EmptyRoom({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HomeScene
      label={label}
      floorLabel="Floor"
      actor={null}
      foreground={
        // Scrolls when the card is taller than a short phone; centred otherwise.
        <div className="flex h-full flex-col items-center overflow-y-auto px-4 pt-16 pb-8">
          <div className="my-auto w-full">{children}</div>
        </div>
      }
    >
      <SceneBackdrop />
    </HomeScene>
  );
}

export function HomeSignedOut() {
  return (
    <EmptyRoom label="An empty home">
      <div className="home-glass w-full max-w-md space-y-4 rounded-3xl p-6 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">The home of your Blobbi</h1>
        <WhatIsBlobbi />
        <p className="text-sm text-muted-foreground">Sign in and your Blobbi will be waiting here. No Blobbi yet? You adopt an egg right here.</p>
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

interface HomeEmptyProps {
  pubkey: string;
  suggestedName?: string;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
}

/** The empty home is where a first egg is adopted. */
export function HomeEmpty({ pubkey, suggestedName, updateCompanionEvent, refresh }: HomeEmptyProps) {
  return (
    <EmptyRoom label="No Blobbi lives here yet">
      <AdoptionFlow pubkey={pubkey} suggestedName={suggestedName} updateCompanionEvent={updateCompanionEvent} refresh={refresh} />
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
