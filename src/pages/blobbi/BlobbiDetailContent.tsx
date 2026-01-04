import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Calendar,
  Heart,
  Sparkles,
  Archive,
  Clock,
  Star,
  Activity,
  Zap,
  MessageCircle,
  TrendingUp,
  Settings,
  Share,
  MoreHorizontal,
  ShoppingBag,
  Package,
  Palette,
  Target,
  CheckCircle,
  Circle,
  Users,
  ExternalLink,
  Egg,
  EggOff,
  Camera,
  PictureInPicture2,
} from 'lucide-react';
import { DailyMissionsCard } from '@/components/blobbi/DailyMissionsCard';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbiById } from '@/hooks/useUserBlobbis';


import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { BlobbiStats } from '@/components/blobbi/BlobbiStats';
import { BlobbiActions } from '@/components/blobbi/BlobbiActions';
import { BlobbiShop } from '@/components/blobbi/BlobbiShop';
import { BlobbiStorage } from '@/components/blobbi/BlobbiStorage';
import { BlobbiCustomization } from '@/components/blobbi/BlobbiCustomization';
import { BlobbiGamesModal } from '@/components/blobbi/BlobbiGamesModal';
import { EvolutionProgress } from '@/components/blobbi/EvolutionProgress';
import { EggGraphic } from '@/components/blobbi/EggGraphic';


import { BlobbiLayout } from '@/components/BlobbiLayout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PolaroidPhotoModal } from '@/components/blobbi/PolaroidPhotoModal';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { useBlobbiQuestSystem } from '@/hooks/useBlobbiQuestSystem';

