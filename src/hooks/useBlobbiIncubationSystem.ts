import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { NostrEvent } from '@nostrify/nostrify';
import { parseBlobbiFromStateEvent } from '@/lib/blobbi-events';
import { mergeBlobbiStateTags, extractTagValues } from '@/lib/blobbi-state-merge';
import { Blobbi } from '@/types/blobbi';

// Task definitions for egg hatching (4 tasks)
export interface EggHatchingTask {
  id: string;
  name: string;
  description: string;
  eventKind: number;
  checkFunction: (event: NostrEvent, userPubkey: string) => boolean;
  completed: boolean;
  progress?: number;
  target?: number;
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
    id: 'first_post',
    name: 'Publish your first post with #Blobbi',
    description: 'Publish your first kind:1 post that includes the #Blobbi hashtag',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      // This task is now completed manually via the Create Post modal
      // to ensure it only completes when the user intentionally uses the incubation feature
      return false; // Never auto-complete, only via manual confirmation
    },
    completed: false,
  },
  {
    id: 'post_blobbi_photo',
    name: 'Post a photo of your Blobbi',
    description: 'Use the Polaroid camera to post a photo of this Blobbi on Nostr',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      // This will be marked as completed by the Polaroid Photo Modal
      // when the user successfully posts via "Post on Nostr"
      return false; // Never auto-complete, only via manual confirmation
    },
    completed: false,
  },
  {
    id: 'interact_6',
    name: 'Interact at least 6 times with your Blobbi',
    description: 'Perform 6 interactions (kind:14919) with your incubating Blobbi after incubation starts',
    eventKind: 14919,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      return event.pubkey === userPubkey && event.kind === 14919;
    },
    completed: false,
    progress: 0,
    target: 6,
  },
  {
    id: 'shell_integrity_above_50',
    name: 'Keep your egg\'s shell strong',
    description: 'Maintain your egg\'s shell integrity above 50 before hatching',
    eventKind: 0, // This is not checked via events but via current state
    checkFunction: () => false, // Always handled by state check
    completed: false,
  },
];

// Define evolution tasks (13 tasks total)
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
  lastInteractionTime?: number;
}

type BlobbiTaskStates = Map<string, IncubationState>;

interface BlobbiIncubationSystemState {
  // Blobbi metadata
  blobbis: Blobbi[];
  isLoadingBlobbis: boolean;
  blobbiError: Error | null;

  // Task tracking
  blobbiTaskStates: BlobbiTaskStates;

