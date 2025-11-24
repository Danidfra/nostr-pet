import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { BLOBBI_EVENT_KINDS } from '@/lib/blobbi-events';

// Mission tag names (must match spec)
export const MISSION_TAGS = {
  CHECK_IN: 'mission_daily_checkin_claimed_at',
  CARE_3: 'mission_daily_care3_claimed_at',
  BONUS: 'mission_daily_bonus_claimed_at',
} as const;

interface MissionStatus {
  title: string;
  description: string;
  reward: number;
  status: 'LOCKED' | 'CLAIMABLE' | 'CLAIMED';
  claimedAt?: number;
  progress?: number;
  progressMax?: number;
}

export interface DailyMissionsData {
  mission1: MissionStatus;
  mission2: MissionStatus;
  bonus: MissionStatus;
}

// Helper functions for UTC day operations
function getUtcDayStart(): number {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
}

function getUtcDayEnd(): number {
  const start = getUtcDayStart();
  return start + 24 * 60 * 60 * 1000 - 1;
}

function isSameUtcDay(timestampA: number, timestampB: number): boolean {
  const dateA = new Date(timestampA * 1000);
  const dateB = new Date(timestampB * 1000);
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

function isTodayUtc(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return isSameUtcDay(timestamp, now);
}

// Helper to get latest timestamp for a specific tag from Kind 31125 tags
function getLastTagTimestamp(tags: string[][], tagName: string): number | null {
  const tagValues = tags
    .filter(([name]) => name === tagName)
    .map(([, value]) => parseInt(value))
    .filter(value => !isNaN(value) && value > 0);

  if (tagValues.length === 0) return null;
  // Return most recent (highest) timestamp
  return Math.max(...tagValues);
}

export function useDailyMissions() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: blobbonautProfile } = useBlobbonautProfile();

  // Fetch latest Kind 31125 (Blobbanaut Profile) for user
  const { data: profileEvent, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['blobbanaut-profile-event', user?.pubkey],
    queryFn: async () => {
      if (!user) return null;

      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE],
          authors: [user.pubkey],
          limit: 1,
        }
      ], { signal });

      return events[0] || null;
    },
    enabled: !!user,
  });

  // Fetch today's interaction events (Kind 14919) for Mission 2
  const { data: todayInteractions, isLoading: isLoadingInteractions } = useQuery({
    queryKey: ['today-interactions', user?.pubkey],
    queryFn: async () => {
      if (!user) return [];

      const signal = AbortSignal.timeout(5000);
      const dayStart = Math.floor(getUtcDayStart() / 1000);
      const dayEnd = Math.floor(getUtcDayEnd() / 1000);

      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.INTERACTION],
          authors: [user.pubkey],
          since: dayStart,
          until: dayEnd,
        }
      ], { signal });

      return events;
    },
    enabled: !!user,
  });

  // Calculate mission statuses
  const missionsData = useQuery({
    queryKey: ['daily-missions', user?.pubkey, profileEvent?.id, todayInteractions?.length],
    queryFn: (): DailyMissionsData => {
      if (!user || !profileEvent) {
        return {
          mission1: {
            title: "Check In",
            description: "Log in and visit your Blobbi today.",
            reward: 15,
            status: 'LOCKED',
          },
          mission2: {
            title: "Care Routine",
            description: "Feed, clean or play with any Blobbi.",
            reward: 25,
            status: 'LOCKED',
            progress: 0,
            progressMax: 3,
          },
          bonus: {
            title: "Complete both daily missions",
            description: "Complete both missions to earn bonus coins!",
            reward: 10,
            status: 'LOCKED',
          },
        };
      }

      const tags = profileEvent.tags;
      const now = Math.floor(Date.now() / 1000);

      // Mission 1: Check In (always claimable on page load unless already claimed today)
      const lastCheckIn = getLastTagTimestamp(tags, MISSION_TAGS.CHECK_IN);
      const mission1ClaimedToday = lastCheckIn && isTodayUtc(lastCheckIn);
      const mission1Status: MissionStatus = {
        title: "Check In",
        description: "Log in and visit your Blobbi today.",
        reward: 15,
        status: mission1ClaimedToday ? 'CLAIMED' : 'CLAIMABLE',
        claimedAt: mission1ClaimedToday ? lastCheckIn : undefined,
      };

      // Mission 2: Care Routine (requires 3 interactions today)
      const interactionCount = todayInteractions?.length || 0;
      const lastCare = getLastTagTimestamp(tags, MISSION_TAGS.CARE_3);
      const mission2ClaimedToday = lastCare && isTodayUtc(lastCare);
      const mission2Eligible = interactionCount >= 3;
      const mission2Status: MissionStatus = {
        title: "Care Routine",
        description: "Feed, clean or play with any Blobbi.",
        reward: 25,
        status: mission2ClaimedToday ? 'CLAIMED' : (mission2Eligible ? 'CLAIMABLE' : 'LOCKED'),
        claimedAt: mission2ClaimedToday ? lastCare : undefined,
        progress: interactionCount,
        progressMax: 3,
      };

      // Bonus: Complete both missions (only claimable if both are claimed today)
      const lastBonus = getLastTagTimestamp(tags, MISSION_TAGS.BONUS);
      const bonusClaimedToday = lastBonus && isTodayUtc(lastBonus);
      const bonusEligible = mission1ClaimedToday && mission2ClaimedToday;
      const bonusStatus: MissionStatus = {
        title: "Complete both daily missions",
        description: "Complete both missions to earn bonus coins!",
        reward: 10,
        status: bonusClaimedToday ? 'CLAIMED' : (bonusEligible ? 'CLAIMABLE' : 'LOCKED'),
        claimedAt: bonusClaimedToday ? lastBonus : undefined,
      };

      return {
        mission1: mission1Status,
        mission2: mission2Status,
        bonus: bonusStatus,
      };
    },
    enabled: !!user && !!profileEvent && todayInteractions !== undefined,
  });

  // Mutation to claim Mission 1
  const claimMission1Mutation = useMutation({
    mutationFn: async () => {
      if (!user || !profileEvent || !blobbonautProfile) throw new Error('User not logged in or no profile');

      const now = Math.floor(Date.now() / 1000);
      const currentTags = profileEvent.tags;

      // Check if already claimed today
      const lastCheckIn = getLastTagTimestamp(currentTags, MISSION_TAGS.CHECK_IN);
      if (lastCheckIn && isTodayUtc(lastCheckIn)) {
        throw new Error('Already claimed today');
      }

      // Get current coins and calculate new amount
      const currentCoins = blobbonautProfile.coins || 0;
      const newCoins = currentCoins + 15;

      // Create new tags array preserving existing tags, removing existing mission tag and coins, then adding new ones
      const newTags = [
        ...currentTags.filter(([name]) => name !== 'coins' && name !== MISSION_TAGS.CHECK_IN), // Remove existing coins tag and this mission tag
        [MISSION_TAGS.CHECK_IN, now.toString()], // Add new mission claim tag
        ['coins', newCoins.toString()] // Add updated coins tag
      ];

      // Publish new Kind 31125 event with both mission claim and coins update
      await publishEvent({
        kind: BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE,
        content: '',
        tags: newTags,
      });

      return now;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile-event', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile'] });
      queryClient.invalidateQueries({ queryKey: ['daily-missions', user?.pubkey] });
    },
  });

  // Mutation to claim Mission 2
  const claimMission2Mutation = useMutation({
    mutationFn: async () => {
      if (!user || !profileEvent || !blobbonautProfile) throw new Error('User not logged in or no profile');

      const now = Math.floor(Date.now() / 1000);
      const currentTags = profileEvent.tags;

      // Check if already claimed today
      const lastCare = getLastTagTimestamp(currentTags, MISSION_TAGS.CARE_3);
      if (lastCare && isTodayUtc(lastCare)) {
        throw new Error('Already claimed today');
      }

      // Check if eligible (3 interactions today)
      const interactionCount = todayInteractions?.length || 0;
      if (interactionCount < 3) {
        throw new Error('Not enough interactions today');
      }

      // Get current coins and calculate new amount
      const currentCoins = blobbonautProfile.coins || 0;
      const newCoins = currentCoins + 25;

      // Create new tags array preserving existing tags, removing existing mission tag and coins, then adding new ones
      const newTags = [
        ...currentTags.filter(([name]) => name !== 'coins' && name !== MISSION_TAGS.CARE_3), // Remove existing coins tag and this mission tag
        [MISSION_TAGS.CARE_3, now.toString()], // Add new mission claim tag
        ['coins', newCoins.toString()] // Add updated coins tag
      ];

      // Publish new Kind 31125 event with both mission claim and coins update
      await publishEvent({
        kind: BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE,
        content: '',
        tags: newTags,
      });

      return now;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile-event', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile'] });
      queryClient.invalidateQueries({ queryKey: ['daily-missions', user?.pubkey] });
    },
  });

  // Mutation to claim Bonus
  const claimBonusMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profileEvent || !blobbonautProfile) throw new Error('User not logged in or no profile');

      const now = Math.floor(Date.now() / 1000);
      const currentTags = profileEvent.tags;

      // Check if already claimed today
      const lastBonus = getLastTagTimestamp(currentTags, MISSION_TAGS.BONUS);
      if (lastBonus && isTodayUtc(lastBonus)) {
        throw new Error('Already claimed today');
      }

      // Check if both missions are claimed today
      const lastCheckIn = getLastTagTimestamp(currentTags, MISSION_TAGS.CHECK_IN);
      const lastCare = getLastTagTimestamp(currentTags, MISSION_TAGS.CARE_3);
      const bothClaimedToday =
        lastCheckIn && isTodayUtc(lastCheckIn) &&
        lastCare && isTodayUtc(lastCare);

      if (!bothClaimedToday) {
        throw new Error('Both missions must be completed first');
      }

      // Get current coins and calculate new amount
      const currentCoins = blobbonautProfile.coins || 0;
      const newCoins = currentCoins + 10;

      // Create new tags array preserving existing tags, removing existing mission tag and coins, then adding new ones
      const newTags = [
        ...currentTags.filter(([name]) => name !== 'coins' && name !== MISSION_TAGS.BONUS), // Remove existing coins tag and this mission tag
        [MISSION_TAGS.BONUS, now.toString()], // Add new mission claim tag
        ['coins', newCoins.toString()] // Add updated coins tag
      ];

      // Publish new Kind 31125 event with both mission claim and coins update
      await publishEvent({
        kind: BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE,
        content: '',
        tags: newTags,
      });

      return now;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile-event', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile'] });
      queryClient.invalidateQueries({ queryKey: ['daily-missions', user?.pubkey] });
    },
  });

  return {
    missions: missionsData.data,
    isLoading: isLoadingProfile || isLoadingInteractions || missionsData.isLoading,
    claimMission1: claimMission1Mutation.mutate,
    claimMission2: claimMission2Mutation.mutate,
    claimBonus: claimBonusMutation.mutate,
    isClaiming: claimMission1Mutation.isPending || claimMission2Mutation.isPending || claimBonusMutation.isPending,
  };
}