import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BlobbiGame } from '@/components/blobbi/BlobbiGame';
import { DailyCheckIn } from '@/components/blobbi/DailyCheckIn';
import { DailyMissionsCard } from '@/components/blobbi/DailyMissionsCard';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { useToast } from '@/hooks/useToast';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { EnablePushModal } from '@/components/EnablePushModal';

export default function Blobbi() {
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbiWithFakeStatus();
  const [showPushModal, setShowPushModal] = useState(false);
  const {
    missions,
    isLoading: isLoadingMissions,
    claimMission1,
    claimMission2,
    claimBonus,
    isClaiming
  } = useDailyMissions();
  const { toast } = useToast();

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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold">Blobbi</h1>
            <div className="flex items-center gap-2">
              <SettingsButton />
              <ThemeToggle />
              <LoginArea />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <BlobbiGame />
            </div>

            {/* Sidebar */}
            {user && (
              <div className="lg:col-span-1 space-y-4">
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

      {/* Push Notification Modal */}
      <EnablePushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
      />
    </div>
  );
}