  // Subscription status
  metadataSubscriptionActive: boolean;
  taskSubscriptionActive: boolean;
  isStartingIncubation: boolean;

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
    blobbiTaskStates: new Map(),
    metadataSubscriptionActive: false,
    taskSubscriptionActive: false,
    isStartingIncubation: false,
    selectedEggId: null,
    incubationStartTime: null,
  });

  // Refs to track subscription cleanup functions and active subscriptions
  const metadataCleanupRef = useRef<(() => void) | null>(null);
  const taskCleanupRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const activeTaskSubscriptionRef = useRef<boolean>(false);
  const activeMetadataSubscriptionRef = useRef<boolean>(false);

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
        authors: [user?.pubkey || ''],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for stage transition');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];

      // Use the new merge helper to safely update tags
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        stage: 'baby',
        removeStartIncubation: true,
        hatchTime: Math.floor(Date.now() / 1000),
      });

      // Publish the updated event with baby stage (without start_incubation tag)
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      console.log(`✅ Successfully transitioned Blobbi ${blobbiId} to baby stage and removed start_incubation tag`);
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

      // Find the current blobbi
      const currentBlobbi = state.blobbis.find(b => b.id === blobbiId);
      if (!currentBlobbi) {
        throw new Error('Blobbi not found');
      }

      // Use the proper dual-event hatching process
      const { processHatching } = await import('@/lib/blobbi-evolution');
      const { createBlobbiRecordEvent, createBlobbiStateEvent } = await import('@/lib/blobbi-events');

      // Generate hatching data
      const { hatchingRecord, updatedBlobbi } = processHatching(currentBlobbi);

      // First, create and publish the kind 14921 hatching record
      console.log('📝 Publishing kind 14921 hatching record...');
      const recordEventData = createBlobbiRecordEvent(blobbiId, hatchingRecord, `${currentBlobbi.name} has hatched! 🐣✨`);
      await publishEvent({
        ...recordEventData,
      });

      // Wait a moment to ensure proper event ordering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then, create and publish the kind 31124 baby state (without task tags and without start_incubation)
      console.log('📝 Publishing kind 31124 baby state...');
      const stateEventData = createBlobbiStateEvent(updatedBlobbi);

      // Use merge helper to ensure start_incubation tag is removed
      const filteredTags = mergeBlobbiStateTags(stateEventData.tags, {
        removeStartIncubation: true,
      });

      await publishEvent({
        ...stateEventData,
        tags: filteredTags,
      });



      console.log(`✅ Successfully hatched Blobbi ${blobbiId}`);

      // Show success message
      toast({
        title: "🎉 Hatching Complete!",
        description: `${currentBlobbi.name} has successfully hatched into a baby Blobbi!`,
        variant: "default",
      });
    } catch (error) {
      console.error('❌ Failed to hatch Blobbi:', error);
      toast({
        title: "❌ Hatching Failed",
        description: "There was an error hatching your Blobbi. Please try again.",
        variant: "destructive",
      });
    }
  }, [user, nostr, state.blobbis, publishEvent, toast]);

  // Publish task confirmation and/or progress update
  const publishTaskConfirmation = useCallback(async (taskId: string, isCompleted: boolean = true, progress?: number) => {
    if (!user || !nostr || !state.selectedEggId) return;

    try {
      const blobbiTaskState = state.blobbiTaskStates.get(state.selectedEggId);
      if (!blobbiTaskState) return;

      if (!taskId) return;

      // Fetch the current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
        '#d': [state.selectedEggId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.warn(`⚠️ Could not find event for selected Blobbi: ${state.selectedEggId}`);
        return;
      }

      const currentEvent = currentBlobbiEvents[0];
      const blobbi = parseBlobbiFromStateEvent(currentEvent);

      if (!blobbi) {
        console.warn(`⚠️ Could not parse event for selected Blobbi: ${state.selectedEggId}`);
        return;
      }

      console.log(`📝 Updating task for ${blobbi.name} (${blobbi.lifeStage}): ${taskId} - completed: ${isCompleted}, progress: ${progress}`);

      // Prepare merge options
      const mergeOptions: any = {
        // Remove any old format confirmation tags
        removeTags: [`(${taskId})_confirmed`, `task_completed`],
      };

      // Add confirmation tag if completed
      if (isCompleted) {
        mergeOptions.addConfirmedTaskId = taskId;
      }

      // Add progress tag if provided
      if (progress !== undefined) {
        mergeOptions.updateTaskProgress = { taskId, progress };
        console.log(`📝 Adding progress tag: ${taskId}_progress = ${progress}`);
      }

      // Debug: Log merge options
      console.log(`🔧 Merge options for task update:`, mergeOptions);

      // Use the new merge helper to safely update tags
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, mergeOptions);

      // Debug: Log the updated tags and specifically check for our progress tag
      const progressTag = updatedTags.find(tag => tag[0] === `${taskId}_progress`);
      console.log(`🏷️ Updated tags for 31124 event:`, updatedTags);
      console.log(`🎯 Progress tag found:`, progressTag);

      // Publish the enriched event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      console.log(`✅ Published task update for ${blobbi.name}: ${taskId} (completed: ${isCompleted}, progress: ${progress})`);
    } catch (error) {
      console.error('Failed to publish task update:', error);
    }
  }, [user, nostr, state.selectedEggId, state.blobbiTaskStates, publishEvent]);

  // Process incoming task events
  const processTaskEvent = useCallback(async (event: NostrEvent) => {
    // Don't return early for selectedEggId or blobbiTaskState - let the logic handle it
    if (!user) return;

    // Debug: Log all incoming events
    console.log(`📨 Processing event: kind ${event.kind}, author ${event.pubkey.slice(0, 8)}..., created_at ${event.created_at}, tags:`, event.tags);

    // Validate event structure
    if (!event || typeof event.created_at !== 'number' || !event.pubkey || !event.kind) {
      console.warn('⚠️ Invalid event structure, skipping:', event);
      return;
    }

    // Only process events that occurred after incubation started
    const eventTimestamp = event.created_at * 1000;
    const incubationTime = state.incubationStartTime;
    if (!incubationTime || eventTimestamp < incubationTime) {
      console.log(`⏭️ Skipping event from before incubation start: ${new Date(eventTimestamp).toISOString()} (incubation: ${incubationTime ? new Date(incubationTime).toISOString() : 'not set'})`);
      return;
    }

    // Get the current selected egg ID and task state
    const currentSelectedEggId = state.selectedEggId;
    const blobbiTaskState = currentSelectedEggId ? state.blobbiTaskStates.get(currentSelectedEggId) : null;

    // If no egg is selected or no task state, skip processing but don't return early for undefined
    if (!currentSelectedEggId || !blobbiTaskState) {
      console.log(`⚠️ No selected egg or task state, skipping event processing`);
      return;
    }

    console.log(`🎯 Processing for selected egg: ${currentSelectedEggId}`);

    // For interact_6 task, we need to validate that the Blobbi has start_incubation tag
    // This will be checked inside the interact_6 logic by fetching current 31124 event

    let taskCompleted = false;
    let completedTaskName = '';
    let completedTaskId: string | null = null;

    setState(prevState => {
      // Use the current selected egg ID we captured earlier
      if (!currentSelectedEggId) return prevState;
      const newBlobbiTaskStates = new Map(prevState.blobbiTaskStates);
      const currentTaskState = newBlobbiTaskStates.get(currentSelectedEggId);
      if (!currentTaskState) return prevState;

      const newIncubationState = { ...currentTaskState };

      // Process egg hatching tasks
      newIncubationState.eggTasks = newIncubationState.eggTasks.map(task => {
        if (task.completed) return task;

        if (task.id === 'interact_6' && event.kind === 14919) {
          // Skip if task is already completed
          if (task.completed) {
            console.log(`⏭️ interact_6 task already completed, skipping`);
            return task;
          }

          // Special handling for interaction task
          const blobbiIdTag = event.tags.find(tag => tag[0] === 'blobbi_id');
          const actionTag = event.tags.find(tag => tag[0] === 'action');

          // Debug: Log the tag checking
          console.log(`🔍 Checking interact_6 task:`);
          console.log(`  - blobbiIdTag: ${blobbiIdTag?.[1]}`);
          console.log(`  - actionTag: ${actionTag?.[1]}`);
          console.log(`  - selectedEggId: ${currentSelectedEggId}`);
          console.log(`  - event.created_at: ${event.created_at}`);
          console.log(`  - Required actions: ['talk', 'sing', 'warm', 'check', 'medicine', 'clean']`);

          // Check if this interaction is for the current blobbi and has valid action
          const isCorrectBlobbi = blobbiIdTag && blobbiIdTag[1] === currentSelectedEggId;
          const isValidAction = actionTag && ['talk', 'sing', 'warm', 'check', 'medicine', 'clean'].includes(actionTag[1]);

          console.log(`  - isCorrectBlobbi: ${isCorrectBlobbi}`);
          console.log(`  - isValidAction: ${isValidAction}`);

          if (isCorrectBlobbi && isValidAction) {
            console.log(`✅ Valid interaction detected: ${actionTag[1]} for blobbi ${currentSelectedEggId}`);

            // Check if this Blobbi has start_incubation tag (required for counting interactions)
            // We check this using the incubationStartTime which is set when start_incubation exists
            if (!state.incubationStartTime) {
              console.log(`❌ No incubation started for this Blobbi, skipping interaction count`);
              return task;
            }

            // Check for duplicates (within 3 seconds) - Use seconds consistently
            const eventTimeSeconds = event.created_at; // Unix timestamp in seconds
            const lastInteractionTimeSeconds = newIncubationState.lastInteractionTime || 0; // Also in seconds

            console.log(`⏱️ Checking cooldown (in seconds): eventTime=${eventTimeSeconds}, lastInteractionTime=${lastInteractionTimeSeconds}, diff=${eventTimeSeconds - lastInteractionTimeSeconds}`);

            if (eventTimeSeconds - lastInteractionTimeSeconds >= 3) { // 3 seconds cooldown
              const currentProgress = task.progress || 0;
              const newProgress = currentProgress + 1;

              console.log(`✅ Cooldown passed, incrementing progress: ${currentProgress} -> ${newProgress}`);

              // Update last interaction time in seconds
              newIncubationState.lastInteractionTime = eventTimeSeconds;

              // Set flag to publish progress update after state change
              if (newProgress >= (task.target || 6)) {
                taskCompleted = true;
                completedTaskName = task.name;
                completedTaskId = task.id;
                console.log(`🥚 Egg task completed: ${task.name} (${newProgress}/${task.target})`);

                // Show immediate toast notification for task completion
                const message = getTaskCompletionMessage(task.id, task.name, false);
                toast({
                  title: message.title,
                  description: message.description,
                  variant: "default",
                });

                return { ...task, progress: newProgress, completed: true };
              } else {
                console.log(`🥚 Egg task progress: ${task.name} (${newProgress}/${task.target})`);

                // Show progress toast for interaction task
                toast({
                  title: "🎯 Interaction Counted!",
                  description: `Progress on "${task.name}": ${newProgress}/${task.target} interactions completed. Keep going!`,
                  variant: "default",
                });

                // Note: Progress updates are now handled automatically by useEnhancedNostrPublish
                // This local state update provides immediate UI feedback

                return { ...task, progress: newProgress };
              }
            } else {
              console.log(`⏭️ Cooldown not passed, skipping interaction (diff: ${eventTimeSeconds - lastInteractionTimeSeconds}s < 3s)`);
            }
          } else {
            console.log(`❌ Invalid interaction - blobbi mismatch or invalid action`);
          }
        } else if (!task.completed && task.checkFunction(event, user?.pubkey || '')) {
          // Handle other egg tasks normally
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

          completedTaskId = task.id;

          return { ...task, completed: true };
        }

        return task;
      });

      // Process evolution tasks (only if hatched)
      if (newIncubationState.hatchTime && eventTimestamp > newIncubationState.hatchTime) {
        newIncubationState.evolutionTasks = newIncubationState.evolutionTasks.map(task => {
          if (task.completed) return task;

          if (task.checkFunction(event, user?.pubkey || '', newIncubationState)) {
            if (task.target && task.progress !== undefined) {
              // Multi-target task
              const newProgress = task.progress + 1;
              if (newProgress >= (task.target || 6)) {
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

                completedTaskId = task.id;

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

              completedTaskId = task.id;

              return { ...task, completed: true };
            }
          }

          // Special handling for receive likes task
          if (task.id === 'receive_5_likes' && event.kind === 7) {
            const pTags = event.tags.filter(tag => tag[0] === 'p');
            if (pTags.some(tag => tag[1] === (user?.pubkey || '')) && event.pubkey !== (user?.pubkey || '')) {
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
      newBlobbiTaskStates.set(currentSelectedEggId, newIncubationState);

      const nextState = {
        ...prevState,
        blobbiTaskStates: newBlobbiTaskStates,
      };
      return nextState;
    });

    // Handle progress updates and task completion
    if (completedTaskId) {
      // Task was completed - publish confirmation
      await publishTaskConfirmation(completedTaskId, true);

      // Check if all egg tasks are completed
      if (currentSelectedEggId) {
        const updatedTaskState = state.blobbiTaskStates.get(currentSelectedEggId);
        if (updatedTaskState) {
          const allEggTasksCompleted = updatedTaskState.eggTasks.every(task => task.completed);
          if (allEggTasksCompleted) {
            console.log('🎉 All egg tasks completed! Ready to hatch manually...');

            // Show toast notification for completing all tasks - now prompts for manual hatching
            toast({
              title: "🥚 All Tasks Complete!",
              description: "You've completed all the hatching tasks! Your egg is ready to hatch. Click the 'Hatch' button when you're ready!",
              variant: "default",
            });
          }
        }
      }
    }

    // Note: Progress updates are now handled automatically by useEnhancedNostrPublish
    // when interaction events are published. This subscription-based logic only
    // updates local state for real-time UI feedback.
  }, [user, publishEvent, state.incubationStartTime, state.selectedEggId, publishTaskConfirmation, toast, getTaskCompletionMessage]);

  // Step 2: Start persistent metadata subscription (kind 31124)
  const startMetadataSubscription = useCallback(async () => {
    if (!user || !nostr || state.metadataSubscriptionActive) return;

    console.log('🔄 Step 2: Starting persistent metadata subscription (kind:31124)...');

    try {
      const subscriptionIterable = nostr.req([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
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
                    const newBlobbis = prev.blobbis.some(b => b.id === blobbi.id)
                      ? prev.blobbis.map(b => b.id === blobbi.id ? blobbi : b)
                      : [...prev.blobbis, blobbi];

                    const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
                    const existingTaskState = newBlobbiTaskStates.get(blobbi.id) || {
                      eggTasks: EGG_HATCHING_TASKS.map(t => ({ ...t })),
                      evolutionTasks: EVOLUTION_TASKS.map(t => ({ ...t })),
                      isListening: false,
                      lastEventTime: 0,
                      uniqueLikers: new Set(),
                      uniqueReactors: new Set(),
                      blobbiCreationTime: blobbi.birthTime,
                      hatchTime: blobbi.hatchTime,
                    };

                    // Check for confirmed task tags (both old "true" format and new timestamp format)
                    const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);
                    if (confirmedTags.length > 0) {
                      console.log(`✅ Found ${confirmedTags.length} confirmed task tags for ${blobbi.name}:`, confirmedTags);

                      existingTaskState.eggTasks = existingTaskState.eggTasks.map(task => {
                        const confirmationTag = `${task.id}_confirmed`;
                        const confirmTag = confirmedTags.find(tag => tag[0] === confirmationTag);
                        if (confirmTag && !task.completed) {
                          console.log(`🥚 Marking egg task for ${blobbi.name} as completed from confirmed tag: ${task.name} (value: ${confirmTag[1]})`);
                          return { ...task, completed: true };
                        }
                        return task;
                      });

                      existingTaskState.evolutionTasks = existingTaskState.evolutionTasks.map(task => {
                        const confirmationTag = `${task.id}_confirmed`;
                        const confirmTag = confirmedTags.find(tag => tag[0] === confirmationTag);
                        if (confirmTag && !task.completed) {
                          console.log(`🧬 Marking evolution task for ${blobbi.name} as completed from confirmed tag: ${task.name} (value: ${confirmTag[1]})`);
                          return { ...task, completed: true };
                        }
                        return task;
                      });
                    }

                    // Check for progress tags (e.g., interact_6_progress)
                    const progressTags = event.tags.filter(tag => tag[0].endsWith('_progress') && tag[1]);
                    if (progressTags.length > 0) {
                      console.log(`📊 Found ${progressTags.length} progress tags for ${blobbi.name}:`, progressTags);

                      existingTaskState.eggTasks = existingTaskState.eggTasks.map(task => {
                        const progressTag = `${task.id}_progress`;
                        const progTag = progressTags.find(tag => tag[0] === progressTag);
                        if (progTag && task.target) {
                          const progress = parseInt(progTag[1]);
                          if (!isNaN(progress)) {
                            console.log(`📈 Restoring progress for ${task.name}: ${progress}/${task.target}`);
                            return { ...task, progress };
                          }
                        }
                        return task;
                      });
                    }

                    newBlobbiTaskStates.set(blobbi.id, existingTaskState);

                    // Handle start_incubation tag changes with authoritative selection
                    const startIncubationTags = extractTagValues(event, 'start_incubation');
                    const currentIncubatingEggId = prev.selectedEggId;
                    const hasStartIncubation = startIncubationTags.length > 0 && !isNaN(parseInt(startIncubationTags[0]));

                    if (hasStartIncubation && blobbi.lifeStage === 'egg') {
                      const timestamp = parseInt(startIncubationTags[0]) * 1000; // Convert to milliseconds
                      console.log(`🎯 Found start_incubation tag for ${blobbi.name} with timestamp ${startIncubationTags[0]}`);

                      // Authoritative selection: if this is an egg with start_incubation, it MUST be selected
                      if (!currentIncubatingEggId || currentIncubatingEggId !== blobbi.id) {
                        console.log(`🔄 Authoritative auto-selection of incubating egg: ${blobbi.name}`);
                        return {
                          ...prev,
                          blobbis: newBlobbis,
                          blobbiTaskStates: (() => {
                            const m = new Map(newBlobbiTaskStates);
                            const s = m.get(blobbi.id);
                            if (s) {
                              s.isListening = true;
                              m.set(blobbi.id, s);
                            }
                            return m;
                          })(),
                          selectedEggId: blobbi.id,
                          incubationStartTime: timestamp,
                        };
                      } else {
                        // Update timestamp if same egg
                        return {
                          ...prev,
                          blobbis: newBlobbis,
                          blobbiTaskStates: (() => {
                            const m = new Map(newBlobbiTaskStates);
                            const s = m.get(blobbi.id);
                            if (s) {
                              s.isListening = true;
                              m.set(blobbi.id, s);
                            }
                            return m;
                          })(),
                          incubationStartTime: timestamp,
                        };
                      }
                    } else if (!hasStartIncubation && currentIncubatingEggId === blobbi.id) {
                      // If the current selected egg lost its start_incubation tag, clear selection
                      console.log(`🛑 Egg ${blobbi.name} lost start_incubation tag, clearing selection`);
                      return {
                        ...prev,
                        blobbis: newBlobbis,
                        blobbiTaskStates: newBlobbiTaskStates,
                        selectedEggId: null,
                        incubationStartTime: null,
                      };
                    }

                    return {
                      ...prev,
                      blobbis: newBlobbis,
                      blobbiTaskStates: newBlobbiTaskStates,
                    };
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
  }, [user, nostr, state.metadataSubscriptionActive, toast]);

  // Step 3: Start task tracking subscription (only after metadata is loaded)
  const startTaskSubscription = useCallback(async (selectedEggId?: string, sinceTimestamp?: number) => {
    if (!user || !nostr) return;

    // Prevent duplicate subscriptions using both state and ref
    if (state.taskSubscriptionActive || activeTaskSubscriptionRef.current) {
      console.warn('⚠️ Task subscription already active, ignoring start request');
      return;
    }

    // If no egg is selected, don't start task subscription
    if (!selectedEggId) {
      console.log('⚠️ No egg selected, skipping task subscription');
      return;
    }

    // If no since timestamp provided, try to get it from the selected egg's start_incubation tag
    let finalSinceTimestamp = sinceTimestamp;
    if (!finalSinceTimestamp && state.incubationStartTime && selectedEggId === state.selectedEggId) {
      finalSinceTimestamp = state.incubationStartTime;
    }
    if (!finalSinceTimestamp) {
      try {
        const signal = AbortSignal.timeout(5000);
        const currentBlobbiEvents = await nostr.query([{
          kinds: [31124],
          authors: [user?.pubkey || ''],
          '#d': [selectedEggId],
          limit: 1,
        }], { signal });

        if (currentBlobbiEvents.length > 0) {
          const startIncubationTag = currentBlobbiEvents[0].tags.find(tag => tag[0] === 'start_incubation');
          if (startIncubationTag && startIncubationTag[1]) {
            const tagTimestamp = parseInt(startIncubationTag[1]);
            if (!isNaN(tagTimestamp)) {
              finalSinceTimestamp = tagTimestamp * 1000; // Convert to milliseconds
              console.log(`🏷️ Using start_incubation tag timestamp: ${startIncubationTag[1]}`);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch start_incubation timestamp:', error);
      }
    }

    console.log('🎯 Step 3: Starting persistent task tracking subscription...');
    console.log(`🥚 Selected egg: ${selectedEggId}`);
    console.log(`⏰ Since timestamp: ${finalSinceTimestamp ? new Date(finalSinceTimestamp).toISOString() : 'Not specified'}`);

    try {
      // Create filters to capture events with p tag mentioning the user AND events authored by the user
      const filters: Array<{ kinds: number[]; '#p'?: string[]; authors?: string[]; since?: number }> = [
        {
          kinds: [1, 3, 6, 7, 9735, 14919], // Added kind:14919 for interaction events
          '#p': [user?.pubkey || ''], // Using p tag filter as requested
        },
        {
          kinds: [1, 3, 6, 7, 9735, 14919], // Same kinds for events authored by user (added kind:14919)
          authors: [user?.pubkey || ''], // Events authored by the user
        }
      ];

      // Add since filter if timestamp is provided (from tag or parameter)
      if (finalSinceTimestamp) {
        const sinceSeconds = Math.floor(finalSinceTimestamp / 1000); // Convert to seconds
        filters[0].since = sinceSeconds;
        filters[1].since = sinceSeconds;
      }

      const subscriptionIterable = nostr.req(filters);

      // Mark subscription as active in both state and ref
      activeTaskSubscriptionRef.current = true;
      setState(prev => {
        if (!selectedEggId) return prev;
        const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
        const taskState = newBlobbiTaskStates.get(selectedEggId);
        if (taskState) {
          taskState.isListening = true;
          newBlobbiTaskStates.set(selectedEggId, taskState);
        }
        return {
          ...prev,
          taskSubscriptionActive: true,
          blobbiTaskStates: newBlobbiTaskStates,
        };
      });

      console.log('🎯 Task subscription marked as active in state and ref');

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
              activeTaskSubscriptionRef.current = false;
              setState(prev => {
                if (!selectedEggId) return prev;
                const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
                const taskState = newBlobbiTaskStates.get(selectedEggId);
                if (taskState) {
                  taskState.isListening = false;
                  newBlobbiTaskStates.set(selectedEggId, taskState);
                }
                return {
                  ...prev,
                  taskSubscriptionActive: false,
                  blobbiTaskStates: newBlobbiTaskStates,
                };
              });
              break;
            }
          }
        } catch (error) {
          console.error('❌ Task subscription error:', error);
          activeTaskSubscriptionRef.current = false;
          setState(prev => {
            if (!selectedEggId) return prev;
            const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
            const taskState = newBlobbiTaskStates.get(selectedEggId);
            if (taskState) {
              taskState.isListening = false;
              newBlobbiTaskStates.set(selectedEggId, taskState);
            }
            return {
              ...prev,
              taskSubscriptionActive: false,
              blobbiTaskStates: newBlobbiTaskStates,
            };
          });
        }
      })();

      // Store cleanup function that properly closes the subscription
      taskCleanupRef.current = () => {
        console.log('🔌 Manually closing task subscription...');
        activeTaskSubscriptionRef.current = false;
        setState(prev => {
          if (!selectedEggId) return prev;
          const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
          const taskState = newBlobbiTaskStates.get(selectedEggId);
          if (taskState) {
            taskState.isListening = false;
            newBlobbiTaskStates.set(selectedEggId, taskState);
          }
          return {
            ...prev,
            taskSubscriptionActive: false,
            blobbiTaskStates: newBlobbiTaskStates,
          };
        });
        // The subscription will close naturally when the async iterator breaks
      };

      console.log('✅ Persistent task tracking subscription established with both #p and authors filters');
    } catch (error) {
      console.error('❌ Failed to start task subscription:', error);
      activeTaskSubscriptionRef.current = false;
      setState(prev => {
        if (!selectedEggId) return prev;
        const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
        const taskState = newBlobbiTaskStates.get(selectedEggId);
        if (taskState) {
          taskState.isListening = false;
          newBlobbiTaskStates.set(selectedEggId, taskState);
        }
        return {
          ...prev,
          taskSubscriptionActive: false,
          blobbiTaskStates: newBlobbiTaskStates,
        };
      });
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
        authors: [user?.pubkey || ''],
      }], { signal });

      console.log(`✅ Found ${events.length} Blobbi metadata events`);

      const newBlobbis: Blobbi[] = [];
      const newBlobbiTaskStates: BlobbiTaskStates = new Map();
      let incubatingEggId: string | null = null;
      let latestIncubationTimestamp = 0;

      // First pass: parse all blobbis and find the authoritative incubating egg
      for (const event of events) {
        try {
          const blobbi = parseBlobbiFromStateEvent(event);
          if (blobbi) {
            newBlobbis.push(blobbi);

            // Authoritative egg selection: find ANY egg with start_incubation tag
            if (blobbi.lifeStage === 'egg') {
              const startIncubationTags = extractTagValues(event, 'start_incubation');
              for (const tagValue of startIncubationTags) {
                const timestamp = parseInt(tagValue);
                if (!isNaN(timestamp) && timestamp > latestIncubationTimestamp) {
                  latestIncubationTimestamp = timestamp;
                  incubatingEggId = blobbi.id;
                  console.log(`🎯 Found incubating egg candidate: ${blobbi.name} (${blobbi.id}) with start_incubation: ${timestamp}`);
                }
              }
            }

            // Check for confirmed task tags (both old "true" format and new timestamp format)
            const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);
            const confirmedTaskIds = new Set(confirmedTags.map(tag => tag[0].replace('_confirmed', '')));

            // Check for progress tags
            const progressTags = event.tags.filter(tag => tag[0].endsWith('_progress') && tag[1]);
            const progressMap = new Map(progressTags.map(tag => [tag[0].replace('_progress', ''), parseInt(tag[1])]));

            const eggTasks = EGG_HATCHING_TASKS.map(task => {
              const isCompleted = confirmedTaskIds.has(task.id);
              const savedProgress = progressMap.get(task.id);

              // Debug logging for first_post task initialization
              if (task.id === 'first_post') {
                console.log(`🔍 Initializing first_post task for blobbi ${blobbi.name}:`, {
                  taskId: task.id,
                  blobbiId: blobbi.id,
                  confirmedTaskIds: Array.from(confirmedTaskIds),
                  isCompleted,
                  savedProgress,
                  confirmedTags: confirmedTags.filter(tag => tag[0].includes('first_post'))
                });
              }

              return {
                ...task,
                completed: isCompleted,
                progress: savedProgress !== undefined ? savedProgress : (task.progress || 0),
              };
            });

            const evolutionTasks = EVOLUTION_TASKS.map(task => ({
              ...task,
              completed: confirmedTaskIds.has(task.id),
            }));

            newBlobbiTaskStates.set(blobbi.id, {
              eggTasks,
              evolutionTasks,
              isListening: false,
              lastEventTime: 0,
              lastInteractionTime: 0, // Initialize to 0 (in seconds, same as event.created_at)
              uniqueLikers: new Set(),
              uniqueReactors: new Set(),
              blobbiCreationTime: blobbi.birthTime,
              hatchTime: blobbi.hatchTime,
            });
          }
        } catch (error) {
          console.warn('Failed to parse Blobbi event:', error);
        }
      }

      // Authoritative egg selection: override any existing selection with incubating egg
      if (incubatingEggId) {
        console.log(`🎯 Authoritative egg selection: ${incubatingEggId} with latest start_incubation: ${latestIncubationTimestamp}`);
        setState(prev => ({
          ...prev,
          selectedEggId: incubatingEggId,
          incubationStartTime: latestIncubationTimestamp * 1000, // Convert to milliseconds
        }));
      } else {
        console.log('🔍 No incubating eggs found, keeping current selection or null');
      }

      setState(prev => ({
        ...prev,
        blobbis: newBlobbis,
        blobbiTaskStates: newBlobbiTaskStates,
        isLoadingBlobbis: false,
      }));

      // Step 2: Start persistent metadata subscription
      await startMetadataSubscription();

      // Step 3: If we have an authoritative incubating egg, start task subscription
      if (incubatingEggId) {
        console.log(`🚀 Auto-starting task subscription for authoritative incubating egg: ${incubatingEggId}`);
        await startTaskSubscription(incubatingEggId, latestIncubationTimestamp * 1000);
      }

    } catch (error) {
      console.error('❌ Failed to fetch Blobbi metadata:', error);
      setState(prev => ({
        ...prev,
        isLoadingBlobbis: false,
        blobbiError: error as Error
      }));
    }
  }, [user, nostr, state.isLoadingBlobbis, startMetadataSubscription, startTaskSubscription]);

  // Initialize the system when user is available
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      console.log('🚀 Initializing Blobbi Incubation System...');
      isInitializedRef.current = true;
      fetchBlobbiMetadata();
    }

    // Only cleanup on unmount, not on re-renders
    return () => {
      // Only cleanup if the component is actually unmounting
      // This prevents cleanup during re-renders
      console.log('🧹 Cleaning up Blobbi Incubation System subscriptions...');
      if (metadataCleanupRef.current) {
        metadataCleanupRef.current();
        metadataCleanupRef.current = null;
      }
      if (taskCleanupRef.current) {
        taskCleanupRef.current();
        taskCleanupRef.current = null;
      }
    };
  }, [user, fetchBlobbiMetadata]);

  // Sync ref state with component state for debugging
  useEffect(() => {
    if (state.selectedEggId) {
      const taskState = state.blobbiTaskStates.get(state.selectedEggId);
      if (taskState && taskState.isListening !== activeTaskSubscriptionRef.current) {
        console.log(`🔄 Task subscription state mismatch for ${state.selectedEggId} - State: ${taskState.isListening}, Ref: ${activeTaskSubscriptionRef.current}`);
      }
    }
  }, [state.taskSubscriptionActive, state.selectedEggId, state.blobbiTaskStates]);

  // Helper function to check task completion including dynamic shell integrity
  const isTaskCompleted = useCallback((task: any, blobbiId: string | null) => {
    if (task.id === 'shell_integrity_above_50') {
      // Check shell integrity from current blobbi state
      const currentBlobbi = state.blobbis.find(b => b.id === blobbiId);
      return currentBlobbi && (currentBlobbi.shellIntegrity || 100) >= 50;
    }

    // Debug logging for first_post task
    if (task.id === 'first_post') {
      console.log(`🔍 isTaskCompleted check for first_post:`, {
        taskId: task.id,
        blobbiId,
        taskCompleted: task.completed,
        taskProgress: task.progress,
        taskName: task.name
      });
    }

    return task.completed;
  }, [state.blobbis]);

  // Calculate progress for current stage
  const getProgress = useCallback((blobbiId: string | null) => {
    if (!blobbiId) {
      return {
        egg: { completed: 0, total: EGG_HATCHING_TASKS.length, percentage: 0 },
        evolution: { completed: 0, total: EVOLUTION_TASKS.length, percentage: 0 },
      };
    }
    const taskState = state.blobbiTaskStates.get(blobbiId);
    if (!taskState) {
      return {
        egg: { completed: 0, total: EGG_HATCHING_TASKS.length, percentage: 0 },
        evolution: { completed: 0, total: EVOLUTION_TASKS.length, percentage: 0 },
      };
    }

    const eggCompleted = taskState.eggTasks.filter(task => isTaskCompleted(task, blobbiId)).length;
    const evolutionCompleted = taskState.evolutionTasks.filter(task => task.completed).length;

    return {
      egg: { completed: eggCompleted, total: taskState.eggTasks.length, percentage: (eggCompleted / taskState.eggTasks.length) * 100 },
      evolution: { completed: evolutionCompleted, total: taskState.evolutionTasks.length, percentage: (evolutionCompleted / taskState.evolutionTasks.length) * 100 },
    };
  }, [state.blobbiTaskStates]);

  // Check if a specific blobbi is ready to hatch
  const isBlobbiReadyToHatch = useCallback((blobbi: Blobbi | null) => {
    if (!blobbi || blobbi.lifeStage !== 'egg') return false;

    const taskState = state.blobbiTaskStates.get(blobbi.id);
    if (!taskState || taskState.eggTasks.length === 0) return false;

    return taskState.eggTasks.every(task => isTaskCompleted(task, blobbi.id));
  }, [state.blobbiTaskStates, isTaskCompleted]);

  // Select an egg for incubation
  const selectEgg = useCallback((eggId: string | null) => {
    setState(prev => ({ ...prev, selectedEggId: eggId }));
  }, []);

  // Persist incubation start to Nostr
  const persistIncubationStart = useCallback(async (eggId: string) => {
    if (!user || !nostr) return;

    try {
      console.log('💾 Persisting incubation start for egg:', eggId);

      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
        '#d': [eggId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for incubation start');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];
      const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

      // Use the new merge helper to safely update tags
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        startIncubation: now,
      });

      // Publish the updated event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      console.log(`✅ Successfully persisted incubation start for egg ${eggId} with timestamp ${now}`);
      return now;
    } catch (error) {
      console.error('❌ Failed to persist incubation start:', error);
      throw error;
    }
  }, [user, nostr, publishEvent]);

  // Stop incubation and remove the start_incubation tag
  const stopIncubation = useCallback(async () => {
    if (!state.selectedEggId) {
      console.warn('⚠️ No egg selected to stop incubation');
      return;
    }

    try {
      console.log('🛑 Stopping incubation for egg:', state.selectedEggId);

      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
        '#d': [state.selectedEggId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for stopping incubation');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];

      // Use the new merge helper to safely remove start_incubation tag
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        removeStartIncubation: true,
      });

      // Publish the updated event without start_incubation tag
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      console.log(`✅ Successfully stopped incubation for egg ${state.selectedEggId}`);

      // Stop the task subscription
      activeTaskSubscriptionRef.current = false;
      if (taskCleanupRef.current) {
        taskCleanupRef.current();
        taskCleanupRef.current = null;
      }

      // Clear the selected egg and incubation state
      setState(prev => {
        if (!prev.selectedEggId) return prev;
        const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
        const taskState = newBlobbiTaskStates.get(prev.selectedEggId);
        if (taskState) {
          taskState.isListening = false;
          newBlobbiTaskStates.set(prev.selectedEggId, taskState);
        }
        return {
          ...prev,
          taskSubscriptionActive: false,
          blobbiTaskStates: newBlobbiTaskStates,
          selectedEggId: null,
          incubationStartTime: null,
        };
      });
    } catch (error) {
      console.error('❌ Failed to stop incubation:', error);
    }
  }, [state.selectedEggId, user, nostr, publishEvent]);

  // Start incubation for selected egg
  const startIncubation = useCallback(async () => {
    if (!state.selectedEggId) {
      console.warn('⚠️ No egg selected for incubation');
      return;
    }

    // Prevent multiple listeners using both state and ref
    if (state.taskSubscriptionActive || activeTaskSubscriptionRef.current || state.incubationStartTime || state.isStartingIncubation) {
      console.warn('⚠️ Incubation already active or starting, ignoring start request');
      console.log(`🔍 Current state - taskSubscriptionActive: ${state.taskSubscriptionActive}, activeRef: ${activeTaskSubscriptionRef.current}, incubationStartTime: ${state.incubationStartTime}, isStarting: ${state.isStartingIncubation}`);
      return;
    }

    try {
      console.log('🥚 Starting incubation for egg:', state.selectedEggId);
      setState(prev => ({ ...prev, isStartingIncubation: true }));

      // Step 1: Persist incubation start to Nostr
      const incubationTimestamp = await persistIncubationStart(state.selectedEggId);
      if (!incubationTimestamp) {
        throw new Error('Failed to persist incubation start');
      }

      // Convert timestamp back to milliseconds for local state
      const incubationTimeMs = incubationTimestamp * 1000;
      setState(prev => ({ ...prev, incubationStartTime: incubationTimeMs }));

      // Preload existing interactions for the selected blobbi
      console.log('🔍 Preloading existing interactions for blobbi:', state.selectedEggId);
      try {
        const signal = AbortSignal.timeout(5000);
        const existingInteractions = await nostr.query([{
          kinds: [14919],
          authors: [user?.pubkey || ''],
          '#blobbi_id': [state.selectedEggId],
        }], { signal });

        console.log(`📊 Found ${existingInteractions.length} existing interactions for blobbi ${state.selectedEggId}`);

        // Filter valid interactions (with valid action tags)
        const validInteractions = existingInteractions.filter(event => {
          const actionTag = event.tags.find(tag => tag[0] === 'action');
          return actionTag && ['talk', 'sing', 'warm', 'check', 'medicine', 'clean'].includes(actionTag[1]);
        });

        console.log(`✅ ${validInteractions.length} valid interactions found`);

        // Update task state with preloaded interactions
        setState(prev => {
          const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
          const taskState = newBlobbiTaskStates.get(prev.selectedEggId!);

          if (taskState) {
            const interactionTask = taskState.eggTasks.find(t => t.id === 'interact_6');
            if (interactionTask && !interactionTask.completed) {
              const preloadedProgress = Math.min(validInteractions.length, interactionTask.target || 6);
              interactionTask.progress = preloadedProgress;

              if (preloadedProgress >= (interactionTask.target || 6)) {
                interactionTask.completed = true;
                console.log('🎉 Interaction task already completed from preloaded data!');
              } else {
                console.log(`📈 Preloaded ${preloadedProgress}/${interactionTask.target} interactions`);
              }
            }
            newBlobbiTaskStates.set(prev.selectedEggId!, taskState);
          }

          return { ...prev, blobbiTaskStates: newBlobbiTaskStates };
        });
      } catch (error) {
        console.warn('Failed to preload existing interactions:', error);
      }

      // Step 2: Start task subscription with since timestamp from the persisted tag
      await startTaskSubscription(state.selectedEggId, incubationTimeMs);

      setState(prev => ({ ...prev, isStartingIncubation: false }));
      console.log('✅ Incubation started successfully');
    } catch (error) {
      console.error('❌ Failed to start incubation:', error);
      activeTaskSubscriptionRef.current = false;
      setState(prev => ({
        ...prev,
        isStartingIncubation: false,
        incubationStartTime: null,
        taskSubscriptionActive: false,
      }));
    }
  }, [state.selectedEggId, state.taskSubscriptionActive, state.incubationStartTime, state.isStartingIncubation, startTaskSubscription, user, nostr, persistIncubationStart]);



  // Function to mark photo task as completed (called by Polaroid modal)
  const markPhotoTaskCompleted = useCallback(async (blobbiId: string) => {
    if (!user || !nostr) return;

    try {
      console.log(`📸 Marking photo task as completed for Blobbi: ${blobbiId}`);

      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for photo task completion');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];

      // Use the new merge helper to safely update tags
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        addConfirmedTaskId: 'post_blobbi_photo',
      });

      // Publish the updated event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      console.log(`✅ Successfully marked photo task as completed for ${blobbiId}`);

      // Update local state
      setState(prev => {
        const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
        const taskState = newBlobbiTaskStates.get(blobbiId);
        if (taskState) {
          const updatedEggTasks = taskState.eggTasks.map(task =>
            task.id === 'post_blobbi_photo' ? { ...task, completed: true } : task
          );
          newBlobbiTaskStates.set(blobbiId, { ...taskState, eggTasks: updatedEggTasks });
        }
        return { ...prev, blobbiTaskStates: newBlobbiTaskStates };
      });

      // Show completion toast
      toast({
        title: "📸 Photo Task Complete!",
        description: "Your Blobbi photo has been posted! This counts towards your hatching progress.",
        variant: "default",
      });

    } catch (error) {
      console.error('❌ Failed to mark photo task as completed:', error);
    }
  }, [user, nostr, publishEvent, toast]);

  // Function to mark first post task as completed (called by Create Post modal)
  const markFirstPostTaskCompleted = useCallback(async (blobbiId: string) => {
    if (!user || !nostr) return;

    try {
      console.log(`✏️ Marking first post task as completed for Blobbi: ${blobbiId}`);

      // Fetch current Blobbi event to update it
      const signal = AbortSignal.timeout(5000);
      const currentBlobbiEvents = await nostr.query([{
        kinds: [31124],
        authors: [user?.pubkey || ''],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (currentBlobbiEvents.length === 0) {
        console.error('❌ No Blobbi event found for first post task completion');
        return;
      }

      const currentEvent = currentBlobbiEvents[0];

      // Use the new merge helper to safely update tags
      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        addConfirmedTaskId: 'first_post',
      });

      // Publish the updated event
      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      console.log(`✅ Successfully marked first post task as completed for ${blobbiId}`);

      // Update local state
      setState(prev => {
        const newBlobbiTaskStates = new Map(prev.blobbiTaskStates);
        const taskState = newBlobbiTaskStates.get(blobbiId);
        if (taskState) {
          const updatedEggTasks = taskState.eggTasks.map(task =>
            task.id === 'first_post' ? { ...task, completed: true } : task
          );
          newBlobbiTaskStates.set(blobbiId, { ...taskState, eggTasks: updatedEggTasks });
        }
        return { ...prev, blobbiTaskStates: newBlobbiTaskStates };
      });

      // Show completion toast
      toast({
        title: "✏️ First Post Task Complete!",
        description: "Your #Blobbi post has been published! This counts towards your hatching progress.",
        variant: "default",
      });

    } catch (error) {
      console.error('❌ Failed to mark first post task as completed:', error);
    }
  }, [user, nostr, publishEvent, toast]);

  const selectedTaskState = state.selectedEggId ? state.blobbiTaskStates.get(state.selectedEggId) : null;
  const progress = getProgress(state.selectedEggId);

  // Check if ready to hatch (global flag for currently selected egg)
  const isReadyToHatch = (() => {
    if (!state.selectedEggId) return false;
    const selectedBlobbi = state.blobbis.find(b => b.id === state.selectedEggId);
    return selectedBlobbi ? isBlobbiReadyToHatch(selectedBlobbi) : false;
  })();

  const isReadyToEvolve = selectedTaskState ? selectedTaskState.evolutionTasks.every(t => t.completed) &&
    selectedTaskState.hatchTime &&
    (Date.now() - selectedTaskState.hatchTime) >= 24 * 60 * 60 * 1000 : false;

  return {
    // Blobbi data
    blobbis: state.blobbis,
    isLoadingBlobbis: state.isLoadingBlobbis,
    blobbiError: state.blobbiError,

    // Task tracking
    eggTasks: selectedTaskState ? selectedTaskState.eggTasks : [],
    evolutionTasks: selectedTaskState ? selectedTaskState.evolutionTasks : [],
    progress,
    isReadyToHatch,
    isReadyToEvolve,
    isBlobbiReadyToHatch,

    // Subscription status
    metadataSubscriptionActive: state.metadataSubscriptionActive,
    taskSubscriptionActive: state.taskSubscriptionActive,
    isListening: selectedTaskState ? selectedTaskState.isListening : false,
    isStartingIncubation: state.isStartingIncubation,

    // Egg selection and incubation
    selectedEggId: state.selectedEggId,
    incubationStartTime: state.incubationStartTime,
    selectEgg,
    startIncubation,
    stopIncubation,
    hatchBlobbi,

    // Fix for getProgress
    getProgress,

    // Controls
    refetchMetadata: fetchBlobbiMetadata,
    markPhotoTaskCompleted,
    markFirstPostTaskCompleted,
    isTaskCompleted,

    // Debug info
    debugInfo: {
      blobbiCreationTime: selectedTaskState?.blobbiCreationTime,
      blobbiCreationDate: selectedTaskState ? new Date(selectedTaskState.blobbiCreationTime).toISOString() : 'N/A',
      lastEventTime: selectedTaskState?.lastEventTime,
      lastEventDate: selectedTaskState?.lastEventTime ? new Date(selectedTaskState.lastEventTime).toISOString() : null,
      uniqueLikersCount: selectedTaskState?.uniqueLikers.size,
      userPubkey: user?.pubkey,
      subscriptionStatus: {
        metadata: state.metadataSubscriptionActive,
        tasks: state.taskSubscriptionActive,
      },
    },
  };
}
