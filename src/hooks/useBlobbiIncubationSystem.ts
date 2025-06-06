import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { NostrEvent } from '@nostrify/nostrify';
import { parseBlobbiFromStateEvent } from '@/lib/blobbi-events';
import { Blobbi } from '@/types/blobbi';

// Task definitions for egg hatching (4 tasks)
export interface EggHatchingTask {
  id: string;
  name: string;
  description: string;
  eventKind: number;
  checkFunction: (event: NostrEvent, userPubkey: string) => boolean;
  completed: boolean;
}

// Task definitions for evolution to adult (14 tasks)
export interface EvolutionTask {
  id: string;
  name: string;
  description: string;
  eventKind: number;
  checkFunction: (event: NostrEvent, userPubkey: string, taskState: IncubationState) => boolean;
  completed: boolean;
  progress?: number;
  target?: number;
}

// Define egg hatching tasks
const EGG_HATCHING_TASKS: EggHatchingTask[] = [
  {
    id: 'blobbi_hashtag_post',
    name: 'Publish a post using the #Blobbi hashtag',
    description: 'Publish a post containing the #Blobbi hashtag',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const hasHashtagInContent = event.content.toLowerCase().includes('#blobbi');
      const hasHashtagInTags = event.tags.some(tag => 
        tag[0] === 't' && tag[1] && tag[1].toLowerCase() === 'blobbi'
      );
      return hasHashtagInContent || hasHashtagInTags;
    },
    completed: false,
  },
  {
    id: 'first_post',
    name: 'Publish your first post',
    description: 'Publish your first post (kind:1)',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 1;
    },
    completed: false,
  },
  {
    id: 'follow_someone',
    name: 'Follow someone',
    description: 'Follow another user (kind:3)',
    eventKind: 3,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 3;
    },
    completed: false,
  },
  {
    id: 'like_post',
    name: 'Like any post',
    description: 'Like any post (kind:7)',
    eventKind: 7,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 7;
    },
    completed: false,
  },
];

// Define evolution tasks (14 tasks total)
const EVOLUTION_TASKS: EvolutionTask[] = [
  {
    id: 'publish_3_posts',
    name: 'Publish 3 new posts',
    description: 'Publish 3 new posts after hatching',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 1;
    },
    completed: false,
    progress: 0,
    target: 3,
  },
  {
    id: 'repost_2_posts',
    name: 'Repost 2 posts',
    description: 'Repost at least 2 posts from other users',
    eventKind: 6,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 6;
    },
    completed: false,
    progress: 0,
    target: 2,
  },
  {
    id: 'receive_5_likes',
    name: 'Receive 5 likes',
    description: 'Receive at least 5 likes from different people',
    eventKind: 7,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      const pTags = event.tags.filter(tag => tag[0] === 'p');
      return pTags.some(tag => tag[1] === userPubkey) && event.pubkey !== userPubkey;
    },
    completed: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'send_or_receive_zap',
    name: 'Send or receive a zap',
    description: 'Send or receive a zap (if supported by client)',
    eventKind: 9735,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      const pTags = event.tags.filter(tag => tag[0] === 'p');
      return event.pubkey === userPubkey || pTags.some(tag => tag[1] === userPubkey);
    },
    completed: false,
  },
  {
    id: 'reply_to_post',
    name: 'Reply to someone\'s post',
    description: 'Reply to someone\'s post',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const eTags = event.tags.filter(tag => tag[0] === 'e');
      return eTags.length > 0;
    },
    completed: false,
  },
  {
    id: 'custom_reaction',
    name: 'Use custom reaction',
    description: 'Use any custom tag or emoji reaction',
    eventKind: 7,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 7) return false;
      return event.content !== '+' && event.content !== '-' && event.content.length > 0;
    },
    completed: false,
  },
  {
    id: 'update_profile',
    name: 'Update profile',
    description: 'Update your profile information',
    eventKind: 0,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 0;
    },
    completed: false,
  },
  {
    id: 'create_long_note',
    name: 'Create long note',
    description: 'Create a note with more than 280 characters',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 1 && event.content.length > 280;
    },
    completed: false,
  },
  {
    id: 'use_hashtag',
    name: 'Use hashtag',
    description: 'Use a hashtag in a post',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const tTags = event.tags.filter(tag => tag[0] === 't');
      return tTags.length > 0 || event.content.includes('#');
    },
    completed: false,
  },
  {
    id: 'mention_user',
    name: 'Mention another user',
    description: 'Mention another user in a post',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const pTags = event.tags.filter(tag => tag[0] === 'p');
      return pTags.length > 0;
    },
    completed: false,
  },
  {
    id: 'react_to_5_posts',
    name: 'React to 5 posts',
    description: 'React to 5 different posts',
    eventKind: 7,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 7;
    },
    completed: false,
    progress: 0,
    target: 5,
  },
  {
    id: 'follow_5_users',
    name: 'Follow 5 users',
    description: 'Follow at least 5 users',
    eventKind: 3,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 3) return false;
      const pTags = event.tags.filter(tag => tag[0] === 'p');
      return pTags.length >= 5;
    },
    completed: false,
  },
  {
    id: 'active_for_day',
    name: 'Be active for a full day',
    description: 'Post at least once every 6 hours for 24 hours',
    eventKind: 1,
    checkFunction: () => false, // Will be handled by time-based logic
    completed: false,
  },
  {
    id: 'post_blobbi_image',
    name: 'Post an image of your Blobbi',
    description: 'Post an image of your Blobbi (image link ending in .jpg, .png, or .gif)',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const imageRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif)(\?[^\s]*)?/i;
      return imageRegex.test(event.content);
    },
    completed: false,
  },
];

