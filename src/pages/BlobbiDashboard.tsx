import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { DashboardNotLoggedIn } from '@/components/blobbi/dashboard/DashboardNotLoggedIn';
import { DashboardLoading } from '@/components/blobbi/dashboard/DashboardLoading';
import { DashboardModals } from '@/components/blobbi/dashboard/DashboardModals';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { EggGraphic } from '@/components/blobbi/EggGraphic';
import { BlobbiActionsFooter } from '@/components/blobbi/BlobbiActionsFooter';
import { BlobbiSelectorDrawer } from '@/components/blobbi/BlobbiSelectorDrawer';
import { BlobbiGrowthHubCard } from '@/components/blobbi/BlobbiGrowthHubCard';
import { FloatingMenuButton } from '@/components/blobbi/FloatingMenuButton';
import { DashboardPanels } from '@/components/blobbi/DashboardPanels';
import { CircularStatusIndicators } from '@/components/blobbi/CircularStatusIndicators';
import { BlobbiShop } from '@/components/blobbi/BlobbiShop';
import { BlobbiStorage } from '@/components/blobbi/BlobbiStorage';
import { BlobbiGamesModal } from '@/components/blobbi/BlobbiGamesModal';
import { PolaroidPhotoModal } from '@/components/blobbi/PolaroidPhotoModal';
import {
  Sparkles,
  Egg,
  EggOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: unknown) => void;
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

  // State hooks
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [showTourCompletionModal, setShowTourCompletionModal] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [isBuyCoinsModalOpen, setIsBuyCoinsModalOpen] = useState(false);
  const [showGamesModal, setShowGamesModal] = useState(false);
  const [showPolaroidModal, setShowPolaroidModal] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Panel states
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Selected Blobbi state - defaults to currentCompanion or first active Blobbi
  const [selectedBlobbiId, setSelectedBlobbiId] = useState<string | null>(null);

  // Effect hooks
  const { toast } = useToast();
  useWelcomeConfetti(showTourCompletionModal);

  // Initialize selected Blobbi
  useEffect(() => {
    if (!selectedBlobbiId && userBlobbis.length > 0) {
      // Priority: currentCompanion > first active > first blobbi
      const companionBlobbi = profile?.currentCompanion
        ? userBlobbis.find(b => b.id === profile.currentCompanion)
        : null;

      const firstActive = userBlobbis.find(b => b.state === 'active');
      const fallback = userBlobbis[0];

      const initialBlobbi = companionBlobbi || firstActive || fallback;
      if (initialBlobbi) {
        setSelectedBlobbiId(initialBlobbi.id);
      }
    }
  }, [userBlobbis, profile?.currentCompanion, selectedBlobbiId]);

  // Get the selected Blobbi with fake status
  const {
    blobbi: selectedBlobbi,
    performAction,
    isPerformingAction,
    triggerEvolution,
    isEvolving,
    isLoading: isBlobbiLoading
  } = useBlobbiWithFakeStatus(undefined, selectedBlobbiId || undefined);

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

  // Local UI flags
  const [isIncubatingUI, setIsIncubatingUI] = useState(false);
  const [isEvolvingUI, setIsEvolvingUI] = useState(false);
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
      setIsIncubatingUI(true);
      startIncubation().catch(error => {
        console.error('[INCUBATION] Failed to start incubation:', error);
        setIsIncubatingUI(false);
      });
      setPendingEggToIncubate(null);
    }
  }, [selectedEggId, pendingEggToIncubate, startIncubation]);

  // Effect: Handle pending baby evolution
  useEffect(() => {
    if (pendingBabyToTrack && selectedBabyId === pendingBabyToTrack) {
      setIsEvolvingUI(true);
      startQuestTracking().catch(error => {
        console.error('[EVOLUTION] Failed to start quest tracking:', error);
        setIsEvolvingUI(false);
      });
      setPendingBabyToTrack(null);
    }
  }, [selectedBabyId, pendingBabyToTrack, startQuestTracking]);

  // Sync UI flags
  useEffect(() => {
    if (isIncubatingUI && !selectedBlobbi?.tags?.some((tag: string[]) =>
      tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
    ) && !taskSubscriptionActive) {
      setIsIncubatingUI(false);
    }
  }, [isIncubatingUI, selectedBlobbi?.tags, taskSubscriptionActive]);

  useEffect(() => {
    if (isEvolvingUI && !selectedBlobbi?.tags?.some((tag: string[]) =>
      tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
    ) && !questSubscriptionActive) {
      setIsEvolvingUI(false);
    }
  }, [isEvolvingUI, selectedBlobbi?.tags, questSubscriptionActive]);

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

  // Handlers for incubation/evolution
  const handleStartIncubation = async () => {
    if (!selectedBlobbi) return;
    setPendingEggToIncubate(selectedBlobbi.id);
    selectEgg(selectedBlobbi.id);
  };

  const handleStopIncubation = async () => {
    setHideIncubationUI(true);
    setIsIncubatingUI(false);
    try {
      await stopIncubation();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to stop incubation:', error);
      setHideIncubationUI(false);
      setIsIncubatingUI(true);
    }
  };

  const handleStartQuestTracking = async () => {
    if (!selectedBlobbi) return;
    setPendingBabyToTrack(selectedBlobbi.id);
    selectBaby(selectedBlobbi.id);
  };

  const handleStopEvolution = async () => {
    setHideEvolutionUI(true);
    setIsEvolvingUI(false);
    try {
      await stopEvolution();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to stop evolution:', error);
      setHideEvolutionUI(false);
      setIsEvolvingUI(true);
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

  // Check for selected blobbi
  const hasIncubationTag = selectedBlobbi?.tags?.some((tag: string[]) =>
    tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
  );
  const hasEvolutionTag = selectedBlobbi?.tags?.some((tag: string[]) =>
    tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
  );

  const shouldShowEggGrowthHub = selectedBlobbi?.lifeStage === 'egg' && !hideIncubationUI && (
    hasIncubationTag || taskSubscriptionActive || isIncubatingUI
  );

  const shouldShowBabyGrowthHub = selectedBlobbi?.lifeStage === 'baby' && !hideEvolutionUI && (
    hasEvolutionTag || questSubscriptionActive || isEvolvingUI
  );

  return (
    <BlobbiLayout>
      <div
        className="bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 overflow-y-hidden"
        style={{
          height: 'calc(100dvh - var(--app-header-h))',
          paddingBottom: 'var(--app-footer-h)'
        }}
      >
        {/* Floating Menu Button */}
        <FloatingMenuButton
          coinBalance={stats.totalCoins}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenStorage={() => setIsStorageOpen(true)}
          onOpenStats={() => setIsStatsOpen(true)}
          onOpenMissions={() => setIsMissionsOpen(true)}
          onOpenBlobbiSelector={() => setIsSelectorOpen(true)}
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

        {/* Centered Main Content - Constrained to viewport */}
        <div className="container mx-auto px-4 py-4">
          {selectedBlobbi ? (
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Blobbi Hero Card - Centered Game UI */}
                <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardContent className="p-4 sm:p-6 md:p-8 relative">
                    {/* Incubation/Evolution Toggle Buttons */}
                    {selectedBlobbi.lifeStage === 'egg' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "absolute top-3 left-3 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                          shouldShowEggGrowthHub
                            ? "bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                            : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600"
                        )}
                        onClick={shouldShowEggGrowthHub ? handleStopIncubation : handleStartIncubation}
                      >
                        {shouldShowEggGrowthHub ?
                          <EggOff className="h-4 w-4 text-purple-600 dark:text-purple-400" /> :
                          <Egg className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        }
                      </Button>
                    )}

                    {selectedBlobbi.lifeStage === 'baby' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "absolute top-3 left-3 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                          shouldShowBabyGrowthHub
                            ? "bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                            : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600"
                        )}
                        onClick={shouldShowBabyGrowthHub ? handleStopEvolution : handleStartQuestTracking}
                      >
                        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </Button>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 z-0"></div>

                    <div className="relative z-10">
                      {/* Blobbi Name & Info */}
                      <div className="text-center mb-3">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 capitalize mb-2">
                          {selectedBlobbi.name}
                        </h1>
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs sm:text-sm">
                            {selectedBlobbi.lifeStage}
                          </Badge>
                          {selectedBlobbi.evolutionForm && selectedBlobbi.evolutionForm !== 'blobbi' && (
                            <Badge variant="default" className="gap-1 text-xs sm:text-sm">
                              <Sparkles className="w-3 h-3" />
                              {selectedBlobbi.evolutionForm}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs sm:text-sm">
                            {selectedBlobbi.state}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Born {formatDistanceToNow(selectedBlobbi.birthTime, { addSuffix: true })}
                        </p>

                        {/* Circular Status Indicators */}
                        <CircularStatusIndicators
                          stats={selectedBlobbi.stats}
                          className="mb-3"
                        />
                      </div>

                      {/* Blobbi Visual - Constrained height */}
                      <div className="flex items-center justify-center" style={{ height: 'clamp(250px, 40vh, 350px)' }}>
                        {selectedBlobbi.lifeStage === 'egg' ? (
                          <EggGraphic
                            blobbi={selectedBlobbi}
                            size="large"
                            animated={true}
                            warmth={selectedBlobbi.eggTemperature || 60}
                          />
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
                  </CardContent>
                </Card>

                {/* Growth Hub */}
                {shouldShowEggGrowthHub && (
                  <BlobbiGrowthHubCard
                    blobbi={selectedBlobbi}
                    mode="egg"
                    eggTasks={eggTasks}
                    isReadyToHatch={isReadyToHatch}
                    incubationStartTime={incubationStartTime || undefined}
                    taskSubscriptionActive={taskSubscriptionActive}
                    onStartIncubation={handleStartIncubation}
                    onStopIncubation={handleStopIncubation}
                    onHatchBlobbi={hatchBlobbi}
                    onMarkPhotoTaskCompleted={markPhotoTaskCompleted}
                    onMarkFirstPostTaskCompleted={() => {}}
                    isTaskCompleted={isTaskCompleted}
                    babyQuests={[]}
                    questProgress={{ completed: 0, total: 0, percentage: 0 }}
                    isReadyToEvolve={false}
                    questStartTime={undefined}
                    questSubscriptionActive={false}
                    isQuestListening={false}
                    onStartQuestTracking={() => {}}
                    onStopEvolution={() => {}}
                    onTriggerEvolution={() => {}}
                    isEvolving={false}
                    onTakePhoto={() => setShowPolaroidModal(true)}
                  />
                )}

                {shouldShowBabyGrowthHub && (
                  <BlobbiGrowthHubCard
                    blobbi={selectedBlobbi}
                    mode="baby"
                    eggTasks={[]}
                    isReadyToHatch={false}
                    incubationStartTime={undefined}
                    taskSubscriptionActive={false}
                    onStartIncubation={() => {}}
                    onStopIncubation={() => {}}
                    onHatchBlobbi={() => {}}
                    onMarkPhotoTaskCompleted={() => {}}
                    onMarkFirstPostTaskCompleted={() => {}}
                    isTaskCompleted={() => false}
                    babyQuests={babyToAdultQuests}
                    questProgress={questProgress}
                    isReadyToEvolve={isQuestReadyToEvolve}
                    questStartTime={questStartTime || undefined}
                    questSubscriptionActive={questSubscriptionActive}
                    isQuestListening={isListening}
                    onStartQuestTracking={handleStartQuestTracking}
                    onStopEvolution={handleStopEvolution}
                    onTriggerEvolution={triggerEvolution}
                    isEvolving={isPerformingAction}
                    onTakePhoto={() => setShowPolaroidModal(true)}
                  />
                )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No Blobbi selected. Please select one from the floating menu.
                  </p>
                </CardContent>
              </Card>
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
          isStorageOpen={isStorageOpen}
          setIsStorageOpen={setIsStorageOpen}
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
          </>
        )}

        {/* Sticky Actions Footer - Game Controls */}
        {selectedBlobbi && (
          <div className="fixed bottom-0 left-0 right-0 z-40">
            <BlobbiActionsFooter
              blobbi={selectedBlobbi}
              onAction={performAction}
              isPerformingAction={isPerformingAction}
              onGamesClick={() => setShowGamesModal(true)}
              onOpenShop={() => setIsShopOpen(true)}
            />
          </div>
        )}
      </div>
    </BlobbiLayout>
  );
}
