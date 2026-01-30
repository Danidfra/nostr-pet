/**
 * NIP-65 Relay List Metadata utilities
 * https://github.com/nostr-protocol/nips/blob/master/65.md
 * 
 * NIP-65 defines relay list metadata as kind 10002 events with relay URLs in tags.
 * Tag format: ["r", "<relay-url>", "<read|write>"]
 * - ["r", "url"] = read and write
 * - ["r", "url", "read"] = read only
 * - ["r", "url", "write"] = write only
 */

import type { NostrEvent } from '@nostrify/nostrify';

export interface Nip65Relay {
  url: string;
  read: boolean;
  write: boolean;
}

export interface Nip65Cache {
  relays: Nip65Relay[];
  lastFetchedAt: number;
  eventCreatedAt: number;
  eventId?: string;
}

const NIP65_CACHE_PREFIX = 'nostr:nip65:';

/**
 * Normalize a relay URL by trimming whitespace and removing trailing slash
 */
export function normalizeRelayUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Parse a NIP-65 (kind 10002) event into relay list
 */
export function parseNip65Event(event: NostrEvent): Nip65Relay[] {
  if (event.kind !== 10002) {
    throw new Error(`Expected kind 10002, got ${event.kind}`);
  }

  const relayMap = new Map<string, Nip65Relay>();

  for (const tag of event.tags) {
    if (tag[0] !== 'r' || !tag[1]) continue;

    const url = normalizeRelayUrl(tag[1]);
    const marker = tag[2]; // "read", "write", or undefined

    const existing = relayMap.get(url);

    if (existing) {
      // Merge permissions for duplicate entries
      if (!marker) {
        // No marker means both read and write
        existing.read = true;
        existing.write = true;
      } else if (marker === 'read') {
        existing.read = true;
      } else if (marker === 'write') {
        existing.write = true;
      }
    } else {
      // New relay entry
      if (!marker) {
        // No marker means both read and write
        relayMap.set(url, { url, read: true, write: true });
      } else if (marker === 'read') {
        relayMap.set(url, { url, read: true, write: false });
      } else if (marker === 'write') {
        relayMap.set(url, { url, read: false, write: true });
      }
    }
  }

  return Array.from(relayMap.values());
}

/**
 * Build a NIP-65 event from relay list
 * Returns an unsigned event template ready for signing
 */
export function buildNip65Event(
  pubkey: string,
  relays: Nip65Relay[]
): Omit<NostrEvent, 'id' | 'sig'> {
  const tags: string[][] = [];

  for (const relay of relays) {
    const url = normalizeRelayUrl(relay.url);

    if (relay.read && relay.write) {
      // Both read and write - no marker
      tags.push(['r', url]);
    } else if (relay.read) {
      // Read only
      tags.push(['r', url, 'read']);
    } else if (relay.write) {
      // Write only
      tags.push(['r', url, 'write']);
    }
    // If neither read nor write, skip this relay
  }

  return {
    kind: 10002,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  };
}

/**
 * Merge remote relay list with local relay list
 * Strategy: remote relays are added/updated, but local enabled state is preserved
 * 
 * @param local - Current local relay list
 * @param remote - Remote NIP-65 relay list
 * @returns Merged relay list with counts of new/updated relays
 */
export function mergeRelayLists(
  local: Array<{ url: string; read?: boolean; write?: boolean; enabled: boolean }>,
  remote: Nip65Relay[]
): {
  merged: Array<{ url: string; read: boolean; write: boolean; enabled: boolean }>;
  newCount: number;
  updatedCount: number;
} {
  const localMap = new Map(
    local.map((r) => [normalizeRelayUrl(r.url), r])
  );

  let newCount = 0;
  let updatedCount = 0;

  const merged: Array<{ url: string; read: boolean; write: boolean; enabled: boolean }> = [];

  // First, add/update all remote relays
  for (const remoteRelay of remote) {
    const url = normalizeRelayUrl(remoteRelay.url);
    const existing = localMap.get(url);

    if (existing) {
      // Update permissions but preserve enabled state
      const hadDifferentPermissions =
        existing.read !== remoteRelay.read || existing.write !== remoteRelay.write;

      merged.push({
        url,
        read: remoteRelay.read,
        write: remoteRelay.write,
        enabled: existing.enabled, // Preserve local enabled state
      });

      if (hadDifferentPermissions) {
        updatedCount++;
      }

      localMap.delete(url); // Mark as processed
    } else {
      // New relay from remote - default to enabled on first import
      merged.push({
        url,
        read: remoteRelay.read,
        write: remoteRelay.write,
        enabled: true, // Default new relays to enabled
      });
      newCount++;
    }
  }

  // Then, preserve any local-only relays that weren't in remote
  for (const local of localMap.values()) {
    merged.push({
      url: normalizeRelayUrl(local.url),
      read: local.read ?? true,
      write: local.write ?? true,
      enabled: local.enabled,
    });
  }

  return { merged, newCount, updatedCount };
}

/**
 * Get NIP-65 cache for a pubkey
 */
export function getNip65Cache(pubkey: string): Nip65Cache | null {
  try {
    const key = `${NIP65_CACHE_PREFIX}${pubkey}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as Nip65Cache;
    return parsed;
  } catch (error) {
    console.error('[NIP-65] Failed to read cache:', error);
    return null;
  }
}

/**
 * Set NIP-65 cache for a pubkey
 */
export function setNip65Cache(pubkey: string, cache: Nip65Cache): void {
  try {
    const key = `${NIP65_CACHE_PREFIX}${pubkey}`;
    localStorage.setItem(key, JSON.stringify(cache));
    console.debug('[NIP-65] Cache updated for', pubkey);
  } catch (error) {
    console.error('[NIP-65] Failed to write cache:', error);
  }
}

/**
 * Clear NIP-65 cache for a pubkey
 */
export function clearNip65Cache(pubkey: string): void {
  try {
    const key = `${NIP65_CACHE_PREFIX}${pubkey}`;
    localStorage.removeItem(key);
    console.debug('[NIP-65] Cache cleared for', pubkey);
  } catch (error) {
    console.error('[NIP-65] Failed to clear cache:', error);
  }
}
