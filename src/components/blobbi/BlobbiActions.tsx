import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Blobbi } from '@/types/blobbi';
import { Gamepad2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { BlobbiFakeStatusIndicator } from './BlobbiFakeStatusIndicator';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { useBlobbiQuestSystem } from '@/hooks/useBlobbiQuestSystem';
import { BlobbiGrowthHubCard } from './BlobbiGrowthHubCard';
import { BlobbiActionsFooter } from './BlobbiActionsFooter';

interface BlobbiActionsProps {
  blobbi: Blobbi;
  onAction: (action: string) => void;
  isPerformingAction: boolean;
  className?: string;
  onGamesClick?: () => void;
  onOpenShop?: () => void;
  onTakePhoto?: () => void;
  lifecycleStatus?: {
    isEligibleForEvolution: boolean;
    evolutionStatus?: {
      isReady: boolean;
      message: string;
    };
  };
  onEvolution?: () => void;
  isIncubatingUI?: boolean;
  isEvolvingUI?: boolean;
}

export function BlobbiActions({
  blobbi,
  onAction,
  isPerformingAction,
  className,
  onGamesClick,
  onOpenShop,
  onTakePhoto,
  lifecycleStatus,
  onEvolution,
  isIncubatingUI = false,
  isEvolvingUI = false
}: BlobbiActionsProps) {
  const { hasFakeStatus, getPendingInteractionCount } = useBlobbiFakeStatus();

  const [isIncubatingLocalUI, setIsIncubatingLocalUI] = useState(false);
  const [isEvolvingLocalUI, setIsEvolvingLocalUI] = useState(false);
  const [hideIncubationUI, setHideIncubationUI] = useState(false);
  const [hideEvolutionUI, setHideEvolutionUI] = useState(false);

  const {
    eggTasks,
    isReadyToHatch,
    incubationStartTime,
    taskSubscriptionActive,
    startIncubation,
    stopIncubation,
    hatchBlobbi,
    markPhotoTaskCompleted,
    isTaskCompleted
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
  } = useBlobbiQuestSystem();

  const handleStartIncubation = async () => {
    setIsIncubatingLocalUI(true);
    try {
      await startIncubation();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to start incubation:', error);
      setIsIncubatingLocalUI(false);
    }
  };

  const handleStopIncubation = async () => {
    setHideIncubationUI(true);
    setIsIncubatingLocalUI(false);
    try {
      await stopIncubation();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to stop incubation:', error);
      setHideIncubationUI(false);
      setIsIncubatingLocalUI(true);
    }
  };

  const handleStartQuestTracking = async () => {
    setIsEvolvingLocalUI(true);
    try {
      await startQuestTracking();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to start quest tracking:', error);
      setIsEvolvingLocalUI(false);
    }
  };

  const handleStopEvolution = async () => {
    setHideEvolutionUI(true);
    setIsEvolvingLocalUI(false);
    try {
      await stopEvolution();
    } catch (error) {
      console.error('[OPTIMISTIC] Failed to stop evolution:', error);
      setHideEvolutionUI(false);
      setIsEvolvingLocalUI(true);
    }
  };

  useEffect(() => {
    if (
      hideIncubationUI &&
      !blobbi.tags?.some((tag: string[]) =>
        tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
      ) &&
      !taskSubscriptionActive &&
      !isIncubatingUI &&
      !isIncubatingLocalUI
    ) {
      setHideIncubationUI(false);
    }
  }, [hideIncubationUI, blobbi.tags, taskSubscriptionActive, isIncubatingUI, isIncubatingLocalUI]);

  useEffect(() => {
    if (
      hideEvolutionUI &&
      !blobbi.tags?.some((tag: string[]) =>
        tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
      ) &&
      !questSubscriptionActive &&
      !isEvolvingUI &&
      !isEvolvingLocalUI
    ) {
      setHideEvolutionUI(false);
    }
  }, [hideEvolutionUI, blobbi.tags, questSubscriptionActive, isEvolvingUI, isEvolvingLocalUI]);

  const hasIncubationTag = blobbi.tags?.some((tag: string[]) =>
    tag[0] === 'start_incubation' || tag[0] === 'incubation_started_at'
  );
  const hasEvolutionTag = blobbi.tags?.some((tag: string[]) =>
    tag[0] === 'start_evolution' || tag[0] === 'evolution_started_at'
  );

  const shouldShowEggGrowthHub =
    !hideIncubationUI && (
      hasIncubationTag ||
      taskSubscriptionActive ||
      isIncubatingUI ||
      isIncubatingLocalUI
    );

  const shouldShowBabyGrowthHub =
    !hideEvolutionUI && (
      hasEvolutionTag ||
      questSubscriptionActive ||
      isEvolvingUI ||
      isEvolvingLocalUI
    );

  return (
    <div className="space-y-4">
      {/* Growth Hub for eggs and babies */}
      {(() => {
        if (blobbi.lifeStage === 'egg') {
          return shouldShowEggGrowthHub ? (
            <BlobbiGrowthHubCard
              blobbi={blobbi}
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
              onTakePhoto={onTakePhoto}
            />
          ) : null;
        } else if (blobbi.lifeStage === 'baby') {
          return shouldShowBabyGrowthHub ? (
            <BlobbiGrowthHubCard
              blobbi={blobbi}
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
              onTriggerEvolution={onEvolution}
              isEvolving={isPerformingAction}
              onTakePhoto={onTakePhoto}
            />
          ) : null;
        } else {
          return null;
        }
      })()}

      {/* Regular Actions - Delegate to footer component */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" />
            Actions
            <BlobbiFakeStatusIndicator
              hasFakeStatus={hasFakeStatus(blobbi.id)}
              pendingInteractionCount={getPendingInteractionCount(blobbi.id)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <BlobbiActionsFooter
            blobbi={blobbi}
            onAction={onAction}
            isPerformingAction={isPerformingAction}
            onGamesClick={onGamesClick}
            onOpenShop={onOpenShop}
            className="border-0 shadow-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}