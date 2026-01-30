/**
 * NIP-65 Relay List Sync Hook
 * Handles fetching and publishing NIP-65 relay lists
 */

import { useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useRelayContext } from '@/contexts/RelayContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';
import type { UnsignedEvent } from 'nostr-tools';

export interface FetchNip65Result {
  found: boolean;
  event?: NostrEvent;
  newCount: number;
  updatedCount: number;
}

export function useNip65Sync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const {
    parseNip65Event,
    buildNip65Event,
    mergeNip65Relays,
    getRelaysForNip65,
    setNip65Cache,
    relays,
  } = useRelayContext();

  /**
   * Fetch NIP-65 relay list for a pubkey
   * Uses provided relay URLs to query
   */
  const fetchNip65 = useCallback(async (
    pubkey: string,
    queryRelays?: string[]
  ): Promise<FetchNip65Result> => {
    try {
      const relayUrls = queryRelays || relays.filter(r => r.enabled).map(r => r.url);

      if (relayUrls.length === 0) {
        console.debug('[NIP-65] No relays available for query');
        return { found: false, newCount: 0, updatedCount: 0 };
      }

      console.debug('[NIP-65] Fetching kind:10002 for', pubkey, 'from', relayUrls.length, 'relays');

      const signal = AbortSignal.timeout(5000); // 5 second timeout

      const events = await nostr.query(
        [{ kinds: [10002], authors: [pubkey], limit: 1 }],
        { signal }
      );

      if (events.length === 0) {
        console.debug('[NIP-65] No kind:10002 event found for', pubkey);
        return { found: false, newCount: 0, updatedCount: 0 };
      }

      // Get the most recent event
      const event = events.sort((a, b) => b.created_at - a.created_at)[0];

      console.debug('[NIP-65] Found event', event.id, 'created at', new Date(event.created_at * 1000).toISOString());

      // Parse and merge relays
      const nip65Relays = parseNip65Event(event);
      const { newCount, updatedCount } = mergeNip65Relays(nip65Relays);

      // Update cache
      setNip65Cache(pubkey, {
        relays: nip65Relays,
        lastFetchedAt: Date.now(),
        eventCreatedAt: event.created_at,
        eventId: event.id,
      });

      console.debug('[NIP-65] Imported', newCount, 'new relays,', updatedCount, 'updated');

      return { found: true, event, newCount, updatedCount };
    } catch (error) {
      console.error('[NIP-65] Failed to fetch relay list:', error);
      return { found: false, newCount: 0, updatedCount: 0 };
    }
  }, [nostr, relays, parseNip65Event, mergeNip65Relays, setNip65Cache]);

  /**
   * Publish NIP-65 relay list
   * Requires user to be logged in with NIP-07 extension
   */
  const publishNip65 = useCallback(async (): Promise<{ success: boolean; eventId?: string }> => {
    if (!user) {
      throw new Error('User must be logged in to publish relay list');
    }

    try {
      // Get current relay list in NIP-65 format
      const nip65Relays = getRelaysForNip65();

      if (nip65Relays.length === 0) {
        throw new Error('No enabled relays to publish');
      }

      // Build unsigned event
      const unsignedEvent = buildNip65Event(user.pubkey, nip65Relays);

      console.debug('[NIP-65] Publishing relay list with', nip65Relays.length, 'relays');

      // Sign the event using the user's signer
      const signedEvent = await user.signer.signEvent(unsignedEvent as UnsignedEvent);

      // Publish to all enabled relays
      const publishRelays = relays.filter(r => r.enabled && r.write).map(r => r.url);

      if (publishRelays.length === 0) {
        throw new Error('No write-enabled relays to publish to');
      }

      console.debug('[NIP-65] Publishing to', publishRelays.length, 'relays');

      // Publish the event
      await nostr.event(signedEvent);

      // Update cache
      setNip65Cache(user.pubkey, {
        relays: nip65Relays,
        lastFetchedAt: Date.now(),
        eventCreatedAt: signedEvent.created_at,
        eventId: signedEvent.id,
      });

      console.debug('[NIP-65] Published successfully, event ID:', signedEvent.id);

      return { success: true, eventId: signedEvent.id };
    } catch (error) {
      console.error('[NIP-65] Failed to publish relay list:', error);
      throw error;
    }
  }, [user, nostr, relays, buildNip65Event, getRelaysForNip65, setNip65Cache]);

  return {
    fetchNip65,
    publishNip65,
  };
}
