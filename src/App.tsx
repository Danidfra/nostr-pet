import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrLoginProvider } from '@nostrify/react/login';
import { BLOBBI_RENDERER_STYLESHEET } from '@blobbi-kit/renderer';

import { NostrProvider } from '@/components/NostrProvider';
import { EnvironmentProvider } from '@/environment';
import { SoundProvider } from '@/features/sound';
import AppRouter from './AppRouter';

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
export function App() {
  return (
    <EnvironmentProvider>
      <SoundProvider>
        <NostrLoginProvider storageKey="nostr:login">
          <NostrProvider>
            <QueryClientProvider client={queryClient}>
              <style>{BLOBBI_RENDERER_STYLESHEET}</style>
              <BrowserRouter>
                <AppRouter />
              </BrowserRouter>
            </QueryClientProvider>
          </NostrProvider>
        </NostrLoginProvider>
      </SoundProvider>
    </EnvironmentProvider>
  );
}

export default App;
