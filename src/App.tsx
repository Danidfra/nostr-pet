// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import React from 'react';
import NostrProvider from '@/components/NostrProvider'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import { ThemeProvider } from "@/components/theme-provider";
import { RelayProvider, useRelayContext } from '@/contexts/RelayContext';
import { BlobbiCompanionIntegration } from '@/components/blobbi/BlobbiCompanionIntegration';
import { AudioProvider } from '@/contexts/AudioContext';
import { BedProvider } from '@/contexts/BedContext';
import { BlobbiFakeInventoryProvider } from '@/contexts/BlobbiFakeInventoryContext';
import { BlobbiFakeStatusProvider } from '@/contexts/BlobbiFakeStatusContext';
import { BlobbiOnLoadDecayIntegration } from '@/components/BlobbiOnLoadDecayIntegration';
import AppRouter from './AppRouter';

// Component that connects relay context to NostrProvider
function NostrProviderWithRelays({ children, fallbackRelays }: { children: React.ReactNode; fallbackRelays: string[] }) {
  const { getEnabledRelayUrls } = useRelayContext();
  const enabledRelays = getEnabledRelayUrls();

  // Use enabled relays if available, otherwise fallback
  const relays = enabledRelays.length > 0 ? enabledRelays : fallbackRelays;

  React.useEffect(() => {
    console.log('🔗 Active relays updated:', relays);
  }, [relays]);

  return (
    <NostrProvider relays={relays}>
      {children}
    </NostrProvider>
  );
}

// DO NOT MODIFY THIS LIST UNLESS YOU ARE ABSOLUTELY CERTAIN EACH RELAY URL YOU ARE ADDING IS VALID AND THE RELAY IS CURRENTLY ONLINE AND CONFIRMED TO BE FULLY FUNCTIONAL AND WORKING.
const defaultRelays = [
  'wss://relay.chorus.community', // DO NOT MODIFY THIS UNLESS EXPLICITLY REQUESTED
];

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
  // Initialize interaction logging system
  React.useEffect(() => {
    console.group('🎮 BLOBBI INTERACTION SYSTEM INITIALIZED');
    console.log('⏰ Timestamp:', new Date().toLocaleString());
    console.log('🔧 Logging: All interactions will be logged to console');
    console.log('📊 Tracking: Action name, Blobbi ID, current stage, timestamp');
    console.log('⏱️ Cooldowns: System ready to track and verify cooldown functionality');
    console.log('🎯 Coverage: Triggered, blocked (cooldown), blocked (unavailable), and error interactions');
    console.groupEnd();
  }, []);

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
                        <Toaster />
                        <Sonner />
                        <BlobbiCompanionIntegration />
                        <BlobbiOnLoadDecayIntegration />
                        <AppRouter />
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
