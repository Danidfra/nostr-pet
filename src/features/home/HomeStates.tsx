import { Egg, RefreshCw } from 'lucide-react';
import { DITTO_BLOBBI_URL } from '@/config/ecosystem';
import { EnterIslandButton } from './EnterIslandButton';

export function HomeLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-16">
      <div className="h-40 w-40 animate-pulse rounded-full bg-muted" />
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      <p className="text-sm text-muted-foreground">Looking for your Blobbi…</p>
    </div>
  );
}

export function HomeEmpty() {
  return (
    <section className="mx-auto max-w-md space-y-5 rounded-2xl border border-border bg-card/80 p-8 text-center shadow-lg backdrop-blur">
      <Egg className="mx-auto h-12 w-12 text-purple-500" aria-hidden />
      <h2 className="text-xl font-semibold">No Blobbi lives here yet</h2>
      <p className="text-sm text-muted-foreground">
        Your home is ready. Adopt an egg and it will show up here, then step out to the Island whenever you like.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href={DITTO_BLOBBI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:from-purple-600 hover:to-pink-600"
        >
          Adopt a Blobbi
        </a>
        <EnterIslandButton variant="secondary" />
      </div>
    </section>
  );
}

interface HomeErrorProps {
  error: unknown;
  onRetry: () => void;
}

export function HomeError({ error, onRetry }: HomeErrorProps) {
  const message = error instanceof Error ? error.message : 'The relays did not answer.';
  return (
    <section role="alert" className="mx-auto max-w-md space-y-4 rounded-2xl border border-destructive/40 bg-card/80 p-8 text-center shadow-lg">
      <h2 className="text-xl font-semibold">Could not reach your Blobbi</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-accent"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </section>
  );
}
