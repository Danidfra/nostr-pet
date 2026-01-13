import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Blobbi } from '@/types/blobbi';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BlobbiGrowthHubContent } from './BlobbiGrowthHubContent';
import { EggHatchingTask } from '@/hooks/useBlobbiIncubationSystem';
import { BabyToAdultQuest } from '@/hooks/useBlobbiQuestSystem';

// Unified interface for both egg and baby modes
interface BlobbiGrowthHubCardProps {
  blobbi: Blobbi;
  mode: 'egg' | 'baby';

  // Egg mode props
  eggTasks?: EggHatchingTask[];
  isReadyToHatch?: boolean;
  incubationStartTime?: number;
  taskSubscriptionActive?: boolean;
  onStartIncubation?: () => void;
  onStopIncubation?: () => void;
  onHatchBlobbi?: (id: string) => void;
  onMarkPhotoTaskCompleted?: (id: string) => void;
  onMarkFirstPostTaskCompleted?: (id: string) => void;
  isTaskCompleted?: (task: EggHatchingTask, blobbiId: string) => boolean;

  // Baby mode props
  babyQuests?: BabyToAdultQuest[];
  questProgress?: { completed: number; total: number; percentage: number };
  isReadyToEvolve?: boolean;
  questStartTime?: number;
  questSubscriptionActive?: boolean;
  isQuestListening?: boolean;
  onStartQuestTracking?: () => void;
  onStopEvolution?: () => void;
  onTriggerEvolution?: () => void;
  isEvolving?: boolean;

  // Common props
  onTakePhoto?: () => void;
  className?: string;
}

export function BlobbiGrowthHubCard({
  blobbi,
  mode,
  // Egg props
  eggTasks = [],
  isReadyToHatch = false,
  incubationStartTime,
  taskSubscriptionActive = false,
  onStartIncubation,
  onStopIncubation,
  onHatchBlobbi,
  onMarkPhotoTaskCompleted,
  onMarkFirstPostTaskCompleted,
  isTaskCompleted,
  // Baby props
  babyQuests = [],
  questProgress = { completed: 0, total: 0, percentage: 0 },
  isReadyToEvolve = false,
  questStartTime,
  questSubscriptionActive = false,
  isQuestListening = false,
  onStartQuestTracking,
  onStopEvolution,
  onTriggerEvolution,
  isEvolving = false,
  // Common props
  onTakePhoto,
  className
}: BlobbiGrowthHubCardProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = sessionStorage.getItem('isGrowthHubCardOpen');
      if (stored === null) return false;
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Determine if we should show this card
  const shouldShow = mode === 'egg' ? blobbi.lifeStage === 'egg' : blobbi.lifeStage === 'baby';
  if (!shouldShow) return null;

  // Get mode-specific content
  const getTitle = () => {
    return mode === 'egg' ? 'Hatching Progress' : 'Evolution Quests';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={(e) => {
      setIsOpen(e)
      sessionStorage.setItem('isGrowthHubCardOpen', String(e))
    }
    }>
      <Card className={cn("relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                {getTitle()}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <BlobbiGrowthHubContent
              blobbi={blobbi}
              mode={mode}
              eggTasks={eggTasks}
              isReadyToHatch={isReadyToHatch}
              incubationStartTime={incubationStartTime}
              taskSubscriptionActive={taskSubscriptionActive}
              onStartIncubation={onStartIncubation}
              onStopIncubation={onStopIncubation}
              onHatchBlobbi={onHatchBlobbi}
              onMarkPhotoTaskCompleted={onMarkPhotoTaskCompleted}
              onMarkFirstPostTaskCompleted={onMarkFirstPostTaskCompleted}
              isTaskCompleted={isTaskCompleted}
              babyQuests={babyQuests}
              questProgress={questProgress}
              isReadyToEvolve={isReadyToEvolve}
              questStartTime={questStartTime}
              questSubscriptionActive={questSubscriptionActive}
              isQuestListening={isQuestListening}
              onStartQuestTracking={onStartQuestTracking}
              onStopEvolution={onStopEvolution}
              onTriggerEvolution={onTriggerEvolution}
              isEvolving={isEvolving}
              onTakePhoto={onTakePhoto}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}