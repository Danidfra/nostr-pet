import React, { createContext, useContext, ReactNode } from 'react';
import { useRelayManager, RelayInfo } from '@/hooks/useRelayManager';
import type { Nip65Relay } from '@/nostr/nip65';
import type { NostrEvent } from '@nostrify/nostrify';

interface RelayContextType {
  relays: RelayInfo[];
  isLoading: boolean;
  getEnabledRelayUrls: () => string[];
  toggleRelay: (url: string, enabled: boolean) => Promise<void>;
  addRelay: (url: string) => Promise<boolean>;
  removeRelay: (url: string) => Promise<void>;
  connectToAllEnabled: () => Promise<void>;
  addDefaultRelays: () => Promise<number>;
  updateRelayPermissions: (url: string, read: boolean, write: boolean) => void;
  importFromNip65Cache: (pubkey: string) => { imported: boolean; count: number };
  mergeNip65Relays: (nip65Relays: Nip65Relay[]) => { newCount: number; updatedCount: number };
  getRelaysForNip65: () => Nip65Relay[];
  parseNip65Event: (event: NostrEvent) => Nip65Relay[];
  buildNip65Event: (pubkey: string, relays: Nip65Relay[]) => Omit<NostrEvent, 'id' | 'sig'>;
  getNip65Cache: (pubkey: string) => { relays: Nip65Relay[]; lastFetchedAt: number; eventCreatedAt: number; eventId?: string } | null;
  setNip65Cache: (pubkey: string, cache: { relays: Nip65Relay[]; lastFetchedAt: number; eventCreatedAt: number; eventId?: string }) => void;
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