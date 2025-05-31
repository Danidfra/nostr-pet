import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useBlobbonautProfile, useAddCoins, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { NostrEvent } from '@nostrify/nostrify';

const DAILY_CHECK_IN_KIND = 30079; // Custom kind for daily check-ins

interface DailyCheckIn {
  lastCheckIn: number;
  streak: number;
  totalCheckIns: number;
}

export function useDailyCheckIn() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { mutateAsync: addCoins } = useAddCoins();
  const { mutateAsync: createInitialProfile } = useCreateInitialProfile();
  
  // Fetch check-in data
  const { data: checkInData, isLoading } = useQuery({
    queryKey: ['daily-check-in', user?.pubkey],
    queryFn: async () => {
      if (!user) return null;
      
      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query([
        { 
          kinds: [DAILY_CHECK_IN_KIND], 
          authors: [user.pubkey],
          '#d': ['check-in'],
          limit: 1 
        }
      ], { signal });
      
      if (events[0]) {
        return JSON.parse(events[0].content) as DailyCheckIn;
      }
      
      return {
        lastCheckIn: 0,
        streak: 0,
        totalCheckIns: 0,
      };
    },
    enabled: !!user,
  });
  
  // Check if user can check in today
  const canCheckIn = () => {
    if (!checkInData) return false;
    
    const now = new Date();
    const lastCheckIn = new Date(checkInData.lastCheckIn);
    
    // Check if it's a new day (UTC)
    return now.toDateString() !== lastCheckIn.toDateString();
  };
  
  // Calculate streak status
  const isStreakActive = () => {
    if (!checkInData || checkInData.streak === 0) return false;
    
    const now = new Date();
    const lastCheckIn = new Date(checkInData.lastCheckIn);
    const daysDiff = Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24));
    
    // Streak is broken if more than 1 day has passed
    return daysDiff <= 1;
  };
  
  // Perform daily check-in
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user || !checkInData) throw new Error('Not logged in');
      if (!canCheckIn()) throw new Error('Already checked in today');
      
      const now = Date.now();
      const newStreak = isStreakActive() ? checkInData.streak + 1 : 1;
      const newTotalCheckIns = checkInData.totalCheckIns + 1;
      
      const newCheckInData: DailyCheckIn = {
        lastCheckIn: now,
        streak: newStreak,
        totalCheckIns: newTotalCheckIns,
      };
      
      await publishEvent({
        kind: DAILY_CHECK_IN_KIND,
        content: JSON.stringify(newCheckInData),
        tags: [
          ['d', 'check-in'],
          ['streak', newStreak.toString()],
          ['total', newTotalCheckIns.toString()],
        ],
      });
      
      // Calculate coin reward
      let coinReward = 10; // Base reward
      if (newStreak >= 7) coinReward += 20; // Week streak bonus
      if (newStreak >= 30) coinReward += 50; // Month streak bonus
      
      // Update Blobbanaut Profile with coins
      try {
        if (!blobbonautProfile) {
          // Create initial profile if it doesn't exist
          await createInitialProfile({ coins: coinReward });
        } else {
          // Add coins to existing profile
          await addCoins(coinReward);
        }
      } catch (error) {
        console.error('Failed to update Blobbanaut Profile with coins:', error);
        // Don't fail the check-in if profile update fails
      }
      
      return { checkInData: newCheckInData, coinReward };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-check-in', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['blobbi', user?.pubkey] });
    },
  });
  
  return {
    checkInData,
    isLoading,
    canCheckIn: canCheckIn(),
    isStreakActive: isStreakActive(),
    checkIn: checkInMutation.mutate,
    isCheckingIn: checkInMutation.isPending,
  };
}