import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BlobbiGame } from '@/components/blobbi/BlobbiGame';
import { DailyCheckIn } from '@/components/blobbi/DailyCheckIn';
import { DailyMissionsCard } from '@/components/blobbi/DailyMissionsCard';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';
import { BlobbiFooter } from '@/components/blobbi/BlobbiFooter';
import { BlobbiActionsModal } from '@/components/blobbi/BlobbiActionsModal';
import { FloatingMenuButton } from '@/components/blobbi/FloatingMenuButton';
import { BlobbiSelectorDrawer } from '@/components/blobbi/BlobbiSelectorDrawer';
import { BlobbiShop } from '@/components/blobbi/BlobbiShop';
import { BlobbiStorage } from '@/components/blobbi/BlobbiStorage';
import { BlobbiGamesModal } from '@/components/blobbi/BlobbiGamesModal';
import { StatsModal } from '@/components/blobbi/StatsModal';
import { MissionsModal } from '@/components/blobbi/MissionsModal';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useSetCurrentCompanion } from '@/hooks/useSetCurrentCompanion';
import { useToast } from '@/hooks/useToast';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { BlobbiAction } from '@/types/blobbi';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { EnablePushModal } from '@/components/EnablePushModal';

export default function Blobbi() {
  const { user } = useCurrentUser();
  const { blobbi, performAction } = useBlobbiWithFakeStatus();
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const { mutate: setCurrentCompanion } = useSetCurrentCompanion();
  const { updateFakeStatus } = useBlobbiFakeStatus();
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showBlobbiSelector, setShowBlobbiSelector] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<BlobbiAction | null>(null);

  const {
    isSleeping,
    canSleep,
    canWakeUp,
  } = useBlobbiSleepSystem({
    blobbi: blobbi ?? null,
    isOwner: true,
    onOptimisticUpdate: (updatedBlobbi) => {
      if (blobbi) {
        updateFakeStatus(blobbi.id, updatedBlobbi);
      }
    },
  });
  const {
    missions,
    isLoading: isLoadingMissions,
    claimMission1,
    claimMission2,
    claimBonus,
    isClaiming
  } = useDailyMissions();
  const { toast } = useToast();

  const handleSelectBlobbi = (blobbiId: string) => {
    setCurrentCompanion(blobbiId);
    setShowBlobbiSelector(false);
  };

  const handleClaimCheckIn = async () => {
    await claimMission1(undefined, {
      onSuccess: () => {
        toast({
          title: "Check-in Complete!",
          description: "You earned 15 coins for checking in today!",
        });
      },
      onError: () => {
        toast({
          title: "Claim Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      },
    });
  };

  const handleClaimCare3 = async () => {
    await claimMission2(undefined, {
      onSuccess: () => {
        toast({
          title: "Care Routine Complete!",
          description: "You earned 25 coins for completing care interactions!",
        });
      },
      onError: () => {
        toast({
          title: "Claim Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      },
    });
  };

  const handleClaimBonus = async () => {
    await claimBonus(undefined, {
      onSuccess: () => {
        toast({
          title: "Daily Bonus Complete!",
          description: "You earned 10 bonus coins for completing all missions!",
        });
      },
      onError: () => {
        toast({
          title: "Bonus Claim Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      },
    });
  };

  useEffect(() => {
    const checkPushNotificationStatus = async () => {
      // Check if service worker is not available
      if (!('serviceWorker' in navigator)) {
        return;
      }

      // Check if user has chosen "Don't ask again"
      if (localStorage.getItem("blobbiPushDontAskAgain") === "1") {
        return;
      }

      try {
        // Check if service worker is ready and get existing subscription
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          // Subscription exists, set enabled timestamp if not already set
          if (!localStorage.getItem("blobbiPushEnabledAt")) {
            localStorage.setItem("blobbiPushEnabledAt", new Date().toISOString());
          }
          // Don't show modal if subscription exists
          return;
        }

        // No subscription exists, show the modal
        setShowPushModal(true);
      } catch (error) {
        console.error("Error checking push notification status:", error);
        // If there's an error (e.g., service worker not available), don't show modal
      }
    };

    checkPushNotificationStatus();
  }, []); // Run only on mount

  // Lock body scroll on this route
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Blobbi</h1>
            <div className="flex items-center gap-2">
              <SettingsButton />
              <ThemeToggle />
              <LoginArea />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - NO SCROLLING */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 py-3 h-full">
          <div className="grid lg:grid-cols-4 gap-3 h-full">
            <div className="lg:col-span-3 overflow-hidden">
              <BlobbiGame />
            </div>

            {/* Sidebar */}
            {user && (
              <div className="lg:col-span-1 space-y-3 overflow-hidden">
                {/* Blobbonaut Profile */}
                <BlobbonautProfileCard />

            {/* Daily Missions */}
            <DailyMissionsCard
              state={{
                checkIn: {
                  status: missions?.mission1.status || 'LOCKED',
                  claimedAt: missions?.mission1.claimedAt
                },
                care3: {
                  status: missions?.mission2.status || 'LOCKED',
                  progress: missions?.mission2.progress,
                  progressMax: missions?.mission2.progressMax,
                  claimedAt: missions?.mission2.claimedAt
                },
                bonus: {
                  status: missions?.bonus.status || 'LOCKED',
                  claimedAt: missions?.bonus.claimedAt
                }
              }}
              onClaimCheckIn={handleClaimCheckIn}
              onClaimCare3={handleClaimCare3}
              onClaimBonus={handleClaimBonus}
              isClaiming={isClaiming}
            />

            {blobbi && <DailyCheckIn />}

                <Link to="/blobbi/evolution">
                  <Button variant="outline" className="w-full gap-2">
                    <Sparkles className="w-4 h-4" />
                    Evolution Guide
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Footer - Only show if user has a blobbi */}
      {user && blobbi && (
        <BlobbiFooter onOpenActions={() => setShowActionsModal(true)} />
      )}

      {/* Floating Menu Button - Only show if logged in */}
      {user && blobbi && (
        <FloatingMenuButton
          coinBalance={blobbonautProfile?.coins || 0}
          onOpenStats={() => setShowStats(true)}
        />
      )}

      {/* Modals */}
      {blobbi && (
        <>
          <BlobbiActionsModal
            isOpen={showActionsModal}
            onClose={() => setShowActionsModal(false)}
            blobbi={blobbi}
            onAction={(action) => {
              setActionInProgress(action);
              performAction(action).finally(() => setActionInProgress(null));
            }}
            actionInProgress={actionInProgress}
            isSleeping={isSleeping}
            canSleep={canSleep ?? false}
            canWakeUp={canWakeUp ?? false}
          />

          <BlobbiSelectorDrawer
            blobbis={userBlobbis}
            selectedBlobbiId={blobbi.id}
            onSelectBlobbi={handleSelectBlobbi}
            open={showBlobbiSelector}
            onOpenChange={setShowBlobbiSelector}
          />

          <BlobbiShop
            isOpen={showShop}
            onClose={() => setShowShop(false)}
          />

          <BlobbiStorage
            isOpen={showStorage}
            onClose={() => setShowStorage(false)}
          />

          <BlobbiGamesModal
            isOpen={showGames}
            onClose={() => setShowGames(false)}
            blobbiId={blobbi.id}
          />

          {/* Stats Modal */}
          <StatsModal
            isOpen={showStats}
            onClose={() => setShowStats(false)}
            blobbi={blobbi}
          />

          {/* Missions Modal */}
          <MissionsModal
            isOpen={showMissions}
            onClose={() => setShowMissions(false)}
            state={{
              checkIn: {
                status: missions?.mission1.status || 'LOCKED',
                claimedAt: missions?.mission1.claimedAt
              },
              care3: {
                status: missions?.mission2.status || 'LOCKED',
                progress: missions?.mission2.progress,
                progressMax: missions?.mission2.progressMax,
                claimedAt: missions?.mission2.claimedAt
              },
              bonus: {
                status: missions?.bonus.status || 'LOCKED',
                claimedAt: missions?.bonus.claimedAt
              }
            }}
            onClaimCheckIn={handleClaimCheckIn}
            onClaimCare3={handleClaimCare3}
            onClaimBonus={handleClaimBonus}
            isClaiming={isClaiming}
          />
        </>
      )}

      {/* Push Notification Modal */}
      <EnablePushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
      />
    </div>
  );
}