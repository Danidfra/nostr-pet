/**
 * The player's kind 1124 care receipts, read once and shared: which kinds of
 * care were ever given, and on which local calendar days. The journey builds
 * its chapters from this; the home's care flame (M14.1) lights from it too,
 * so one read serves both and a guest's local world answers it like a relay.
 */
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NPool } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, parseInteractionEvent } from '@blobbi-kit/core';
import { timeoutSignal } from '@/lib/abort';
import type { CareAction } from './journey';

const READ_TIMEOUT_MS = 8_000;
export const CARE_ACTIONS: readonly CareAction[] = ['feed', 'play', 'clean', 'medicate', 'boost'];

export interface CareReceipts {
  actions: CareAction[];
  days: string[];
}

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const careReceiptsKey = (pubkey: string | undefined) => ['journey-care', pubkey] as const;

export async function readCareReceipts(nostr: Pick<NPool, 'query'>, pubkey: string): Promise<CareReceipts> {
  const events = await nostr.query([{ kinds: [KIND_BLOBBI_INTERACTION], authors: [pubkey], limit: 500 }], { signal: timeoutSignal(READ_TIMEOUT_MS) });
  const seen = new Set<CareAction>();
  const days = new Set<string>();
  for (const event of events) {
    const parsed = parseInteractionEvent(event);
    if (parsed && (CARE_ACTIONS as readonly string[]).includes(parsed.action)) {
      seen.add(parsed.action as CareAction);
      days.add(localDay(new Date(event.created_at * 1000)));
    }
  }
  return { actions: [...seen], days: [...days] };
}

export function useCareReceipts(pubkey: string | undefined) {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: careReceiptsKey(pubkey),
    enabled: !!pubkey,
    staleTime: 60_000,
    queryFn: () => readCareReceipts(nostr, pubkey!),
  });
}

/**
 * Whether this player has ever really cared for a Blobbi: a receipt on the
 * relays (or in the guest world), or care that landed on this visit before
 * the read caught up. False while unknown, so nothing lights early.
 */
export function useCareGiven(pubkey: string | undefined, caredThisVisit: boolean): boolean {
  const receipts = useCareReceipts(pubkey);
  return caredThisVisit || (receipts.data?.actions.length ?? 0) > 0;
}
