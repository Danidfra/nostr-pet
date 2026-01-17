import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle,
  Circle,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  Egg,
  Sparkles,
  Clock,
  Users,
  ExternalLink,
  ArrowRight,
  Target,
  Zap,
  Baby,
  Send,
  Camera
} from 'lucide-react';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { useBlobbiQuestSystem } from '@/hooks/useBlobbiQuestSystem';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { BlobbiGrowthHubCard } from './BlobbiGrowthHubCard';
import { EggGraphic } from './EggGraphic';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { CreatePostModal } from './CreatePostModal';
import { PolaroidPhotoModal } from './PolaroidPhotoModal';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface BlobbiIncubationDashboardProps {
  className?: string;
}

export function BlobbiIncubationDashboard({ className }: BlobbiIncubationDashboardProps) {
  const {
    blobbis,
    isLoadingBlobbis,
    blobbiError,
    eggTasks,
    evolutionTasks,
    isReadyToHatch,
    isReadyToEvolve,
    isBlobbiReadyToHatch,
    metadataSubscriptionActive,
    taskSubscriptionActive,
    isListening,
    selectedEggId,
    incubationStartTime,
    selectEgg,
    startIncubation,
    stopIncubation,
    hatchBlobbi,
    refetchMetadata,
    debugInfo,
    getProgress,
    markPhotoTaskCompleted,
    markFirstPostTaskCompleted,
    isTaskCompleted,
  } = useBlobbiIncubationSystem();

  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [showPolaroidModal, setShowPolaroidModal] = useState(false);
  const [showBabyList, setShowBabyList] = useState(true);
  const [showAllBabies, setShowAllBabies] = useState(false);

  // New quest system for Baby to Adult evolution
  const {
    babyToAdultQuests,
    questProgress,
    isReadyToEvolve: isQuestReadyToEvolve,
    isBabyReadyToEvolve,
    getBlobbiQuestProgress,
    questSubscriptionActive,
    blobbiHashtagSubscriptionActive,
    isListening: isQuestListening,
    selectedBabyId,
    questStartTime,
    selectBaby,
    startQuestTracking,
    stopQuestTracking,
    stopEvolution,
    debugInfo: questDebugInfo,
  } = useBlobbiQuestSystem();

  // Get evolution function for the selected baby
  const { triggerEvolution, isEvolving } = useBlobbiWithFakeStatus(undefined, selectedBabyId || undefined);

  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showEggList, setShowEggList] = useState(true);
  const [showEvolvedList, setShowEvolvedList] = useState(true);

  // Filter eggs, babies, and adult blobbis
  const eggBlobbis = blobbis.filter(blobbi => blobbi.lifeStage === 'egg');
  const babyBlobbis = blobbis.filter(blobbi => blobbi.lifeStage === 'baby');
  const adultBlobbis = blobbis.filter(blobbi => blobbi.lifeStage === 'adult');
  const evolvedBlobbis = blobbis.filter(blobbi => blobbi.lifeStage !== 'egg');

  // Get selected blobbi (either egg or baby)
  const selectedBlobbi = selectedEggId ? blobbis.find(b => b.id === selectedEggId) : null;
  const selectedBabyBlobbi = selectedBabyId ? blobbis.find(b => b.id === selectedBabyId) : null;
  const currentSelectedBlobbi = selectedBlobbi || selectedBabyBlobbi;

  // Check for babies with evolution already started
  const babiesWithEvolution = babyBlobbis.filter(blobbi => {
    // Check if the baby has evolution started via the quest system
    const babyProgress = getBlobbiQuestProgress(blobbi.id);
    return babyProgress.total > 0; // If there are quests, evolution has started
  });
  const hasEvolutionInProgress = babiesWithEvolution.length > 0;

  // Auto-selection logic with proper priority order
  useEffect(() => {
    // Only auto-select if nothing is currently selected and we have blobbis
    if (!selectedEggId && !selectedBabyId && blobbis.length > 0) {

      // Priority 1: Auto-select eggs (if any exist)
      if (eggBlobbis.length > 0) {
        // Priority 1a: Find egg with start_incubation tag
        const eggWithIncubation = eggBlobbis.find(blobbi =>
          blobbi.tags?.some(tag => tag[0] === 'start_incubation')
        );

        if (eggWithIncubation) {
          // Select the egg that has incubation started
          selectEgg(eggWithIncubation.id);
          console.log('[AUTO-SELECT] Selected egg with start_incubation tag:', eggWithIncubation.id);
        } else {
          // Priority 1b: Fallback to first egg in the list
          const firstEgg = eggBlobbis[0];
          selectEgg(firstEgg.id);
          console.log('[AUTO-SELECT] Selected first egg:', firstEgg.id);
        }
      }
      // Priority 2: Auto-select babies (only if no eggs exist)
      else if (babyBlobbis.length > 0) {
        // Priority 2a: Find baby with start_evolution tag
        const babyWithEvolution = babyBlobbis.find(blobbi =>
          blobbi.tags?.some(tag => tag[0] === 'start_evolution')
        );

        if (babyWithEvolution) {
          // Select the baby that has evolution started
          selectBaby(babyWithEvolution.id);
          console.log('[AUTO-SELECT] Selected baby with start_evolution tag:', babyWithEvolution.id);
        } else {
          // Priority 2b: Fallback to first baby in the list
          const firstBaby = babyBlobbis[0];
          selectBaby(firstBaby.id);
          console.log('[AUTO-SELECT] Selected first baby:', firstBaby.id);
        }
      }
      // Note: Adult blobbis are never auto-selected
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: We only depend on lengths and selection state to avoid infinite loops
    // The arrays themselves change on every render, but we only care about count changes
  }, [
    blobbis.length,
    eggBlobbis.length,
    babyBlobbis.length,
    selectedEggId,
    selectedBabyId,
    selectEgg,
    selectBaby,
  ]);

  const selectedBlobbiProgress = getProgress(selectedEggId);

  // Show loading state
  if (isLoadingBlobbis) {
    return (
      <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <RefreshCw className="h-5 w-5 animate-spin text-purple-500" />
            Loading Blobbi Growth Hub...
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Fetching your Blobbi metadata and setting up task tracking...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show error state
  if (blobbiError) {
    return (
      <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Circle className="h-5 w-5" />
            Error Loading Blobbi System
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            {blobbiError.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={refetchMetadata}
            variant="outline"
            className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show no Blobbis state
  if (blobbis.length === 0) {
    return (
      <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Egg className="h-5 w-5 text-yellow-500" />
            No Blobbis Found
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            You don't have any Blobbis yet. Adopt one to start the incubation process!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-600">
            <div className="text-sm text-purple-600 dark:text-purple-300 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${metadataSubscriptionActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Metadata Subscription: {metadataSubscriptionActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${taskSubscriptionActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Task Subscription: {taskSubscriptionActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* System Status */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
        <CardTitle className="flex flex-col items-center justify-between text-gray-900 dark:text-gray-100 sm:flex-row">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Blobbi Growth Hub
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={metadataSubscriptionActive ? 'default' : 'secondary'}
                className={`flex items-center gap-1 ${
                  metadataSubscriptionActive
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {metadataSubscriptionActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Metadata
              </Badge>
              <Badge
                variant={taskSubscriptionActive ? 'default' : 'secondary'}
                className={`flex items-center gap-1 ${
                  taskSubscriptionActive
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {taskSubscriptionActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Tasks
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={refetchMetadata}
                className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Tracking {blobbis.length} Blobbi{blobbis.length !== 1 ? 's' : ''} with persistent Nostr subscriptions
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Eggs Section */}
      {eggBlobbis.length > 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <Collapsible open={showEggList} onOpenChange={setShowEggList}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2" id='tab-growth-hub-incubating-eggs'>
                    <Egg className="h-5 w-5 text-yellow-500" />
                    Incubating Eggs ({eggBlobbis.length})
                    {!showEggList && eggBlobbis.some(blobbi => isBlobbiReadyToHatch(blobbi)) && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent collapsible toggle
                          // Find the first ready-to-hatch egg and hatch it
                          const readyEgg = eggBlobbis.find(blobbi => isBlobbiReadyToHatch(blobbi));
                          if (readyEgg) {
                            hatchBlobbi(readyEgg.id);
                          }
                        }}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Hatch Ready Egg
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showEggList ? (
                      <ChevronDown className="h-4 w-4 text-purple-500 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-purple-500 transition-transform duration-200" />
                    )}
                  </div>
                </CardTitle>
                {showEggList && (
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Click on an egg to view its detailed incubation progress
                  </CardDescription>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {eggBlobbis.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    <Egg className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No eggs are currently incubating.</p>
                    <p className="text-sm mt-2">Adopt a new Blobbi to start the incubation process!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eggBlobbis.map((blobbi) => (
                      <div
                        id="tab-growth-hub-egg-selection"
                        key={blobbi.id}
                        className={`group transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border shadow-sm hover:shadow-xl hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20 rounded-2xl cursor-pointer hover:scale-[1.02] ${
                          selectedEggId === blobbi.id
                            ? 'border-purple-400 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 shadow-md scale-[1.02] ring-2 ring-purple-200 dark:ring-purple-600'
                            : 'border-purple-200/60 dark:border-purple-600/60 hover:border-purple-300 dark:hover:border-purple-500'
                        }`}
                        onClick={() => {
                          const isAuthoritative = selectedEggId === blobbi.id && !!incubationStartTime;
                          if (isAuthoritative) return;
                          selectEgg(selectedEggId === blobbi.id ? null : blobbi.id);
                        }}
                      >
                        <div className="flex flex-col items-center space-y-3 p-4">
                          {/* Compact Blobbi Visual Container */}
                          <div className="flex flex-col items-center justify-end transition-all duration-500 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl border-2 border-purple-100/60 dark:border-purple-600/30 group-hover:border-purple-200/80 dark:group-hover:border-purple-500/50 h-32 w-full p-3 relative">
                            {/* Egg with ground shadow */}
                            <div className="relative flex flex-col items-center justify-end h-full scale-75">
                              <EggGraphic
                                blobbi={blobbi}
                                sizeVariant="small"
                                animated={true}
                                warmth={blobbi.eggTemperature || (60 + (getProgress(blobbi.id).egg.percentage * 0.4))}
                              />
                              {/* Ground shadow below the egg */}
                              <div className="w-16 h-2 bg-black/15 dark:bg-black/25 rounded-full blur-sm -mt-2" />
                            </div>
                            {selectedEggId === blobbi.id && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse">
                                  <div className="absolute inset-0 w-3 h-3 bg-purple-400 rounded-full animate-ping"></div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="text-center space-y-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{blobbi.name}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {selectedEggId === blobbi.id && incubationStartTime
                                ? `Incubating since ${formatDistanceToNow(incubationStartTime, { addSuffix: true })}`
                                : `Created ${formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}`}
                            </p>
                          </div>

                          {(() => {
                            const blobbiProgress = getProgress(blobbi.id);
                            return (
                              <div className="w-full space-y-2">
                                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                  <span>Hatching Progress</span>
                                  <span>{blobbiProgress.egg.completed}/{blobbiProgress.egg.total}</span>
                                </div>
                                <Progress value={blobbiProgress.egg.percentage} className="h-2" />
                                {isBlobbiReadyToHatch(blobbi) ? (
                                  <Button
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent card selection when clicking button
                                      hatchBlobbi(blobbi.id);
                                    }}
                                  >
                                    <Zap className="w-3 h-3 mr-1" />
                                    Hatch {blobbi.name}
                                  </Button>
                                ) : (
                                  <Badge className="w-full justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Incubating...
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}

                          {selectedEggId === blobbi.id && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                              <ArrowRight className="w-3 h-3" />
                              <span>View details below</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Helpful message when no egg is selected */}
      {eggBlobbis.length > 0 && showEggList && !selectedBlobbi && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-600">
          <CardContent className="py-8 text-center">
            <Target className="w-8 h-8 mx-auto mb-3 text-purple-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Select an Egg to View Progress
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Click on any egg above to see its detailed incubation progress and required tasks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Egg Incubation Card - Only for eggs with start_incubation tag or incubation timestamp */}
      {(() => {
        // Check if the selected blobbi has start_incubation tag or incubation timestamp
        const hasStartIncubation = selectedBlobbi &&
          selectedBlobbi.lifeStage === 'egg' &&
          (selectedBlobbi.tags?.some((tag: string[]) => tag[0] === 'start_incubation') ||
           incubationStartTime !== undefined);

        return hasStartIncubation ? (
          <BlobbiGrowthHubCard
            blobbi={selectedBlobbi!}
            mode="egg"
            // Egg mode props - using real values from the incubation system
            eggTasks={eggTasks}
            isReadyToHatch={isReadyToHatch}
            incubationStartTime={incubationStartTime || undefined}
            taskSubscriptionActive={taskSubscriptionActive}
            onStartIncubation={startIncubation}
            onStopIncubation={stopIncubation}
            onHatchBlobbi={hatchBlobbi}
            onMarkPhotoTaskCompleted={markPhotoTaskCompleted}
            onMarkFirstPostTaskCompleted={markFirstPostTaskCompleted}
            isTaskCompleted={isTaskCompleted}
            // Common props
            onTakePhoto={() => setShowPolaroidModal(true)}
            className="animate-in slide-in-from-top-4 duration-500"
          />
        ) : null;
      })()}

      {/* Baby Blobbis Section - New Quest System */}
      {babyBlobbis.length > 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-blue-200 dark:border-blue-600">
          <Collapsible open={showBabyList} onOpenChange={setShowBabyList}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors">
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Baby className="h-5 w-5 text-blue-500" />
                    Baby Blobbis - Evolution Quests ({babyBlobbis.length})
                    {hasEvolutionInProgress && (
                      <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Evolution in Progress
                      </Badge>
                    )}
                    {babyBlobbis.some(blobbi => isBabyReadyToEvolve(blobbi)) && (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Ready to Evolve!
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showBabyList ? (
                      <ChevronDown className="h-4 w-4 text-blue-500 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-blue-500 transition-transform duration-200" />
                    )}
                  </div>
                </CardTitle>
                {showBabyList && (
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Click on a baby Blobbi to view its evolution quest progress
                  </CardDescription>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {(() => {
                  const visibleBabies = showAllBabies ? babyBlobbis : babyBlobbis.slice(0, 3);
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleBabies.map((blobbi) => (
                          <div
                            key={blobbi.id}
                            className={`group transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border shadow-sm hover:shadow-xl hover:shadow-blue-200/20 dark:hover:shadow-blue-900/20 rounded-2xl cursor-pointer hover:scale-[1.02] ${
                              selectedBabyId === blobbi.id
                                ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md scale-[1.02] ring-2 ring-blue-200 dark:ring-blue-600'
                                : 'border-blue-200/60 dark:border-blue-600/60 hover:border-blue-300 dark:hover:border-blue-500'
                            }`}
                            onClick={() => selectBaby(selectedBabyId === blobbi.id ? null : blobbi.id)}
                          >
                            <div className="flex flex-col items-center space-y-3 p-4">
                              {/* Compact Blobbi Visual Container */}
                              <div className="flex flex-col items-center justify-end transition-all duration-500 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-2xl border-2 border-blue-100/60 dark:border-blue-600/30 group-hover:border-blue-200/80 dark:group-hover:border-blue-500/50 h-32 w-full p-3 relative">
                                {/* Blobbi with ground shadow */}
                                <div className="relative flex flex-col items-center justify-end h-full scale-75">
                                  <BlobbiVisual blobbi={blobbi} size="small" />
                                  {/* Ground shadow below the blobbi */}
                                  <div className="w-16 h-2 bg-black/15 dark:bg-black/25 rounded-full blur-sm -mt-2" />
                                </div>
                                {selectedBabyId === blobbi.id && (
                                  <div className="absolute -top-1 -right-1">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse">
                                      <div className="absolute inset-0 w-3 h-3 bg-blue-400 rounded-full animate-ping"></div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="text-center space-y-1">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{blobbi.name}</h4>
                                <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300">
                                  Baby
                                </Badge>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                                </p>
                              </div>

                              <div className="w-full space-y-2">
                                {(() => {
                                  const blobbiProgress = getBlobbiQuestProgress(blobbi.id);
                                  return (
                                    <>
                                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                        <span>Evolution Progress</span>
                                        <span>{blobbiProgress.completed}/{blobbiProgress.total}</span>
                                      </div>
                                      <Progress value={blobbiProgress.percentage} className="h-2" />
                                    </>
                                  );
                                })()}
                                {isBabyReadyToEvolve(blobbi) ? (
                                  selectedBabyId === blobbi.id ? (
                                    <Button
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent card selection when clicking button
                                        triggerEvolution();
                                      }}
                                      disabled={isEvolving}
                                    >
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      {isEvolving ? 'Evolving...' : 'Evolve to Adult'}
                                    </Button>
                                  ) : (
                                    <Badge className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white">
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      Ready to Evolve!
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="w-full justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Completing Quests...
                                  </Badge>
                                )}
                              </div>

                              {selectedBabyId === blobbi.id && (
                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                  <ArrowRight className="w-3 h-3" />
                                  <span>View quests below</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Show more / Show less button */}
                      {babyBlobbis.length > 3 && (
                        <div className="flex justify-center mt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllBabies(!showAllBabies)}
                            className="border-blue-200 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            {showAllBabies ? (
                              <>
                                <ChevronUp className="w-3 h-3 mr-1" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3 mr-1" />
                                Show {babyBlobbis.length - 3} More
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Evolution Quests Card - Only for babies with start_evolution tag or quest timestamp */}
      {(() => {
        // Check if the selected baby blobbi has start_evolution tag or quest timestamp
        const hasStartEvolution = selectedBabyBlobbi &&
          selectedBabyBlobbi.lifeStage === 'baby' &&
          (selectedBabyBlobbi.tags?.some((tag: string[]) => tag[0] === 'start_evolution') ||
           questStartTime !== undefined);

        return hasStartEvolution ? (
          <BlobbiGrowthHubCard
            blobbi={selectedBabyBlobbi!}
            mode="baby"
            // Baby mode props - using real values from the quest system
            babyQuests={babyToAdultQuests}
            questProgress={questProgress}
            isReadyToEvolve={isQuestReadyToEvolve}
            questStartTime={questStartTime || undefined}
            questSubscriptionActive={questSubscriptionActive}
            isQuestListening={isQuestListening}
            onStartQuestTracking={startQuestTracking}
            onStopEvolution={stopEvolution}
            onTriggerEvolution={triggerEvolution}
            isEvolving={isEvolving}
            // Common props
            onTakePhoto={() => setShowPolaroidModal(true)}
            className="animate-in slide-in-from-top-4 duration-500"
          />
        ) : null;
      })()}

      {/* Helpful message when no blobbi is selected */}
      {(eggBlobbis.length > 0 || babyBlobbis.length > 0) && !currentSelectedBlobbi && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-600">
          <CardContent className="py-8 text-center">
            <Target className="w-8 h-8 mx-auto mb-3 text-purple-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Select a Blobbi to View Progress
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {eggBlobbis.length > 0
                ? "Click on any egg above to see hatching progress, or any baby to see evolution quests."
                : "Click on any baby above to see its evolution quests."
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Adult Blobbis Section */}
      {adultBlobbis.length > 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-yellow-200 dark:border-yellow-600">
          <Collapsible open={showEvolvedList} onOpenChange={setShowEvolvedList}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-yellow-50/50 dark:hover:bg-yellow-900/20 transition-colors">
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    Adult Blobbis ({adultBlobbis.length})
                  </div>
                  <div className="flex items-center gap-2">
                    {showEvolvedList ? (
                      <ChevronDown className="h-4 w-4 text-yellow-500 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-yellow-500 transition-transform duration-200" />
                    )}
                  </div>
                </CardTitle>
                {showEvolvedList && (
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Your fully evolved adult Blobbis - no more quests needed!
                  </CardDescription>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adultBlobbis.map((blobbi) => (
                    <div
                      key={blobbi.id}
                      className="group transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border shadow-sm hover:shadow-xl hover:shadow-yellow-200/20 dark:hover:shadow-yellow-900/20 rounded-2xl hover:scale-[1.02] border-yellow-200/60 dark:border-yellow-600/60 hover:border-yellow-300 dark:hover:border-yellow-500"
                    >
                      <div className="flex flex-col items-center space-y-3 p-4">
                        {/* Compact Blobbi Visual Container */}
                        <div className="flex flex-col items-center justify-end transition-all duration-500 bg-gradient-to-br from-yellow-50/80 to-orange-50/80 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-2xl border-2 border-yellow-100/60 dark:border-yellow-600/30 group-hover:border-yellow-200/80 dark:group-hover:border-yellow-500/50 h-32 w-full p-3 relative">
                          {/* Blobbi with ground shadow */}
                          <div className="relative flex flex-col items-center justify-end h-full scale-75">
                            {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                              <BlobbiEvolvedVisual blobbi={blobbi} size="small" />
                            ) : (
                              <BlobbiVisual blobbi={blobbi} size="small" />
                            )}
                            {/* Ground shadow below the blobbi */}
                            <div className="w-16 h-2 bg-black/15 dark:bg-black/25 rounded-full blur-sm -mt-2" />
                          </div>
                          <div className="absolute -top-1 -right-1">
                            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                              <Sparkles className="w-2 h-2 text-white" />
                            </div>
                          </div>
                        </div>

                        <div className="text-center space-y-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{blobbi.name}</h4>
                          <Badge className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-600">
                            Adult {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? `(${blobbi.evolutionForm})` : ''}
                          </Badge>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                          </p>
                        </div>

                        <div className="w-full">
                          <Badge className="w-full justify-center bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Fully Evolved!
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Debug Information */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <Collapsible open={showDebugInfo} onOpenChange={setShowDebugInfo}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
              <CardTitle className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                {showDebugInfo ? <ChevronDown className="h-4 w-4 text-purple-500" /> : <ChevronRight className="h-4 w-4 text-purple-500" />}
                <Info className="h-4 w-4 text-purple-500" />
                Debug Information
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Subscription Status */}
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Subscription Status
                </h4>
                <div className="text-sm text-blue-600 dark:text-blue-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${debugInfo.subscriptionStatus.metadata ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Metadata (kind:31124): {debugInfo.subscriptionStatus.metadata ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${debugInfo.subscriptionStatus.tasks ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Egg Tasks (kinds:[1,3,6,7,9735,14919] with #p + authors filters): {debugInfo.subscriptionStatus.tasks ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${questDebugInfo.subscriptionStatus.quests ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Baby Quests (kinds:[1,3,6,7] with #p + authors filters): {questDebugInfo.subscriptionStatus.quests ? 'Active' : 'Inactive'}</span>
                    <span className="text-xs opacity-70">(+ #t:blobbi watcher)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${questDebugInfo.subscriptionStatus.blobbiHashtag ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>#Blobbi Hashtag Tracking: {questDebugInfo.subscriptionStatus.blobbiHashtag ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Egg Listening: {isListening ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isQuestListening ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Quest Listening: {isQuestListening ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Timing Information */}
              <div className="p-4 bg-green-50/80 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing Information
                </h4>
                <div className="text-sm text-green-600 dark:text-green-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Blobbi Creation:</span>
                    <span className="font-mono text-xs">{debugInfo.blobbiCreationDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Quest Start:</span>
                    <span className="font-mono text-xs">{questDebugInfo.questStartDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Egg Event:</span>
                    <span className="font-mono text-xs">{debugInfo.lastEventDate || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Quest Event:</span>
                    <span className="font-mono text-xs">{questDebugInfo.lastEventDate || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>User:</span>
                    <span className="font-mono text-xs">{debugInfo.userPubkey?.slice(0, 8)}...{debugInfo.userPubkey?.slice(-8)}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="p-4 bg-yellow-50/80 dark:bg-yellow-950/50 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Statistics
                </h4>
                <div className="text-sm text-yellow-600 dark:text-yellow-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Unique Likers:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {debugInfo.uniqueLikersCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Unique Reactions:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {questDebugInfo.uniqueReactionTargetsCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Unique Reposts:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {questDebugInfo.uniqueRepostTargetsCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>#Blobbi Events:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {questDebugInfo.blobbiHashtagEventsCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Blobbis Tracked:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {blobbis.length} (🥚{eggBlobbis.length} 🐣{babyBlobbis.length} 🌟{adultBlobbis.length})
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Egg Progress:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {selectedBlobbiProgress.egg.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Quest Progress:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {questProgress.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div className="p-4 bg-purple-50/80 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  System Information
                </h4>
                <div className="text-sm text-purple-600 dark:text-purple-300 space-y-2">
                  <div>🔄 Implementation: Dual System - Egg Incubation + Baby Quest Tracking</div>
                  <div>📡 Egg Filters: kinds:[1,3,6,7,9735] with #p:[user] + authors:[user]</div>
                  <div>🎯 Quest Filters: kinds:[1,3,6,7] with #p:[user] + authors:[user] + since parameter</div>
                  <div>🏷️ Hashtag Tracking: kinds:[1] with #t:[blobbi] for quest validation</div>
                  <div>⚡ Real-time: Event processing as they arrive</div>
                  <div>🚫 No REQ+CLOSE cycles: Connections remain open</div>
                  <div>⏰ Quest tracking only starts after "Start Evolution" is clicked</div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Recommended Clients */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Users className="h-5 w-5 text-purple-500" />
            Recommended Nostr Clients
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Use these clients to complete your interaction tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="https://ditto.pub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border border-purple-200 dark:border-purple-600 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Ditto</h4>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">ditto.pub</p>
            </a>
            <a
              href="https://gleasonator.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border border-purple-200 dark:border-purple-600 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Gleasonator</h4>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">gleasonator.dev</p>
            </a>
            <a
              href="https://cobrafuma.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border border-purple-200 dark:border-purple-600 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Cobrafuma</h4>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">cobrafuma.com</p>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Create Post Modal */}
      <CreatePostModal
        open={isCreatePostModalOpen}
        onClose={() => setIsCreatePostModalOpen(false)}
        onPostPublished={() => {
          // Manually mark the first post task as completed
          if (selectedBlobbi) {
            markFirstPostTaskCompleted(selectedBlobbi.id);
          }
          // Also refresh the incubation system
          refetchMetadata();
        }}
      />

      {/* Polaroid Photo Modal */}
      {selectedBlobbi && (() => {
        // Determine if selected blobbi is incubating (for egg stage)
        const isIncubating = selectedBlobbi.lifeStage === 'egg' &&
          (selectedBlobbi.tags?.some((tag: string[]) => tag[0] === 'start_incubation') ||
           incubationStartTime !== undefined);

        return (
          <PolaroidPhotoModal
            isOpen={showPolaroidModal}
            onClose={() => setShowPolaroidModal(false)}
            blobbi={selectedBlobbi}
            isIncubating={isIncubating}
            onPhotoPosted={async () => {
              // Mark the photo task as completed
              await markPhotoTaskCompleted(selectedBlobbi.id);
              // Refresh the incubation system
              refetchMetadata();
            }}
          />
        );
      })()}
    </div>
  );
}