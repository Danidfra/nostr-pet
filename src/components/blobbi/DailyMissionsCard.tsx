import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Gift, Target, Coins, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MissionState {
  status: 'LOCKED' | 'CLAIMABLE' | 'CLAIMED';
  claimedAt?: number;
  progress?: number;
  progressMax?: number;
}

interface DailyMissionsCardProps {
  state: {
    checkIn: MissionState;
    care3: MissionState;
    bonus: MissionState;
  };
  onClaimCheckIn: () => Promise<void>;
  onClaimCare3: () => Promise<void>;
  onClaimBonus: () => Promise<void>;
  isClaiming?: boolean;
}

export function DailyMissionsCard({ 
  state, 
  onClaimCheckIn, 
  onClaimCare3, 
  onClaimBonus, 
  isClaiming = false 
}: DailyMissionsCardProps) {
  const MissionItem = ({ 
    mission, 
    onClaim,
    icon,
    isBonus = false
  }: { 
    mission: MissionState; 
    onClaim: () => Promise<void>;
    icon: React.ReactNode;
    isBonus?: boolean;
  }) => (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border",
      isBonus ? "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-600" : "border-gray-200 dark:border-gray-700"
    )}>
      <div className="flex items-center gap-3 flex-1">
        <div className="text-purple-600 dark:text-purple-400">
          {mission.status === 'CLAIMED' ? (
            <CheckCircle className="w-5 h-5" />
          ) : mission.status === 'CLAIMABLE' ? (
            <Circle className="w-5 h-5" />
          ) : (
            <Lock className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {icon}
              {isBonus ? "Complete both daily missions" : 
               mission.progress !== undefined ? "Care Routine" : "Check In"}
            </span>
            <Badge variant={isBonus ? "default" : "secondary"} className="text-xs">
              <Coins className="w-3 h-3 mr-1" />
              {isBonus ? "+10" : mission.progress !== undefined ? "+25" : "+15"}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {isBonus ? "Complete both missions to earn bonus coins!" :
             mission.progress !== undefined ? "Feed, clean or play with any Blobbi." : "Log in and visit your Blobbi today."}
          </p>
          {mission.progress !== undefined && mission.progressMax !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                <span>Progress</span>
                <span>{mission.progress}/{mission.progressMax}</span>
              </div>
              <Progress value={(mission.progress / mission.progressMax) * 100} className="h-1" />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {mission.status === 'CLAIMABLE' && (
          <Button 
            size="sm" 
            onClick={onClaim}
            disabled={isClaiming}
            className={cn(
              "text-xs",
              isBonus 
                ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            )}
          >
            <Gift className="w-3 h-3 mr-1" />
            Claim
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100" id="daily-missions-card">
          <Target  className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Daily Missions
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300">
          Complete these to earn coins today.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mission 1 - Check In */}
        <MissionItem 
          mission={state.checkIn}
          onClaim={onClaimCheckIn}
          icon={<span className="mr-1">📝</span>}
        />
        
        {/* Mission 2 - Care Routine */}
        <MissionItem 
          mission={state.care3}
          onClaim={onClaimCare3}
          icon={<span className="mr-1">🎮</span>}
        />
        
        {/* Bonus Mission */}
        <MissionItem 
          mission={state.bonus}
          onClaim={onClaimBonus}
          icon={<span className="mr-1">⭐</span>}
          isBonus={true}
        />
        
        {/* Total Rewards Info */}
        <div className="text-xs text-gray-600 dark:text-gray-300 mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-600">
          <div className="flex items-center justify-between">
            <span>Total possible rewards per day:</span>
            <span className="font-semibold text-sm text-purple-600 dark:text-purple-400">
              <Coins className="w-3 h-3 inline mr-1" />
              50 coins
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}