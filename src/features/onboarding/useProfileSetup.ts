/**
 * Publishing the kind 0 of the profile step, and the optional picture
 * upload before it.
 *
 * The write reads the FRESH kind 0 first so nothing the player set elsewhere
 * is lost, then signs with the current signer (extension, bunker or the
 * session's nsec signer: the key is never touched here) and publishes to the
 * application relays. The `author` query cache is updated so the home shows
 * the name at once. The upload is Blossom through nostrify's uploader, to
 * the ecosystem's servers.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NSchema as n, type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CLIENT_NAME } from '@/features/care/usePublishAdapter';
import { BLOSSOM_SERVERS } from '@/config/blossom';
import { mergeProfileMetadata, type ProfileFormInput } from './profile-plan';

const PUBLISH_TIMEOUT_MS = 8_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

export function useProfileSetup(pubkey: string | undefined) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const publish = useMutation<NostrEvent, Error, ProfileFormInput>({
    mutationFn: async (form) => {
      if (!user || !pubkey) throw new Error('Sign in first.');
      const [fresh] = await nostr.query([{ kinds: [0], authors: [pubkey], limit: 1 }], { signal: AbortSignal.timeout(2_500) }).catch(() => [] as NostrEvent[]);
      let existing: NostrMetadata | undefined;
      if (fresh) {
        try {
          existing = n.json().pipe(n.metadata()).parse(fresh.content);
        } catch {
          existing = undefined;
        }
      }
      const metadata = mergeProfileMetadata(existing, form);
      const event = await user.signer.signEvent({ kind: 0, content: JSON.stringify(metadata), tags: [['client', CLIENT_NAME]], created_at: Math.floor(Date.now() / 1000) });
      if (event.pubkey !== pubkey) throw new Error('The signer answered for a different account.');
      await nostr.event(event, { signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS) });
      queryClient.setQueryData(['author', pubkey], { event, metadata });
      return event;
    },
  });

  const upload = useMutation<string, Error, File>({
    mutationFn: async (file) => {
      if (!user) throw new Error('Sign in first.');
      if (!file.type.startsWith('image/')) throw new Error('Choose an image.');
      if (file.size > MAX_PICTURE_BYTES) throw new Error('Choose an image under 5 MB.');
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
