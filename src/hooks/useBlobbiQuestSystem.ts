import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { NostrEvent } from '@nostrify/nostrify';
import { parseBlobbiFromStateEvent } from '@/lib/blobbi-events';
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
    },
    metadataSubscriptionActive: false,
    questSubscriptionActive: false,
    blobbiHashtagSubscriptionActive: false,
    selectedBabyId: null,
    questStartTime: null,
  });

  // Refs to track subscription cleanup functions
  const metadataCleanupRef = useRef<(() => void) | null>(null);
  const questCleanupRef = useRef<(() => void) | null>(null);
  const blobbiHashtagCleanupRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);

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
        limit: 10,
      }], { signal });

      // Find the specific Blobbi event we're updating
      const currentEvent = currentBlobbiEvents.find(event => {
        const blobbi = parseBlobbiFromStateEvent(event);
        return blobbi && blobbi.id === state.selectedBabyId;
      });

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

      console.log(`📝 Adding quest confirmation for ${blobbi.name} (baby): ${questId}_confirmed`);

      const existingTags = currentEvent.tags.map(tag => [tag[0] || '', tag[1] || '']) as Array<[string, string]>;
      
      // Create the correct confirmation tag format: ["<quest_id>_confirmed", "true"]
      const confirmationTag: [string, string] = [`${questId}_confirmed`, 'true'];

      // Remove any existing confirmation tags for this quest
      const filteredTags = existingTags.filter(tag => 
        tag[0] !== `${questId}_confirmed`
      );

      // Add the new confirmation tag
      const enrichedTags = [...filteredTags, confirmationTag];

      // Publish the enriched event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: enrichedTags,
      });
      
      console.log(`✅ Published quest confirmation for ${blobbi.name} only: ${questId}_confirmed`);
    } catch (error) {
      console.error('Failed to publish quest confirmation:', error);
    }
  }, [user, nostr, state.selectedBabyId, state.questState, publishEvent]);

  // Process incoming quest events
  const processQuestEvent = useCallback(async (event: NostrEvent) => {
    if (!user || !state.selectedBabyId) return;

    // Validate event structure
    if (!event || typeof event.created_at !== 'number' || !event.pubkey || !event.kind) {
      console.warn('⚠️ Invalid event structure, skipping:', event);
      return;
    }

    // Only process events that occurred after quest started
    const eventTimestamp = event.created_at * 1000;
    const questTime = state.questStartTime || state.questState.questStartTime;
    if (eventTimestamp < questTime) {
      console.log(`⏭️ Skipping event from before quest start: ${new Date(eventTimestamp).toISOString()}`);
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

      // Process baby to adult quests
      newQuestState.babyToAdultQuests = newQuestState.babyToAdultQuests.map(quest => {
        if (quest.completed) return quest;

        const eventKinds = Array.isArray(quest.eventKind) ? quest.eventKind : [quest.eventKind];
        if (!eventKinds.includes(event.kind)) return quest;

        if (quest.checkFunction(event, user.pubkey, newQuestState)) {
          if (quest.target && quest.progress !== undefined) {
            // Multi-target quest
            let newProgress = quest.progress;
            
            // Special handling for unique targets
            if (quest.id === 'react_to_5_posts') {
              const eTags = event.tags.filter(tag => tag[0] === 'e');
              if (eTags.length > 0) {
                const targetEventId = eTags[0][1];
                if (!newQuestState.uniqueReactionTargets.has(targetEventId)) {
                  newQuestState.uniqueReactionTargets.add(targetEventId);
                  newProgress = newQuestState.uniqueReactionTargets.size;
                }
              }
            } else if (quest.id === 'repost_3_posts') {
              const eTags = event.tags.filter(tag => tag[0] === 'e');
              if (eTags.length > 0) {
                const targetEventId = eTags[0][1];
                if (!newQuestState.uniqueRepostTargets.has(targetEventId)) {
                  newQuestState.uniqueRepostTargets.add(targetEventId);
                  newProgress = newQuestState.uniqueRepostTargets.size;
                }
              }
            } else {
              newProgress = quest.progress + 1;
            }

            if (newProgress >= quest.target) {
              questCompleted = true;
              completedQuestName = quest.name;
              console.log(`🧬 Quest completed: ${quest.name} (${newProgress}/${quest.target})`);
              
              // Show toast notification for completed multi-target quest
              const message = getQuestCompletionMessage(quest.id, quest.name);
              toast({
                title: message.title,
                description: message.description,
                variant: "default",
              });
              
              return { ...quest, progress: newProgress, completed: true };
            } else {
              console.log(`🧬 Quest progress: ${quest.name} (${newProgress}/${quest.target})`);
              
              // Show progress toast for multi-target quests
              toast({
                title: "📈 Quest Progress!",
                description: `Progress on "${quest.name}": ${newProgress}/${quest.target} completed. Keep going!`,
                variant: "default",
              });
              
              return { ...quest, progress: newProgress };
            }
          } else {
            // Single completion quest
            questCompleted = true;
            completedQuestName = quest.name;
            console.log(`🧬 Quest completed: ${quest.name}`);
            
            // Show toast notification for completed single quest
            const message = getQuestCompletionMessage(quest.id, quest.name);
            toast({
              title: message.title,
              description: message.description,
              variant: "default",
            });
            
            return { ...quest, completed: true };
          }
        }

        return quest;
      });

      newQuestState.lastEventTime = Date.now();

      return {
        ...prevState,
        questState: newQuestState,
      };
    });

    // Publish quest confirmation if completed
    if (questCompleted && completedQuestName) {
      await publishQuestConfirmation(completedQuestName);
      
      // Check if all quests are completed (ready to evolve to adult)
      const allQuestsCompleted = state.questState.babyToAdultQuests.every(quest => quest.completed);
      if (allQuestsCompleted) {
        console.log('🎉 All baby to adult quests completed! Ready to evolve...');
        
        // Show toast notification for completing all quests
        toast({
          title: "🎊 All Quests Complete!",
          description: "Amazing! You've completed all evolution quests. Your Blobbi is ready to evolve to adult!",
          variant: "default",
        });
      }
    }
  }, [user, publishEvent, state.questStartTime, state.questState.questStartTime, state.questState.babyToAdultQuests, state.selectedBabyId, publishQuestConfirmation, toast, getQuestCompletionMessage]);

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

    console.log('🔄 Starting persistent metadata subscription (kind:31124)...');

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
              console.log(`📨 Metadata update received: ${event.id?.slice(0, 8)}...`);
              
              // Parse and update Blobbi data
              try {
                const blobbi = parseBlobbiFromStateEvent(event);
                if (blobbi) {
                  setState(prev => {
                    const updatedBlobbis = prev.blobbis.some(b => b.id === blobbi.id)
                      ? prev.blobbis.map(b => b.id === blobbi.id ? blobbi : b)
                      : [...prev.blobbis, blobbi];
                    
                    // Update baby Blobbis list for hashtag validation
                    const babyBlobbis = updatedBlobbis.filter(b => b.lifeStage === 'baby');
                    
                    // Update selected Blobbi if it was updated
                    const selectedBlobbi = prev.selectedBabyId 
                      ? updatedBlobbis.find(b => b.id === prev.selectedBabyId)
                      : undefined;
                    
                    return {
                      ...prev,
                      blobbis: updatedBlobbis,
                      questState: {
                        ...prev.questState,
                        babyBlobbis,
                        selectedBlobbi: selectedBlobbi,
                      },
                    };
                  });
                  
                  // Check for *_confirmed tags to mark quests as completed
                  // ONLY if this Blobbi is the selected one
                  setState(prevInner => {
                    if (blobbi.id === prevInner.selectedBabyId) {
                      const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1] === 'true');
                      if (confirmedTags.length > 0) {
                        console.log(`✅ Found confirmed quest tags for selected Blobbi ${blobbi.name}:`, confirmedTags);
                        
                        const newQuestState = { ...prevInner.questState };
                        
                        // Mark baby to adult quests as completed based on confirmed tags
                        newQuestState.babyToAdultQuests = newQuestState.babyToAdultQuests.map(quest => {
                          const confirmationTag = `${quest.id}_confirmed`;
                          const isConfirmed = confirmedTags.some(tag => tag[0] === confirmationTag);
                          if (isConfirmed && !quest.completed) {
                            console.log(`🧬 Marking quest as completed from confirmed tag: ${quest.name}`);
                            return { ...quest, completed: true };
                          }
                          return quest;
                        });
                        
                        return {
                          ...prevInner,
                          questState: newQuestState,
                        };
                      }
                    }
                    return prevInner;
                  });
                }
              } catch (error) {
                console.warn('Failed to parse updated Blobbi event:', error);
              }
            } else if (msg[0] === 'EOSE') {
              console.log('📡 Metadata subscription EOSE');
            } else if (msg[0] === 'CLOSED') {
              console.log(`🔌 Metadata subscription closed: ${msg[1] || 'unknown reason'}`);
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

      console.log('✅ Persistent metadata subscription established');
    } catch (error) {
      console.error('❌ Failed to start metadata subscription:', error);
      setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
    }
  }, [user, nostr, state.metadataSubscriptionActive]);

  // Start #Blobbi hashtag tracking subscription
  const startBlobbiHashtagSubscription = useCallback(async () => {
    if (!user || !nostr || state.blobbiHashtagSubscriptionActive) return;

    console.log('🏷️ Starting #Blobbi hashtag tracking subscription...');

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
              console.log('📡 Blobbi hashtag subscription EOSE');
            } else if (msg[0] === 'CLOSED') {
              console.log(`🔌 Blobbi hashtag subscription closed: ${msg[1] || 'unknown reason'}`);
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

      console.log('✅ Blobbi hashtag tracking subscription established');
    } catch (error) {
      console.error('❌ Failed to start Blobbi hashtag subscription:', error);
      setState(prev => ({ ...prev, blobbiHashtagSubscriptionActive: false }));
    }
  }, [user, nostr, state.blobbiHashtagSubscriptionActive, processBlobbiHashtagEvent]);

  // Start quest tracking subscription (only after user clicks "Start Listening")
  const startQuestSubscription = useCallback(async (selectedBabyId?: string, sinceTimestamp?: number) => {
    if (!user || !nostr || state.questSubscriptionActive) return;

    // If no baby is selected, don't start quest subscription
    if (!selectedBabyId) {
      console.log('⚠️ No baby selected, skipping quest subscription');
      return;
    }

    console.log('🎯 Starting persistent quest tracking subscription...');
    console.log(`🐣 Selected baby: ${selectedBabyId}`);
    console.log(`⏰ Since timestamp: ${sinceTimestamp ? new Date(sinceTimestamp).toISOString() : 'Not specified'}`);

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

      // Add since filter if timestamp is provided (when "Start Listening" is clicked)
      if (sinceTimestamp) {
        const sinceSeconds = Math.floor(sinceTimestamp / 1000); // Convert to seconds
        filters[0].since = sinceSeconds;
        filters[1].since = sinceSeconds;
      }

      const subscriptionIterable = nostr.req(filters);

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
              console.log(`📨 Quest event received: kind ${event.kind} from ${event.pubkey.slice(0, 8)}...`);
              await processQuestEvent(event);
            } else if (msg[0] === 'EOSE') {
              console.log('📡 Quest subscription EOSE');
            } else if (msg[0] === 'CLOSED') {
              console.log(`🔌 Quest subscription closed: ${msg[1] || 'unknown reason'}`);
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
          setState(prev => ({ 
            ...prev, 
            questSubscriptionActive: false,
            questState: { ...prev.questState, isListening: false },
          }));
        }
      })();

      // Store cleanup function
      questCleanupRef.current = () => {
        setState(prev => ({ 
          ...prev, 
          questSubscriptionActive: false,
          questState: { ...prev.questState, isListening: false },
        }));
      };

      console.log('✅ Persistent quest tracking subscription established');
    } catch (error) {
      console.error('❌ Failed to start quest subscription:', error);
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

    console.log('🔍 Fetching Blobbi metadata (kind:31124)...');
    
    setState(prev => ({ ...prev, isLoadingBlobbis: true, blobbiError: null }));

    try {
      const signal = AbortSignal.timeout(10000);
      const events = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
      }], { signal });

      console.log(`✅ Found ${events.length} Blobbi metadata events`);

      // Parse Blobbi events
      const blobbis: Blobbi[] = [];
      
      for (const event of events) {
        try {
          const blobbi = parseBlobbiFromStateEvent(event);
          if (blobbi) {
            blobbis.push(blobbi);
          }
        } catch (error) {
          console.warn('Failed to parse Blobbi event:', error);
        }
      }

      setState(prev => {
        // Update baby Blobbis list for hashtag validation
        const babyBlobbis = blobbis.filter(b => b.lifeStage === 'baby');
        
        // If we have a selected baby, load its quest confirmations
        let updatedQuests = [...prev.questState.babyToAdultQuests];
        let selectedBlobbi: Blobbi | undefined;
        
        if (prev.selectedBabyId) {
          selectedBlobbi = blobbis.find(b => b.id === prev.selectedBabyId);
          
          const selectedBlobbiEvent = events.find(event => {
            const blobbi = parseBlobbiFromStateEvent(event);
            return blobbi && blobbi.id === prev.selectedBabyId;
          });
          
          if (selectedBlobbiEvent) {
            const confirmedTags = selectedBlobbiEvent.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1] === 'true');
            
            updatedQuests = updatedQuests.map(quest => {
              const confirmationTag = `${quest.id}_confirmed`;
              const isConfirmed = confirmedTags.some(tag => tag[0] === confirmationTag);
              if (isConfirmed && !quest.completed) {
                console.log(`🧬 Marking quest as completed from initial load for ${prev.selectedBabyId}: ${quest.name}`);
                return { ...quest, completed: true };
              }
              return quest;
            });
          }
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
          },
        };
      });

      // Start persistent metadata subscription
      await startMetadataSubscription();
      
      // Start #Blobbi hashtag tracking
      await startBlobbiHashtagSubscription();

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
      console.log('🚀 Initializing Blobbi Quest System...');
      isInitializedRef.current = true;
      fetchBlobbiMetadata();
    }

    return () => {
      // Cleanup subscriptions on unmount
      if (metadataCleanupRef.current) {
        metadataCleanupRef.current();
      }
      if (questCleanupRef.current) {
        questCleanupRef.current();
      }
      if (blobbiHashtagCleanupRef.current) {
        blobbiHashtagCleanupRef.current();
      }
    };
  }, [user, fetchBlobbiMetadata]);

  // Calculate progress for baby to adult quests
  const getQuestProgress = useCallback(() => {
    const completed = state.questState.babyToAdultQuests.filter(quest => quest.completed).length;
    const total = state.questState.babyToAdultQuests.length;
    
    return {
      completed,
      total,
      percentage: (completed / total) * 100,
    };
  }, [state.questState]);

  // Check if a specific baby blobbi is ready to evolve to adult
  const isBabyReadyToEvolve = useCallback((blobbi: Blobbi) => {
    // Only babies can evolve to adult
    if (blobbi.lifeStage !== 'baby') return false;
    
    // Check if all baby to adult quests are completed
    const questsCompleted = state.questState.babyToAdultQuests.filter(quest => quest.completed).length;
    const questsTotal = state.questState.babyToAdultQuests.length;
    
    return questsCompleted === questsTotal;
  }, [state.questState.babyToAdultQuests]);

  // Select a baby for quest tracking
  const selectBaby = useCallback(async (babyId: string | null) => {
    // If selecting a different baby, reset quest state and reload
    if (babyId !== state.selectedBabyId) {
      // Stop current quest tracking if active
      if (state.questSubscriptionActive && questCleanupRef.current) {
        questCleanupRef.current();
        questCleanupRef.current = null;
      }
      
      // Reset quest state
      setState(prev => ({
        ...prev,
        selectedBabyId: babyId,
        questStartTime: null,
        questSubscriptionActive: false,
        questState: {
          ...prev.questState,
          babyToAdultQuests: [...BABY_TO_ADULT_QUESTS], // Reset to initial state
          isListening: false,
          uniqueReactionTargets: new Set(),
          uniqueRepostTargets: new Set(),
        },
      }));
      
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
              const updatedQuests = prev.questState.babyToAdultQuests.map(quest => {
                const confirmationTag = `${quest.id}_confirmed`;
                const isConfirmed = confirmedTags.some(tag => tag[0] === confirmationTag);
                if (isConfirmed) {
                  console.log(`🧬 Loading confirmed quest for ${babyId}: ${quest.name}`);
                  return { ...quest, completed: true };
                }
                return quest;
              });
              
              const selectedBlobbi = prev.blobbis.find(b => b.id === babyId);
              
              return {
                ...prev,
                questState: {
                  ...prev.questState,
                  babyToAdultQuests: updatedQuests,
                  selectedBlobbi: selectedBlobbi,
                },
              };
            });
          }
        } catch (error) {
          console.error('Failed to load quest confirmations for selected baby:', error);
        }
      }
    } else {
      // Just update the selection
      setState(prev => {
        const selectedBlobbi = babyId ? prev.blobbis.find(b => b.id === babyId) : undefined;
        return {
          ...prev,
          selectedBabyId: babyId,
          questState: {
            ...prev.questState,
            selectedBlobbi: selectedBlobbi,
          },
        };
      });
    }
  }, [state.selectedBabyId, state.questSubscriptionActive, user, nostr]);

  // Start quest tracking for selected baby
  const startQuestTracking = useCallback(async () => {
    if (!state.selectedBabyId) {
      console.warn('⚠️ No baby selected for quest tracking');
      return;
    }

    const now = Date.now();
    setState(prev => ({ ...prev, questStartTime: now }));
    
    // Start quest subscription with since timestamp
    await startQuestSubscription(state.selectedBabyId, now);
  }, [state.selectedBabyId, startQuestSubscription]);

  // Stop quest tracking (cleanup)
  const stopQuestTrackingRef = useRef<() => void>();
  
  stopQuestTrackingRef.current = () => {
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
    
    // Subscription status
    metadataSubscriptionActive: state.metadataSubscriptionActive,
    questSubscriptionActive: state.questSubscriptionActive,
    blobbiHashtagSubscriptionActive: state.blobbiHashtagSubscriptionActive,
    isListening: state.questState.isListening,
    
    // Baby selection and quest tracking
    selectedBabyId: state.selectedBabyId,
    questStartTime: state.questStartTime,
    selectBaby,
    startQuestTracking,
    stopQuestTracking,
    
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