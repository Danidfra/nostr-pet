import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SetCompanionButton } from '@/components/SetCompanionButton';
import { DailyMissionsCard } from '@/components/blobbi/DailyMissionsCard';
import { Trophy, Camera, ExternalLink } from 'lucide-react';
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
      {/* Quick Stats Panel */}
      <Sheet open={isStatsOpen} onOpenChange={onStatsOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Quick Stats
            </SheetTitle>
            <SheetDescription>
              Your Blobbi collection overview
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {stats.totalBlobbis}
                </div>
                <div className="text-xs text-muted-foreground">Total Blobbis</div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.activeBlobbis}
                </div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {stats.incubatingBlobbis}
                </div>
                <div className="text-xs text-muted-foreground">Incubating</div>
              </div>

              <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">
                  {stats.evolvedBlobbis}
                </div>
                <div className="text-xs text-muted-foreground">Evolved</div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Coins</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.totalCoins}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total XP</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.totalExperience}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Care Streak</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.careStreak} days
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Achievements</span>
                <Badge variant="secondary" className="text-sm font-semibold">
                  {stats.achievements}
                </Badge>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Daily Missions Panel */}
      <Sheet open={isMissionsOpen} onOpenChange={onMissionsOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Daily Missions
            </SheetTitle>
            <SheetDescription>
              Complete daily tasks to earn rewards
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {missionsState ? (
              <DailyMissionsCard
                state={missionsState}
                onClaimCheckIn={onClaimCheckIn}
                onClaimCare3={onClaimCare3}
                onClaimBonus={onClaimBonus}
                isClaiming={isClaiming}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Loading missions...
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick Actions Panel */}
      <Sheet open={isActionsOpen} onOpenChange={onActionsOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Quick Actions
            </SheetTitle>
            <SheetDescription>
              Manage your selected Blobbi
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {selectedBlobbi ? (
              <>
                {/* Set Companion */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Companion Status
                  </label>
                  <SetCompanionButton blobbi={selectedBlobbi} className="w-full" />
                </div>

                {/* Take Photo */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Capture Memory
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onTakePhoto}
                    className="w-full gap-2 justify-start"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </Button>
                </div>

                {/* View Details */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    More Options
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onViewDetails}
                    className="w-full gap-2 justify-start"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Details
                  </Button>
                </div>

                {/* Blobbi Info */}
                <div className="mt-6 pt-6 border-t">
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div className="flex justify-between">
                      <span>Life Stage:</span>
                      <Badge variant="outline">{selectedBlobbi.lifeStage}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>State:</span>
                      <Badge variant="secondary">{selectedBlobbi.state}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Experience:</span>
                      <span className="font-semibold">{selectedBlobbi.experience} XP</span>
                    </div>
                    {selectedBlobbi.evolutionForm && (
                      <div className="flex justify-between">
                        <span>Evolution:</span>
                        <Badge variant="default">{selectedBlobbi.evolutionForm}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No Blobbi selected
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
