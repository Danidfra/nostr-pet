/**
 * Unified Blobbi Growth System Hook
 *
 * ARCHITECTURE PRINCIPLES:
 * 1. Pure setState - no side effects inside state updates
 * 2. Immutable state - always clone Maps, Sets, arrays, objects
 * 3. Single source of truth - phase state is authoritative
 * 4. Proper subscription cleanup - AbortController for all subscriptions
 * 5. Consistent tag naming - start_incubation, start_evolution
 * 6. Side effect queue - collect toasts/publishes, flush outside setState
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { NostrEvent } from '@nostrify/nostrify';
import { parseBlobbiFromStateEvent, createBlobbiStateEvent, createBlobbiRecordEvent } from '@/lib/blobbi-events';
import { mergeBlobbiStateTags, extractTagValues } from '@/lib/blobbi-state-merge';
import { Blobbi } from '@/types/blobbi';

// ============================================================================
// TYPES
// ============================================================================

export interface GrowthTask {
  id: string;
  name: string;
  description: string;
  eventKind: number | number[];
  checkFunction: (event: NostrEvent, userPubkey: string, state: GrowthPhaseState) => boolean;
  completed: boolean;
  progress?: number;
  target?: number;
}

interface GrowthPhaseState {
  tasks: GrowthTask[];
  isListening: boolean;
  lastEventTime: number;
  lastInteractionTime: number;
  uniqueLikers: Set<string>;
  uniqueReactors: Set<string>;
  uniqueRepostTargets: Set<string>;
  blobbiHashtagEvents: Set<string>;
  startTime?: number;
  selectedBlobbi?: Blobbi;
}

interface BlobbiGrowthState {
  blobbis: Blobbi[];
  isLoadingBlobbis: boolean;
  blobbiError: Error | null;
  eggPhaseStates: Map<string, GrowthPhaseState>;
  babyPhaseStates: Map<string, GrowthPhaseState>;
  metadataSubscriptionActive: boolean;
  activitySubscriptionActive: boolean;
  hashtagSubscriptionActive: boolean;
  activeEggId: string | null;
  activeBabyId: string | null;
}

// Side effect types
type SideEffect =
  | { type: 'toast'; payload: { title: string; description: string; variant?: 'default' | 'destructive' } }
  | { type: 'publish_confirmation'; payload: { blobbiId: string; taskId: string; isCompleted: boolean; progress?: number } };

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

const EGG_TASKS: GrowthTask[] = [
  {
    id: 'first_post',
    name: 'Publish your first post with #Blobbi',
    description: 'Publish your first kind:1 post that includes the #Blobbi hashtag',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const content = event.content.toLowerCase();
      const hasBlobbiTag = content.includes('#blobbi') ||
        event.tags.some(tag => tag[0] === 't' && tag[1]?.toLowerCase() === 'blobbi');
      return hasBlobbiTag;
    },
    completed: false,
  },
  {
    id: 'post_blobbi_photo',
    name: 'Post a photo of your Blobbi',
    description: 'Use the Polaroid camera to post a photo of this Blobbi on Nostr',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      // Check for image URLs in content
      const imageRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?/i;
      const hasImage = imageRegex.test(event.content);
      // Check for imeta tags (NIP-94)
      const hasImeta = event.tags.some(tag => tag[0] === 'imeta');
      return hasImage || hasImeta;
    },
    completed: false,
  },
  {
    id: 'interact_6',
    name: 'Interact at least 6 times with your Blobbi',
    description: 'Perform 6 interactions (kind:14919) with your incubating Blobbi',
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
    eventKind: 0,
    checkFunction: () => false, // State-based check
    completed: false,
  },
];

const BABY_QUESTS: GrowthTask[] = [
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
    description: 'Post a kind:1 event that includes a YouTube link',
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
    description: 'Create a post including both #Blobbi and #Evolving<NameOfBlobbi>',
    eventKind: 1,
    checkFunction: (event: NostrEvent, userPubkey: string, state: GrowthPhaseState) => {
      if (event.pubkey !== userPubkey || event.kind !== 1) return false;
      const content = event.content.toLowerCase();
      const hasBlobbiTag = content.includes('#blobbi');
      const selectedBlobbi = state.selectedBlobbi;
      if (!selectedBlobbi) return false;
      const evolvingTag = `#evolving${selectedBlobbi.name.toLowerCase()}`;
      return hasBlobbiTag && content.includes(evolvingTag);
    },
    completed: false,
  },
  {
    id: 'mention_user',
    name: 'Mention another user',
    description: 'Create a post that tags another user',
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
    description: 'Post a reply using e and p tags',
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
    description: 'Send a kind:3 event with at least 5 public keys',
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
    description: 'Send 5 unique kind:7 reaction events',
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
    description: 'Send 3 kind:6 repost events',
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
    description: 'React to or repost a post with #Blobbi hashtag',
    eventKind: [6, 7],
    checkFunction: (event: NostrEvent, userPubkey: string, state: GrowthPhaseState) => {
      if (event.pubkey !== userPubkey || (event.kind !== 6 && event.kind !== 7)) return false;
      const eTags = event.tags.filter(tag => tag[0] === 'e');
      if (eTags.length > 0) {
        return state.blobbiHashtagEvents.has(eTags[0][1]);
      }
      return false;
    },
    completed: false,
  },
];

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useBlobbiGrowthSystem() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const [state, setState] = useState<BlobbiGrowthState>({
    blobbis: [],
    isLoadingBlobbis: false,
    blobbiError: null,
    eggPhaseStates: new Map(),
    babyPhaseStates: new Map(),
    metadataSubscriptionActive: false,
    activitySubscriptionActive: false,
    hashtagSubscriptionActive: false,
    activeEggId: null,
    activeBabyId: null,
  });

  // Refs for subscription cleanup
  const metadataAbortRef = useRef<AbortController | null>(null);
  const activityAbortRef = useRef<AbortController | null>(null);
  const hashtagAbortRef = useRef<AbortController | null>(null);
  const isInitializedRef = useRef(false);

  // Side effect queue - collected during setState, flushed after
  const pendingEffectsRef = useRef<SideEffect[]>([]);

  // ============================================================================
  // HELPERS - PURE FUNCTIONS
  // ============================================================================

  const parseStartTimestamp = useCallback((tagValue: string, eventCreatedAt: number): number => {
    const parsed = parseInt(tagValue);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed * 1000;
    }
    console.warn(`[Growth] Invalid tag value "${tagValue}", falling back to event.created_at`);
    return eventCreatedAt * 1000;
  }, []);

  const clonePhaseState = useCallback((state: GrowthPhaseState): GrowthPhaseState => {
    return {
      ...state,
      tasks: state.tasks.map(t => ({ ...t })),
      uniqueLikers: new Set(state.uniqueLikers),
      uniqueReactors: new Set(state.uniqueReactors),
      uniqueRepostTargets: new Set(state.uniqueRepostTargets),
      blobbiHashtagEvents: new Set(state.blobbiHashtagEvents),
    };
  }, []);

  const createInitialPhaseState = useCallback((phase: 'egg' | 'baby'): GrowthPhaseState => {
    return {
      tasks: phase === 'egg' ? EGG_TASKS.map(t => ({ ...t })) : BABY_QUESTS.map(t => ({ ...t })),
      isListening: false,
      lastEventTime: 0,
      lastInteractionTime: 0,
      uniqueLikers: new Set(),
      uniqueReactors: new Set(),
      uniqueRepostTargets: new Set(),
      blobbiHashtagEvents: new Set(),
    };
  }, []);

  const getTaskCompletionMessage = useCallback((taskId: string, taskName: string, phase: 'egg' | 'baby') => {
    const messages: Record<string, { title: string; description: string }> = {
      first_post: { title: '🎯 First Post Complete!', description: 'Your egg is responding to your Nostr activity!' },
      post_blobbi_photo: { title: '📸 Photo Task Complete!', description: 'Your Blobbi photo has been posted!' },
      interact_6: { title: '🎯 Interaction Task Complete!', description: 'You completed 6 interactions!' },
      publish_5_posts: { title: '🌟 5 Posts Complete!', description: 'Excellent content creation!' },
      share_song: { title: '🌟 Song Shared!', description: 'Great taste in music!' },
      use_blobbi_hashtags: { title: '🌟 Blobbi Hashtags Used!', description: 'Your Blobbi feels the love!' },
      react_to_5_posts: { title: '🌟 5 Reactions Complete!', description: 'Amazing engagement!' },
      repost_3_posts: { title: '🌟 3 Reposts Complete!', description: 'Great job sharing content!' },
    };
    return messages[taskId] || {
      title: phase === 'egg' ? '🎯 Task Complete!' : '🌟 Quest Complete!',
      description: `You completed: "${taskName}"`
    };
  }, []);

  // ============================================================================
  // SIDE EFFECT FLUSHING
  // ============================================================================

  useEffect(() => {
    const effects = pendingEffectsRef.current;
    if (effects.length === 0) return;

    pendingEffectsRef.current = [];

    effects.forEach(effect => {
      if (effect.type === 'toast') {
        toast(effect.payload);
      } else if (effect.type === 'publish_confirmation') {
        const { blobbiId, taskId, isCompleted, progress } = effect.payload;
        publishTaskConfirmation(blobbiId, taskId, isCompleted, progress).catch(err => {
          console.error('[Growth] Failed to publish confirmation:', err);
        });
      }
    });
  });

  // ============================================================================
  // PUBLISH HELPERS
  // ============================================================================

  const publishTaskConfirmation = useCallback(async (
    blobbiId: string,
    taskId: string,
    isCompleted: boolean = true,
    progress?: number
  ) => {
    if (!user || !nostr) return;

    try {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (events.length === 0) return;

      const currentEvent = events[0];
      const mergeOptions: Record<string, unknown> = {
        removeTags: [`${taskId}_confirmed`],
      };

      if (isCompleted) {
        mergeOptions.addConfirmedTaskId = taskId;
      }

      if (progress !== undefined) {
        mergeOptions.updateTaskProgress = { taskId, progress };
      }

      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, mergeOptions);

      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });
    } catch (error) {
      console.error('[Growth] Failed to publish task confirmation:', error);
    }
  }, [user, nostr, publishEvent]);

  // ============================================================================
  // EVENT PROCESSORS - PURE (collect side effects)
  // ============================================================================

  const processActivityEvent = useCallback((event: NostrEvent) => {
    if (!user) return;

    if (!event || typeof event.created_at !== 'number' || !event.pubkey || !event.kind) {
      return;
    }

    const eventTimestamp = event.created_at * 1000;

    setState(prevState => {
      const newEggPhaseStates = new Map(prevState.eggPhaseStates);
      const newBabyPhaseStates = new Map(prevState.babyPhaseStates);
      let stateChanged = false;

      // Process egg phase
      if (prevState.activeEggId) {
        const eggState = newEggPhaseStates.get(prevState.activeEggId);
        if (eggState && eggState.startTime && eventTimestamp >= eggState.startTime) {
          const blobbi = prevState.blobbis.find(b => b.id === prevState.activeEggId);
          if (blobbi) {
            const clonedState = clonePhaseState(eggState);
            let taskUpdated = false;

            clonedState.tasks = clonedState.tasks.map(task => {
              if (task.completed) return task;

              // Handle first_post task (auto-detect)
              if (task.id === 'first_post' && event.kind === 1) {
                const content = event.content.toLowerCase();
                const hasBlobbiTag = content.includes('#blobbi') ||
                  event.tags.some(tag => tag[0] === 't' && tag[1]?.toLowerCase() === 'blobbi');

                if (hasBlobbiTag && event.pubkey === user.pubkey) {
                  taskUpdated = true;
                  const message = getTaskCompletionMessage(task.id, task.name, 'egg');
                  pendingEffectsRef.current.push({ type: 'toast', payload: message });
                  pendingEffectsRef.current.push({
                    type: 'publish_confirmation',
                    payload: { blobbiId: prevState.activeEggId!, taskId: task.id, isCompleted: true }
                  });
                  return { ...task, completed: true };
                }
              }

              // Handle post_blobbi_photo task (auto-detect)
              if (task.id === 'post_blobbi_photo' && event.kind === 1) {
                const imageRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?/i;
                const hasImage = imageRegex.test(event.content);
                const hasImeta = event.tags.some(tag => tag[0] === 'imeta');

                if ((hasImage || hasImeta) && event.pubkey === user.pubkey) {
                  taskUpdated = true;
                  const message = getTaskCompletionMessage(task.id, task.name, 'egg');
                  pendingEffectsRef.current.push({ type: 'toast', payload: message });
                  pendingEffectsRef.current.push({
                    type: 'publish_confirmation',
                    payload: { blobbiId: prevState.activeEggId!, taskId: task.id, isCompleted: true }
                  });
                  return { ...task, completed: true };
                }
              }

              // Handle interact_6 task
              if (task.id === 'interact_6' && event.kind === 14919) {
                const blobbiIdTag = event.tags.find(tag => tag[0] === 'blobbi_id');
                const actionTag = event.tags.find(tag => tag[0] === 'action');

                if (
                  blobbiIdTag?.[1] === prevState.activeEggId &&
                  actionTag && ['talk', 'sing', 'warm', 'check', 'medicine', 'clean'].includes(actionTag[1])
                ) {
                  const eventTimeSeconds = event.created_at;
                  const lastInteractionTimeSeconds = clonedState.lastInteractionTime || 0;

                  if (eventTimeSeconds - lastInteractionTimeSeconds >= 3) {
                    clonedState.lastInteractionTime = eventTimeSeconds;
                    const newProgress = (task.progress || 0) + 1;
                    taskUpdated = true;

                    if (newProgress >= (task.target || 6)) {
                      const message = getTaskCompletionMessage(task.id, task.name, 'egg');
                      pendingEffectsRef.current.push({ type: 'toast', payload: message });
                      pendingEffectsRef.current.push({
                        type: 'publish_confirmation',
                        payload: { blobbiId: prevState.activeEggId!, taskId: task.id, isCompleted: true }
                      });
                      return { ...task, progress: newProgress, completed: true };
                    } else {
                      pendingEffectsRef.current.push({
                        type: 'toast',
                        payload: {
                          title: '🎯 Interaction Counted!',
                          description: `Progress: ${newProgress}/${task.target} interactions completed.`
                        }
                      });
                      pendingEffectsRef.current.push({
                        type: 'publish_confirmation',
                        payload: { blobbiId: prevState.activeEggId!, taskId: task.id, isCompleted: false, progress: newProgress }
                      });
                      return { ...task, progress: newProgress };
                    }
                  }
                }
              }

              return task;
            });

            if (taskUpdated) {
              newEggPhaseStates.set(prevState.activeEggId, clonedState);
              stateChanged = true;
            }
          }
        }
      }

      // Process baby phase
      if (prevState.activeBabyId) {
        const babyState = newBabyPhaseStates.get(prevState.activeBabyId);
        if (babyState && babyState.startTime && eventTimestamp >= babyState.startTime) {
          const blobbi = prevState.blobbis.find(b => b.id === prevState.activeBabyId);
          if (blobbi) {
            const clonedState = clonePhaseState(babyState);
            clonedState.selectedBlobbi = blobbi;
            let questUpdated = false;

            clonedState.tasks = clonedState.tasks.map(quest => {
              if (quest.completed) return quest;

              const eventKinds = Array.isArray(quest.eventKind) ? quest.eventKind : [quest.eventKind];
              if (!eventKinds.includes(event.kind)) return quest;

              if (quest.checkFunction(event, user.pubkey, clonedState)) {
                if (quest.target && quest.progress !== undefined) {
                  let newProgress = quest.progress;

                  if (quest.id === 'react_to_5_posts') {
                    const eTags = event.tags.filter(tag => tag[0] === 'e');
                    if (eTags.length > 0 && !clonedState.uniqueReactors.has(eTags[0][1])) {
                      clonedState.uniqueReactors.add(eTags[0][1]);
                      newProgress = clonedState.uniqueReactors.size;
                    }
                  } else if (quest.id === 'repost_3_posts') {
                    const eTags = event.tags.filter(tag => tag[0] === 'e');
                    if (eTags.length > 0 && !clonedState.uniqueRepostTargets.has(eTags[0][1])) {
                      clonedState.uniqueRepostTargets.add(eTags[0][1]);
                      newProgress = clonedState.uniqueRepostTargets.size;
                    }
                  } else {
                    newProgress = quest.progress + 1;
                  }

                  questUpdated = true;

                  if (newProgress >= quest.target) {
                    const message = getTaskCompletionMessage(quest.id, quest.name, 'baby');
                    pendingEffectsRef.current.push({
                      type: 'toast',
                      payload: { ...message, description: `${blobbi.name}: ${message.description}` }
                    });
                    pendingEffectsRef.current.push({
                      type: 'publish_confirmation',
                      payload: { blobbiId: prevState.activeBabyId!, taskId: quest.id, isCompleted: true }
                    });
                    return { ...quest, progress: newProgress, completed: true };
                  } else {
                    pendingEffectsRef.current.push({
                      type: 'toast',
                      payload: {
                        title: '📈 Quest Progress!',
                        description: `${blobbi.name}: Progress on "${quest.name}": ${newProgress}/${quest.target}`
                      }
                    });
                    return { ...quest, progress: newProgress };
                  }
                } else {
                  questUpdated = true;
                  const message = getTaskCompletionMessage(quest.id, quest.name, 'baby');
                  pendingEffectsRef.current.push({
                    type: 'toast',
                    payload: { ...message, description: `${blobbi.name}: ${message.description}` }
                  });
                  pendingEffectsRef.current.push({
                    type: 'publish_confirmation',
                    payload: { blobbiId: prevState.activeBabyId!, taskId: quest.id, isCompleted: true }
                  });
                  return { ...quest, completed: true };
                }
              }

              return quest;
            });

            if (questUpdated) {
              newBabyPhaseStates.set(prevState.activeBabyId, clonedState);
              stateChanged = true;
            }
          }
        }
      }

      if (!stateChanged) return prevState;

      return {
        ...prevState,
        eggPhaseStates: newEggPhaseStates,
        babyPhaseStates: newBabyPhaseStates,
      };
    });
  }, [user, clonePhaseState, getTaskCompletionMessage]);

  const processBlobbiHashtagEvent = useCallback((event: NostrEvent) => {
    if (event.kind !== 1) return;

    const content = event.content.toLowerCase();
    const hasBlobbiTag = content.includes('#blobbi') ||
      event.tags.some(tag => tag[0] === 't' && tag[1]?.toLowerCase() === 'blobbi');

    if (hasBlobbiTag) {
      setState(prevState => {
        const newBabyPhaseStates = new Map(prevState.babyPhaseStates);
        let updated = false;

        for (const [blobbiId, state] of newBabyPhaseStates) {
          if (!state.blobbiHashtagEvents.has(event.id)) {
            const cloned = clonePhaseState(state);
            cloned.blobbiHashtagEvents.add(event.id);
            newBabyPhaseStates.set(blobbiId, cloned);
            updated = true;
          }
        }

        if (!updated) return prevState;

        return {
          ...prevState,
          babyPhaseStates: newBabyPhaseStates,
        };
      });
    }
  }, [clonePhaseState]);

  // ============================================================================
  // SUBSCRIPTIONS - PROPER CLEANUP
  // ============================================================================

  const startMetadataSubscription = useCallback(async () => {
    if (!user || !nostr || state.metadataSubscriptionActive) return;

    const abortController = new AbortController();
    metadataAbortRef.current = abortController;

    try {
      const subscriptionIterable = nostr.req([{
        kinds: [31124],
        authors: [user.pubkey],
      }]);

      setState(prev => ({ ...prev, metadataSubscriptionActive: true }));

      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (abortController.signal.aborted) break;

            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;

              try {
                const blobbi = parseBlobbiFromStateEvent(event);
                if (blobbi) {
                  setState(prev => {
                    const updatedBlobbis = prev.blobbis.some(b => b.id === blobbi.id)
                      ? prev.blobbis.map(b => b.id === blobbi.id ? blobbi : b)
                      : [...prev.blobbis, blobbi];

                    let newActiveEggId = prev.activeEggId;
                    let newActiveBabyId = prev.activeBabyId;
                    const newEggPhaseStates = new Map(prev.eggPhaseStates);
                    const newBabyPhaseStates = new Map(prev.babyPhaseStates);

                    // Check for start_incubation tag
                    if (blobbi.lifeStage === 'egg') {
                      const startTags = extractTagValues(event, 'start_incubation');
                      if (startTags.length > 0) {
                        const timestamp = parseStartTimestamp(startTags[0], event.created_at);
                        newActiveEggId = blobbi.id;

                        const existingState = newEggPhaseStates.get(blobbi.id);
                        const eggState = existingState ? clonePhaseState(existingState) : createInitialPhaseState('egg');
                        eggState.startTime = timestamp;
                        eggState.isListening = true;

                        // Load confirmed tasks and progress
                        const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);
                        const progressTags = event.tags.filter(tag => tag[0].endsWith('_progress') && tag[1]);

                        eggState.tasks = eggState.tasks.map(task => {
                          const isConfirmed = confirmedTags.some(tag => tag[0] === `${task.id}_confirmed`);
                          const progressTag = progressTags.find(tag => tag[0] === `${task.id}_progress`);
                          const progress = progressTag ? parseInt(progressTag[1]) : task.progress;

                          return {
                            ...task,
                            completed: isConfirmed || task.completed,
                            progress: !isNaN(progress as number) ? progress : task.progress,
                          };
                        });

                        newEggPhaseStates.set(blobbi.id, eggState);
                      } else if (prev.activeEggId === blobbi.id) {
                        newActiveEggId = null;
                      }
                    }

                    // Check for start_evolution tag
                    if (blobbi.lifeStage === 'baby') {
                      const startTags = extractTagValues(event, 'start_evolution');
                      if (startTags.length > 0) {
                        const timestamp = parseStartTimestamp(startTags[0], event.created_at);
                        newActiveBabyId = blobbi.id;

                        const existingState = newBabyPhaseStates.get(blobbi.id);
                        const babyState = existingState ? clonePhaseState(existingState) : createInitialPhaseState('baby');
                        babyState.startTime = timestamp;
                        babyState.isListening = true;
                        babyState.selectedBlobbi = blobbi;

                        // Load confirmed quests
                        const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);

                        babyState.tasks = babyState.tasks.map(task => {
                          const isConfirmed = confirmedTags.some(tag => tag[0] === `${task.id}_confirmed`);
                          return {
                            ...task,
                            completed: isConfirmed || task.completed,
                          };
                        });

                        newBabyPhaseStates.set(blobbi.id, babyState);
                      } else if (prev.activeBabyId === blobbi.id) {
                        newActiveBabyId = null;
                      }
                    }

                    return {
                      ...prev,
                      blobbis: updatedBlobbis,
                      activeEggId: newActiveEggId,
                      activeBabyId: newActiveBabyId,
                      eggPhaseStates: newEggPhaseStates,
                      babyPhaseStates: newBabyPhaseStates,
                    };
                  });
                }
              } catch (error) {
                console.warn('[Growth] Failed to parse Blobbi event:', error);
              }
            } else if (msg[0] === 'CLOSED') {
              setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
              break;
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error('[Growth] Metadata subscription error:', error);
          }
          setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
        }
      })();
    } catch (error) {
      console.error('[Growth] Failed to start metadata subscription:', error);
      setState(prev => ({ ...prev, metadataSubscriptionActive: false }));
    }
  }, [user, nostr, state.metadataSubscriptionActive, parseStartTimestamp, clonePhaseState, createInitialPhaseState]);

  const startActivitySubscription = useCallback(async (sinceTimestamp?: number) => {
    if (!user || !nostr || activityAbortRef.current) return;

    const abortController = new AbortController();
    activityAbortRef.current = abortController;

    try {
      const filters: Array<{ kinds: number[]; '#p'?: string[]; authors?: string[]; since?: number }> = [
        { kinds: [1, 3, 6, 7, 14919], '#p': [user.pubkey] },
        { kinds: [1, 3, 6, 7, 14919], authors: [user.pubkey] }
      ];

      if (sinceTimestamp) {
        const sinceSeconds = Math.floor(sinceTimestamp / 1000);
        filters[0].since = sinceSeconds;
        filters[1].since = sinceSeconds;
      }

      const subscriptionIterable = nostr.req(filters);

      setState(prev => ({ ...prev, activitySubscriptionActive: true }));

      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (abortController.signal.aborted) break;

            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;
              processActivityEvent(event);
            } else if (msg[0] === 'CLOSED') {
              setState(prev => ({ ...prev, activitySubscriptionActive: false }));
              break;
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error('[Growth] Activity subscription error:', error);
          }
          setState(prev => ({ ...prev, activitySubscriptionActive: false }));
        }
      })();
    } catch (error) {
      console.error('[Growth] Failed to start activity subscription:', error);
      setState(prev => ({ ...prev, activitySubscriptionActive: false }));
    }
  }, [user, nostr, processActivityEvent]);

  const startHashtagSubscription = useCallback(async () => {
    if (!user || !nostr || state.hashtagSubscriptionActive) return;

    const abortController = new AbortController();
    hashtagAbortRef.current = abortController;

    try {
      const subscriptionIterable = nostr.req([{
        kinds: [1],
        '#t': ['blobbi'],
      }]);

      setState(prev => ({ ...prev, hashtagSubscriptionActive: true }));

      (async () => {
        try {
          for await (const msg of subscriptionIterable) {
            if (abortController.signal.aborted) break;

            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;
              processBlobbiHashtagEvent(event);
            } else if (msg[0] === 'CLOSED') {
              setState(prev => ({ ...prev, hashtagSubscriptionActive: false }));
              break;
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error('[Growth] Hashtag subscription error:', error);
          }
          setState(prev => ({ ...prev, hashtagSubscriptionActive: false }));
        }
      })();
    } catch (error) {
      console.error('[Growth] Failed to start hashtag subscription:', error);
      setState(prev => ({ ...prev, hashtagSubscriptionActive: false }));
    }
  }, [user, nostr, state.hashtagSubscriptionActive, processBlobbiHashtagEvent]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const fetchBlobbis = useCallback(async () => {
    if (!user || !nostr || state.isLoadingBlobbis) return;

    setState(prev => ({ ...prev, isLoadingBlobbis: true, blobbiError: null }));

    try {
      const signal = AbortSignal.timeout(10000);
      const events = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
      }], { signal });

      const blobbis: Blobbi[] = [];
      const newEggPhaseStates = new Map<string, GrowthPhaseState>();
      const newBabyPhaseStates = new Map<string, GrowthPhaseState>();
      let activeEggId: string | null = null;
      let activeBabyId: string | null = null;
      let earliestStartTime: number | undefined;

      for (const event of events) {
        try {
          const blobbi = parseBlobbiFromStateEvent(event);
          if (blobbi) {
            blobbis.push(blobbi);

            // Check for active egg
            if (blobbi.lifeStage === 'egg') {
              const startTags = extractTagValues(event, 'start_incubation');
              if (startTags.length > 0) {
                const timestamp = parseStartTimestamp(startTags[0], event.created_at);
                activeEggId = blobbi.id;

                const eggState = createInitialPhaseState('egg');
                eggState.startTime = timestamp;
                eggState.isListening = true;

                const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);
                const progressTags = event.tags.filter(tag => tag[0].endsWith('_progress') && tag[1]);

                eggState.tasks = eggState.tasks.map(task => {
                  const isConfirmed = confirmedTags.some(tag => tag[0] === `${task.id}_confirmed`);
                  const progressTag = progressTags.find(tag => tag[0] === `${task.id}_progress`);
                  const progress = progressTag ? parseInt(progressTag[1]) : task.progress;

                  return {
                    ...task,
                    completed: isConfirmed,
                    progress: !isNaN(progress as number) ? progress : task.progress,
                  };
                });

                newEggPhaseStates.set(blobbi.id, eggState);

                if (!earliestStartTime || timestamp < earliestStartTime) {
                  earliestStartTime = timestamp;
                }
              }
            }

            // Check for active baby
            if (blobbi.lifeStage === 'baby') {
              const startTags = extractTagValues(event, 'start_evolution');
              if (startTags.length > 0) {
                const timestamp = parseStartTimestamp(startTags[0], event.created_at);
                activeBabyId = blobbi.id;

                const babyState = createInitialPhaseState('baby');
                babyState.startTime = timestamp;
                babyState.isListening = true;
                babyState.selectedBlobbi = blobbi;

                const confirmedTags = event.tags.filter(tag => tag[0].endsWith('_confirmed') && tag[1]);

                babyState.tasks = babyState.tasks.map(task => {
                  const isConfirmed = confirmedTags.some(tag => tag[0] === `${task.id}_confirmed`);
                  return {
                    ...task,
                    completed: isConfirmed,
                  };
                });

                newBabyPhaseStates.set(blobbi.id, babyState);

                if (!earliestStartTime || timestamp < earliestStartTime) {
                  earliestStartTime = timestamp;
                }
              }
            }
          }
        } catch (error) {
          console.warn('[Growth] Failed to parse Blobbi event:', error);
        }
      }

      setState(prev => ({
        ...prev,
        blobbis,
        eggPhaseStates: newEggPhaseStates,
        babyPhaseStates: newBabyPhaseStates,
        activeEggId,
        activeBabyId,
        isLoadingBlobbis: false,
      }));

      await startMetadataSubscription();
      await startHashtagSubscription();

      if ((activeEggId || activeBabyId) && earliestStartTime) {
        await startActivitySubscription(earliestStartTime);
      }
    } catch (error) {
      console.error('[Growth] Failed to fetch Blobbis:', error);
      setState(prev => ({
        ...prev,
        isLoadingBlobbis: false,
        blobbiError: error as Error
      }));
    }
  }, [
    user,
    nostr,
    state.isLoadingBlobbis,
    parseStartTimestamp,
    createInitialPhaseState,
    startMetadataSubscription,
    startHashtagSubscription,
    startActivitySubscription
  ]);

  useEffect(() => {
    if (user && !isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchBlobbis();
    }

    return () => {
      if (metadataAbortRef.current) {
        metadataAbortRef.current.abort();
        metadataAbortRef.current = null;
      }
      if (activityAbortRef.current) {
        activityAbortRef.current.abort();
        activityAbortRef.current = null;
      }
      if (hashtagAbortRef.current) {
        hashtagAbortRef.current.abort();
        hashtagAbortRef.current = null;
      }
    };
  }, [user, fetchBlobbis]);

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  const getPhaseState = useCallback((blobbiId: string, phase: 'egg' | 'baby') => {
    const states = phase === 'egg' ? state.eggPhaseStates : state.babyPhaseStates;
    return states.get(blobbiId);
  }, [state.eggPhaseStates, state.babyPhaseStates]);

  const getTaskProgress = useCallback((blobbiId: string, phase: 'egg' | 'baby') => {
    const phaseState = getPhaseState(blobbiId, phase);
    if (!phaseState) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = phaseState.tasks.filter(t => t.completed).length;
    const total = phaseState.tasks.length;

    return {
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [getPhaseState]);

  const isPhaseActive = useCallback((blobbiId: string, phase: 'egg' | 'baby'): boolean => {
    return phase === 'egg'
      ? state.activeEggId === blobbiId
      : state.activeBabyId === blobbiId;
  }, [state.activeEggId, state.activeBabyId]);

  const startPhaseTracking = useCallback(async (blobbiId: string, phase: 'egg' | 'baby') => {
    if (!user || !nostr) return;

    try {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (events.length === 0) {
        console.error('[Growth] No Blobbi event found');
        return;
      }

      const currentEvent = events[0];
      const now = Math.floor(Date.now() / 1000);

      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        [phase === 'egg' ? 'startIncubation' : 'startEvolution']: now,
      });

      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });

      if (!activityAbortRef.current) {
        await startActivitySubscription(now * 1000);
      }

      return now;
    } catch (error) {
      console.error('[Growth] Failed to start phase tracking:', error);
      throw error;
    }
  }, [user, nostr, publishEvent, startActivitySubscription]);

  const stopPhaseTracking = useCallback(async (blobbiId: string, phase: 'egg' | 'baby') => {
    if (!user || !nostr) return;

    try {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [31124],
        authors: [user.pubkey],
        '#d': [blobbiId],
        limit: 1,
      }], { signal });

      if (events.length === 0) {
        console.error('[Growth] No Blobbi event found');
        return;
      }

      const currentEvent = events[0];

      const updatedTags = mergeBlobbiStateTags(currentEvent.tags, {
        [phase === 'egg' ? 'removeStartIncubation' : 'removeStartEvolution']: true,
      });

      await publishEvent({
        kind: 31124,
        content: currentEvent.content,
        tags: updatedTags,
      });
    } catch (error) {
      console.error('[Growth] Failed to stop phase tracking:', error);
      throw error;
    }
  }, [user, nostr, publishEvent]);

  const markTaskCompleted = useCallback(async (blobbiId: string, taskId: string) => {
    await publishTaskConfirmation(blobbiId, taskId, true);

    setState(prev => {
      const newEggPhaseStates = new Map(prev.eggPhaseStates);
      const eggState = newEggPhaseStates.get(blobbiId);

      if (eggState) {
        const cloned = clonePhaseState(eggState);
        cloned.tasks = cloned.tasks.map(task =>
          task.id === taskId ? { ...task, completed: true } : task
        );
        newEggPhaseStates.set(blobbiId, cloned);

        return {
          ...prev,
          eggPhaseStates: newEggPhaseStates,
        };
      }

      return prev;
    });

    const eggState = state.eggPhaseStates.get(blobbiId);
    const task = eggState?.tasks.find(t => t.id === taskId);
    const message = getTaskCompletionMessage(taskId, task?.name || '', 'egg');
    toast({
      title: message.title,
      description: message.description,
      variant: 'default',
    });
  }, [publishTaskConfirmation, clonePhaseState, getTaskCompletionMessage, toast]);

  const hatchBlobbi = useCallback(async (blobbiId: string) => {
    if (!user || !nostr) return;

    try {
      toast({
        title: "🥚 Hatching in Progress...",
        description: "Your Blobbi is breaking out of its shell!",
        variant: "default",
      });

      const currentBlobbi = state.blobbis.find(b => b.id === blobbiId);
      if (!currentBlobbi) {
        throw new Error('Blobbi not found');
      }

      const { processHatching } = await import('@/lib/blobbi-evolution');

      const { hatchingRecord, updatedBlobbi } = processHatching(currentBlobbi);

      const recordEventData = createBlobbiRecordEvent(blobbiId, hatchingRecord, `${currentBlobbi.name} has hatched! 🐣✨`);
      await publishEvent(recordEventData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const stateEventData = createBlobbiStateEvent(updatedBlobbi);
      const filteredTags = mergeBlobbiStateTags(stateEventData.tags, {
        removeStartIncubation: true,
      });

      await publishEvent({
        ...stateEventData,
        tags: filteredTags,
      });

      toast({
        title: "🎉 Hatching Complete!",
        description: `${currentBlobbi.name} has successfully hatched into a baby Blobbi!`,
        variant: "default",
      });
    } catch (error) {
      console.error('[Growth] Failed to hatch Blobbi:', error);
      toast({
        title: "❌ Hatching Failed",
        description: "There was an error hatching your Blobbi. Please try again.",
        variant: "destructive",
      });
    }
  }, [user, nostr, state.blobbis, publishEvent, toast]);

  const evolveBlobbi = useCallback(async (blobbiId: string) => {
    if (!user || !nostr) return;

    try {
      toast({
        title: "✨ Evolution in Progress...",
        description: "Your Blobbi is evolving!",
        variant: "default",
      });

      const currentBlobbi = state.blobbis.find(b => b.id === blobbiId);
      if (!currentBlobbi) {
        throw new Error('Blobbi not found');
      }

      const { processEvolution } = await import('@/lib/blobbi-evolution');

      const { evolutionRecord, updatedBlobbi } = processEvolution(currentBlobbi, 'adult', 'All evolution quests completed');

      const recordEventData = createBlobbiRecordEvent(blobbiId, evolutionRecord, `${currentBlobbi.name} has evolved to adult! ✨`);
      await publishEvent(recordEventData);

      await new Promise(resolve => setTimeout(resolve, 100));

      const stateEventData = createBlobbiStateEvent(updatedBlobbi);
      const filteredTags = mergeBlobbiStateTags(stateEventData.tags, {
        removeStartEvolution: true,
      });

      await publishEvent({
        ...stateEventData,
        tags: filteredTags,
      });

      toast({
        title: "🎉 Evolution Complete!",
        description: `${currentBlobbi.name} has successfully evolved to adult!`,
        variant: "default",
      });
    } catch (error) {
      console.error('[Growth] Failed to evolve Blobbi:', error);
      toast({
        title: "❌ Evolution Failed",
        description: "There was an error evolving your Blobbi. Please try again.",
        variant: "destructive",
      });
    }
  }, [user, nostr, state.blobbis, publishEvent, toast]);

  return {
    blobbis: state.blobbis,
    isLoadingBlobbis: state.isLoadingBlobbis,
    blobbiError: state.blobbiError,
    activeEggId: state.activeEggId,
    activeBabyId: state.activeBabyId,
    getPhaseState,
    getTaskProgress,
    isPhaseActive,
    startPhaseTracking,
    stopPhaseTracking,
    markTaskCompleted,
    hatchBlobbi,
    evolveBlobbi,
    metadataSubscriptionActive: state.metadataSubscriptionActive,
    activitySubscriptionActive: state.activitySubscriptionActive,
    hashtagSubscriptionActive: state.hashtagSubscriptionActive,
    refetchBlobbis: fetchBlobbis,
  };
}