import { formatDistanceToNow } from 'date-fns';
import { getActionDisplayName } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BlobbiAction } from '@/types/blobbi';
import { checkEggHatchingReadiness, checkBabyEvolutionReadiness } from '@/lib/blobbi-evolution';
import { isValidSize } from '@/lib/blobbi-egg-validation';
import { SetCompanionButton } from '@/components/SetCompanionButton';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';
import { BlobbiDetailsTour } from '@/components/BlobbiDetailsTour';
import { TourCompletionModal } from '@/components/TourCompletionModal';
import { useToast } from '@/hooks/useToast';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { useTourCompletion } from '@/hooks/useTourCompletion';
import { useBlobbiPiPController } from '@/hooks/useBlobbiPiPController';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function BlobbiDetailContent({ blobbiId }: { blobbiId: string }) {
  const { user } = useCurrentUser();

  // 🔥 FIX: Use only one hook to prevent conflicting data sources
  // useBlobbiWithFakeStatus already includes all the functionality we need
  const {
    blobbi,
    performAction,
    isPerformingAction,
    triggerEvolution,
    isEvolving,
    isLoading
  } = useBlobbiWithFakeStatus(undefined, blobbiId);

  // 🔥 FIX: Use the blobbi from the fake status hook as the single source of truth
  // This prevents conflicts between real and fake data
  const realBlobbi = blobbi;
  const {
    missions,
    isLoading: isLoadingMissions,
    claimMission1,
    claimMission2,
    claimBonus,
    isClaiming
  } = useDailyMissions();
  const { toast } = useToast();

  const isOwner = user?.pubkey === realBlobbi?.ownerPubkey;

  // PiP controller
  const {
    isPiPActive,
    activeBlobbiId,
    isLoading: isPiPLoading,
    isPiPSupported,
    startPiP,
    stopPiP,
  } = useBlobbiPiPController();

  // Check if PiP is active for this specific Blobbi
  const isPiPActiveForThisBlobbi = isPiPActive && activeBlobbiId === blobbiId;

  // Local state to track when user initiates stop action
  const [isStoppingIncubation, setIsStoppingIncubation] = useState(false);
  const [isStoppingEvolution, setIsStoppingEvolution] = useState(false);

  // Pending states for incubation and evolution
  const [pendingEggToIncubate, setPendingEggToIncubate] = useState<string | null>(null);
  const [pendingBabyToTrack, setPendingBabyToTrack] = useState<string | null>(null);

  // Simple UI flags for immediate feedback
  const [isIncubatingUI, setIsIncubatingUI] = useState(false);
  const [isEvolvingUI, setIsEvolvingUI] = useState(false);

  // Incubation system for eggs
  const {
    selectEgg,
    startIncubation,
    stopIncubation,
    selectedEggId,
    taskSubscriptionActive,
  } = useBlobbiIncubationSystem();

  // Quest system for baby blobbis
  const {
    selectBaby,
    startQuestTracking,
    stopEvolution,
    selectedBabyId,
    questSubscriptionActive,
  } = useBlobbiQuestSystem();

  // NEW — derived booleans to avoid race conditions (moved before early return)
  const hasIncubationTag = realBlobbi?.tags?.some((tag: string[]) =>
    tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
  );
  const isIncubatingThisEgg =
    realBlobbi?.lifeStage === 'egg' &&
    (
      hasIncubationTag ||
      (selectedEggId === realBlobbi.id && taskSubscriptionActive) ||
      isIncubatingUI // Add UI flag for immediate feedback
    );
  const hasEvolutionTag = realBlobbi?.tags?.some((tag: string[]) =>
    tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
  );
  const isEvolvingThisBaby =
    realBlobbi?.lifeStage === 'baby' &&
    (
      hasEvolutionTag ||
      (selectedBabyId === realBlobbi.id && questSubscriptionActive) ||
      isEvolvingUI // Add UI flag for immediate feedback
    );

  // Effect: Sync UI flags with real state to prevent drift (moved before early return)
  useEffect(() => {
    // Reset incubation UI flag when real state shows it's not incubating
    if (isIncubatingUI && !isIncubatingThisEgg && !hasIncubationTag && !(realBlobbi && selectedEggId === realBlobbi.id && taskSubscriptionActive)) {
      console.log('[UI SYNC] Clearing incubation UI flag - real state shows not incubating');
      setIsIncubatingUI(false);
    }
  }, [isIncubatingUI, isIncubatingThisEgg, hasIncubationTag, selectedEggId, taskSubscriptionActive, realBlobbi?.id]);

  useEffect(() => {
    // Reset evolution UI flag when real state shows it's not evolving
    if (isEvolvingUI && !isEvolvingThisBaby && !hasEvolutionTag && !(realBlobbi && selectedBabyId === realBlobbi.id && questSubscriptionActive)) {
      console.log('[UI SYNC] Clearing evolution UI flag - real state shows not evolving');
      setIsEvolvingUI(false);
    }
  }, [isEvolvingUI, isEvolvingThisBaby, hasEvolutionTag, selectedBabyId, questSubscriptionActive, realBlobbi?.id]);

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

  // Use the sleep system
  const {
    isSleeping,
    wakeUp
  } = useBlobbiSleepSystem({
    blobbi: realBlobbi || null,
    isOwner
  });

  // CRITICAL FIX: Auto-wake guard to prevent infinite loop
  // This effect was causing the infinite 14919 loop because it ran on every realBlobbi change
  // We now use a ref to track if we've already auto-woken for this sleep session
  const hasAutoWokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Only attempt auto-wake if:
    // 1. Blobbi exists
    // 2. Energy is at 100
    // 3. Currently sleeping
    // 4. User is owner
    // 5. Haven't already auto-woken this sleep session
    if (realBlobbi && realBlobbi.stats.energy === 100 && isSleeping && isOwner) {
      // Create a unique key for this sleep session
      const sleepSessionKey = `${realBlobbi.id}-${realBlobbi.sleepStartedAt || 'unknown'}`;

      // Guard: Only wake up ONCE per sleep session
      if (hasAutoWokenRef.current !== sleepSessionKey) {
        console.log('[AUTO-WAKE] Triggering auto-wake at 100 energy for session:', sleepSessionKey);
        hasAutoWokenRef.current = sleepSessionKey;
        // wakeUp();
        performAction("rest");
      } else {
        console.log('[AUTO-WAKE] Already woke for this session, skipping');
      }
    }

    // Reset guard when Blobbi wakes up manually or goes to sleep
    if (!isSleeping) {
      hasAutoWokenRef.current = null;
    }
  }, [realBlobbi?.stats.energy, realBlobbi?.id, realBlobbi?.sleepStartedAt, isSleeping, isOwner, wakeUp]);

  // Effect: Handle pending egg incubation when selectedEggId updates
  useEffect(() => {
    if (pendingEggToIncubate && selectedEggId === pendingEggToIncubate) {
      console.log('[INCUBATION] Starting incubation for pending egg:', pendingEggToIncubate);

      // Set UI flag immediately for instant feedback
      setIsIncubatingUI(true);

      startIncubation()
        .catch(error => {
          console.error('[INCUBATION] Failed to start incubation:', error);
          // Reset UI flag on error
          setIsIncubatingUI(false);
        });

      setPendingEggToIncubate(null);
    }
  }, [selectedEggId, pendingEggToIncubate, startIncubation]);

  // Effect: Handle pending baby evolution when selectedBabyId updates
  useEffect(() => {
    if (pendingBabyToTrack && selectedBabyId === pendingBabyToTrack) {
      console.log('[EVOLUTION] Starting quest tracking for pending baby:', pendingBabyToTrack);

      // Set UI flag immediately for instant feedback
      setIsEvolvingUI(true);

      startQuestTracking()
        .catch(error => {
          console.error('[EVOLUTION] Failed to start quest tracking:', error);
          // Reset UI flag on error
          setIsEvolvingUI(false);
        });

      setPendingBabyToTrack(null);
    }
  }, [selectedBabyId, pendingBabyToTrack, startQuestTracking]);



  // Helper function to get valid size for components
  const getValidSize = (size?: string): 'tiny' | 'small' | 'medium' | 'large' => {
    if (size && isValidSize(size)) {
      return size as 'tiny' | 'small' | 'medium' | 'large';
    }
    return 'medium'; // Default fallback
  };

  const [showShop, setShowShop] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showPolaroidModal, setShowPolaroidModal] = useState(false);
  const [activeTab, setActiveTab] = useState('actions');
  const [isDetailsTourActive, setIsDetailsTourActive] = useState(false);
  const [showTourCompletionModal, setShowTourCompletionModal] = useState(false);



  // Auto-start details tour based on sessionStorage
  useEffect(() => {
    const resume = sessionStorage.getItem('tour.resume');
    if (resume) {
      try {
        const data = JSON.parse(resume);
        if (data?.next === 'details' && data?.blobbiId === blobbiId) {
          // Clear the resume token
          sessionStorage.removeItem('tour.resume');
          // Start the details tour
          setIsDetailsTourActive(true);
        } else if (data?.next === 'dashboard-complete') {
          // Handle tour completion from details page
          // Clear the token
          sessionStorage.removeItem('tour.resume');
          // Show completion modal
          setShowTourCompletionModal(true);
          toast({
            title: "Tour Complete! 🎉",
            description: "You've successfully completed the Blobbi tour. Your Blobbi is ready for adventure!",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Error parsing tour resume data:', error);
        sessionStorage.removeItem('tour.resume');
      }
    }
  }, [blobbiId, toast]);

  // Function to start details tour manually
  const startDetailsTour = useCallback((startIndex = 0) => {
    setIsDetailsTourActive(true);
  }, []);

  if (isLoading || !realBlobbi || !blobbi) {
    return (
      <BlobbiLayout>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
          <div className="container mx-auto py-8 px-4">
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </BlobbiLayout>
    );
  }






  // Calculate evolution readiness
  const eggReadiness = realBlobbi.lifeStage === 'egg' ? checkEggHatchingReadiness(realBlobbi) : null;
  const babyReadiness = realBlobbi.lifeStage === 'baby' ? checkBabyEvolutionReadiness(realBlobbi) : null;

  // Mock zaps received (in a real app, this would come from Nostr events)
  const zapsReceived = [
    { id: '1', amount: 100, from: 'npub1...', timestamp: Date.now() - 86400000, message: 'Cute Blobbi!' },
    { id: '2', amount: 50, from: 'npub2...', timestamp: Date.now() - 172800000, message: 'Love the evolution!' },
  ];

  // Mock comments (in a real app, this would come from Nostr events)
  const comments = [
    { id: '1', author: 'npub1...', content: 'Your Blobbi looks amazing!', timestamp: Date.now() - 3600000 },
    { id: '2', author: 'npub2...', content: 'How did you get it to evolve so quickly?', timestamp: Date.now() - 7200000 },
  ];

  return (
    <BlobbiLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto py-8 px-4">

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Visual and Stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* Blobbi Visual */}
          <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 group" id="blobbi-details-visual">
            <CardContent className="p-4 sm:p-6 relative">
              {/* Quick Action Buttons */}
              {isOwner && (
                <>
                  {/* Start/Stop Incubation Button for Eggs */}
                  {blobbi.lifeStage === 'egg' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "absolute top-3 left-3 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                        isIncubatingThisEgg
                          ? "bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-900/30"
                          : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      )}
                      onClick={async () => {
                        if (isIncubatingThisEgg) {
                          setIsStoppingIncubation(true);
                          try {
                            // Clear UI flag immediately for instant feedback
                            setIsIncubatingUI(false);

                            await stopIncubation();
                          } finally {
                            setIsStoppingIncubation(false);
                          }
                        } else {
                          // Set pending state, then select the egg
                          setPendingEggToIncubate(realBlobbi.id);
                          selectEgg(realBlobbi.id);
                        }
                      }}
                      title={isIncubatingThisEgg ? "Stop Incubation" : "Start Incubation"}
                      disabled={isStoppingIncubation}
                    >
                      {hasIncubationTag ? <EggOff className="h-4 w-4 text-purple-600 dark:text-purple-400" /> :
                      <Egg className="h-4 w-4 text-purple-600 dark:text-purple-400" /> }
                    </Button>
                  )}

                  {/* Start/Stop Evolution Button for Babies */}
                  {blobbi.lifeStage === 'baby' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "absolute top-3 left-3 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                        isEvolvingThisBaby
                          ? "bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-900/30"
                          : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      )}
                      onClick={() => {
                        if (isEvolvingThisBaby) {
                          setIsStoppingEvolution(true);

                          // Clear UI flag immediately for instant feedback
                          setIsEvolvingUI(false);

                          stopEvolution().finally(() => {
                            setIsStoppingEvolution(false);
                          });
                        } else {
                          // Set pending state, then select the baby
                          setPendingBabyToTrack(realBlobbi.id);
                          selectBaby(realBlobbi.id);
                        }
                      }}
                      title={isEvolvingThisBaby ? "Stop Evolution" : "Start Evolution"}
                      disabled={isStoppingEvolution}
                    >
                      <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </Button>
                  )}
                </>
              )}

              {/* Action Buttons (PiP & Camera) */}
              {isOwner && (
                <div className="absolute top-3 right-3 z-20 flex gap-2">
                  {/* PiP Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "p-2 h-8 w-8 rounded-full backdrop-blur-sm border transition-all duration-200",
                            isPiPActiveForThisBlobbi
                              ? "bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500 hover:bg-purple-200 dark:hover:bg-purple-900/60"
                              : "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-105"
                          )}
                          onClick={() => {
                            if (isPiPActiveForThisBlobbi) {
                              stopPiP();
                            } else {
                              startPiP({ blobbiId, blobbi: realBlobbi });
                            }
                          }}
                          disabled={isPiPLoading || !isPiPSupported}
                          aria-label={isPiPActiveForThisBlobbi ? "Close PiP" : "Open PiP"}
                        >
                          {isPiPLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                          ) : (
                            <PictureInPicture2
                              className={cn(
                                "h-4 w-4",
                                isPiPActiveForThisBlobbi
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
                          : isPiPActiveForThisBlobbi
                          ? "Close PiP"
                          : "Open PiP"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Camera Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 h-8 w-8 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:scale-105 transition-all duration-200"
                          onClick={() => setShowPolaroidModal(true)}
                          aria-label="Take photo"
                        >
                          <Camera className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Take photo
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 transition-all duration-300 z-0"></div>
              <div className="relative z-10">
                <div className="text-center mb-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">{blobbi.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)} • {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center justify-center transition-all duration-500 min-h-[300px] sm:min-h-[380px]">
                  {blobbi.lifeStage === 'egg' ? (
                    <EggGraphic
                      blobbi={blobbi}
                      size="medium"
                      animated={true}
                      warmth={blobbi.eggTemperature || 60}
                    />
                  ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                    <BlobbiEvolvedVisual
                      blobbi={blobbi}
                      size="medium"
                      onClick={() => isOwner && performAction('play')}
                    />
                  ) : (
                    <BlobbiVisual
                      blobbi={blobbi}
                      size="medium"
                      onClick={() => isOwner && performAction('play')}
                    />
                  )}
                </div>

                {blobbi.state === 'hibernating' && (
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                    Your Blobbi is hibernating. Interact with it to wake it up!
                  </p>
                )}

              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div id="blobbi-details-stats" data-testid="blobbi-stats">
            <BlobbiStats blobbi={blobbi} />
          </div>

          {/* Daily Missions */}
          {isOwner && missions && (
            <DailyMissionsCard
              state={{
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
              }}
              onClaimCheckIn={handleClaimCheckIn}
              onClaimCare3={handleClaimCare3}
              onClaimBonus={handleClaimBonus}
              isClaiming={isClaiming}
            />
          )}



          {/* Quick Info */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Quick Info
              </CardTitle>
              <CardDescription>
                Essential details about your Blobbi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Life Stage</span>
                <Badge variant="outline">
                  {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">State</span>
                <Badge variant={blobbi.state === 'active' ? 'default' : 'secondary'}>
                  {blobbi.state.charAt(0).toUpperCase() + blobbi.state.slice(1)}
                  {isSleeping && ' 💤'}
                </Badge>
              </div>
              {isSleeping && blobbi.sleepStartedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sleeping Since</span>
                  <span className="font-medium">{formatDistanceToNow(blobbi.sleepStartedAt * 1000, { addSuffix: true })}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Experience</span>
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-purple-600" />
                  <span className="font-semibold">{blobbi.experience} XP</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Care</span>
                <span className="font-medium">{formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}</span>
              </div>
              {blobbi.evolutionForm && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Evolution</span>
                  <Badge variant="default" className="gap-1">
                    <Sparkles className="w-3 h-3" />
                    {blobbi.evolutionForm.charAt(0).toUpperCase() + blobbi.evolutionForm.slice(1)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner Actions */}
          {isOwner && (
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600" data-testid="quick-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Manage your Blobbi's needs and activities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SetCompanionButton blobbi={realBlobbi} className="w-full" />
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowShop(true)}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Shop
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowStorage(true)}
                >
                  <Package className="w-4 h-4" />
                  Storage
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowCustomization(true)}
                  disabled
                >
                  <Palette className="w-4 h-4" />
                  Customize
                </Button>

                {realBlobbi.state === 'hibernating' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={wakeUp}
                  >
                    <Activity className="w-4 h-4" />
                    Wake Up
                  </Button>
                )}
                {realBlobbi.state === 'active' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {/* Archive logic */}}
                    disabled
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Detailed Information */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-2">
                <TabsList className="grid w-full grid-cols-3 bg-purple-50/50 dark:bg-purple-900/20">
                  <TabsTrigger
                    value="actions"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Actions
                  </TabsTrigger>
                  <TabsTrigger
                    value="info"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Info
                  </TabsTrigger>

                  <TabsTrigger
                    value="social"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Social
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            {/* Actions Tab */}
            <TabsContent value="actions">
              {isOwner ? (
                <BlobbiActions
                  blobbi={blobbi}
                  onAction={performAction}
                  isPerformingAction={isPerformingAction}
                  onGamesClick={() => setShowGames(true)}
                  onOpenShop={() => setShowShop(true)}
                  onTakePhoto={() => setShowPolaroidModal(true)}
                  lifecycleStatus={{
                    isEligibleForEvolution: eggReadiness?.isReady || babyReadiness?.isReady || false,
                    evolutionStatus: eggReadiness || babyReadiness || undefined
                  }}
                  onEvolution={triggerEvolution}
                  isIncubatingUI={isIncubatingUI}
                  isEvolvingUI={isEvolvingUI}
                />
              ) : (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share className="w-5 h-5" />
                      Viewing Mode
                    </CardTitle>
                    <CardDescription>
                      You're viewing someone else's Blobbi
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Only the owner can interact with this Blobbi. You can view its stats and evolution progress.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Settings className="w-5 h-5" />
                    Blobbi Information
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Detailed metadata and characteristics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Basic Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">ID</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {blobbi.id.slice(0, 8)}...{blobbi.id.slice(-8)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Size</span>
                          <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                            {blobbi.size || 'medium'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Base Color</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                              style={{ backgroundColor: blobbi.baseColor || '#8B5CF6' }}
                            />
                            <span className="font-mono text-xs">{blobbi.baseColor || '#8B5CF6'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Birth Time</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(blobbi.birthTime).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Owner</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {realBlobbi.ownerPubkey.slice(0, 8)}...{realBlobbi.ownerPubkey.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Advanced Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Care Streak</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.careStreak || 0} days</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Interactions</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.evolutionProgress?.careSessions?.reduce((total, session) => total + (session.actions || 0), 0) || 0}</span>
                        </div>
                        {blobbi.evolutionTime && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Evolution Time</span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(blobbi.evolutionTime).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {blobbi.eggTemperature && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Egg Temperature</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.eggTemperature}°</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Version</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">v1.0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Data Section */}
                  <div className="mt-6 pt-6 border-t border-purple-100 dark:border-purple-600/30">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Raw Data</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto max-w-[290px] sm:max-w-full">
                      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words sm:break-normal">
                        {JSON.stringify(realBlobbi, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Tab */}
            <TabsContent value="social" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <MessageCircle className="w-5 h-5 text-purple-500" />
                    Social Features
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Interactions, comments and zaps for your Blobbi are not available yet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Social is coming soon ✨
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                      Soon you'll be able to see zaps, comments, and other Nostr interactions connected to this Blobbi here.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      For now, you can keep taking care of your Blobbi and getting it ready for the social spotlight.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Shop, Storage, Customization, Games, and Polaroid Photo Dialogs */}
      {isOwner && (
        <>
          <BlobbiShop isOpen={showShop} onClose={() => setShowShop(false)} />
          <BlobbiStorage isOpen={showStorage} onClose={() => setShowStorage(false)} />
          <BlobbiCustomization isOpen={showCustomization} onClose={() => setShowCustomization(false)} />
          <BlobbiGamesModal
            isOpen={showGames}
            onClose={() => setShowGames(false)}
            blobbiId={blobbi.id}
          />
          <PolaroidPhotoModal
            isOpen={showPolaroidModal}
            onClose={() => setShowPolaroidModal(false)}
            blobbi={blobbi}
          />
        </>
      )}

      {/* Blobbi Details Tour */}
      <BlobbiDetailsTour
        isOpen={isDetailsTourActive}
        onClose={() => setIsDetailsTourActive(false)}
        blobbiId={blobbiId}
      />

      {/* Tour Completion Modal */}
      <TourCompletionModal
        isOpen={showTourCompletionModal}
        onClose={() => setShowTourCompletionModal(false)}
      />
        </div>
      </div>
    </BlobbiLayout>
  );
}
