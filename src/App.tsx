// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import NostrProvider from '@/components/NostrProvider'
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import { ThemeProvider } from "@/components/theme-provider";
import { RelayProvider, useRelayContext } from '@/contexts/RelayContext';
import { BASE_RELAYS } from '@/hooks/useRelayManager';
import { BlobbiCompanionIntegration } from '@/components/blobbi/BlobbiCompanionIntegration';
import { AudioProvider } from '@/contexts/AudioContext';
import { BedProvider } from '@/contexts/BedContext';
import { BlobbiFakeInventoryProvider } from '@/contexts/BlobbiFakeInventoryContext';
import { BlobbiFakeStatusProvider } from '@/contexts/BlobbiFakeStatusContext';
import { BlobbiOnLoadDecayIntegration } from '@/components/BlobbiOnLoadDecayIntegration';
import { BlobbiAutoRepairIntegration } from '@/components/BlobbiAutoRepairIntegration';
import { BlobbiPiPWrapper } from '@/components/blobbi/BlobbiPiPWrapper';
import { Nip65Bootstrap } from '@/components/Nip65Bootstrap';
import AppRouter from './AppRouter';

// Component that connects relay context to NostrProvider
function NostrProviderWithRelays({ children, fallbackRelays }: { children: React.ReactNode; fallbackRelays: string[] }) {
  const { getEnabledRelayUrls } = useRelayContext();
  const enabledRelays = getEnabledRelayUrls();

  // Use enabled relays if available, otherwise fallback
  const relays = enabledRelays.length > 0 ? enabledRelays : fallbackRelays;

  return (
    <NostrProvider relays={relays}>
      {children}
    </NostrProvider>
  );
}

// Using BASE_RELAYS as the single source of truth for default/fallback relays
// BASE_RELAYS is imported from useRelayManager
const defaultRelays = BASE_RELAYS;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute - data stays fresh
      gcTime: 5 * 60 * 1000, // 5 minutes - how long to keep in cache when unused
      retry: 2, // Retry failed requests 2 times
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
  },
});

export function App() {

  return (
    <ThemeProvider defaultTheme="system" storageKey="blobbi-theme">
      <NostrLoginProvider storageKey='nostr:login'>
        <RelayProvider>
          <NostrProviderWithRelays fallbackRelays={defaultRelays}>
            <QueryClientProvider client={queryClient}>
              <BlobbiFakeStatusProvider>
                <BlobbiFakeInventoryProvider>
                  <TooltipProvider>
                    <AudioProvider>
                      <BedProvider>
                        <BrowserRouter>
                          <Toaster />
                          <Nip65Bootstrap />
                          <BlobbiCompanionIntegration />
                          <BlobbiOnLoadDecayIntegration />
                          <BlobbiAutoRepairIntegration />
                          <BlobbiPiPWrapper />
                          <AppRouter />
                        </BrowserRouter>
                      </BedProvider>
                    </AudioProvider>
                  </TooltipProvider>
                </BlobbiFakeInventoryProvider>
              </BlobbiFakeStatusProvider>
            </QueryClientProvider>
          </NostrProviderWithRelays>
        </RelayProvider>
      </NostrLoginProvider>
    </ThemeProvider>
  );
}
export default App;
