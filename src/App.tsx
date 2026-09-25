import { lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrLoginProvider } from '@nostrify/react/login';
import { BLOBBI_RENDERER_STYLESHEET } from '@blobbi-kit/renderer';

import { NostrProvider } from '@/components/NostrProvider';
import { EnvironmentProvider } from '@/environment';
import { SoundProvider } from '@/features/sound';
import AppRouter from './AppRouter';

/**
 * Dev fixture mode (`?fixture=egg|baby|adult|adult-v2`, with `&state=sleeping`
 * and `&low=<stat>`): the app over an in-memory world, for looking at every
 * stage without an account or a relay. Only a dev build with the dev-tools
 * flag ever loads the module; production has no code path to it.
 */
const DEV_FIXTURES = import.meta.env.DEV && import.meta.env.VITE_BLOBBI_DEV_TOOLS === 'true';
const DevFixture = DEV_FIXTURES ? lazy(() => import('@/dev/DevFixture')) : null;
const fixtureRequest = DEV_FIXTURES && typeof window !== 'undefined' ? readFixtureRequestSafe(window.location.search) : null;
function readFixtureRequestSafe(search: string) {
  const params = new URLSearchParams(search);
  const name = params.get('fixture');
  if (!name) return null;
  const state = params.get('state') === 'sleeping' ? ('sleeping' as const) : ('active' as const);
  const lowRaw = params.get('low');
  const low = lowRaw && ['hunger', 'energy', 'health', 'happiness', 'hygiene'].includes(lowRaw) ? (lowRaw as 'hunger' | 'energy' | 'health' | 'happiness' | 'hygiene') : undefined;
  return ['egg', 'baby', 'adult', 'adult-v2'].includes(name) ? { name: name as 'egg' | 'baby' | 'adult' | 'adult-v2', state, low } : null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});

/**
 * Provider order, outermost first: the environment (paints the home's
 * lighting before any relay answers; device-local, never published), sound
 * (off by default, device-local), persisted logins, the relay pool (bunker
 * logins need it), the query cache, then the router. Domain state comes from
 * @blobbi-kit hooks per surface; no Blobbi provider lives here.
 */
/** The relays, or the dev fixture world when one is asked for. */
function Transport({ children }: { children: React.ReactNode }) {
  if (DevFixture && fixtureRequest) {
    return (
      <Suspense fallback={null}>
        <DevFixture options={fixtureRequest}>{children}</DevFixture>
      </Suspense>
    );
  }
  return <NostrProvider>{children}</NostrProvider>;
}

export function App() {
  return (
    <EnvironmentProvider>
      <SoundProvider>
        <NostrLoginProvider storageKey="nostr:login">
          <Transport>
            <QueryClientProvider client={queryClient}>
              <style>{BLOBBI_RENDERER_STYLESHEET}</style>
              <BrowserRouter>
                <AppRouter />
              </BrowserRouter>
            </QueryClientProvider>
          </Transport>
        </NostrLoginProvider>
      </SoundProvider>
    </EnvironmentProvider>
  );
}

export default App;
