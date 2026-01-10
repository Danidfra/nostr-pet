import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { useBlobbiQuestSystem } from '@/hooks/useBlobbiQuestSystem';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useWelcomeConfetti } from '@/hooks/useWelcomeConfetti';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbiPiPController } from '@/hooks/useBlobbiPiPController';
import { DashboardNotLoggedIn } from '@/components/blobbi/dashboard/DashboardNotLoggedIn';
import { DashboardLoading } from '@/components/blobbi/dashboard/DashboardLoading';
import { DashboardModals } from '@/components/blobbi/dashboard/DashboardModals';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { EggGraphic } from '@/components/blobbi/EggGraphic';
import { BlobbiActionsFooter } from '@/components/blobbi/BlobbiActionsFooter';
import { BlobbiSelectorDrawer } from '@/components/blobbi/BlobbiSelectorDrawer';
import { BlobbiGrowthHubModal } from '@/components/blobbi/BlobbiGrowthHubModal';
import { FloatingMenuButton } from '@/components/blobbi/FloatingMenuButton';
import { DashboardPanels } from '@/components/blobbi/DashboardPanels';
import { CircularStatusIndicators } from '@/components/blobbi/CircularStatusIndicators';
import { BlobbiGamesModal } from '@/components/blobbi/BlobbiGamesModal';
import { PolaroidPhotoModal } from '@/components/blobbi/PolaroidPhotoModal';
import { SettingsModal } from '@/components/SettingsModal';
import { IncubatorVisual } from '@/components/blobbi/IncubatorVisual';
import {
  Sparkles,
  Egg,
  Info,
  Camera,
  PictureInPicture2,
  Users,
  Settings,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: unknown) => void;
  }
}

// LocalStorage helpers for persisting selected Blobbi
const LAST_SELECTED_KEY_BASE = "blobbi:lastSelectedId:v1";

function getStorageKey(userPubkey?: string): string {
  return userPubkey ? `${LAST_SELECTED_KEY_BASE}:${userPubkey}` : LAST_SELECTED_KEY_BASE;
}

function getLastSelectedId(userPubkey?: string): string | null {
  try {
    const key = getStorageKey(userPubkey);
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Failed to read last selected blobbi from localStorage:', error);
    return null;
  }
}

function setLastSelectedId(id: string, userPubkey?: string): void {
  try {
    const key = getStorageKey(userPubkey);
    localStorage.setItem(key, id);
  } catch (error) {
    console.warn('Failed to save last selected blobbi to localStorage:', error);
  }
}

