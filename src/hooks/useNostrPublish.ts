import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { ensureBlobbiTagsWithDebug } from "@/lib/blobbi-tags";
import { BLOBBI_EVENT_KINDS } from "@/lib/blobbi-events";
import { useCurrentUser } from "./useCurrentUser";

interface EventTemplate {
  kind: number;
  content?: string;
  tags?: string[][];
  created_at?: number;
}

// Blobbi event kinds that should always include Blobbi tags
const BLOBBI_EVENT_KINDS_SET = new Set([
  BLOBBI_EVENT_KINDS?.STATE || 31124,
  BLOBBI_EVENT_KINDS?.INTERACTION || 14919,
  BLOBBI_EVENT_KINDS?.RECORD || 14921,
  BLOBBI_EVENT_KINDS?.BREEDING || 14920,
  BLOBBI_EVENT_KINDS?.BLOBBONAUT_PROFILE || 31125,
  // Also include kind:1 for Blobbi social posts
  1,
]);

export function useNostrPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (t: EventTemplate) => {
      if (!user) {
        throw new Error("User is not logged in");
      }

      let tags = t.tags ?? [];

      // Add client tag if it doesn't exist
      if (!tags.some((tag) => tag[0] === "client")) {
        tags.push(["client", "blobbi"]);
      }

      // Add Blobbi tags for Blobbi events
      if (BLOBBI_EVENT_KINDS_SET.has(t.kind)) {
        const hasEcosystemTag = tags.some(
          (tag) => tag[0] === "b" && tag[1] === "blobbi:ecosystem:v1"
        );
        const hasTopicTag = tags.some(
          (tag) => tag[0] === "t" && tag[1]?.toLowerCase() === "blobbi"
        );

        if (!hasEcosystemTag || !hasTopicTag) {
          console.warn(`[Blobbi] Adding Blobbi tags to kind:${t.kind} event`);
          tags = ensureBlobbiTagsWithDebug(tags, 'useNostrPublish', t.kind);
        }
      }

      const event = await user.signer.signEvent({
        kind: t.kind,
        content: t.content ?? "",
        tags,
        created_at: t.created_at ?? Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });

      return event; // Return signed event
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {

    },
  });
}