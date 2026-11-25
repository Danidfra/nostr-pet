/**
 * Publishing the kind 0 of the profile step, and the optional picture
 * upload before it.
 *
 * The write never replaces metadata it could not read (`metadata-write.ts`):
 * a complete read of the relays that must answer, the change merged onto the
 * newest kind 0's raw JSON, a second read after signing; then it publishes
 * to the application relays. It signs with the current signer (extension,
 * bunker or the session's nsec signer: the key is never touched here).
 * `allowCreate` is for a key made here (saving a guest): only then may "no
 * kind 0 found" start a new one. The `author` query cache is updated so the home shows
 * the name at once. The upload is Blossom through nostrify's uploader, to
 * the ecosystem's servers.
 */
import { useContext } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NSchema as n, type NPool, type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { canAskRelays } from '@/features/companion/pool-relays';
import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { CLIENT_NAME } from '@/features/care/usePublishAdapter';
import { BLOSSOM_SERVERS } from '@/config/blossom';
import { t } from '@/i18n';
import type { ProfileFormInput } from './profile-plan';
import { metadataChangedMeanwhile, newerMetadata, planMetadataWrite, readMetadataCensus, type MetadataCensus } from './metadata-write';

const PUBLISH_TIMEOUT_MS = 8_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

export function useProfileSetup(pubkey: string | undefined, { allowCreate = false }: { allowCreate?: boolean } = {}) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  // The fixture world is in memory; an upload would be the one thing leaving the tab
  const fixture = useContext(DevFixtureContext) !== null;

  const publish = useMutation<NostrEvent, Error, ProfileFormInput>({
    mutationFn: async (form) => {
      if (!user || !pubkey) throw new Error(t('wayIn.profile.signInFirst'));
      // The real relays are asked one by one; a guest's world or a dev fixture holds everything there is
      const pool: NPool = nostr;
      const networked: boolean = canAskRelays(pool);
      const census = async (): Promise<MetadataCensus> => {
        if (networked) return readMetadataCensus(pool, pubkey);
        const events = await pool.query([{ kinds: [0], authors: [pubkey], limit: 1 }]);
        return { complete: true, missing: [], newest: events.reduce<NostrEvent | null>((a, b) => newerMetadata(a, b), null) };
      };
      const plan = planMetadataWrite(await census(), form, { allowCreate: allowCreate || !networked, now: Math.floor(Date.now() / 1000), client: CLIENT_NAME });
      if (plan.kind === 'refused') throw new Error(t(`wayIn.profile.refused.${plan.reason}`));
      const event = await user.signer.signEvent({ kind: 0, content: plan.content, tags: plan.tags, created_at: plan.createdAt });
      if (event.pubkey !== pubkey) throw new Error(t('wayIn.profile.wrongAccount'));
      // Written elsewhere while the signer was asked: nothing is sent over it
      if (networked) {
        const again = await readMetadataCensus(pool, pubkey);
        if (!again.complete) throw new Error(t('wayIn.profile.refused.incomplete'));
        if (metadataChangedMeanwhile(again, plan.base, event)) throw new Error(t('wayIn.profile.refused.stale'));
      }
      await nostr.event(event, { signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS) });
      let metadata: NostrMetadata = {};
      try {
        metadata = n.json().pipe(n.metadata()).parse(event.content);
      } catch {
        /* shown as the content allows */
      }
      queryClient.setQueryData(['author', pubkey], { event, metadata });
      return event;
    },
  });

  const upload = useMutation<string, Error, File>({
    mutationFn: async (file) => {
      if (!user) throw new Error(t('wayIn.profile.signInFirst'));
      if (fixture) throw new Error('Pictures are not uploaded in fixture mode.');
      if (!file.type.startsWith('image/')) throw new Error(t('wayIn.profile.chooseImage'));
      if (file.size > MAX_PICTURE_BYTES) throw new Error(t('wayIn.profile.imageTooBig'));
      const uploader = new BlossomUploader({
        servers: [...BLOSSOM_SERVERS],
        signer: user.signer,
        fetch: (input, init) => globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) }),
      });
      const tags = await uploader.upload(file);
      return tags[0][1];
    },
  });

  return { publish, upload };
}
