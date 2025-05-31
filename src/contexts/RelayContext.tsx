import React, { createContext, useContext, ReactNode } from 'react';
import { useRelayManager, RelayInfo } from '@/hooks/useRelayManager';

interface RelayContextType {
  relays: RelayInfo[];
  isLoading: boolean;
  getEnabledRelayUrls: () => string[];
  toggleRelay: (url: string, enabled: boolean) => Promise<void>;
  addRelay: (url: string) => Promise<boolean>;
  removeRelay: (url: string) => Promise<void>;
  connectToAllEnabled: () => Promise<void>;
  addDefaultRelays: () => Promise<number>;
}

const RelayContext = createContext<RelayContextType | undefined>(undefined);

interface RelayProviderProps {
  children: ReactNode;
}

export function RelayProvider({ children }: RelayProviderProps) {
  const relayManager = useRelayManager();

  return (
    <RelayContext.Provider value={relayManager}>
      {children}
    </RelayContext.Provider>
  );
}

export function useRelayContext() {
  const context = useContext(RelayContext);
  if (context === undefined) {
    throw new Error('useRelayContext must be used within a RelayProvider');
  }
  return context;
}