export default function BlobbiDashboard() {
  // All hooks must be called unconditionally at the top
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: profile, isLoading: isProfileLoading } = useBlobbonautProfile();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const { data: coinBalance } = useCoinBalance();
  const { missions, claimMission1, claimMission2, claimBonus, isClaiming } = useDailyMissions();

  // PiP controller
  const {
    isPiPActive,
    activeBlobbiId,
    isLoading: isPiPLoading,
    isPiPSupported,
    startPiP,
    stopPiP,
  } = useBlobbiPiPController();

  // State hooks
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [showTourCompletionModal, setShowTourCompletionModal] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [isBuyCoinsModalOpen, setIsBuyCoinsModalOpen] = useState(false);
  const [showGamesModal, setShowGamesModal] = useState(false);
  const [showPolaroidModal, setShowPolaroidModal] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isBlobbiInfoOpen, setIsBlobbiInfoOpen] = useState(false);
  const [isGrowthHubOpen, setIsGrowthHubOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSwitchIncubationModal, setShowSwitchIncubationModal] = useState(false);
  const [pendingIncubationTargetId, setPendingIncubationTargetId] = useState<string | null>(null);

  // Panel states
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Selected Blobbi state - defaults to currentCompanion or first active Blobbi
  const [selectedBlobbiId, setSelectedBlobbiId] = useState<string | null>(null);

  // Effect hooks
  const { toast } = useToast();
  useWelcomeConfetti(showTourCompletionModal);

  // Initialize selected Blobbi with localStorage persistence
  useEffect(() => {
    // Only initialize when we don't have a selection and blobbis are loaded
    if (selectedBlobbiId || userBlobbis.length === 0) return;

    // Priority 1: Last selected blobbi from localStorage (if still exists)
    const lastSelectedId = getLastSelectedId(user?.pubkey);
    if (lastSelectedId && userBlobbis.some(b => b.id === lastSelectedId)) {
      setSelectedBlobbiId(lastSelectedId);
      return;
    }

    // Priority 2: Current companion (if exists in blobbis)
    const companionBlobbi = profile?.currentCompanion
      ? userBlobbis.find(b => b.id === profile.currentCompanion)
      : null;
    if (companionBlobbi) {
      setSelectedBlobbiId(companionBlobbi.id);
      return;
    }

    // Priority 3: First active blobbi
    const firstActive = userBlobbis.find(b => b.state === 'active');
    if (firstActive) {
      setSelectedBlobbiId(firstActive.id);
      return;
    }

    // Priority 4: First blobbi
    if (userBlobbis[0]) {
      setSelectedBlobbiId(userBlobbis[0].id);
    }
  }, [selectedBlobbiId, userBlobbis, profile?.currentCompanion, user?.pubkey]);

  // Persist selected Blobbi to localStorage whenever it changes
  useEffect(() => {
    if (selectedBlobbiId && userBlobbis.some(b => b.id === selectedBlobbiId)) {
      setLastSelectedId(selectedBlobbiId, user?.pubkey);
    }
  }, [selectedBlobbiId, userBlobbis, user?.pubkey]);

  // Validate selected Blobbi still exists - reset if deleted
  useEffect(() => {
    if (selectedBlobbiId && userBlobbis.length > 0 && !userBlobbis.some(b => b.id === selectedBlobbiId)) {
      // Selected blobbi no longer exists, reset to null to trigger re-initialization
      setSelectedBlobbiId(null);
    }
  }, [selectedBlobbiId, userBlobbis]);

  // Get the selected Blobbi with fake status
  const {
    blobbi: selectedBlobbi,
    performAction,
    isPerformingAction,
    triggerEvolution,
    isEvolving,
    isLoading: isBlobbiLoading
  } = useBlobbiWithFakeStatus(undefined, selectedBlobbiId || undefined);

  // Check if PiP is active for the selected Blobbi
  const isPiPActiveForSelectedBlobbi =  isPiPActive && !!selectedBlobbi && activeBlobbiId === selectedBlobbi.id;

  // Incubation and quest systems
  const {
    eggTasks,
    isReadyToHatch,
    incubationStartTime,
    taskSubscriptionActive,
    startIncubation,
    stopIncubation,
    hatchBlobbi,
    markPhotoTaskCompleted,
    isTaskCompleted,
    selectEgg,
    selectedEggId,
  } = useBlobbiIncubationSystem();

  const {
    babyToAdultQuests,
    questProgress,
    isReadyToEvolve: isQuestReadyToEvolve,
    questStartTime,
    questSubscriptionActive,
    isListening,
    startQuestTracking,
    stopEvolution,
    selectBaby,
    selectedBabyId,
  } = useBlobbiQuestSystem();

  // Local UI flags - SCOPED to blobbi ID for correctness
  const [incubatingUiBlobbiId, setIncubatingUiBlobbiId] = useState<string | null>(null);
  const [evolvingUiBlobbiId, setEvolvingUiBlobbiId] = useState<string | null>(null);
  const [hideIncubationUI, setHideIncubationUI] = useState(false);
  const [hideEvolutionUI, setHideEvolutionUI] = useState(false);
  const [pendingEggToIncubate, setPendingEggToIncubate] = useState<string | null>(null);
  const [pendingBabyToTrack, setPendingBabyToTrack] = useState<string | null>(null);

  // Handle tour completion from details page
  useEffect(() => {
    const resume = sessionStorage.getItem('tour.resume');
    if (resume) {
      try {
        const data = JSON.parse(resume);
        if (data?.next === 'dashboard-complete') {
          sessionStorage.removeItem('tour.resume');
          setShowTourCompletionModal(true);
          toast({
            title: "Tour Complete! 🎉",
            description: "You've successfully completed Blobbi tour. Your Blobbi is ready for adventure!",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Error parsing tour resume data:', error);
        sessionStorage.removeItem('tour.resume');
      }
    }
  }, [toast]);

  // Redirect to adoption page if user doesn't have a profile
  useEffect(() => {
    if (user && !isProfileLoading && !profile) {
      console.log('No profile found, redirecting to adoption page');
      navigate('/blobbi/adopt');
    }
  }, [user, profile, isProfileLoading, navigate]);

  // Check push notification status
  useEffect(() => {
    const checkPushNotificationStatus = async () => {
      if (!('serviceWorker' in navigator) || localStorage.getItem("blobbiPushDontAskAgain") === "1") {
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          if (!localStorage.getItem("blobbiPushEnabledAt")) {
            localStorage.setItem("blobbiPushEnabledAt", new Date().toISOString());
          }
          return;
        }

        setShowPushModal(true);
      } catch (error) {
        console.error("Error checking push notification status:", error);
      }
    };

    checkPushNotificationStatus();
  }, []);

  // Check if we should show welcome modal
  useEffect(() => {
    if (user && !isProfileLoading && !profile?.onboardingDone) {
      setShowWelcomeModal(true);
    }
  }, [user, profile, isProfileLoading]);

  // Effect: Handle pending egg incubation
  useEffect(() => {
    if (pendingEggToIncubate && selectedEggId === pendingEggToIncubate) {
      setIncubatingUiBlobbiId(pendingEggToIncubate);
      startIncubation().catch(error => {
        console.error('[INCUBATION] Failed to start incubation:', error);
        setIncubatingUiBlobbiId(null);
      });
      setPendingEggToIncubate(null);
    }
  }, [selectedEggId, pendingEggToIncubate, startIncubation]);

  // Effect: Handle pending baby evolution
  useEffect(() => {
    if (pendingBabyToTrack && selectedBabyId === pendingBabyToTrack) {
      setEvolvingUiBlobbiId(pendingBabyToTrack);
      startQuestTracking().catch(error => {
        console.error('[EVOLUTION] Failed to start quest tracking:', error);
        setEvolvingUiBlobbiId(null);
      });
      setPendingBabyToTrack(null);
    }
  }, [selectedBabyId, pendingBabyToTrack, startQuestTracking]);

  // Sync UI flags - clear optimistic state when tags appear or subscription ends
  useEffect(() => {
    if (incubatingUiBlobbiId) {
      const blobbi = userBlobbis.find(b => b.id === incubatingUiBlobbiId);
      if (blobbi?.tags?.some((tag: string[]) =>
        tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
      )) {
        // Tags appeared, clear optimistic UI
        setIncubatingUiBlobbiId(null);
      } else if (!taskSubscriptionActive) {
        // Subscription ended without tags appearing, clear optimistic UI
        setIncubatingUiBlobbiId(null);
      }
    }
  }, [incubatingUiBlobbiId, userBlobbis, taskSubscriptionActive]);

  useEffect(() => {
    if (evolvingUiBlobbiId) {
      const blobbi = userBlobbis.find(b => b.id === evolvingUiBlobbiId);
      if (blobbi?.tags?.some((tag: string[]) =>
        tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
      )) {
        // Tags appeared, clear optimistic UI
        setEvolvingUiBlobbiId(null);
      } else if (!questSubscriptionActive) {
        // Subscription ended without tags appearing, clear optimistic UI
        setEvolvingUiBlobbiId(null);
      }
    }
  }, [evolvingUiBlobbiId, userBlobbis, questSubscriptionActive]);

  // Memoized stats
  const stats = useMemo(() => ({
    totalBlobbis: userBlobbis.length,
    activeBlobbis: userBlobbis.filter(b => b.state === 'active').length,
    incubatingBlobbis: userBlobbis.filter(b => b.lifeStage === 'egg').length,
    evolvedBlobbis: userBlobbis.filter(b => b.evolutionForm && b.evolutionForm !== 'blobbi').length,
    totalCoins: coinBalance?.balance || profile?.coins || 0,
    totalExperience: userBlobbis.reduce((sum, b) => sum + b.experience, 0),
    achievements: profile?.achievements.length || 0,
    careStreak: Math.max(...userBlobbis.map(b => b.careStreak || 0), 0),
  }), [userBlobbis, coinBalance, profile]);

  // Find which blobbi is currently incubating (if any)
  const incubatingBlobbi = useMemo(() => {
    return userBlobbis.find(b =>
      b.lifeStage === 'egg' &&
      b.tags?.some((tag: string[]) =>
        tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
      )
    );
  }, [userBlobbis]);

  // Find which blobbi is currently evolving (if any)
  const evolvingBlobbi = useMemo(() => {
    return userBlobbis.find(b =>
      b.lifeStage === 'baby' &&
      b.tags?.some((tag: string[]) =>
        tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
      )
    );
  }, [userBlobbis]);

  // Check if the selected blobbi is actually incubating - SOURCE OF TRUTH
  const isSelectedIncubating = useMemo(() => {
    if (!selectedBlobbi || selectedBlobbi.lifeStage !== 'egg') return false;
    return selectedBlobbi.tags?.some((tag: string[]) =>
      tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
    ) || false;
  }, [selectedBlobbi]);

  // Check if the selected blobbi is actually evolving - SOURCE OF TRUTH
  const isSelectedEvolving = useMemo(() => {
    if (!selectedBlobbi || selectedBlobbi.lifeStage !== 'baby') return false;
    return selectedBlobbi.tags?.some((tag: string[]) =>
      tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
    ) || false;
  }, [selectedBlobbi]);

  // Check if we're optimistically showing incubation UI for the selected blobbi
  const isOptimisticallyIncubating = incubatingUiBlobbiId === selectedBlobbi?.id;
  const isOptimisticallyEvolving = evolvingUiBlobbiId === selectedBlobbi?.id;

  // Handlers for incubation/evolution
  const handleStartIncubation = async () => {
    if (!selectedBlobbi) return;

    // Check if another blobbi is already incubating
    if (incubatingBlobbi && incubatingBlobbi.id !== selectedBlobbi.id) {
      setPendingIncubationTargetId(selectedBlobbi.id);
      setShowSwitchIncubationModal(true);
      return;
    }

    // Proceed with normal incubation start
    setPendingEggToIncubate(selectedBlobbi.id);
    selectEgg(selectedBlobbi.id);
  };

  const handleStopIncubation = async () => {
    if (!selectedBlobbi) return;

    setHideIncubationUI(true);
    setIncubatingUiBlobbiId(null);
    try {
      await stopIncubation();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to stop incubation:', error);
      setHideIncubationUI(false);
      setIncubatingUiBlobbiId(selectedBlobbi.id);
    }
  };

  const confirmSwitchIncubation = async () => {
    if (!pendingIncubationTargetId) return;

    try {
      // Step 1: Stop current incubation (await it)
      await stopIncubation();

      // Step 2: Select the new egg
      selectEgg(pendingIncubationTargetId);

      // Step 3: Start incubation on new egg
      setIncubatingUiBlobbiId(pendingIncubationTargetId);
      setPendingEggToIncubate(pendingIncubationTargetId);

      // Close modal and reset
      setShowSwitchIncubationModal(false);
      setPendingIncubationTargetId(null);

      toast({
        title: "Incubation Switched",
        description: "Successfully switched incubation to the new egg.",
      });
    } catch (error) {
      console.error('[SWITCH INCUBATION] Failed:', error);

      // Clear optimistic state
      setIncubatingUiBlobbiId(null);

      toast({
        title: "Error",
        description: "Failed to switch incubation. Please try again.",
        variant: "destructive",
      });

      // Reset modal state on error
      setShowSwitchIncubationModal(false);
      setPendingIncubationTargetId(null);
    }
  };

  const cancelSwitchIncubation = () => {
    setShowSwitchIncubationModal(false);
    setPendingIncubationTargetId(null);
  };

  const handleStartQuestTracking = async () => {
    if (!selectedBlobbi) return;
    setPendingBabyToTrack(selectedBlobbi.id);
    selectBaby(selectedBlobbi.id);
  };

  const handleStopEvolution = async () => {
    if (!selectedBlobbi) return;

    setHideEvolutionUI(true);
    setEvolvingUiBlobbiId(null);
    try {
      await stopEvolution();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to stop evolution:', error);
      setHideEvolutionUI(false);
      setEvolvingUiBlobbiId(selectedBlobbi.id);
    }
  };

  // Mission handlers
  const handleClaimCheckIn = async () => {
    await claimMission1(undefined, {
      onSuccess: () => {
        toast({
          title: "Check-in Complete!",
          description: "You earned 15 coins for checking in today!",
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
    });
  };

  // Conditional returns
  if (!user) return <DashboardNotLoggedIn />;
  if (user && isProfileLoading) return <DashboardLoading />;
  if (user && !profile) return <DashboardLoading />;

  // Growth Hub display flags - STRICTLY per-blobbi, no global leaks
  const shouldShowEggGrowthHub = selectedBlobbi?.lifeStage === 'egg' && !hideIncubationUI && (
    isSelectedIncubating || isOptimisticallyIncubating
  );

  const shouldShowBabyGrowthHub = selectedBlobbi?.lifeStage === 'baby' && !hideEvolutionUI && (
    isSelectedEvolving || isOptimisticallyEvolving
  );

  return (
    <BlobbiLayout>
      <TooltipProvider>
        <div
          className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-t-2 border-t-purple-300 dark:border-t-purple-600 overflow-y-hidden px-4 py-4 sm:px-6 sm:py-6"
          style={{
            height: 'calc(100dvh - var(--app-header-h))',
            paddingBottom: 'var(--app-footer-h)'
          }}
        >
          {/* Decorative gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30" />

          {/* Real content wrapper */}
          <div className="relative z-10 h-full flex flex-col min-h-0">
        {/* Floating Menu Button */}
        <FloatingMenuButton
          coinBalance={stats.totalCoins}
          onOpenStats={() => setIsStatsOpen(true)}
        />

        {/* Dashboard Panels (Sheets) */}
        <DashboardPanels
          isStatsOpen={isStatsOpen}
          onStatsOpenChange={setIsStatsOpen}
          stats={stats}
          isMissionsOpen={isMissionsOpen}
          onMissionsOpenChange={setIsMissionsOpen}
          missionsState={missions ? {
            checkIn: {
              status: missions.mission1.status || 'LOCKED',
              claimedAt: missions.mission1.claimedAt
            },
            care3: {
              status: missions.mission2.status || 'LOCKED',
              progress: missions.mission2.progress,
              progressMax: missions.mission2.progressMax,
              claimedAt: missions.mission2.claimedAt
            },
            bonus: {
              status: missions.bonus.status || 'LOCKED',
              claimedAt: missions.bonus.claimedAt
            }
          } : null}
          onClaimCheckIn={handleClaimCheckIn}
          onClaimCare3={handleClaimCare3}
          onClaimBonus={handleClaimBonus}
          isClaiming={isClaiming}
          isActionsOpen={isActionsOpen}
          onActionsOpenChange={setIsActionsOpen}
          selectedBlobbi={selectedBlobbi}
          onTakePhoto={() => setShowPolaroidModal(true)}
          onViewDetails={() => selectedBlobbi && navigate(`/blobbi/${selectedBlobbi.id}`)}
        />

        {/* Blobbi Selector Drawer */}
        <BlobbiSelectorDrawer
          blobbis={userBlobbis}
          selectedBlobbiId={selectedBlobbiId}
          onSelectBlobbi={setSelectedBlobbiId}
          open={isSelectorOpen}
          onOpenChange={setIsSelectorOpen}
        />

          {/* Centered Main Content - Fills available height */}
          <div className="container mx-auto max-w-4xl flex-1 min-h-0 flex flex-col gap-4">
            {selectedBlobbi ? (
              <div className="relative flex-1 min-h-0">
                {/* Invisible Control Rail (Desktop Only) - OUTSIDE content bounds */}

                {/* Hero Content (no card wrapper) */}
                <div className="relative h-full flex flex-col min-h-0">
                    {/* Growth Hub Icon Button - Opens Modal */}
                    {selectedBlobbi.lifeStage === 'egg' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "absolute top-3 left-3 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                          shouldShowEggGrowthHub
                            ? "bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600"
                            : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600"
                        )}
                        onClick={() => setIsGrowthHubOpen(true)}
                        aria-label="Open Growth Hub"
                      >
                        <Egg className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </Button>
                    )}

                    {selectedBlobbi.lifeStage === 'baby' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "absolute top-3 left-3 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                          shouldShowBabyGrowthHub
                            ? "bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600"
                            : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600"
                        )}
                        onClick={() => setIsGrowthHubOpen(true)}
                        aria-label="Open Growth Hub"
                      >
                        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </Button>
                    )}

                    {/* Quick Action Buttons - Vertical Column */}
                    <div className="absolute  -right-8 sm:right-3 z-20 flex flex-col gap-2">
                      {/* PiP Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                              isPiPActiveForSelectedBlobbi
                                ? "bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500 hover:bg-purple-200 dark:hover:bg-purple-900/60"
                                : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-105"
                            )}
                            onClick={() => {
                              if (isPiPActiveForSelectedBlobbi) {
                                stopPiP();
                              } else if (selectedBlobbi) {
                                startPiP({ blobbiId: selectedBlobbi.id, blobbi: selectedBlobbi });
                              }
                            }}
                            disabled={isPiPLoading || !isPiPSupported}
                            aria-label={isPiPActiveForSelectedBlobbi ? "Close PiP" : "Open PiP"}
                          >
                            {isPiPLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                            ) : (
                              <PictureInPicture2
                                className={cn(
                                  "h-4 w-4",
                                  isPiPActiveForSelectedBlobbi
                                    ? "text-purple-700 dark:text-purple-300"
                                    : "text-purple-600 dark:text-purple-400"
                                )}
                              />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {!isPiPSupported
                            ? "PiP not supported"
                            : isPiPActiveForSelectedBlobbi
                            ? "Close PiP"
                            : "Open PiP"}
                        </TooltipContent>
                      </Tooltip>

                      {/* Camera Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 h-8 w-8 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-105 transition-all duration-200"
                            onClick={() => setShowPolaroidModal(true)}
                            disabled={!selectedBlobbi}
                            aria-label="Take photo"
                          >
                            <Camera className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Take photo
                        </TooltipContent>
                      </Tooltip>

                      {/* Community Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 h-8 w-8 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-105 transition-all duration-200"
                            onClick={() => navigate('/blobbi/community')}
                            aria-label="Community"
                          >
                            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Community
                        </TooltipContent>
                      </Tooltip>

                      {/* Settings Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 h-8 w-8 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-105 transition-all duration-200"
                            onClick={() => setIsSettingsOpen(true)}
                            aria-label="Settings"
                          >
                            <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Settings
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Content column */}
                    <div className="h-full flex flex-col">
                      {/* Blobbi Name & Info - Fixed height header */}
                      <div className="text-center mb-3 flex-shrink-0">
                        <div className="relative inline-block">
                          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                            {selectedBlobbi.name}
                          </h1>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30"
                            onClick={() => setIsBlobbiInfoOpen(true)}
                            aria-label="Blobbi info"
                          >
                            <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </Button>
                        </div>
                      </div>

                      {/* Circular Status Indicators - Fixed height */}
                      <div className="flex-shrink-0 mb-3">
                        <CircularStatusIndicators
                          stats={selectedBlobbi.stats}
                        />
                      </div>

                      {/* Blobbi Visual - Takes remaining vertical space */}
                      <div className="flex-1 flex items-center justify-center min-h-[220px]">
                        <div
                          className={cn(
                            "mx-auto aspect-square max-w-full transition-all duration-300",
                            // normal
                            "w-[220px] sm:w-[260px]",
                            // incubando: maior
                            (isSelectedIncubating || isOptimisticallyIncubating) && "w-[280px] sm:w-[340px]"
                          )}
                        >
                          {selectedBlobbi.lifeStage === 'egg' ? (
                            // Egg: Wrap with incubator if incubating
                            isSelectedIncubating || isOptimisticallyIncubating ? (
                              <IncubatorVisual className="w-full h-full">
                                <EggGraphic
                                  blobbi={selectedBlobbi}
                                  sizeVariant="tiny"
                                  animated={true}
                                  warmth={selectedBlobbi.eggTemperature || 60}
                                />
                              </IncubatorVisual>
                            ) : (
                              <EggGraphic
                                blobbi={selectedBlobbi}
                                sizeVariant="tiny"
                                animated={true}
                                warmth={selectedBlobbi.eggTemperature || 60}
                              />
                            )
                          ) : selectedBlobbi.evolutionForm && selectedBlobbi.evolutionForm !== 'blobbi' ? (
                            <BlobbiEvolvedVisual
                              blobbi={selectedBlobbi}
                              size="large"
                              onClick={() => performAction('play')}
                            />
                          ) : (
                            <BlobbiVisual
                              blobbi={selectedBlobbi}
                              size="large"
                              onClick={() => performAction('play')}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">
                    No Blobbi selected. Please select one from the floating menu.
                  </p>
                </div>
              )}
          </div>

        {/* Modals */}
        <DashboardModals
          showWelcomeModal={showWelcomeModal}
          setShowWelcomeModal={setShowWelcomeModal}
          isTourActive={isTourActive}
          setIsTourActive={setIsTourActive}
          showTourCompletionModal={showTourCompletionModal}
          setShowTourCompletionModal={setShowTourCompletionModal}
          showPushModal={showPushModal}
          setShowPushModal={setShowPushModal}
          isShopOpen={isShopOpen}
          setIsShopOpen={setIsShopOpen}
          isStorageOpen={isInventoryOpen}
          setIsStorageOpen={setIsInventoryOpen}
          isBuyCoinsModalOpen={isBuyCoinsModalOpen}
          setIsBuyCoinsModalOpen={setIsBuyCoinsModalOpen}
          setActiveTab={() => {}}
        />

        {selectedBlobbi && (
          <>
            <BlobbiGamesModal
              isOpen={showGamesModal}
              onClose={() => setShowGamesModal(false)}
              blobbiId={selectedBlobbi.id}
            />
            <PolaroidPhotoModal
              isOpen={showPolaroidModal}
              onClose={() => setShowPolaroidModal(false)}
              blobbi={selectedBlobbi}
            />

            {/* Growth Hub Modal */}
            {selectedBlobbi.lifeStage === 'egg' && (
              <BlobbiGrowthHubModal
                open={isGrowthHubOpen}
                onOpenChange={setIsGrowthHubOpen}
                blobbi={selectedBlobbi}
                mode="egg"
                eggTasks={eggTasks}
                isReadyToHatch={isReadyToHatch}
                incubationStartTime={isSelectedIncubating ? (incubationStartTime || undefined) : undefined}
                taskSubscriptionActive={isSelectedIncubating && taskSubscriptionActive}
                isIncubatingForThisBlobbi={isSelectedIncubating || isOptimisticallyIncubating}
                onStartIncubation={handleStartIncubation}
                onStopIncubation={handleStopIncubation}
                onHatchBlobbi={hatchBlobbi}
                onMarkPhotoTaskCompleted={markPhotoTaskCompleted}
                onMarkFirstPostTaskCompleted={() => {}}
                isTaskCompleted={isTaskCompleted}
                onTakePhoto={() => setShowPolaroidModal(true)}
              />
            )}

            {selectedBlobbi.lifeStage === 'baby' && (
              <BlobbiGrowthHubModal
                open={isGrowthHubOpen}
                onOpenChange={setIsGrowthHubOpen}
                blobbi={selectedBlobbi}
                mode="baby"
                babyQuests={babyToAdultQuests}
                questProgress={questProgress}
                isReadyToEvolve={isQuestReadyToEvolve}
                questStartTime={isSelectedEvolving ? (questStartTime || undefined) : undefined}
                questSubscriptionActive={isSelectedEvolving && questSubscriptionActive}
                isQuestListening={isSelectedEvolving && isListening}
                isEvolvingForThisBlobbi={isSelectedEvolving || isOptimisticallyEvolving}
                onStartQuestTracking={handleStartQuestTracking}
                onStopEvolution={handleStopEvolution}
                onTriggerEvolution={triggerEvolution}
                isEvolving={isPerformingAction}
                onTakePhoto={() => setShowPolaroidModal(true)}
              />
            )}

            {/* Switch Incubation Confirmation Modal */}
            {incubatingBlobbi && (
              <Dialog open={showSwitchIncubationModal} onOpenChange={setShowSwitchIncubationModal}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Switch Incubation?</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold capitalize">{incubatingBlobbi.name}</span> is currently incubating.
                      Do you want to switch incubation to the selected egg?
                    </p>

                    {/* Thumbnail preview of currently incubating blobbi */}
                    <div className="flex justify-center">
                      <div className="w-32 h-32 flex items-center justify-center">
                        <EggGraphic
                          blobbi={incubatingBlobbi}
                          sizeVariant="tiny"
                          animated={true}
                          warmth={incubatingBlobbi.eggTemperature || 60}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Switching will stop incubation for {incubatingBlobbi.name} and start it for the new egg.
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={cancelSwitchIncubation}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmSwitchIncubation}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Yes, Switch
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Blobbi Info Modal */}
            <Dialog open={isBlobbiInfoOpen} onOpenChange={setIsBlobbiInfoOpen}>
              <DialogContent
                className={cn(
                  "w-[calc(100vw-2rem)]",      // mobile: almost full
                  "sm:w-full",                 // sm+: controled by min/max
                  "sm:min-w-[420px]",          // MIN desktop
                  "sm:max-w-[560px]"           // MAX desktop
                )}
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold capitalize">
                    {selectedBlobbi.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Life Stage */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Life Stage
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {selectedBlobbi.lifeStage}
                    </Badge>
                  </div>

                  {/* State */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      State
                    </span>
                    <Badge variant="secondary" className="capitalize">
                      {selectedBlobbi.state}
                    </Badge>
                  </div>

                  {/* Evolution Form */}
                  {selectedBlobbi.evolutionForm && selectedBlobbi.evolutionForm !== 'blobbi' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Evolution
                      </span>
                      <Badge variant="default" className="gap-1 capitalize">
                        <Sparkles className="w-3 h-3" />
                        {selectedBlobbi.evolutionForm}
                      </Badge>
                    </div>
                  )}

                  {/* Born */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Born
                    </span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {formatDistanceToNow(selectedBlobbi.birthTime, { addSuffix: true })}
                    </span>
                  </div>

                  {/* Generation (if available) */}
                  {selectedBlobbi.generation && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Generation
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {selectedBlobbi.generation}
                      </span>
                    </div>
                  )}

                  {/* Experience */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Experience
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {selectedBlobbi.experience} XP
                    </span>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

          {/* Sticky Actions Footer - Game Controls */}
          {selectedBlobbi && (
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <BlobbiActionsFooter
                blobbi={selectedBlobbi}
                onAction={performAction}
                isPerformingAction={isPerformingAction}
                onOpenShop={() => setIsShopOpen(true)}
                onSwitchBlobbi={() => setIsSelectorOpen(true)}
                onOpenInventory={() => setIsInventoryOpen(true)}
                onOpenMissions={() => setIsMissionsOpen(true)}
              />
            </div>
          )}

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
          </div>
          {/* End of real content wrapper */}
        </div>
      </TooltipProvider>
    </BlobbiLayout>
  );
}
