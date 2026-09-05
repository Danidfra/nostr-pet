import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrLoginProvider } from '@nostrify/react/login';
import { BLOBBI_RENDERER_STYLESHEET } from '@blobbi-kit/renderer';

import { NostrProvider } from '@/components/NostrProvider';
import { ThemeProvider } from '@/components/theme-provider';
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
 * Provider order, outermost first: theme (paints before any relay answers),
 * persisted logins, the relay pool (bunker logins need it), the query cache,
 * then the router. Recovered from the pre-nuke App with every Blobbi-specific
 * provider removed: domain state now comes from @blobbi-kit hooks per surface.
 */
export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="blobbi-theme">
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
    </ThemeProvider>
  );
}

export default App;
