/**
 * Rename a Blobbi (`rename.ts` for the rules): a signed-in player's on the
 * relays, a guest's in their world on this device (it then travels with the
 * Blobbi when it is saved to an account: the save copies the guest's newest
 * record, name included).
 */
import { useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NPool } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, type NostrEvent } from '@blobbi-kit/core';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS } from '@/config/relays';
import { canAskRelays } from '@/features/companion/pool-relays';
import { readCensus } from '@/lib/relay-census';
import { t } from '@/i18n';
import { serializeBlobbiWrite } from './blobbi-writes';
import { usePublishAdapter } from './usePublishAdapter';
import { checkNewName, newestRevision, planRename } from './rename';
import { NAME_MAX_LENGTH } from '@/features/adoption/adoption-plan';

export const RENAME_READ_TIMEOUT_MS = 8_000;

export interface RenameResult {
  name: string;
  event: NostrEvent;
}

export function useRenameBlobbi({ pubkey, updateCompanionEvent }: { pubkey: string | undefined; updateCompanionEvent: (event: NostrEvent) => void }) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();

  return useMutation<RenameResult, Error, { d: string; name: string; current: string }>({
    mutationFn: async ({ d, name, current }) => {
      if (!pubkey) throw new Error(t('home.rename.error.signIn'));
      const checked = checkNewName(name, current);
      if (!checked.ok) throw new Error(t(`home.rename.error.${checked.reason}`, { max: NAME_MAX_LENGTH }));
      // In turn with care and items on this page; the read is inside the turn, so it sees what they wrote
      return serializeBlobbiWrite(pubkey, d, async () => {
        const pool: NPool = nostr;
        const networked: boolean = canAskRelays(pool);
        const filter = { kinds: [KIND_BLOBBI_STATE], authors: [pubkey], '#d': [d] };
        let events: NostrEvent[];
        if (networked) {
          const census = await readCensus(pool, [filter], { required: ABSENCE_REQUIRED_RELAYS, others: BASE_RELAYS, timeoutMs: RENAME_READ_TIMEOUT_MS });
          // A relay that must answer did not: what it holds is unknown, so nothing is written over it
          if (!census.complete) throw new Error(t('home.rename.error.incomplete'));
          events = census.events;
        } else {
          events = await pool.query([filter]);
        }
        const companion = newestRevision(events, pubkey, d);
        if (!companion) throw new Error(t('home.rename.error.notFound'));
        // Renamed meanwhile (here or elsewhere) to this very name: nothing to write
        if (companion.name === checked.name) return { name: checked.name, event: companion.event };
        const event = await publisher.publish(planRename(companion, checked.name, Math.floor(Date.now() / 1000)));
        updateCompanionEvent(event);
        return { name: checked.name, event };
      });
    },
  });
}
