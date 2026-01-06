import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SetCompanionButton } from '@/components/SetCompanionButton';
import { Trophy, Camera, ExternalLink, BarChart3, Coins } from 'lucide-react';
import { Blobbi } from '@/types/blobbi';

interface QuickStats {
  totalBlobbis: number;
  activeBlobbis: number;
  incubatingBlobbis: number;
  evolvedBlobbis: number;
  totalCoins: number;
  totalExperience: number;
  achievements: number;
  careStreak: number;
}

interface MissionState {
  checkIn: {
    status: 'LOCKED' | 'CLAIMABLE' | 'CLAIMED';
    claimedAt?: number;
  };
  care3: {
    status: 'LOCKED' | 'CLAIMABLE' | 'CLAIMED';
    progress?: number;
    progressMax?: number;
    claimedAt?: number;
  };
  bonus: {
    status: 'LOCKED' | 'CLAIMABLE' | 'CLAIMED';
    claimedAt?: number;
  };
}

interface DashboardPanelsProps {
  // Stats Panel
  isStatsOpen: boolean;
  onStatsOpenChange: (open: boolean) => void;
  stats: QuickStats;

  // Missions Panel
  isMissionsOpen: boolean;
  onMissionsOpenChange: (open: boolean) => void;
  missionsState: MissionState | null;
  onClaimCheckIn: () => Promise<void>;
  onClaimCare3: () => Promise<void>;
  onClaimBonus: () => Promise<void>;
  isClaiming: boolean;

  // Quick Actions Panel
  isActionsOpen: boolean;
  onActionsOpenChange: (open: boolean) => void;
  selectedBlobbi: Blobbi | null;
  onTakePhoto: () => void;
  onViewDetails: () => void;
}

export function DashboardPanels({
  isStatsOpen,
  onStatsOpenChange,
  stats,
  isMissionsOpen,
  onMissionsOpenChange,
  missionsState,
  onClaimCheckIn,
  onClaimCare3,
  onClaimBonus,
  isClaiming,
  isActionsOpen,
  onActionsOpenChange,
  selectedBlobbi,
  onTakePhoto,
  onViewDetails,
}: DashboardPanelsProps) {
  return (
    <>
      {/* Quick Stats Modal */}
      <Dialog open={isStatsOpen} onOpenChange={onStatsOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-between text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span>Quick Stats</span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Your Blobbi collection overview
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pb-2 max-h-[calc(85vh-120px)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-600/50">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {stats.totalBlobbis}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Blobbis</div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200/50 dark:border-green-600/50">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.activeBlobbis}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Active</div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200/50 dark:border-orange-600/50">
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {stats.incubatingBlobbis}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Incubating</div>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl p-4 border border-pink-200/50 dark:border-pink-600/50">
                <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">
                  {stats.evolvedBlobbis}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Evolved</div>
              </div>
            </div>

            <div className="border-t border-purple-200/50 dark:border-purple-600/50 pt-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl border border-yellow-200/50 dark:border-yellow-600/50">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Coins</span>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                  <Coins className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-semibold text-sm text-yellow-700 dark:text-yellow-300">{stats.totalCoins}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total XP</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.totalExperience}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200/50 dark:border-blue-600/50">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Care Streak</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.careStreak} days
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-600/50">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Achievements</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.achievements}
                </Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Missions Modal */}
      <Dialog open={isMissionsOpen} onOpenChange={onMissionsOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-between text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span>Daily Missions</span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Complete daily tasks to earn rewards
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(85vh-120px)] overflow-y-auto pb-2">
            {missionsState ? (
              <div className="space-y-3">
                {/* Mission 1: Daily Check-In */}
                <div className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 border border-purple-200/50 dark:border-purple-600/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
                          Daily Check-In
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Visit your Blobbi today
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">+15</span>
                    </div>
                  </div>
                  {missionsState.checkIn.status === 'CLAIMABLE' && (
                    <Button
                      onClick={onClaimCheckIn}
                      disabled={isClaiming}
                      size="sm"
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      Claim Reward
                    </Button>
                  )}
                  {missionsState.checkIn.status === 'CLAIMED' && (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs text-green-600 dark:text-green-400">
                      <span>✓ Claimed</span>
                    </div>
                  )}
                </div>

                {/* Mission 2: Care 3 */}
                <div className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 border border-purple-200/50 dark:border-purple-600/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
                          Care Routine
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Complete 3 care interactions
                        </p>
                        {missionsState.care3.progress !== undefined && missionsState.care3.status !== 'CLAIMED' && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {missionsState.care3.progress}/{missionsState.care3.progressMax || 3} completed
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">+25</span>
                    </div>
                  </div>
                  {missionsState.care3.status === 'CLAIMABLE' && (
                    <Button
                      onClick={onClaimCare3}
                      disabled={isClaiming}
                      size="sm"
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      Claim Reward
                    </Button>
                  )}
                  {missionsState.care3.status === 'CLAIMED' && (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs text-green-600 dark:text-green-400">
                      <span>✓ Claimed</span>
                    </div>
                  )}
                </div>

                {/* Bonus Mission */}
                <div className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 border border-purple-200/50 dark:border-purple-600/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-500 to-amber-500 flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
                          Daily Bonus
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Complete all daily missions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">+10</span>
                    </div>
                  </div>
                  {missionsState.bonus.status === 'CLAIMABLE' && (
                    <Button
                      onClick={onClaimBonus}
                      disabled={isClaiming}
                      size="sm"
                      className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      Claim Reward
                    </Button>
                  )}
                  {missionsState.bonus.status === 'CLAIMED' && (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs text-green-600 dark:text-green-400">
                      <span>✓ Claimed</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading missions...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Actions Modal */}
      <Dialog open={isActionsOpen} onOpenChange={onActionsOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <span>Quick Actions</span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage your selected Blobbi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pb-2 max-h-[calc(85vh-120px)] overflow-y-auto">
            {selectedBlobbi ? (
              <>
                {/* Set Companion */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
                  <label className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                    Companion Status
                  </label>
                  <SetCompanionButton blobbi={selectedBlobbi} className="w-full" />
                </div>

                {/* Take Photo */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200/50 dark:border-blue-600/50">
                  <label className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                    Capture Memory
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onTakePhoto}
                    className="w-full gap-2 justify-start hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </Button>
                </div>

                {/* View Details */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-600/50">
                  <label className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">
                    More Options
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onViewDetails}
                    className="w-full gap-2 justify-start hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Details
                  </Button>
                </div>

                {/* Blobbi Info */}
                <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                      <span className="text-gray-600 dark:text-gray-400">Life Stage:</span>
                      <Badge variant="outline">{selectedBlobbi.lifeStage}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                      <span className="text-gray-600 dark:text-gray-400">State:</span>
                      <Badge variant="secondary">{selectedBlobbi.state}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                      <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedBlobbi.experience} XP</span>
                    </div>
                    {selectedBlobbi.evolutionForm && (
                      <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                        <span className="text-gray-600 dark:text-gray-400">Evolution:</span>
                        <Badge variant="default">{selectedBlobbi.evolutionForm}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No Blobbi selected
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