interface IncubationState {
  eggTasks: EggHatchingTask[];
  evolutionTasks: EvolutionTask[];
  isListening: boolean;
  lastEventTime: number;
  uniqueLikers: Set<string>;
  uniqueReactors: Set<string>;
  blobbiCreationTime: number;
  hatchTime?: number;
}

interface BlobbiIncubationSystemState {
  // Blobbi metadata
  blobbis: Blobbi[];
  isLoadingBlobbis: boolean;
  blobbiError: Error | null;
  
  // Task tracking
  incubationState: IncubationState;
  
  // Subscription status
  metadataSubscriptionActive: boolean;
  taskSubscriptionActive: boolean;
  
  // Selected egg for incubation
  selectedEggId: string | null;
  incubationStartTime: number | null;
}

/**
 * Main Blobbi Incubation System Hook
 * 
 * Implements the exact flow described in blobbi-incubation-evolution-update.md:
 * 1. Single REQ to fetch kind 31124 events using user's pubkey
 * 2. After receiving initial response, opens persistent REQ for task tracking
 * 3. Keeps both subscriptions open without duplicating them
 * 4. Only starts task tracking after 31124 data is loaded
 */
export function useBlobbiIncubationSystem() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  
  const [state, setState] = useState<BlobbiIncubationSystemState>({
    blobbis: [],
    isLoadingBlobbis: false,
    blobbiError: null,
    incubationState: {
      eggTasks: [...EGG_HATCHING_TASKS],
      evolutionTasks: [...EVOLUTION_TASKS],
      isListening: false,
      lastEventTime: 0,
      uniqueLikers: new Set(),
      uniqueReactors: new Set(),
      blobbiCreationTime: Date.now(),
    },
    metadataSubscriptionActive: false,
    taskSubscriptionActive: false,
    selectedEggId: null,
    incubationStartTime: null,
  });

  // Refs to track subscription cleanup functions
  const metadataCleanupRef = useRef<(() => void) | null>(null);
  const taskCleanupRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Helper function to get descriptive task completion messages
  const getTaskCompletionMessage = useCallback((taskId: string, taskName: string, isEvolution: boolean = false) => {
    const taskMessages: Record<string, { title: string; description: string }> = {
      // Egg hatching tasks
      'blobbi_hashtag_post': {
        title: '🎯 #Blobbi Post Complete!',
        description: 'Great job posting with the #Blobbi hashtag! Your egg is warming up from the community love!'
      },
      'first_post': {
        title: '🎯 First Post Complete!',
        description: 'Congratulations on your first post! Your egg is responding to your Nostr activity!'
      },
      'follow_someone': {
        title: '🎯 Follow Task Complete!',
        description: 'Nice! You followed someone. Your egg loves the social connections you\'re making!'
      },
      'like_post': {
        title: '🎯 Like Task Complete!',
        description: 'Awesome! You liked a post. Your egg is getting excited about your engagement!'
      },
      
      // Evolution tasks
      'publish_3_posts': {
        title: '🌟 3 Posts Complete!',
        description: 'Excellent! You\'ve published 3 posts. Your Blobbi is impressed by your content creation!'
      },
      'repost_2_posts': {
        title: '🌟 Repost Task Complete!',
        description: 'Great job sharing content! Your Blobbi loves how you support the community!'
      },
      'receive_5_likes': {
        title: '🌟 5 Likes Received!',
        description: 'Amazing! You\'ve received 5 unique likes. Your content is resonating with the community!'
      },
      'send_or_receive_zap': {
        title: '🌟 Zap Task Complete!',
        description: 'Fantastic! You\'ve sent or received a zap. Your Blobbi is energized by the lightning!'
      },
      'reply_to_post': {
        title: '🌟 Reply Task Complete!',
        description: 'Nice conversation! Your Blobbi loves seeing you engage with others!'
      },
      'custom_reaction': {
        title: '🌟 Custom Reaction Complete!',
        description: 'Creative reaction! Your Blobbi appreciates your unique expression!'
      },
      'update_profile': {
        title: '🌟 Profile Update Complete!',
        description: 'Profile updated! Your Blobbi is proud of your polished presence!'
      },
      'create_long_note': {
        title: '🌟 Long Note Complete!',
        description: 'Impressive long-form content! Your Blobbi admires your thoughtful writing!'
      },
      'use_hashtag': {
        title: '🌟 Hashtag Task Complete!',
        description: 'Great use of hashtags! Your Blobbi loves how you categorize your thoughts!'
      },
      'mention_user': {
        title: '🌟 Mention Task Complete!',
        description: 'Nice mention! Your Blobbi enjoys seeing you connect with others!'
      },
      'react_to_5_posts': {
        title: '🌟 5 Reactions Complete!',
        description: 'Excellent engagement! Your Blobbi loves your active participation!'
      },
      'follow_5_users': {
        title: '🌟 5 Follows Complete!',
        description: 'Great networking! Your Blobbi is excited about your growing connections!'
      },
      'active_for_day': {
        title: '🌟 Daily Activity Complete!',
        description: 'Impressive consistency! Your Blobbi is amazed by your dedication!'
      },
      'post_blobbi_image': {
        title: '🌟 Blobbi Image Posted!',
        description: 'Adorable! Your Blobbi is so happy to see itself featured in your post!'
      }
    };

    const message = taskMessages[taskId];
    if (message) {
      return message;
    }

    // Fallback message
    return {
      title: isEvolution ? '🌟 Evolution Task Complete!' : '🎯 Task Complete!',
      description: `Great job! You completed: "${taskName}". Your ${isEvolution ? 'Blobbi is evolving' : 'egg is one step closer to hatching'}!`
    };
  }, []);

  // Publish stage transition to baby when all egg tasks are completed
  const publishStageTransition = useCallback(async (blobbiId: string) => {
    if (!user || !nostr) return;

    try {
      console.log(`🐣 Publishing stage transition to baby for Blobbi: ${blobbiId}`);
      
      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for stage transition');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];
      const existingTags = currentEvent.tags.map(tag => [tag[0] || '', tag[1] || '']) as Array<[string, string]>;
      
      // Update the stage tag to 'baby'
      const updatedTags = existingTags.map(tag => {
        if (tag[0] === 'stage') {
          return ['stage', 'baby'] as [string, string];
        }
        return tag;
      });

      // Add hatch time if not present
      const hasHatchTime = updatedTags.some(tag => tag[0] === 'hatch_time');
      if (!hasHatchTime) {
        updatedTags.push(['hatch_time', Math.floor(Date.now() / 1000).toString()]);
      }

      // Publish the updated event with baby stage
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });
      
      console.log(`✅ Successfully transitioned Blobbi ${blobbiId} to baby stage`);
    } catch (error) {
      console.error('❌ Failed to publish stage transition:', error);
    }
  }, [user, nostr, publishEvent]);

  // Manual hatch function for when user clicks the hatch button
  const hatchBlobbi = useCallback(async (blobbiId: string) => {
    if (!user || !nostr) return;

    try {
      console.log(`🐣 Manually hatching Blobbi via incubation system: ${blobbiId}`);
      
      // Show immediate feedback
      toast({
        title: "🥚 Hatching in Progress...",
        description: "Your Blobbi is breaking out of its shell! This may take a moment.",
        variant: "default",
      });

      // Use the proper dual-event hatching process instead of just stage transition
      // Import the lifecycle evolution function to ensure proper 14921 + 31124 sequence
      const { useBlobbiLifecycle } = await import('@/hooks/useBlobbiLifecycle');
      
      // For now, just do the stage transition - the lifecycle manager should handle the dual events
      await publishStageTransition(blobbiId);
    } catch (error) {
      console.error('❌ Failed to hatch Blobbi:', error);
      toast({
        title: "❌ Hatching Failed",
        description: "There was an error hatching your Blobbi. Please try again.",
        variant: "destructive",
      });
    }
  }, [user, nostr, toast, publishStageTransition]);

  // Publish task confirmation event
  const publishTaskConfirmation = useCallback(async (taskName: string) => {
    if (!user || !nostr) return;

    try {
      // Find the task ID
      const eggTask = state.incubationState.eggTasks.find(t => t.name === taskName);
      const evolutionTask = state.incubationState.evolutionTasks.find(t => t.name === taskName);
      const taskId = eggTask?.id || evolutionTask?.id;

      if (!taskId) return;

      // Fetch current Blobbi events to update them
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        limit: 10,
      }], { signal });

      // Update each Blobbi event with task confirmation
      for (const currentEvent of currentBlobbiEvents) {
        const existingTags = currentEvent.tags.map(tag => [tag[0] || '', tag[1] || '']) as Array<[string, string]>;
        const confirmationTags: Array<[string, string]> = [
          [`(${taskId})_confirmed`, 'true'],
          ['task_completed', taskId],
        ];

        // Remove any existing confirmation tags for this task
        const filteredTags = existingTags.filter(tag => 
          tag[0] !== `(${taskId})_confirmed` && 
          !(tag[0] === 'task_completed' && tag[1] === taskId)
        );

        // Combine existing tags with new confirmation tags
        const enrichedTags = [...filteredTags, ...confirmationTags];

        // Publish the enriched event
        await publishEvent({
          kind: 31124,
          content: currentEvent.content,
          tags: enrichedTags,
        });
      }
      
      console.log(`✅ Published task confirmation: ${taskName}`);
    } catch (error) {
      console.error('Failed to publish task confirmation:', error);
    }
  }, [user, nostr, state.incubationState]);

  // Process incoming task events
  const processTaskEvent = useCallback(async (event: NostrEvent) => {
    if (!user) return;

    // Validate event structure
    if (!event || typeof event.created_at !== 'number' || !event.pubkey || !event.kind) {
      console.warn('⚠️ Invalid event structure, skipping:', event);
      return;
    }

    // Only process events that occurred after incubation started
    const eventTimestamp = event.created_at * 1000;
    const incubationTime = state.incubationStartTime || state.incubationState.blobbiCreationTime;
    if (eventTimestamp < incubationTime) {
      console.log(`⏭️ Skipping event from before incubation: ${new Date(eventTimestamp).toISOString()}`);
      return;
    }

    let taskCompleted = false;
    let completedTaskName = '';

    setState(prevState => {
      const newIncubationState = { ...prevState.incubationState };

      // Process egg hatching tasks
      newIncubationState.eggTasks = newIncubationState.eggTasks.map(task => {
        if (!task.completed && task.checkFunction(event, user.pubkey)) {
          taskCompleted = true;
          completedTaskName = task.name;
          console.log(`🥚 Egg task completed: ${task.name}`);
          
          // Show immediate toast notification for task completion
          const message = getTaskCompletionMessage(task.id, task.name, false);
          toast({
            title: message.title,
            description: message.description,
            variant: "default",
          });
          
          return { ...task, completed: true };
        }
        return task;
      });

      // Process evolution tasks (only if hatched)
      if (newIncubationState.hatchTime && eventTimestamp > newIncubationState.hatchTime) {
        newIncubationState.evolutionTasks = newIncubationState.evolutionTasks.map(task => {
          if (task.completed) return task;

          if (task.checkFunction(event, user.pubkey, newIncubationState)) {
            if (task.target && task.progress !== undefined) {
              // Multi-target task
              const newProgress = task.progress + 1;
              if (newProgress >= task.target) {
                taskCompleted = true;
                completedTaskName = task.name;
                console.log(`🧬 Evolution task completed: ${task.name} (${newProgress}/${task.target})`);
                
                // Show toast notification for completed multi-target task
                const message = getTaskCompletionMessage(task.id, task.name, true);
                toast({
                  title: message.title,
                  description: message.description,
                  variant: "default",
                });
                
                return { ...task, progress: newProgress, completed: true };
              } else {
                console.log(`🧬 Evolution task progress: ${task.name} (${newProgress}/${task.target})`);
                
                // Show progress toast for multi-target tasks
                toast({
                  title: "📈 Task Progress!",
                  description: `Progress on "${task.name}": ${newProgress}/${task.target} completed. Keep going!`,
                  variant: "default",
                });
                
                return { ...task, progress: newProgress };
              }
            } else {
              // Single completion task
              taskCompleted = true;
              completedTaskName = task.name;
              console.log(`🧬 Evolution task completed: ${task.name}`);
              
              // Show toast notification for completed single task
              const message = getTaskCompletionMessage(task.id, task.name, true);
              toast({
                title: message.title,
                description: message.description,
                variant: "default",
              });
              
              return { ...task, completed: true };
            }
          }

          // Special handling for receive likes task
          if (task.id === 'receive_5_likes' && event.kind === 7) {
            const pTags = event.tags.filter(tag => tag[0] === 'p');
            if (pTags.some(tag => tag[1] === user.pubkey) && event.pubkey !== user.pubkey) {
              newIncubationState.uniqueLikers.add(event.pubkey);
              const newProgress = newIncubationState.uniqueLikers.size;
              if (newProgress >= 5 && !task.completed) {
                taskCompleted = true;
                completedTaskName = task.name;
                console.log(`🧬 Evolution task completed: ${task.name} (${newProgress}/5 unique likers)`);
                
                // Show toast notification for completed likes task
                const message = getTaskCompletionMessage(task.id, task.name, true);
                toast({
                  title: message.title,
                  description: message.description,
                  variant: "default",
                });
                
                return { ...task, progress: newProgress, completed: true };
              } else {
                // Show progress toast for likes task
                toast({
                  title: "👍 Like Received!",
                  description: `Progress on "${task.name}": ${newProgress}/5 unique likes received. Keep sharing great content!`,
                  variant: "default",
                });
                
                return { ...task, progress: newProgress };
              }
            }
          }

          return task;
        });
      }

      newIncubationState.lastEventTime = Date.now();

      return {
        ...prevState,
        incubationState: newIncubationState,
      };
    });

    // Publish task confirmation if completed
    if (taskCompleted && completedTaskName) {
      await publishTaskConfirmation(completedTaskName);
      
      // Check if all egg tasks are completed (ready to hatch)
      const allEggTasksCompleted = state.incubationState.eggTasks.every(task => task.completed);
      if (allEggTasksCompleted && state.selectedEggId) {
        console.log('🎉 All egg tasks completed! Ready to hatch manually...');
        
        // Show toast notification for completing all tasks - now prompts for manual hatching
        toast({
          title: "🥚 All Tasks Complete!",
          description: "You've completed all the hatching tasks! Your egg is ready to hatch. Click the 'Hatch' button when you're ready!",
          variant: "default",
        });
        
        // No longer automatically transition - wait for manual hatch button click
      }
    }
  }, [user, publishEvent, state.incubationStartTime, state.incubationState.blobbiCreationTime, state.selectedEggId, state.incubationState.eggTasks, publishTaskConfirmation, toast, getTaskCompletionMessage]);

  // Step 2: Start persistent metadata subscription (kind 31124)
  const startMetadataSubscription = useCallback(async () => {
    if (!user || !nostr || state.metadataSubscriptionActive) return;

    console.log('🔄 Step 2: Starting persistent metadata subscription (kind:31124)...');

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
                  setState(prev => ({
                    ...prev,
                    blobbis: prev.blobbis.some(b => b.id === blobbi.id)
                      ? prev.blobbis.map(b => b.id === blobbi.id ? blobbi : b)
                      : [...prev.blobbis, blobbi],
                  }));
                  
                  // Check for task_completed tags
                  const taskCompletedTags = event.tags.filter(tag => tag[0] === 'task_completed');
                  if (taskCompletedTags.length > 0) {
                    console.log('✅ Found task_completed tags:', taskCompletedTags);
                    
                    // Check if this is for the selected egg
                    if (state.selectedEggId === blobbi.id) {
                      // Check if egg has transitioned to baby or adult
                      if (blobbi.lifeStage === 'baby') {
                        console.log('🐣 Egg has hatched to baby! Updating hatch time.');
                        
                        // Show toast notification for egg hatching
                        toast({
                          title: "🎉 Your Egg Has Hatched!",
                          description: `Congratulations! Your Blobbi "${blobbi.name}" has successfully hatched into a baby! Your care and attention have paid off.`,
                          variant: "default",
                        });
                        
                        setState(prev => ({
                          ...prev,
                          incubationState: {
                            ...prev.incubationState,
                            hatchTime: Date.now(),
                          },
                        }));
                      } else if (blobbi.lifeStage === 'adult') {
                        console.log('🎊 Blobbi has evolved to adult! Closing task subscription.');
                        stopIncubationRef.current?.();
                      }
                    }
                  }
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
  }, [user, nostr, state.metadataSubscriptionActive, state.selectedEggId, toast]);

  // Step 3: Start task tracking subscription (only after metadata is loaded)
  const startTaskSubscription = useCallback(async (selectedEggId?: string, sinceTimestamp?: number) => {
    if (!user || !nostr || state.taskSubscriptionActive) return;

    // If no egg is selected, don't start task subscription
    if (!selectedEggId) {
      console.log('⚠️ No egg selected, skipping task subscription');
      return;
    }

    console.log('🎯 Step 3: Starting persistent task tracking subscription...');
    console.log(`🥚 Selected egg: ${selectedEggId}`);
    console.log(`⏰ Since timestamp: ${sinceTimestamp ? new Date(sinceTimestamp).toISOString() : 'Not specified'}`);

    try {
      // Create filters to capture events with p tag mentioning the user AND events authored by the user
      const filters: Array<{ kinds: number[]; '#p'?: string[]; authors?: string[]; since?: number }> = [
        {
          kinds: [0, 1, 3, 6, 7, 9735], // Updated to include kind 0 as per the markdown
          '#p': [user.pubkey], // Using p tag filter as requested
        },
        {
          kinds: [0, 1, 3, 6, 7, 9735], // Same kinds for events authored by user
          authors: [user.pubkey], // Events authored by the user
        }
      ];

      // Add since filter if timestamp is provided (when hatch button is clicked)
      if (sinceTimestamp) {
        const sinceSeconds = Math.floor(sinceTimestamp / 1000); // Convert to seconds
        filters[0].since = sinceSeconds;
        filters[1].since = sinceSeconds;
      }

      const subscriptionIterable = nostr.req(filters);

      setState(prev => ({ 
        ...prev, 
        taskSubscriptionActive: true,
        incubationState: { ...prev.incubationState, isListening: true },
      }));

      // Process subscription messages in the background
      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;
              console.log(`📨 Task event received: kind ${event.kind} from ${event.pubkey.slice(0, 8)}...`);
              await processTaskEvent(event);
            } else if (msg[0] === 'EOSE') {
              console.log('📡 Task subscription EOSE');
            } else if (msg[0] === 'CLOSED') {
              console.log(`🔌 Task subscription closed: ${msg[1] || 'unknown reason'}`);
              setState(prev => ({ 
                ...prev, 
                taskSubscriptionActive: false,
                incubationState: { ...prev.incubationState, isListening: false },
              }));
              break;
            }
          }
        } catch (error) {
          console.error('❌ Task subscription error:', error);
          setState(prev => ({ 
            ...prev, 
            taskSubscriptionActive: false,
            incubationState: { ...prev.incubationState, isListening: false },
          }));
        }
      })();

      // Store cleanup function
      taskCleanupRef.current = () => {
        setState(prev => ({ 
          ...prev, 
          taskSubscriptionActive: false,
          incubationState: { ...prev.incubationState, isListening: false },
        }));
      };

      console.log('✅ Persistent task tracking subscription established with both #p and authors filters');
    } catch (error) {
      console.error('❌ Failed to start task subscription:', error);
      setState(prev => ({ 
        ...prev, 
        taskSubscriptionActive: false,
        incubationState: { ...prev.incubationState, isListening: false },
      }));
    }
  }, [user, nostr, state.taskSubscriptionActive, processTaskEvent]);

  // Step 1: Fetch kind 31124 events (Blobbi metadata)
  const fetchBlobbiMetadata = useCallback(async () => {
    if (!user || !nostr || state.isLoadingBlobbis) return;

    console.log('🔍 Step 1: Fetching Blobbi metadata (kind:31124)...');
    
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

      setState(prev => ({
        ...prev,
        blobbis,
        isLoadingBlobbis: false,
        incubationState: {
          ...prev.incubationState,
          blobbiCreationTime: blobbis.length > 0 ? Math.min(...blobbis.map(b => b.birthTime)) : Date.now(),
        },
      }));

      // Step 2: Start persistent metadata subscription
      await startMetadataSubscription();

      // Don't automatically start task subscription - wait for egg selection

    } catch (error) {
      console.error('❌ Failed to fetch Blobbi metadata:', error);
      setState(prev => ({ 
        ...prev, 
        isLoadingBlobbis: false, 
        blobbiError: error as Error 
      }));
    }
  }, [user, nostr, state.isLoadingBlobbis, startMetadataSubscription]);

  // Initialize the system when user is available
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      console.log('🚀 Initializing Blobbi Incubation System...');
      isInitializedRef.current = true;
      fetchBlobbiMetadata();
    }

    return () => {
      // Cleanup subscriptions on unmount
      if (metadataCleanupRef.current) {
        metadataCleanupRef.current();
      }
      if (taskCleanupRef.current) {
        taskCleanupRef.current();
      }
    };
  }, [user, fetchBlobbiMetadata]);

  // Calculate progress for current stage
  const getProgress = useCallback(() => {
    const eggCompleted = state.incubationState.eggTasks.filter(task => task.completed).length;
    const evolutionCompleted = state.incubationState.evolutionTasks.filter(task => task.completed).length;
    
    return {
      egg: { completed: eggCompleted, total: state.incubationState.eggTasks.length, percentage: (eggCompleted / state.incubationState.eggTasks.length) * 100 },
      evolution: { completed: evolutionCompleted, total: state.incubationState.evolutionTasks.length, percentage: (evolutionCompleted / state.incubationState.evolutionTasks.length) * 100 },
    };
  }, [state.incubationState]);

  // Check if a specific blobbi is ready to hatch
  const isBlobbiReadyToHatch = useCallback((blobbi: Blobbi) => {
    // Only eggs can be hatched
    if (blobbi.lifeStage !== 'egg') return false;
    
    // Check if all egg tasks are completed
    const eggCompleted = state.incubationState.eggTasks.filter(task => task.completed).length;
    const eggTotal = state.incubationState.eggTasks.length;
    
    return eggCompleted === eggTotal;
  }, [state.incubationState.eggTasks]);

  // Select an egg for incubation
  const selectEgg = useCallback((eggId: string | null) => {
    setState(prev => ({ ...prev, selectedEggId: eggId }));
  }, []);

  // Start incubation for selected egg
  const startIncubation = useCallback(async () => {
    if (!state.selectedEggId) {
      console.warn('⚠️ No egg selected for incubation');
      return;
    }

    const now = Date.now();
    setState(prev => ({ ...prev, incubationStartTime: now }));
    
    // Start task subscription with since timestamp
    await startTaskSubscription(state.selectedEggId, now);
  }, [state.selectedEggId, startTaskSubscription]);

  // Stop incubation (cleanup) - defined early to avoid circular dependency
  const stopIncubationRef = useRef<() => void>();
  
  stopIncubationRef.current = () => {
    if (taskCleanupRef.current) {
      taskCleanupRef.current();
      taskCleanupRef.current = null;
    }
    setState(prev => ({ 
      ...prev, 
      taskSubscriptionActive: false,
      incubationState: { ...prev.incubationState, isListening: false },
      selectedEggId: null,
      incubationStartTime: null,
    }));
  };
  
  const stopIncubation = useCallback(() => {
    stopIncubationRef.current?.();
  }, []);

  const progress = getProgress();
  const isReadyToHatch = progress.egg.completed === progress.egg.total;
  const isReadyToEvolve = progress.evolution.completed === progress.evolution.total && 
    state.incubationState.hatchTime && 
    (Date.now() - state.incubationState.hatchTime) >= 24 * 60 * 60 * 1000; // 1 day

  return {
    // Blobbi data
    blobbis: state.blobbis,
    isLoadingBlobbis: state.isLoadingBlobbis,
    blobbiError: state.blobbiError,
    
    // Task tracking
    eggTasks: state.incubationState.eggTasks,
    evolutionTasks: state.incubationState.evolutionTasks,
    progress,
    isReadyToHatch,
    isReadyToEvolve,
    isBlobbiReadyToHatch,
    
    // Subscription status
    metadataSubscriptionActive: state.metadataSubscriptionActive,
    taskSubscriptionActive: state.taskSubscriptionActive,
    isListening: state.incubationState.isListening,
    
    // Egg selection and incubation
    selectedEggId: state.selectedEggId,
    incubationStartTime: state.incubationStartTime,
    selectEgg,
    startIncubation,
    stopIncubation,
    hatchBlobbi,
    
    // Controls
    refetchMetadata: fetchBlobbiMetadata,
    
    // Debug info
    debugInfo: {
      blobbiCreationTime: state.incubationState.blobbiCreationTime,
      blobbiCreationDate: new Date(state.incubationState.blobbiCreationTime).toISOString(),
      lastEventTime: state.incubationState.lastEventTime,
      lastEventDate: state.incubationState.lastEventTime ? new Date(state.incubationState.lastEventTime).toISOString() : null,
      uniqueLikersCount: state.incubationState.uniqueLikers.size,
      userPubkey: user?.pubkey,
      subscriptionStatus: {
        metadata: state.metadataSubscriptionActive,
        tasks: state.taskSubscriptionActive,
      },
    },
  };
}