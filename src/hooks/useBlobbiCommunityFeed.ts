import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useAuthor } from '@/hooks/useAuthor';
import { formatDistanceToNow } from 'date-fns';
import { hasBlobbiEcosystemTag, hasBlobbiTopicTag } from '@/lib/blobbi-tags';

export interface CommunityPost {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  author: {
    displayName?: string;
    picture?: string;
    name?: string;
  };
  tags: Array<string[]>;
}

export function useBlobbiCommunityFeed(limit: number = 50) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['blobbi-community-feed', limit],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);

      try {
        // First, try to query with both Blobbi ecosystem and topic tags
        let events = await nostr.query([
          {
            kinds: [1],
            // '#b': ['blobbi:ecosystem:v1'],
            '#t': ['blobbi'],
            limit: limit,
          }
        ], { signal });

        // If no results, try fallback query without tag filters and filter client-side
        if (events.length === 0) {
          console.log('[Blobbi Community] No results with tag filters, trying fallback query...');
          const allEvents = await nostr.query([
            {
              kinds: [1],
              limit: limit * 2, // Get more events since we'll filter them
            }
          ], { signal });

          // Filter events client-side to ensure they have Blobbi tags
          events = allEvents.filter(event => 
            hasBlobbiEcosystemTag(event.tags) && hasBlobbiTopicTag(event.tags)
          );
          
          console.log(`[Blobbi Community] Fallback query found ${events.length} matching events`);
        }

        // Transform events into CommunityPost format
        const posts: CommunityPost[] = await Promise.all(
          events.map(async (event) => {
            // Extract author information from tags if available
            const pictureTag = event.tags.find(([name]) => name === 'picture')?.[1];
            const nameTag = event.tags.find(([name]) => name === 'name')?.[1];

            return {
              id: event.id,
              pubkey: event.pubkey,
              content: event.content,
              createdAt: event.created_at,
              author: {
                displayName: nameTag,
                picture: pictureTag,
                name: nameTag,
              },
              tags: event.tags,
            };
          })
        );

        // Sort by created_at descending
        return posts.sort((a, b) => b.createdAt - a.createdAt);
      } catch (error) {
        console.error('Error fetching community feed:', error);
        throw error;
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Helper hook to get author data for a post
export function usePostAuthor(pubkey: string) {
  return useAuthor(pubkey);
}

// Helper function to format timestamp
export function formatPostTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp * 1000), {
    addSuffix: true
  });
}

// Helper function to generate display name fallback
export function generateDisplayName(pubkey: string, author?: { displayName?: string; name?: string }): string {
  if (author?.displayName || author?.name) {
    return author.displayName || author.name!;
  }

  // Fallback to shortened pubkey
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}

// Helper function to get avatar URL or generate colored circle
export function getAvatarUrl(author?: { picture?: string }): string | undefined {
  return author?.picture;
}

// Helper function to get avatar background color based on pubkey
export function getAvatarColor(pubkey: string): string {
  const colors = [
    'bg-purple-500',
    'bg-pink-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];

  // Use pubkey to generate consistent color
  const index = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}
