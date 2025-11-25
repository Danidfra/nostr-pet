import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { NostrEvent } from '@nostrify/nostrify';
import { parseBlobbiFromStateEvent } from '@/lib/blobbi-events';
import { extractTagValues } from '@/lib/blobbi-state-merge';
import { Blobbi } from '@/types/blobbi';

// Quest definitions for Baby to Adult evolution (9 quests)
export interface BabyToAdultQuest {
  id: string;
  name: string;
  description: string;
  eventKind: number | number[];
  checkFunction: (event: NostrEvent, userPubkey: string, questState: QuestState) => boolean;
  completed: boolean;
  progress?: number;
  target?: number;
}

// Define Baby to Adult evolution quests as per the markdown specification
const BABY_TO_ADULT_QUESTS: BabyToAdultQuest[] = [
  {
    id: 'publish_5_posts',
    name: 'Publish 5 new posts',
    description: 'Post 5 kind:1 events authored by you',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 1;
    },
    completed: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'share_song',
    name: 'Share a song you like',
    description: 'Post a kind:1 event that includes a YouTube link in the content',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/i;
      return youtubeRegex.test(event.content);
    },
    completed: false,
  },
  {
    id: 'use_blobbi_hashtags',
    name: 'Use your Blobbi hashtags',
    description: 'Create a post including both hashtags: #Blobbi and #Evolving<NameOfBlobbi>',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string, questState: QuestState) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;

      const content = event.content.toLowerCase();
      const hasBlobbiTag = content.includes('#blobbi');

      // Check for #Evolving<BlobbiName> pattern for the selected baby Blobbi
      const selectedBlobbi = questState.selectedBlobbi;
      if (!selectedBlobbi) return false;

      const evolvingTag = `#evolving${selectedBlobbi.name.toLowerCase()}`;
      const hasEvolvingTag = content.includes(evolvingTag);

      return hasBlobbiTag && hasEvolvingTag;
    },
    completed: false,
  },
  {
    id: 'mention_user',
    name: 'Mention another user',
    description: 'Create a post that tags another user via ["p", "<pubkey>"] tag',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const pTags = event.tags.filter(tag => tag[0] === 'p' && tag[1] !== userPubkey);
      return pTags.length > 0;
    },
    completed: false,
  },
  {
    id: 'reply_to_post',
    name: 'Reply to someone else\'s post',
    description: 'Post a reply using ["e", "<event_id>"] and ["p", "<author_pubkey>"] tags, where the replied post is not authored by you',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const eTags = event.tags.filter(tag => tag[0] === 'e');
      const pTags = event.tags.filter(tag => tag[0] === 'p' && tag[1] !== userPubkey);
      return eTags.length > 0 && pTags.length > 0;
    },
    completed: false,
  },
  {
    id: 'follow_5_users',
    name: 'Follow 5 users',
    description: 'Send a kind:3 event (contacts list) that includes at least 5 public keys',
    eventKind: 3,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 3) return false;
      const pTags = event.tags.filter(tag => tag[0] === 'p');
      return pTags.length >= 5;
    },
    completed: false,
  },

  {
    id: 'react_to_5_posts',
    name: 'React to 5 different posts',
    description: 'Send 5 unique kind:7 reaction events, each targeting a different post',
    eventKind: 7,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 7;
    },
    completed: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'repost_3_posts',
    name: 'Repost 3 different posts',
    description: 'Send 3 kind:6 repost events referencing posts from other users',
    eventKind: 6,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 6;
    },
    completed: false,
    progress: 0,
    target: 3,
  },
  {
    id: 'react_or_repost_blobbi',
    name: 'React or repost a #Blobbi post',
    description: 'React to or repost a post that contains the #Blobbi hashtag',
    eventKind: [6, 7],
    checkFunction: (event: NostrEvent, userPubkey: string, questState: QuestState) => {
      if (event.pubkey !== userPubkey || (event.kind !== 6 && event.kind !== 7)) return false;

      // For reactions (kind 7), check if the referenced event contains #Blobbi
      if (event.kind === 7) {
        const eTags = event.tags.filter(tag => tag[0] === 'e');
        if (eTags.length > 0) {
          // We need to check if the referenced event contains #Blobbi
          // This would require fetching the referenced event, which we'll track separately
          return questState.blobbiHashtagEvents.has(eTags[0][1]);
        }
      }

      // For reposts (kind 6), check if the referenced event contains #Blobbi
      if (event.kind === 6) {
        const eTags = event.tags.filter(tag => tag[0] === 'e');
        if (eTags.length > 0) {
          return questState.blobbiHashtagEvents.has(eTags[0][1]);
        }
      }

      return false;
    },
    completed: false,
  },
];

interface QuestState {
  babyToAdultQuests: BabyToAdultQuest[];
  isListening: boolean;
  lastEventTime: number;
  uniqueReactionTargets: Set<string>;
  uniqueRepostTargets: Set<string>;
  blobbiHashtagEvents: Set<string>; // Track event IDs that contain #Blobbi hashtag
  questStartTime: number;
  babyBlobbis: Blobbi[]; // Track baby Blobbis for hashtag validation
  selectedBlobbi?: Blobbi; // The currently selected baby Blobbi
  // Per-Blobbi quest progress tracking
  blobbiQuestProgress: Map<string, BabyToAdultQuest[]>; // Map of Blobbi ID to their quest progress
  blobbiUniqueReactionTargets: Map<string, Set<string>>; // Map of Blobbi ID to their unique reaction targets
  blobbiUniqueRepostTargets: Map<string, Set<string>>; // Map of Blobbi ID to their unique repost targets
}

interface BlobbiQuestSystemState {
  // Blobbi metadata
  blobbis: Blobbi[];
  isLoadingBlobbis: boolean;
  blobbiError: Error | null;

  // Quest tracking
  questState: QuestState;

  // Subscription status
  metadataSubscriptionActive: boolean;
  questSubscriptionActive: boolean;
  blobbiHashtagSubscriptionActive: boolean;
  isStartingQuestTracking: boolean;

  // Selected baby for quest tracking
  selectedBabyId: string | null;
  questStartTime: number | null;
}

/**
 * Blobbi Quest System Hook for Baby to Adult Evolution
 *
 * Implements the quest system described in blobbi-evolve-baby-to-adult-quests.md:
 * 1. Tracks 9 specific social interaction quests
 * 2. Only starts tracking after user clicks "Start Listening"
 * 3. Uses since parameter to only count events after quest start
 * 4. Preserves existing egg/baby logic from incubation system
 */
