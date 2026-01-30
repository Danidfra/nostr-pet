import { useState, useCallback, useEffect } from 'react';
import {
  parseNip65Event,
  buildNip65Event,
  mergeRelayLists,
  getNip65Cache,
  setNip65Cache,
  normalizeRelayUrl,
  type Nip65Relay,
} from '@/nostr/nip65';

export interface RelayInfo {
  url: string;
  connected: boolean;
  enabled: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: number;
  messageCount?: number;
  read: boolean; // NIP-65: relay supports read operations
  write: boolean; // NIP-65: relay supports write operations
}

const STORAGE_KEY = 'nostr:relays';

// Base relays used for bootstrapping NIP-65 discovery
const BASE_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.nostr.band', // Widely-used relay with good uptime
];

// Test relay connection by attempting to open a WebSocket
async function testRelayConnection(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000); // 5 second timeout

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    } catch (error) {
      resolve(false);
    }
  });
}

export function useRelayManager() {
  const [relays, setRelays] = useState<RelayInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Connect to a specific relay
  const connectToRelay = useCallback(async (url: string): Promise<boolean> => {
    try {
      setRelays(prev => prev.map(relay =>
        relay.url === url
          ? { ...relay, status: 'connecting' as const }
          : relay
      ));

      // Test the relay connection by creating a WebSocket
      const success = await testRelayConnection(url);

      setRelays(prev => prev.map(relay =>
        relay.url === url
          ? {
              ...relay,
              connected: success,
              status: success ? 'connected' as const : 'error' as const,
              lastConnected: success ? Date.now() : relay.lastConnected
            }
          : relay
      ));

      return success;
    } catch (error) {
      console.error(`Failed to connect to relay ${url}:`, error);
      setRelays(prev => prev.map(relay =>
        relay.url === url
          ? { ...relay, connected: false, status: 'error' as const }
          : relay
      ));
      return false;
    }
  }, []);

  // Load relays from localStorage on mount
  useEffect(() => {
    const loadRelays = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedRelays = JSON.parse(stored) as RelayInfo[];
          setRelays(parsedRelays);
        } else {
          // Initialize with base relays
          const defaultRelayInfos: RelayInfo[] = BASE_RELAYS.map(url => ({
            url,
            connected: false,
            enabled: true,
            status: 'disconnected' as const,
            lastConnected: undefined,
            messageCount: 0,
            read: true,
            write: true,
          }));
          setRelays(defaultRelayInfos);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRelayInfos));
        }
      } catch (error) {
        console.error('Failed to load relays from storage:', error);
        // Fallback to base relays
        const defaultRelayInfos: RelayInfo[] = BASE_RELAYS.map(url => ({
          url,
          connected: false,
          enabled: true,
          status: 'disconnected' as const,
          lastConnected: undefined,
          messageCount: 0,
          read: true,
          write: true,
        }));
        setRelays(defaultRelayInfos);
      }
    };

    loadRelays();
  }, []);

  // Auto-connect to enabled relays on initial load
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (relays.length > 0 && !hasInitialized) {
      setHasInitialized(true);
      // Test connections for enabled relays on initial load
      relays.forEach(relay => {
        if (relay.enabled && relay.status === 'disconnected') {
          connectToRelay(relay.url);
        }
      });
    }
  }, [relays.length, hasInitialized, connectToRelay]);

  // Save relays to localStorage whenever they change
  useEffect(() => {
    if (relays.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(relays));
    }
  }, [relays]);

  // Get enabled relay URLs for the Nostr pool
  const getEnabledRelayUrls = useCallback(() => {
    return relays.filter(relay => relay.enabled).map(relay => relay.url);
  }, [relays]);

  // Disconnect from a specific relay
  const disconnectFromRelay = useCallback(async (url: string): Promise<void> => {
    try {
      // In a real implementation, you would disconnect from the relay here
      setRelays(prev => prev.map(relay =>
        relay.url === url
          ? {
              ...relay,
              connected: false,
              status: 'disconnected' as const
            }
          : relay
      ));
    } catch (error) {
      console.error(`Failed to disconnect from relay ${url}:`, error);
    }
  }, []);

  // Toggle relay enabled/disabled state
  const toggleRelay = useCallback(async (url: string, enabled: boolean) => {
    setRelays(prev => prev.map(relay =>
      relay.url === url
        ? { ...relay, enabled }
        : relay
    ));

    if (enabled) {
      await connectToRelay(url);
    } else {
      await disconnectFromRelay(url);
    }
  }, [connectToRelay, disconnectFromRelay]);

  // Add a new relay
  const addRelay = useCallback(async (url: string): Promise<boolean> => {
    // Validate URL format
    try {
      const urlObj = new URL(url);
      if (!urlObj.protocol.startsWith('ws')) {
        throw new Error('Relay URL must use ws:// or wss:// protocol');
      }
    } catch (error) {
      throw new Error('Please enter a valid WebSocket URL (ws:// or wss://)');
    }

    // Check if relay already exists
    if (relays.some(relay => relay.url === url)) {
      throw new Error('This relay is already in your list');
    }

    const newRelay: RelayInfo = {
      url,
      connected: false,
      enabled: true,
      status: 'disconnected',
      lastConnected: undefined,
      messageCount: 0,
      read: true,
      write: true,
    };

    setRelays(prev => [...prev, newRelay]);

    // Attempt to connect to the new relay
    return await connectToRelay(url);
  }, [relays, connectToRelay]);

  // Remove a relay
  const removeRelay = useCallback(async (url: string) => {
    // Disconnect first if connected
    await disconnectFromRelay(url);

    // Remove from list
    setRelays(prev => prev.filter(relay => relay.url !== url));
  }, [disconnectFromRelay]);

  // Connect to all enabled relays
  const connectToAllEnabled = useCallback(async () => {
    setIsLoading(true);
    try {
      const enabledRelays = relays.filter(relay => relay.enabled && !relay.connected);
      await Promise.all(enabledRelays.map(relay => connectToRelay(relay.url)));
    } finally {
      setIsLoading(false);
    }
  }, [relays, connectToRelay]);

  // Add base relays that aren't already present
  const addDefaultRelays = useCallback(async () => {
    const existingUrls = relays.map(r => r.url);
    const newRelays = BASE_RELAYS.filter(url => !existingUrls.includes(url));

    if (newRelays.length === 0) {
      throw new Error('All default relays are already added');
    }

    for (const url of newRelays) {
      await addRelay(url);
    }

    return newRelays.length;
  }, [relays, addRelay]);

  // Update relay read/write permissions
  const updateRelayPermissions = useCallback((url: string, read: boolean, write: boolean) => {
    setRelays(prev => prev.map(relay =>
      relay.url === url
        ? { ...relay, read, write }
        : relay
    ));
  }, []);

  // Import relays from NIP-65 cache (synchronous, for boot sequence)
  const importFromNip65Cache = useCallback((pubkey: string) => {
    const cache = getNip65Cache(pubkey);
    if (!cache) {
      console.debug('[NIP-65] Cache miss for', pubkey);
      return { imported: false, count: 0 };
    }

    console.debug('[NIP-65] Cache hit for', pubkey, 'with', cache.relays.length, 'relays');

    const { merged, newCount, updatedCount } = mergeRelayLists(
      relays.map(r => ({ url: r.url, read: r.read, write: r.write, enabled: r.enabled })),
      cache.relays
    );

    // Convert merged list to RelayInfo format
    const updatedRelays: RelayInfo[] = merged.map(r => {
      const existing = relays.find(relay => normalizeRelayUrl(relay.url) === r.url);
      return {
        url: r.url,
        connected: existing?.connected ?? false,
        enabled: r.enabled,
        status: existing?.status ?? ('disconnected' as const),
        lastConnected: existing?.lastConnected,
        messageCount: existing?.messageCount ?? 0,
        read: r.read,
        write: r.write,
      };
    });

    setRelays(updatedRelays);

    return { imported: true, count: newCount + updatedCount };
  }, [relays]);

  // Merge relays from a NIP-65 relay list
  const mergeNip65Relays = useCallback((nip65Relays: Nip65Relay[]) => {
    const { merged, newCount, updatedCount } = mergeRelayLists(
      relays.map(r => ({ url: r.url, read: r.read, write: r.write, enabled: r.enabled })),
      nip65Relays
    );

    // Convert merged list to RelayInfo format
    const updatedRelays: RelayInfo[] = merged.map(r => {
      const existing = relays.find(relay => normalizeRelayUrl(relay.url) === r.url);
      return {
        url: r.url,
        connected: existing?.connected ?? false,
        enabled: r.enabled,
        status: existing?.status ?? ('disconnected' as const),
        lastConnected: existing?.lastConnected,
        messageCount: existing?.messageCount ?? 0,
        read: r.read,
        write: r.write,
      };
    });

    setRelays(updatedRelays);

    return { newCount, updatedCount };
  }, [relays]);

  // Get relays in NIP-65 format for publishing
  const getRelaysForNip65 = useCallback((): Nip65Relay[] => {
    return relays
      .filter(r => r.enabled) // Only publish enabled relays
      .map(r => ({
        url: normalizeRelayUrl(r.url),
        read: r.read,
        write: r.write,
      }));
  }, [relays]);

  return {
    relays,
    isLoading,
    getEnabledRelayUrls,
    toggleRelay,
    addRelay,
    removeRelay,
    connectToAllEnabled,
    addDefaultRelays,
    updateRelayPermissions,
    importFromNip65Cache,
    mergeNip65Relays,
    getRelaysForNip65,
    parseNip65Event,
    buildNip65Event,
    getNip65Cache,
    setNip65Cache,
  };
}