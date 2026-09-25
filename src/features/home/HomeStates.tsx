import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { HomeScene } from './scene';
import { RoomBackdrop } from './rooms';
import { HOME_SPACE } from './space/home-space';

/** The room, empty, with something held up in front of it. */
function EmptyRoom({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HomeScene
      label={label}
      room="home"
      floorLabel="Floor"
      actor={null}
      foreground={
        // Scrolls when the card is taller than a short phone; centred otherwise.
        <div className="flex h-full flex-col items-center overflow-y-auto px-4 pt-16 pb-8">
          <div className="my-auto w-full">{children}</div>
        </div>
      }
    >
      <RoomBackdrop room={HOME_SPACE.room} />
    </HomeScene>
  );
}

/** The signed-out home: the way in, held up in front of the empty room. */
export function HomeSignedOut({ children }: { children: ReactNode }) {
  return <EmptyRoom label="An empty home">{children}</EmptyRoom>;
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

/** The empty home: profile and adoption steps, in front of the room a first egg will live in. */
export function HomeEmpty({ children }: { children: ReactNode }) {
  return <EmptyRoom label="No Blobbi lives here yet">{children}</EmptyRoom>;
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