export function useBlobbiQuestSystem() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const [state, setState] = useState<BlobbiQuestSystemState>({
    blobbis: [],
    isLoadingBlobbis: false,
    blobbiError: null,
    questState: {
      babyToAdultQuests: [...BABY_TO_ADULT_QUESTS],
      isListening: false,
      lastEventTime: 0,
      uniqueReactionTargets: new Set(),
      uniqueRepostTargets: new Set(),
      blobbiHashtagEvents: new Set(),
      questStartTime: Date.now(),
      babyBlobbis: [],
      selectedBlobbi: undefined,
      // Per-Blobbi quest progress tracking
      blobbiQuestProgress: new Map(),
      blobbiUniqueReactionTargets: new Map(),
      blobbiUniqueRepostTargets: new Map(),
    },
    metadataSubscriptionActive: false,
    questSubscriptionActive: false,
    blobbiHashtagSubscriptionActive: false,
    isStartingQuestTracking: false,
    selectedBabyId: null,
    questStartTime: null,
  });

  // Refs to track subscription cleanup functions and active subscriptions
  const metadataCleanupRef = useRef<(() => void) | null>(null);
  const questCleanupRef = useRef<(() => void) | null>(null);
  const blobbiHashtagCleanupRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const activeQuestSubscriptionRef = useRef<boolean>(false);
  const activeMetadataSubscriptionRef = useRef<boolean>(false);
  const activeBlobbiHashtagSubscriptionRef = useRef<boolean>(false);

  // Helper function to get descriptive quest completion messages
  const getQuestCompletionMessage = useCallback((questId: string, questName: string) => {
    const questMessages: Record<string, { title: string; description: string }> = {
      'publish_5_posts': {
        title: '🌟 5 Posts Complete!',
        description: 'Excellent! You\'ve published 5 posts. Your Blobbi is impressed by your content creation!'
      },
      'share_song': {
        title: '🌟 Song Shared!',
        description: 'Great taste in music! Your Blobbi loves the YouTube link you shared!'
      },
      'use_blobbi_hashtags': {
        title: '🌟 Blobbi Hashtags Used!',
        description: 'Perfect! You used both #Blobbi and #Evolving hashtags. Your Blobbi feels the love!'
      },
      'mention_user': {
        title: '🌟 User Mentioned!',
        description: 'Nice social interaction! Your Blobbi enjoys seeing you connect with others!'
      },
      'reply_to_post': {
        title: '🌟 Reply Posted!',
        description: 'Great conversation! Your Blobbi loves seeing you engage with the community!'
      },
      'follow_5_users': {
        title: '🌟 5 Users Followed!',
        description: 'Excellent networking! Your Blobbi is excited about your growing connections!'
      },

      'react_to_5_posts': {
        title: '🌟 5 Reactions Complete!',
        description: 'Amazing engagement! Your Blobbi loves your active participation in the community!'
      },
      'repost_3_posts': {
        title: '🌟 3 Reposts Complete!',
        description: 'Great job sharing content! Your Blobbi loves how you support others!'
      },
      'react_or_repost_blobbi': {
        title: '🌟 Blobbi Post Interaction!',
        description: 'Fantastic! You interacted with a #Blobbi post. Your Blobbi feels the community spirit!'
      }
    };

    const message = questMessages[questId];
    if (message) {
      return message;
    }

    // Fallback message
    return {
      title: '🌟 Quest Complete!',
      description: `Great job! You completed: "${questName}". Your Blobbi is one step closer to evolving!`
    };
  }, []);

  // Publish quest confirmation event
  const publishQuestConfirmation = useCallback(async (questName: string) => {
    if (!user || !nostr || !state.selectedBabyId) return;

    try {
      // Find the quest ID
      const quest = state.questState.babyToAdultQuests.find(q => q.name === questName);
      const questId = quest?.id;

      if (!questId) return;

      // Fetch ONLY the selected Blobbi's event
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        '#d': [state.selectedBabyId],
        limit: 1,
      }], { signal });

      const currentEvent = currentBlobbiEvents[0];

      if (!currentEvent) {
        console.warn(`⚠️ Could not find event for selected Blobbi: ${state.selectedBabyId}`);
        return;
      }

      // Parse the Blobbi to verify it's the right one
      const blobbi = parseBlobbiFromStateEvent(currentEvent);

      if (!blobbi || blobbi.lifeStage !== 'baby' || blobbi.id !== state.selectedBabyId) {
        console.warn(`⚠️ Selected Blobbi is not a baby or doesn't match: ${state.selectedBabyId}`);
        return;
      }

      // Use mergeBlobbiStateTags to preserve incubation/quest tags while adding the confirmation
      const { mergeBlobbiStateTags } = await import('@/lib/blobbi-state-merge');
      const mergedTags = mergeBlobbiStateTags(currentEvent.tags, {
        addConfirmedTaskId: questId,
      });

      // Publish the merged event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: mergedTags,
      });

    } catch (error) {
      console.error('Failed to publish quest confirmation:', error);
    }
  }, [user, nostr, state.selectedBabyId, state.questState.babyToAdultQuests, publishEvent]);

  // Process incoming quest events
  const processQuestEvent = useCallback(async (event: NostrEvent) => {
    if (!user || !state.selectedBabyId) return;

    // Validate event structure
    if (!event || typeof event.created_at !== 'number' || !event.pubkey || !event.kind) {
      console.warn('⚠️ Invalid event structure, skipping:', event);
      return;
    }

    // Only process events that occurred after evolution started
    const eventTimestamp = event.created_at * 1000;
    const evolutionTime = state.questStartTime;
    if (!evolutionTime || eventTimestamp < evolutionTime) {

      return;
    }

    let questCompleted = false;
    let completedQuestName = '';

    setState(prevState => {
      const newQuestState = { ...prevState.questState };

      // Set the selected Blobbi in quest state
      const selectedBlobbi = prevState.blobbis.find(b => b.id === prevState.selectedBabyId);
      if (selectedBlobbi) {
        newQuestState.selectedBlobbi = selectedBlobbi;
      }

      // Get or initialize quest progress for the selected Blobbi
      const selectedBabyId = prevState.selectedBabyId!;
      let blobbiQuests = newQuestState.blobbiQuestProgress.get(selectedBabyId) || [...BABY_TO_ADULT_QUESTS];
      const currentBlobbiReactionTargets = newQuestState.blobbiUniqueReactionTargets.get(selectedBabyId) || new Set<string>();
      const currentBlobbiRepostTargets = newQuestState.blobbiUniqueRepostTargets.get(selectedBabyId) || new Set<string>();

      // Process baby to adult quests for the selected Blobbi only
      blobbiQuests = blobbiQuests.map(quest => {
        if (quest.completed) return quest;

        const eventKinds = Array.isArray(quest.eventKind) ? quest.eventKind : [quest.eventKind];
        if (!eventKinds.includes(event.kind)) return quest;

        if (quest.checkFunction(event, user.pubkey, newQuestState)) {
          if (quest.target && quest.progress !== undefined) {
            // Multi-target quest
            let newProgress = quest.progress;

            // Special handling for unique targets per Blobbi
            if (quest.id === 'react_to_5_posts') {
              const eTags = event.tags.filter(tag => tag[0] === 'e');
              if (eTags.length > 0) {
                const targetEventId = eTags[0][1];
                if (!currentBlobbiReactionTargets.has(targetEventId)) {
                  currentBlobbiReactionTargets.add(targetEventId);
                  newProgress = currentBlobbiReactionTargets.size;
                }
              }
            } else if (quest.id === 'repost_3_posts') {
              const eTags = event.tags.filter(tag => tag[0] === 'e');
              if (eTags.length > 0) {
                const targetEventId = eTags[0][1];
                if (!currentBlobbiRepostTargets.has(targetEventId)) {
                  currentBlobbiRepostTargets.add(targetEventId);
                  newProgress = currentBlobbiRepostTargets.size;
                }
              }
            } else {
              newProgress = quest.progress + 1;
            }

            if (newProgress >= quest.target) {
              questCompleted = true;
              completedQuestName = quest.name;

              // Show toast notification for completed multi-target quest
              const message = getQuestCompletionMessage(quest.id, quest.name);
              toast({
                title: message.title,
                description: `${selectedBlobbi?.name}: ${message.description}`,
                variant: "default",
              });

              return { ...quest, progress: newProgress, completed: true };
            } else {

              // Show progress toast for multi-target quests
              toast({
                title: "📈 Quest Progress!",
                description: `${selectedBlobbi?.name}: Progress on "${quest.name}": ${newProgress}/${quest.target} completed. Keep going!`,
                variant: "default",
              });

              return { ...quest, progress: newProgress };
            }
          } else {
            // Single completion quest
            questCompleted = true;
            completedQuestName = quest.name;

            // Show toast notification for completed single quest
            const message = getQuestCompletionMessage(quest.id, quest.name);
            toast({
              title: message.title,
              description: `${selectedBlobbi?.name}: ${message.description}`,
              variant: "default",
            });

            return { ...quest, completed: true };
          }
        }

        return quest;
      });

      // Update the per-Blobbi quest progress
      newQuestState.blobbiQuestProgress.set(selectedBabyId, blobbiQuests);
      newQuestState.blobbiUniqueReactionTargets.set(selectedBabyId, currentBlobbiReactionTargets);
      newQuestState.blobbiUniqueRepostTargets.set(selectedBabyId, currentBlobbiRepostTargets);

      // Also update the global quest state for the selected Blobbi (for backward compatibility)
      newQuestState.babyToAdultQuests = blobbiQuests;
      newQuestState.uniqueReactionTargets = currentBlobbiReactionTargets;
      newQuestState.uniqueRepostTargets = currentBlobbiRepostTargets;

      newQuestState.lastEventTime = Date.now();

      return {
        ...prevState,
        questState: newQuestState,
      };
    });

    // Publish quest confirmation if completed
    if (questCompleted && completedQuestName) {
      await publishQuestConfirmation(completedQuestName);

      // Check if all quests are completed for this specific Blobbi (ready to evolve to adult)
      const selectedBlobbi = state.blobbis.find(b => b.id === state.selectedBabyId);
      if (selectedBlobbi) {
        const blobbiQuests = state.questState.blobbiQuestProgress.get(state.selectedBabyId) || [...BABY_TO_ADULT_QUESTS];
        const allQuestsCompleted = blobbiQuests.every(quest => quest.completed);
        if (allQuestsCompleted) {

          // Show toast notification for completing all quests
          toast({
            title: "🎊 All Quests Complete!",
            description: `Amazing! ${selectedBlobbi.name} has completed all evolution quests and is ready to evolve to adult!`,
            variant: "default",
          });
        }
      }
    }
  }, [user, publishEvent, state.questStartTime, state.questState.questStartTime, state.selectedBabyId, state.blobbis, state.questState.blobbiQuestProgress, publishQuestConfirmation, toast, getQuestCompletionMessage]);

  // Process #Blobbi hashtag events for quest validation
  const processBlobbiHashtagEvent = useCallback((event: NostrEvent) => {
    if (event.kind !== 1) return;

    const content = event.content.toLowerCase();
    const hasBlobbiTag = content.includes('#blobbi') ||
      event.tags.some(tag => tag[0] === 't' && tag[1] && tag[1].toLowerCase() === 'blobbi');

    if (hasBlobbiTag) {
      setState(prevState => ({
        ...prevState,
        questState: {
          ...prevState.questState,
          blobbiHashtagEvents: new Set([...prevState.questState.blobbiHashtagEvents, event.id]),
        },
      }));
    }
  }, []);

  // Start persistent metadata subscription (kind 31124)
  const startMetadataSubscription = useCallback(async () => {
    if (!user || !nostr || state.metadataSubscriptionActive) return;

    try {
      const subscriptionIterable = nostr.req([{
        kinds: [31124],
        authors: [user.pubkey],
      }]);

      setState(prev => ({ ...prev, metadataSubscriptionActive: true }));

      // Process subscription messages in the background
      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;

              // Parse and update Blobbi data
              try {
                const blobbi = parseBlobbiFromStateEvent(event);
                if (blobbi) {
                  setState(prev => {
                    const updatedBlobbis = prev.blobbis.some(b => b.id === blobbi.id)
                      ? prev.blobbis.map(b => b.id === blobbi.id ? blobbi : b)
                      : [...prev.blobbis, blobbi];

                    const newBlobbiTaskStates = new Map(prev.questState.blobbiQuestProgress);
                    let evolutionBabyId: string | null = null;
                    let latestEvolutionTimestamp = 0;

                    // Update baby Blobbis list for hashtag validation
                    const babyBlobbis = updatedBlobbis.filter(b => b.lifeStage === 'baby');

                    // Check for start_evolution tags and find authoritative baby
                    if (blobbi.lifeStage === 'baby') {
                      const startEvolutionTags = extractTagValues(event, 'start_evolution');
                      for (const tagValue of startEvolutionTags) {
                        let timestamp = parseInt(tagValue);
                        // If invalid (e.g., "true"), fallback to event.created_at
                        if (isNaN(timestamp)) {
                          timestamp = event.created_at;

                        }
                        if (timestamp > latestEvolutionTimestamp) {
                          latestEvolutionTimestamp = timestamp;
                          evolutionBabyId = blobbi.id;

                        }
                      }
                    }

                    // Update selected Blobbi if it was updated
                    const selectedBlobbi = prev.selectedBabyId
                      ? updatedBlobbis.find(b => b.id === prev.selectedBabyId)
                      : undefined;

                    // Handle start_evolution tag changes with authoritative selection
                    const currentEvolutionBabyId = prev.selectedBabyId;
                    const hasStartEvolution = evolutionBabyId !== null;

                    if (hasStartEvolution && blobbi.lifeStage === 'baby') {
                      const timestamp = latestEvolutionTimestamp * 1000; // Convert to milliseconds

                      // Authoritative selection: if this is a baby with start_evolution, it MUST be selected
                      if (!currentEvolutionBabyId || currentEvolutionBabyId !== blobbi.id) {

                        return {
                          ...prev,
                          blobbis: updatedBlobbis,
                          questState: {
                            ...prev.questState,
                            babyBlobbis,
                            selectedBlobbi: blobbi,
                            blobbiQuestProgress: newBlobbiTaskStates,
                            isListening: true,
                          },
                          selectedBabyId: blobbi.id,
                          questStartTime: timestamp,
                        };
                      } else {
                        // Update timestamp if same baby
                        return {
                          ...prev,
                          blobbis: updatedBlobbis,
                          questState: {
                            ...prev.questState,
                            babyBlobbis,
                            selectedBlobbi: blobbi,
                            blobbiQuestProgress: newBlobbiTaskStates,
                            isListening: true,
                          },
                          questStartTime: timestamp,
                        };
                      }
                    } else if (!hasStartEvolution && currentEvolutionBabyId === blobbi.id) {
                      // If the current selected baby lost its start_evolution tag, clear selection

                      return {
                        ...prev,
                        blobbis: updatedBlobbis,
                        questState: {
                          ...prev.questState,
                          babyBlobbis,
                          blobbiQuestProgress: newBlobbiTaskStates,
                        },
                        selectedBabyId: null,
                        questStartTime: null,
                      };
                    }

                    return {
                      ...prev,
                      blobbis: updatedBlobbis,
                      questState: {
                        ...prev.questState,
                        babyBlobbis,
                        selectedBlobbi: selectedBlobbi,
                        blobbiQuestProgress: newBlobbiTaskStates,
                      },
                    };
                  });

                  // Check for *_confirmed tags to mark quests as completed for this specific Blobbi
                  setState(prevInner => {
                    const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);
                    if (confirmedTags.length > 0 && blobbi.lifeStage === 'baby') {

                      const newQuestState = { ...prevInner.questState };

                      // Get or initialize quest progress for this Blobbi
                      let blobbiQuests = newQuestState.blobbiQuestProgress.get(blobbi.id) || [...BABY_TO_ADULT_QUESTS];

                      // Mark baby to adult quests as completed based on confirmed tags
                      blobbiQuests = blobbiQuests.map(quest => {
                        const confirmationTag = `${quest.id}_confirmed`;
                        const isConfirmed = confirmedTags.some(tag => tag[0] === confirmationTag);
                        if (isConfirmed && !quest.completed) {

                          return { ...quest, completed: true };
                        }
                        return quest;
                      });

                      // Update the per-Blobbi quest progress
                      const newBlobbiQuestProgress = new Map(newQuestState.blobbiQuestProgress);
                      newBlobbiQuestProgress.set(blobbi.id, blobbiQuests);
                      newQuestState.blobbiQuestProgress = newBlobbiQuestProgress;

                      // If this is the selected Blobbi, also update the global quest state
                      if (blobbi.id === prevInner.selectedBabyId) {
                        newQuestState.babyToAdultQuests = blobbiQuests;
                      }

                      return {
                        ...prevInner,
                        questState: newQuestState,
                      };
                    }
                    return prevInner;
                  });
                }
              } catch (error) {
                console.warn('Failed to parse updated Blobbi event:', error);
              }
            } else if (msg[0] === 'EOSE') {

            } else if (msg[0] === 'CLOSED') {

              setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
              break;
            }
          }
        } catch (error) {
          console.error('❌ Metadata subscription error:', error);
          setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
        }
      })();

      // Store cleanup function
      metadataCleanupRef.current = () => {
        setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
      };

    } catch (error) {
      console.error('❌ Failed to start metadata subscription:', error);
      setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
    }
  }, [user, nostr, state.metadataSubscriptionActive]);

  // Start #Blobbi hashtag tracking subscription
  const startBlobbiHashtagSubscription = useCallback(async () => {
    if (!user || !nostr || state.blobbiHashtagSubscriptionActive) return;

    try {
      const subscriptionIterable = nostr.req([{
        kinds: [1],
        '#t': ['blobbi'],
      }]);

      setState(prev => ({ ...prev, blobbiHashtagSubscriptionActive: true }));

      // Process subscription messages in the background
      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;
              processBlobbiHashtagEvent(event);
            } else if (msg[0] === 'EOSE') {

            } else if (msg[0] === 'CLOSED') {

              setState(prev => ({ ...prev, blobbiHashtagSubscriptionActive: false }));
              break;
            }
          }
        } catch (error) {
          console.error('❌ Blobbi hashtag subscription error:', error);
          setState(prev => ({ ...prev, blobbiHashtagSubscriptionActive: false }));
        }
      })();

      // Store cleanup function
      blobbiHashtagCleanupRef.current = () => {
        setState(prev => ({ ...prev, blobbiHashtagSubscriptionActive: false }));
      };

    } catch (error) {
      console.error('❌ Failed to start Blobbi hashtag subscription:', error);
      setState(prev => ({ ...prev, blobbiHashtagSubscriptionActive: false }));
    }
  }, [user, nostr, state.blobbiHashtagSubscriptionActive, processBlobbiHashtagEvent]);

  // Start quest tracking subscription (only after user clicks "Start Evolution")
  const startQuestSubscription = useCallback(async (selectedBabyId?: string, sinceTimestamp?: number) => {
    if (!user || !nostr) return;

    // Prevent duplicate subscriptions using ref only (more reliable)
    if (activeQuestSubscriptionRef.current) {
      console.warn('⚠️ Quest subscription already active (ref check), ignoring start request');
      return;
    }

    // If no baby is selected, don't start quest subscription
    if (!selectedBabyId) {

      return;
    }

    // If no since timestamp provided, try to get it from the selected baby's start_evolution tag
    let finalSinceTimestamp = sinceTimestamp;
    if (!finalSinceTimestamp && state.questStartTime && selectedBabyId === state.selectedBabyId) {
      finalSinceTimestamp = state.questStartTime;
    }
    if (!finalSinceTimestamp) {
      try {
        const signal = AbortSignal.timeout(5000);
        const currentBlobbiEvents = await nostr.query([{
          kinds: [31124],
          authors: [user?.pubkey || ''],
          '#d': [selectedBabyId],
          limit: 1,
        }], { signal });

        if (currentBlobbiEvents.length > 0) {
          const startEvolutionTag = currentBlobbiEvents[0].tags.find(tag => tag[0] === 'start_evolution');
          if (startEvolutionTag && startEvolutionTag[1]) {
            const tagTimestamp = parseInt(startEvolutionTag[1]);
            if (!isNaN(tagTimestamp)) {
              finalSinceTimestamp = tagTimestamp * 1000; // Convert to milliseconds

            } else {
              // Fallback to event.created_at
              finalSinceTimestamp = currentBlobbiEvents[0].created_at * 1000;

            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch start_evolution timestamp:', error);
      }
    }

    try {
      // Create filters to capture events as per the markdown specification
      const filters: Array<{ kinds: number[]; '#p'?: string[]; authors?: string[]; since?: number }> = [
        {
          kinds: [1, 3, 6, 7], // Quest-relevant event kinds (removed kind:0)
          '#p': [user.pubkey], // Events mentioning the user
        },
        {
          kinds: [1, 3, 6, 7], // Quest-relevant event kinds (removed kind:0)
          authors: [user.pubkey], // Events authored by the user
        }
      ];

      // Add since filter if timestamp is provided (when "Start Evolution" is clicked)
      if (sinceTimestamp) {
        const sinceSeconds = Math.floor(sinceTimestamp / 1000); // Convert to seconds
        filters[0].since = sinceSeconds;
        filters[1].since = sinceSeconds;
      }

      const subscriptionIterable = nostr.req(filters);

      // Mark subscription as active in both state and ref
      activeQuestSubscriptionRef.current = true;
      setState(prev => ({
        ...prev,
        questSubscriptionActive: true,
        questState: { ...prev.questState, isListening: true },
      }));

      // Process subscription messages in the background
      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;

              await processQuestEvent(event);
            } else if (msg[0] === 'EOSE') {

            } else if (msg[0] === 'CLOSED') {

              activeQuestSubscriptionRef.current = false;
              setState(prev => ({
                ...prev,
                questSubscriptionActive: false,
                questState: { ...prev.questState, isListening: false },
              }));
              break;
            }
          }
        } catch (error) {
          console.error('❌ Quest subscription error:', error);
          activeQuestSubscriptionRef.current = false;
          setState(prev => ({
            ...prev,
            questSubscriptionActive: false,
            questState: { ...prev.questState, isListening: false },
          }));
        }
      })();

      // Store cleanup function that properly closes the subscription
      questCleanupRef.current = () => {

        activeQuestSubscriptionRef.current = false;
        setState(prev => ({
          ...prev,
          questSubscriptionActive: false,
          questState: { ...prev.questState, isListening: false },
        }));
        // The subscription will close naturally when the async iterator breaks
      };

    } catch (error) {
      console.error('❌ Failed to start quest subscription:', error);
      activeQuestSubscriptionRef.current = false;
      setState(prev => ({
        ...prev,
        questSubscriptionActive: false,
        questState: { ...prev.questState, isListening: false },
      }));
    }
  }, [user, nostr, state.questSubscriptionActive, processQuestEvent]);

  // Fetch Blobbi metadata
  const fetchBlobbiMetadata = useCallback(async () => {
    if (!user || !nostr || state.isLoadingBlobbis) return;

    setState(prev => ({ ...prev, isLoadingBlobbis: true, blobbiError: null }));

    try {
      const signal = AbortSignal.timeout(10000);
      const events = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
      }], { signal });

      // Parse Blobbi events
      const blobbis: Blobbi[] = [];
      let evolutionBabyId: string | null = null;
      let latestEvolutionTimestamp = 0;

      for (const event of events) {
        try {
          const blobbi = parseBlobbiFromStateEvent(event);
          if (blobbi) {
            blobbis.push(blobbi);

            // Check for start_evolution tags for babies
            if (blobbi.lifeStage === 'baby') {
              const startEvolutionTags = extractTagValues(event, 'start_evolution');
              for (const tagValue of startEvolutionTags) {
                let timestamp = parseInt(tagValue);
                // If invalid (e.g., "true"), fallback to event.created_at
                if (isNaN(timestamp)) {
                  timestamp = event.created_at;

                }
                if (timestamp > latestEvolutionTimestamp) {
                  latestEvolutionTimestamp = timestamp;
                  evolutionBabyId = blobbi.id;

                }
              }
            }
          }
        } catch (error) {
          console.warn('Failed to parse Blobbi event:', error);
        }
      }

      setState(prev => {
        // Update baby Blobbis list for hashtag validation
        const babyBlobbis = blobbis.filter(b => b.lifeStage === 'baby');

        // Load quest confirmations for all baby Blobbis
        const newBlobbiQuestProgress = new Map(prev.questState.blobbiQuestProgress);
        let updatedQuests = [...prev.questState.babyToAdultQuests];
        let selectedBlobbi: Blobbi | undefined;

        // Process quest confirmations for all baby Blobbis
        for (const blobbi of babyBlobbis) {
          const blobbiEvent = events.find(event => {
            const eventBlobbi = parseBlobbiFromStateEvent(event);
            return eventBlobbi && eventBlobbi.id === blobbi.id;
          });

          if (blobbiEvent) {
            const confirmedTags = blobbiEvent.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);

            if (confirmedTags.length > 0) {
              // Get existing quest progress for this Blobbi or start fresh
              let blobbiQuests = newBlobbiQuestProgress.get(blobbi.id) || [...BABY_TO_ADULT_QUESTS];

              blobbiQuests = blobbiQuests.map(quest => {
                const confirmationTag = `${quest.id}_confirmed`;
                const isConfirmed = confirmedTags.some(tag => tag[0] === confirmationTag);
                if (isConfirmed && !quest.completed) {

                  return { ...quest, completed: true };
                }
                return quest;
              });

              newBlobbiQuestProgress.set(blobbi.id, blobbiQuests);

              // If this is the selected Blobbi, update the global quest state
              if (blobbi.id === prev.selectedBabyId) {
                updatedQuests = blobbiQuests;
                selectedBlobbi = blobbi;
              }
            }
          }
        }

        // Set selected Blobbi if we have one
        if (prev.selectedBabyId && !selectedBlobbi) {
          selectedBlobbi = blobbis.find(b => b.id === prev.selectedBabyId);
          // Load quest progress for selected Blobbi
          const blobbiQuests = newBlobbiQuestProgress.get(prev.selectedBabyId) || [...BABY_TO_ADULT_QUESTS];
          updatedQuests = blobbiQuests;
        }

        return {
          ...prev,
          blobbis,
          isLoadingBlobbis: false,
          questState: {
            ...prev.questState,
            babyToAdultQuests: updatedQuests,
            questStartTime: blobbis.length > 0 ? Math.min(...blobbis.map(b => b.birthTime)) : Date.now(),
            babyBlobbis,
            selectedBlobbi: selectedBlobbi,
            blobbiQuestProgress: newBlobbiQuestProgress,
          },
        };
      });

      // Authoritative baby selection: override any existing selection with evolving baby
      if (evolutionBabyId) {

        setState(prev => ({
          ...prev,
          selectedBabyId: evolutionBabyId,
          questStartTime: latestEvolutionTimestamp * 1000, // Convert to milliseconds
        }));
      } else {

      }

      // Start persistent metadata subscription
      await startMetadataSubscription();

      // Start #Blobbi hashtag tracking
      await startBlobbiHashtagSubscription();

      // If we have an authoritative evolving baby, start quest subscription
      if (evolutionBabyId) {

        await startQuestSubscription(evolutionBabyId, latestEvolutionTimestamp * 1000);
      }

    } catch (error) {
      console.error('❌ Failed to fetch Blobbi metadata:', error);
      setState(prev => ({
        ...prev,
        isLoadingBlobbis: false,
        blobbiError: error as Error
      }));
    }
  }, [user, nostr, state.isLoadingBlobbis, startMetadataSubscription, startBlobbiHashtagSubscription]);

  // Initialize the system when user is available
  useEffect(() => {
    if (user && !isInitializedRef.current) {

      isInitializedRef.current = true;
      fetchBlobbiMetadata();
    }

    // Only cleanup on unmount, not on re-renders
    return () => {
      // Only cleanup if the component is actually unmounting
      // This prevents cleanup during re-renders

      if (metadataCleanupRef.current) {
        metadataCleanupRef.current();
        metadataCleanupRef.current = null;
      }
      if (questCleanupRef.current) {
        questCleanupRef.current();
        questCleanupRef.current = null;
      }
      if (blobbiHashtagCleanupRef.current) {
        blobbiHashtagCleanupRef.current();
        blobbiHashtagCleanupRef.current = null;
      }
    };
  }, [user, fetchBlobbiMetadata]);

  // Sync ref state with component state for debugging
  useEffect(() => {
    if (state.questSubscriptionActive !== activeQuestSubscriptionRef.current) {

    }
  }, [state.questSubscriptionActive]);

  // Get quest progress for a specific Blobbi
  const getBlobbiQuestProgress = useCallback((blobbiId: string) => {
    const blobbiQuests = state.questState.blobbiQuestProgress.get(blobbiId) || [...BABY_TO_ADULT_QUESTS];
    const completed = blobbiQuests.filter(quest => quest.completed).length;
    const total = blobbiQuests.length;

    return {
      completed,
      total,
      percentage: (completed / total) * 100,
    };
  }, [state.questState.blobbiQuestProgress]);

  // Calculate progress for baby to adult quests (for selected Blobbi)
  const getQuestProgress = useCallback(() => {
    if (state.selectedBabyId) {
      return getBlobbiQuestProgress(state.selectedBabyId);
    }

    // Fallback to global state if no Blobbi selected
    const completed = state.questState.babyToAdultQuests.filter(quest => quest.completed).length;
    const total = state.questState.babyToAdultQuests.length;

    return {
      completed,
      total,
      percentage: (completed / total) * 100,
    };
  }, [state.questState, state.selectedBabyId, getBlobbiQuestProgress]);

  // Check if a specific baby blobbi is ready to evolve to adult
  const isBabyReadyToEvolve = useCallback((blobbi: Blobbi) => {
    // Only babies can evolve to adult
    if (blobbi.lifeStage !== 'baby') return false;

    // Check if all baby to adult quests are completed for this specific Blobbi
    const blobbiQuests = state.questState.blobbiQuestProgress.get(blobbi.id) || [...BABY_TO_ADULT_QUESTS];
    const questsCompleted = blobbiQuests.filter(quest => quest.completed).length;
    const questsTotal = blobbiQuests.length;

    return questsCompleted === questsTotal;
  }, [state.questState.blobbiQuestProgress]);

  // Select a baby for quest tracking
  const selectBaby = useCallback(async (babyId: string | null) => {

    // If selecting the same baby, just update the selection without resetting anything
    if (babyId === state.selectedBabyId) {

      setState(prev => {
        const selectedBlobbi = babyId ? prev.blobbis.find(b => b.id === babyId) : undefined;
        // Load the quest progress for this specific Blobbi
        const blobbiQuests = babyId ? prev.questState.blobbiQuestProgress.get(babyId) || [...BABY_TO_ADULT_QUESTS] : [...BABY_TO_ADULT_QUESTS];
        const blobbiReactionTargets = babyId ? prev.questState.blobbiUniqueReactionTargets.get(babyId) || new Set<string>() : new Set<string>();
        const blobbiRepostTargets = babyId ? prev.questState.blobbiUniqueRepostTargets.get(babyId) || new Set<string>() : new Set<string>();

        return {
          ...prev,
          selectedBabyId: babyId,
          questState: {
            ...prev.questState,
            selectedBlobbi: selectedBlobbi,
            babyToAdultQuests: blobbiQuests,
            uniqueReactionTargets: blobbiReactionTargets,
            uniqueRepostTargets: blobbiRepostTargets,
          },
        };
      });
      return;
    }

    // If selecting a different baby, load its specific quest state

    // Stop current quest tracking if active
    if (activeQuestSubscriptionRef.current && questCleanupRef.current) {

      activeQuestSubscriptionRef.current = false;
      questCleanupRef.current();
      questCleanupRef.current = null;
    }

    // Load quest state for the new baby
    setState(prev => {
      const selectedBlobbi = babyId ? prev.blobbis.find(b => b.id === babyId) : undefined;
      // Load the quest progress for this specific Blobbi
      const blobbiQuests = babyId ? prev.questState.blobbiQuestProgress.get(babyId) || [...BABY_TO_ADULT_QUESTS] : [...BABY_TO_ADULT_QUESTS];
      const blobbiReactionTargets = babyId ? prev.questState.blobbiUniqueReactionTargets.get(babyId) || new Set<string>() : new Set<string>();
      const blobbiRepostTargets = babyId ? prev.questState.blobbiUniqueRepostTargets.get(babyId) || new Set<string>() : new Set<string>();

      return {
        ...prev,
        selectedBabyId: babyId,
        questStartTime: null,
        questSubscriptionActive: false,
        questState: {
          ...prev.questState,
          babyToAdultQuests: blobbiQuests,
          isListening: false,
          uniqueReactionTargets: blobbiReactionTargets,
          uniqueRepostTargets: blobbiRepostTargets,
          selectedBlobbi: selectedBlobbi,
        },
      };
    });

    // If a new baby is selected, load its quest confirmations
    if (babyId && user && nostr) {
      try {
        const signal = AbortSignal.timeout(5000);
        const events = await nostr.query([{
          kinds: [31124],
          authors: [user.pubkey],
        }], { signal });

        const selectedBlobbiEvent = events.find(event => {
          const blobbi = parseBlobbiFromStateEvent(event);
          return blobbi && blobbi.id === babyId;
        });

        if (selectedBlobbiEvent) {
          const confirmedTags = selectedBlobbiEvent.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1] === 'true');

          setState(prev => {
            // Get existing quest progress for this Blobbi or start fresh
            let blobbiQuests = prev.questState.blobbiQuestProgress.get(babyId) || [...BABY_TO_ADULT_QUESTS];

            // Update quest completion status based on confirmed tags
            blobbiQuests = blobbiQuests.map(quest => {
              const confirmationTag = `${quest.id}_confirmed`;
              const isConfirmed = confirmedTags.some(tag => tag[0] === confirmationTag);
              if (isConfirmed) {

                return { ...quest, completed: true };
              }
              return quest;
            });

            // Update the per-Blobbi quest progress
            const newBlobbiQuestProgress = new Map(prev.questState.blobbiQuestProgress);
            newBlobbiQuestProgress.set(babyId, blobbiQuests);

            const selectedBlobbi = prev.blobbis.find(b => b.id === babyId);

            return {
              ...prev,
              questState: {
                ...prev.questState,
                babyToAdultQuests: blobbiQuests,
                selectedBlobbi: selectedBlobbi,
                blobbiQuestProgress: newBlobbiQuestProgress,
              },
            };
          });
        }
      } catch (error) {
        console.error('Failed to load quest confirmations for selected baby:', error);
      }
    }
  }, [state.selectedBabyId, user, nostr]);

  // Persist evolution start to Nostr (matches persistIncubationStart exactly)
  const persistEvolutionStart = useCallback(async (babyId: string) => {
    if (!user || !nostr) return;

    try {

      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        '#d': [babyId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for evolution start');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];

      // Check if start_evolution tag already exists
      const existingStartEvolutionTags = extractTagValues(currentEvent, 'start_evolution');
      if (existingStartEvolutionTags.length > 0) {
        const existingTimestamp = parseInt(existingStartEvolutionTags[0]);
        if (!isNaN(existingTimestamp)) {

          return existingTimestamp;
        } else {
          // Invalid value (e.g., "true"), fallback to event.created_at
          const fallbackTimestamp = currentEvent.created_at;

          return fallbackTimestamp;
        }
      }

      const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

      console.log('[Evolution Start] Original event tags:', currentEvent.tags.length);
      console.log('[Evolution Start] Original stats:', {
        hunger: currentEvent.tags.find(([n]) => n === 'hunger')?.[1],
        happiness: currentEvent.tags.find(([n]) => n === 'happiness')?.[1],
        health: currentEvent.tags.find(([n]) => n === 'health')?.[1],
        experience: currentEvent.tags.find(([n]) => n === 'experience')?.[1],
        care_streak: currentEvent.tags.find(([n]) => n === 'care_streak')?.[1],
      });

      // Use the merge helper to safely update tags
      const { mergeBlobbiStateTags } = await import('@/lib/blobbi-state-merge');
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        startEvolution: now,
      });

      console.log('[Evolution Start] Merged tags:', updatedTags.length);
      console.log('[Evolution Start] Merged stats:', {
        hunger: updatedTags.find(([n]) => n === 'hunger')?.[1],
        happiness: updatedTags.find(([n]) => n === 'happiness')?.[1],
        health: updatedTags.find(([n]) => n === 'health')?.[1],
        experience: updatedTags.find(([n]) => n === 'experience')?.[1],
        care_streak: updatedTags.find(([n]) => n === 'care_streak')?.[1],
        start_evolution: updatedTags.find(([n]) => n === 'start_evolution')?.[1],
      });

      // Publish the updated event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      return now;
    } catch (error) {
      console.error('❌ Failed to persist evolution start:', error);
      throw error;
    }
  }, [user, nostr, publishEvent]);

  // Start quest tracking for selected baby
  const startQuestTracking = useCallback(async () => {
    if (!state.selectedBabyId) {
      console.warn('⚠️ No baby selected for quest tracking');
      return;
    }

    // Prevent multiple listeners using both state and ref (removed questStartTime check)
    if (state.questSubscriptionActive || activeQuestSubscriptionRef.current || state.isStartingQuestTracking) {
      console.warn('⚠️ Quest tracking already active or starting, ignoring start request');

      return;
    }

    try {

      setState(prev => ({ ...prev, isStartingQuestTracking: true }));

      // Step 1: Persist evolution start to Nostr
      const evolutionTimestamp = await persistEvolutionStart(state.selectedBabyId);
      if (!evolutionTimestamp) {
        throw new Error('Failed to persist evolution start');
      }

      // Convert timestamp back to milliseconds for local state
      const evolutionTimeMs = evolutionTimestamp * 1000;
      setState(prev => ({ ...prev, questStartTime: evolutionTimeMs }));

      // Step 2: Start quest subscription with since timestamp from the persisted tag
      await startQuestSubscription(state.selectedBabyId, evolutionTimeMs);

      setState(prev => ({ ...prev, isStartingQuestTracking: false }));

    } catch (error) {
      console.error('❌ Failed to start quest tracking:', error);
      activeQuestSubscriptionRef.current = false;
      setState(prev => ({
        ...prev,
        isStartingQuestTracking: false,
        questStartTime: null,
        questSubscriptionActive: false,
        questState: { ...prev.questState, isListening: false },
      }));
    }
  }, [state.selectedBabyId, state.questSubscriptionActive, state.isStartingQuestTracking, startQuestSubscription, persistEvolutionStart]);

  // Stop evolution and remove the start_evolution tag
  const stopEvolution = useCallback(async () => {
    if (!state.selectedBabyId) {
      console.warn('⚠️ No baby selected to stop evolution');
      return;
    }

    try {

      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
        '#d': [state.selectedBabyId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for stopping evolution');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];

      // Use the merge helper to safely remove start_evolution tag
      const { mergeBlobbiStateTags } = await import('@/lib/blobbi-state-merge');
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        removeStartEvolution: true,
      });

      // Publish the updated event without start_evolution tag
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      // Stop the quest subscription
      activeQuestSubscriptionRef.current = false;
      if (questCleanupRef.current) {
        questCleanupRef.current();
        questCleanupRef.current = null;
      }

      // Clear the selected baby and evolution state
      setState(prev => {
        if (!prev.selectedBabyId) return prev;
        const newQuestState = { ...prev.questState };
        newQuestState.isListening = false;
        return {
          ...prev,
          questSubscriptionActive: false,
          questState: newQuestState,
          selectedBabyId: null,
          questStartTime: null,
        };
      });
    } catch (error) {
      console.error('❌ Failed to stop evolution:', error);
    }
  }, [state.selectedBabyId, user, nostr, publishEvent]);

  // Stop quest tracking (cleanup)
  const stopQuestTrackingRef = useRef<() => void>();

  stopQuestTrackingRef.current = () => {

    activeQuestSubscriptionRef.current = false;
    if (questCleanupRef.current) {
      questCleanupRef.current();
      questCleanupRef.current = null;
    }
    setState(prev => ({
      ...prev,
      questSubscriptionActive: false,
      questState: { ...prev.questState, isListening: false },
      selectedBabyId: null,
      questStartTime: null,
    }));
  };

  const stopQuestTracking = useCallback(() => {
    stopQuestTrackingRef.current?.();
  }, []);

  // Reset quest tracking state (for debugging/recovery)
  const resetQuestTracking = useCallback(() => {

    activeQuestSubscriptionRef.current = false;
    if (questCleanupRef.current) {
      questCleanupRef.current();
      questCleanupRef.current = null;
    }
    setState(prev => ({
      ...prev,
      questSubscriptionActive: false,
      questStartTime: null,
      isStartingQuestTracking: false,
      questState: {
        ...prev.questState,
        isListening: false,
        babyToAdultQuests: [...BABY_TO_ADULT_QUESTS],
        uniqueReactionTargets: new Set(),
        uniqueRepostTargets: new Set(),
        blobbiQuestProgress: new Map(),
        blobbiUniqueReactionTargets: new Map(),
        blobbiUniqueRepostTargets: new Map(),
      },
    }));
  }, []);

  const questProgress = getQuestProgress();
  const isReadyToEvolve = questProgress.completed === questProgress.total;

  return {
    // Blobbi data
    blobbis: state.blobbis,
    isLoadingBlobbis: state.isLoadingBlobbis,
    blobbiError: state.blobbiError,

    // Quest tracking
    babyToAdultQuests: state.questState.babyToAdultQuests,
    questProgress,
    isReadyToEvolve,
    isBabyReadyToEvolve,
    getBlobbiQuestProgress, // New function to get progress for specific Blobbi

    // Subscription status
    metadataSubscriptionActive: state.metadataSubscriptionActive,
    questSubscriptionActive: state.questSubscriptionActive,
    blobbiHashtagSubscriptionActive: state.blobbiHashtagSubscriptionActive,
    isListening: state.questState.isListening,
    isStartingQuestTracking: state.isStartingQuestTracking,

    // Baby selection and quest tracking
    selectedBabyId: state.selectedBabyId,
    questStartTime: state.questStartTime,
    selectBaby,
    startQuestTracking,
    stopQuestTracking,
    stopEvolution,
    resetQuestTracking,

    // Helper functions
    hasEvolutionStarted: (blobbiId: string) => state.selectedBabyId === blobbiId && !!state.questStartTime,

    // Controls
    refetchMetadata: fetchBlobbiMetadata,

    // Debug info
    debugInfo: {
      questStartTime: state.questState.questStartTime,
      questStartDate: new Date(state.questState.questStartTime).toISOString(),
      lastEventTime: state.questState.lastEventTime,
      lastEventDate: state.questState.lastEventTime ? new Date(state.questState.lastEventTime).toISOString() : null,
      uniqueReactionTargetsCount: state.questState.uniqueReactionTargets.size,
      uniqueRepostTargetsCount: state.questState.uniqueRepostTargets.size,
      blobbiHashtagEventsCount: state.questState.blobbiHashtagEvents.size,
      userPubkey: user?.pubkey,
      subscriptionStatus: {
        metadata: state.metadataSubscriptionActive,
        quests: state.questSubscriptionActive,
        blobbiHashtag: state.blobbiHashtagSubscriptionActive,
      },
    },
  };
}