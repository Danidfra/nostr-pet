import { useEffect, useCallback } from 'react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { registerAutoRepairCallback } from '@/lib/blobbi-events';
import { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook that registers the auto-repair callback for Blobbi STATE events.
 * This enables automatic publishing of corrected events when missing tags are detected.
 */
export function useBlobbiAutoRepair() {
  const { mutateAsync: publishEvent } = useNostrPublish();

  const callback = useCallback(async (event: Omit<NostrEvent, 'id' | 'sig'>) => {
    try {
      await publishEvent(event);
    } catch (error) {
      console.error('[AutoRepair] Failed to publish:', error);
      throw error;
    }
  }, [publishEvent]);

  useEffect(() => {
    registerAutoRepairCallback(callback);
    return () => {
      registerAutoRepairCallback(null);
    };
  }, [callback]);
}
