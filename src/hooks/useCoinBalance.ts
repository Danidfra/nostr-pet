import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useNostrPublish } from '@/hooks/useNostrPublish';

interface CoinTransaction {
  coins: number;
  sats?: number;
  timestamp: number;
  type: 'credit' | 'debit';
  phase: string;
  bolt11_hash?: string;
  purchaseId: string;
}

export function useCoinBalance() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: profile } = useBlobbonautProfile();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['coin-balance', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) {
        return { balance: 0, transactions: [] };
      }

      // Query for credit events (kind 40100) from Treasury
      const creditEvents = await nostr.query(
        [{
          kinds: [40100],
          '#p': [user.pubkey],
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      // Query for debit events (kind 40101) - purchases
      const debitEvents = await nostr.query(
        [{
          kinds: [40101],
          authors: [user.pubkey],
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      // Process transactions
      const transactions: CoinTransaction[] = [];
      const processedPurchaseIds = new Set<string>();

      // Process credit events
      creditEvents.forEach(event => {
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        const coinsTag = event.tags.find(([name]) => name === 'coins')?.[1];
        const satsTag = event.tags.find(([name]) => name === 'sats')?.[1];
        const phaseTag = event.tags.find(([name]) => name === 'phase')?.[1];
        const bolt11HashTag = event.tags.find(([name]) => name === 'bolt11_hash')?.[1];

        if (dTag && coinsTag) {
          const coins = parseInt(coinsTag.replace('+', ''));
          const sats = satsTag ? parseInt(satsTag) : undefined;
          const phase = phaseTag || 'unknown';
          const bolt11_hash = bolt11HashTag;

          // Check for idempotency - only process each purchase ID once
          if (!processedPurchaseIds.has(dTag)) {
            transactions.push({
              coins,
              sats,
              timestamp: event.created_at,
              type: 'credit',
              phase,
              bolt11_hash,
              purchaseId: dTag,
            });
            processedPurchaseIds.add(dTag);
          }
        }
      });

      // Process debit events
      debitEvents.forEach(event => {
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        const coinsTag = event.tags.find(([name]) => name === 'coins')?.[1];
        const phaseTag = event.tags.find(([name]) => name === 'phase')?.[1];

        if (dTag && coinsTag) {
          const coins = parseInt(coinsTag.replace('-', ''));
          const phase = phaseTag || 'unknown';

          // Check for idempotency
          if (!processedPurchaseIds.has(dTag)) {
            transactions.push({
              coins,
              timestamp: event.created_at,
              type: 'debit',
              phase,
              purchaseId: dTag,
            });
            processedPurchaseIds.add(dTag);
          }
        }
      });

      // Sort by timestamp (newest first)
      transactions.sort((a, b) => b.timestamp - a.timestamp);

      // Calculate balance
      let balance = 0;
      transactions.forEach(transaction => {
        if (transaction.type === 'credit') {
          balance += transaction.coins;
        } else {
          balance -= transaction.coins;
        }
      });

      // Add profile's base coins if available
      if (profile) {
        balance += profile.coins;
      }

      return { balance, transactions };
    },
    enabled: !!user,
  });
}

export function useAddCoins() {
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return async (coins: number, sats?: number, bolt11_hash?: string) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    // Generate unique purchase ID for idempotency
    const purchaseId = `purchase:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const tags = [
      ['p', user.pubkey],
      ['d', purchaseId],
      ['coins', `+${coins}`],
      ['phase', 'prod'],
    ];

    if (sats !== undefined) {
      tags.push(['sats', sats.toString()]);
    }

    if (bolt11_hash) {
      tags.push(['bolt11_hash', bolt11_hash]);
    }

    // Publish credit event
    await publishEvent({
      kind: 40100,
      content: 'Blobbi coin deposit confirmed',
      tags,
    });

    // Invalidate coin balance query to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['coin-balance', user.pubkey] });
  };
}

export function useSpendCoins() {
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return async (coins: number, description: string = 'Blobbi shop purchase') => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    // Generate unique purchase ID for idempotency
    const purchaseId = `purchase:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const tags = [
      ['d', purchaseId],
      ['coins', `-${coins}`],
      ['phase', 'prod'],
    ];

    // Publish debit event
    await publishEvent({
      kind: 40101,
      content: description,
      tags,
    });

    // Invalidate coin balance query to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['coin-balance', user.pubkey] });
  };
}