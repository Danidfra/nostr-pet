import { useState, useCallback, useEffect } from 'react';

export interface RelayInfo {
  url: string;
  connected: boolean;
  enabled: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: number;
  messageCount?: number;
}

const STORAGE_KEY = 'nostr:relays';

// Default relays that are commonly used in the Nostr ecosystem
const DEFAULT_RELAYS = [
'wss://relay.chorus.community'
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
          // Initialize with default relays
          const defaultRelayInfos: RelayInfo[] = DEFAULT_RELAYS.map(url => ({
            url,
            connected: false,
            enabled: true,
            status: 'disconnected' as const,
            lastConnected: undefined,
            messageCount: 0,
          }));
          setRelays(defaultRelayInfos);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRelayInfos));
        }
      } catch (error) {
        console.error('Failed to load relays from storage:', error);
        // Fallback to default relays
        const defaultRelayInfos: RelayInfo[] = DEFAULT_RELAYS.map(url => ({
          url,
          connected: false,
          enabled: true,
          status: 'disconnected' as const,
          lastConnected: undefined,
          messageCount: 0,
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

  // Add default relays that aren't already present
  const addDefaultRelays = useCallback(async () => {
    const existingUrls = relays.map(r => r.url);
    const newRelays = DEFAULT_RELAYS.filter(url => !existingUrls.includes(url));

    if (newRelays.length === 0) {
      throw new Error('All default relays are already added');
    }

    for (const url of newRelays) {
      await addRelay(url);
    }

    return newRelays.length;
  }, [relays, addRelay]);

  return {
    relays,
    isLoading,
    getEnabledRelayUrls,
    toggleRelay,
    addRelay,
    removeRelay,
    connectToAllEnabled,
    addDefaultRelays,
  };
}