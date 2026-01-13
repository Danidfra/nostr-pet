import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Blobbi } from '@/types/blobbi';
import { BlobbiGrowthHubContent } from './BlobbiGrowthHubContent';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EggHatchingTask } from '@/hooks/useBlobbiIncubationSystem';
import { BabyToAdultQuest } from '@/hooks/useBlobbiQuestSystem';

interface BlobbiGrowthHubModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blobbi: Blobbi;
  mode: 'egg' | 'baby';

  // Egg mode props
  eggTasks?: EggHatchingTask[];
  isReadyToHatch?: boolean;
  incubationStartTime?: number;
  taskSubscriptionActive?: boolean;
  isIncubatingForThisBlobbi?: boolean;
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
  isEvolvingForThisBlobbi?: boolean;
  onStartQuestTracking?: () => void;
  onStopEvolution?: () => void;
  onTriggerEvolution?: () => void;
  isEvolving?: boolean;

  // Common props
  onTakePhoto?: () => void;
}

export function BlobbiGrowthHubModal({
  open,
  onOpenChange,
  blobbi,
  mode,
  // Egg props
  eggTasks = [],
  isReadyToHatch = false,
  incubationStartTime,
  taskSubscriptionActive = false,
  isIncubatingForThisBlobbi = false,
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
  isEvolvingForThisBlobbi = false,
  onStartQuestTracking,
  onStopEvolution,
  onTriggerEvolution,
  isEvolving = false,
  // Common props
  onTakePhoto,
}: BlobbiGrowthHubModalProps) {
  const getTitle = () => {
    return mode === 'egg' ? 'Hatching Progress' : 'Evolution Quests';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Mobile: almost full screen
          "w-[calc(100vw-1.5rem)]",
          "max-h-[calc(100dvh-1.5rem)]",
          // Desktop: controlled min/max width
          "sm:min-w-[420px]",
          "sm:max-w-[720px]",
          "sm:max-h-[80dvh]",
          // Internal scrolling
          "overflow-y-auto",
          // Styling
          "bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-purple-200 dark:border-purple-600"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-purple-600" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <BlobbiGrowthHubContent
          blobbi={blobbi}
          mode={mode}
          eggTasks={eggTasks}
          isReadyToHatch={isReadyToHatch}
          incubationStartTime={incubationStartTime}
          taskSubscriptionActive={taskSubscriptionActive}
          isIncubatingForThisBlobbi={isIncubatingForThisBlobbi}
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
          isEvolvingForThisBlobbi={isEvolvingForThisBlobbi}
          onStartQuestTracking={onStartQuestTracking}
          onStopEvolution={onStopEvolution}
          onTriggerEvolution={onTriggerEvolution}
          isEvolving={isEvolving}
          onTakePhoto={onTakePhoto}
        />
      </DialogContent>
    </Dialog>
  );
}
