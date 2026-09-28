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
 * Dev fixture mode (`?fixture=egg|baby|adult|adult-v2`, with `&state=sleeping`,
 * `&low=<stat>` and `&expression=<preset>`): the app over an in-memory world
 * with a panel that rewrites it live, for looking at every stage without an
 * account or a relay. Only a dev build with the dev-tools flag ever loads the
 * module; production has no code path to it. The request is parsed in
 * `src/dev`; here only whether there is one matters.
 */
const DEV_FIXTURES = import.meta.env.DEV && import.meta.env.VITE_BLOBBI_DEV_TOOLS === 'true';
const DevFixture = DEV_FIXTURES ? lazy(() => import('@/dev/DevFixture')) : null;
/** The Dev Lab page (`/dev`): the same fixture world with an engineering surface around it. Dev bundle only. */
const DevLab = DEV_FIXTURES ? lazy(() => import('@/dev/DevLab')) : null;
const DEV_LAB_PATH = '/dev';
const devLabRequested = DEV_FIXTURES && typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === DEV_LAB_PATH;
/** Fixture mode: the Dev Lab page, or a `?fixture=` link. The query string (possibly empty) is what the dev module parses. */
const fixtureMode = DEV_FIXTURES && typeof window !== 'undefined' && (devLabRequested || new URLSearchParams(window.location.search).has('fixture'));
const fixtureSearch = fixtureMode ? window.location.search : '';

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
 * (off by default, device-local), persisted logins, the query cache, the
 * relay pool (bunker logins need it; in dev fixture mode the fixture world
 * and its panel, which is why the cache sits above it), then the router. Domain state comes from
 * @blobbi-kit hooks per surface; no Blobbi provider lives here.
 */
/** The relays, or the dev fixture world when one is asked for. */
function Transport({ children }: { children: React.ReactNode }) {
  if (DevFixture && fixtureMode) {
    return (
      <Suspense fallback={null}>
        <DevFixture search={fixtureSearch} floatingPanel={!devLabRequested}>
          {children}
        </DevFixture>
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
          <QueryClientProvider client={queryClient}>
            <Transport>
              <style>{BLOBBI_RENDERER_STYLESHEET}</style>
              <BrowserRouter>
                <AppRouter
                  devLab={
                    DevLab && devLabRequested ? (
                      <Suspense fallback={null}>
                        <DevLab />
                      </Suspense>
                    ) : null
                  }
                />
              </BrowserRouter>
            </Transport>
          </QueryClientProvider>
        </NostrLoginProvider>
      </SoundProvider>
    </EnvironmentProvider>
  );
}

export default App;
