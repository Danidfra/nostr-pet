import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle, Lock, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MissionState {
  checkIn: {
    status: 'LOCKED' | 'READY' | 'CLAIMABLE' | 'CLAIMED';
    claimedAt?: number;
  };
  care3: {
    status: 'LOCKED' | 'READY' | 'CLAIMABLE' | 'CLAIMED';
    progress?: number;
    progressMax?: number;
    claimedAt?: number;
  };
  bonus: {
    status: 'LOCKED' | 'READY' | 'CLAIMABLE' | 'CLAIMED';
    claimedAt?: number;
  };
}

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: MissionState;
  onClaimCheckIn: () => void;
  onClaimCare3: () => void;
  onClaimBonus: () => void;
  isClaiming: boolean;
}

export function MissionsModal({
  isOpen,
  onClose,
  state,
  onClaimCheckIn,
  onClaimCare3,
  onClaimBonus,
  isClaiming,
}: MissionsModalProps) {
  const missions = [
    {
      id: 'check-in',
      title: 'Daily Check-In',
      description: 'Visit your Blobbi today',
      reward: 15,
      icon: CheckCircle,
      status: state.checkIn.status,
      onClaim: onClaimCheckIn,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'care-3',
      title: 'Care Routine',
      description: 'Complete 3 care interactions',
      reward: 25,
      icon: Sparkles,
      status: state.care3.status,
      progress: state.care3.progress || 0,
      progressMax: state.care3.progressMax || 3,
      onClaim: onClaimCare3,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      id: 'bonus',
      title: 'Daily Bonus',
      description: 'Complete all daily missions',
      reward: 10,
      icon: Trophy,
      status: state.bonus.status,
      onClaim: onClaimBonus,
      gradient: 'from-yellow-500 to-amber-500',
    },
  ];

  const totalRewards = missions.reduce((sum, mission) => {
    return sum + (mission.status === 'CLAIMED' ? mission.reward : 0);
  }, 0);

  const completedCount = missions.filter(m => m.status === 'CLAIMED').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center justify-between text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <span className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <span>Daily Missions</span>
            </span>
            <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
              {completedCount}/{missions.length} Complete
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pb-2">
          {missions.map(({ id, title, description, reward, icon: Icon, status, progress, progressMax, onClaim, gradient }) => (
            <div
              key={id}
              className={cn(
                "group relative overflow-hidden rounded-xl p-4",
                "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40",
                "border border-purple-200/50 dark:border-purple-600/50",
                status === 'CLAIMED' && "opacity-60",
                "transition-all duration-200"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br flex-shrink-0",
                    gradient
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
                      {title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {description}
                    </p>
                    {progress !== undefined && progressMax !== undefined && status !== 'CLAIMED' && (
                      <div className="mt-2">
                        <Progress value={(progress / progressMax) * 100} className="h-1.5" />
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {progress}/{progressMax} completed
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-2">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                      +{reward}
                    </span>
                  </div>
                </div>
              </div>

              {(status === 'READY' || status === 'CLAIMABLE') && (
                <Button
                  onClick={onClaim}
                  disabled={isClaiming}
                  size="sm"
                  className={cn(
                    "w-full bg-gradient-to-r text-white shadow-md hover:shadow-lg transition-all",
                    gradient.includes('blue') && "from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600",
                    gradient.includes('purple') && "from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
                    gradient.includes('yellow') && "from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                  )}
                >
                  Claim Reward
                </Button>
              )}

              {status === 'LOCKED' && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500 dark:text-gray-500">
                  <Lock className="w-3 h-3" />
                  <span>Complete to unlock</span>
                </div>
              )}

              {status === 'CLAIMED' && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>Claimed</span>
                </div>
              )}
            </div>
          ))}

          {/* Summary Card */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Today's Earnings
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="font-bold text-base text-yellow-700 dark:text-yellow-300">
                  +{totalRewards}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
