import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Camera, Send, Sparkles, AlertTriangle, Wifi, WifiOff, ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Blobbi } from '@/types/blobbi';
import { CreatePostModal } from './CreatePostModal';
import { formatDistanceToNow } from 'date-fns';
import { EggHatchingTask } from '@/hooks/useBlobbiIncubationSystem';
import { BabyToAdultQuest } from '@/hooks/useBlobbiQuestSystem';

// Union type for tasks/quests
type Task = EggHatchingTask | BabyToAdultQuest;

// Unified interface for both egg and baby modes
interface BlobbiGrowthHubContentProps {
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

export function BlobbiGrowthHubContent({
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
}: BlobbiGrowthHubContentProps) {
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Calculate progress based on mode
  const completedTasks = mode === 'egg'
    ? eggTasks.filter(task => isTaskCompleted?.(task, blobbi.id))
    : babyQuests.filter(quest => quest.completed);
  const totalTasks = mode === 'egg' ? eggTasks.length : babyQuests.length;
  const progressPercentage = mode === 'egg'
    ? (completedTasks.length / totalTasks) * 100
    : questProgress.percentage;

  // Determine if tracking is active - ONLY for THIS blobbi
  const isTrackingActive = mode === 'egg'
    ? (isIncubatingForThisBlobbi && taskSubscriptionActive)
    : (isEvolvingForThisBlobbi && questSubscriptionActive);
  const hasStartTime = mode === 'egg'
    ? (isIncubatingForThisBlobbi && !!incubationStartTime)
    : (isEvolvingForThisBlobbi && !!questStartTime);

  // Handle post creation
  const handlePostPublished = () => {
    setShowCreatePost(false);
    if (mode === 'egg' && onMarkFirstPostTaskCompleted) {
      onMarkFirstPostTaskCompleted(blobbi.id);
    }
  };

  const handlePhotoTaken = () => {
    if (onTakePhoto) {
      onTakePhoto();
    }
    if (mode === 'egg' && onMarkPhotoTaskCompleted) {
      onMarkPhotoTaskCompleted(blobbi.id);
    }
  };

  // Get mode-specific content
  const getDescription = () => {
    if (mode === 'egg') {
      return 'Complete these tasks to help your egg hatch';
    } else {
      return hasStartTime
        ? 'Complete these social interaction quests to help your baby evolve'
        : "Click 'Start Evolution' to begin tracking your Nostr interactions for evolution quests";
    }
  };

  const getProgressLabel = () => {
    return mode === 'egg' ? 'Hatching Progress' : 'Evolution Progress';
  };

  const getProgressCount = () => {
    if (mode === 'egg') {
      return `${completedTasks.length}/${totalTasks}`;
    } else {
      return `${questProgress.completed}/${questProgress.total}`;
    }
  };

  const getReadyButton = () => {
    if (mode === 'egg' && isReadyToHatch) {
      return (
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onHatchBlobbi?.(blobbi.id);
          }}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Hatch {blobbi.name}
        </Button>
      );
    } else if (mode === 'baby' && isReadyToEvolve) {
      return (
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onTriggerEvolution?.();
          }}
          disabled={isEvolving}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isEvolving ? 'Evolving...' : 'Evolve to Adult'}
        </Button>
      );
    } else {
      return (
        <Badge variant="outline" className="w-full justify-center mt-1">
          {mode === 'egg' ? 'Incubating...' : 'Completing Quests...'}
        </Badge>
      );
    }
  };

  const getStartStopButtons = () => {
    if (mode === 'egg') {
      // CRITICAL: Only show incubating UI if THIS blobbi is incubating
      if (!isIncubatingForThisBlobbi) {
        return (
          <Button
            onClick={onStartIncubation}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Start Incubation
          </Button>
        );
      } else {
        return (
          <>
            <Badge className={isTrackingActive ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}>
              <Wifi className="w-3 h-3 mr-1" />
              {isTrackingActive ? 'Listening for events...' : 'Incubating'}
            </Badge>
            <Button
              onClick={onStopIncubation}
              size="sm"
              variant="outline"
              className="border-red-200 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <WifiOff className="w-4 h-4 mr-2" />
              Stop Incubation
            </Button>
          </>
        );
      }
    } else {
      // Baby mode - CRITICAL: Only show evolving UI if THIS blobbi is evolving
      if (!isEvolvingForThisBlobbi) {
        return (
          <Button
            onClick={onStartQuestTracking}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={true}
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Start Evolution
          </Button>
        );
      } else {
        return (
          <>
            <Badge className={isQuestListening ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}>
              <Wifi className="w-3 h-3 mr-1" />
              {isQuestListening ? 'Listening for evolution events...' : 'Evolution started'}
            </Badge>
            <Button
              onClick={onStopEvolution}
              size="sm"
              variant="outline"
              className="border-red-200 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <WifiOff className="w-4 h-4 mr-2" />
              Stop Evolution
            </Button>
          </>
        );
      }
    }
  };

  const renderTasks = () => {
    const tasks: Task[] = mode === 'egg' ? eggTasks : babyQuests;

    return (
      <div className="space-y-2 sm:space-y-3">
        {tasks.map((task, index) => {
          const isCompleted = mode === 'egg'
            ? isTaskCompleted?.(task as EggHatchingTask, blobbi.id)
            : (task as BabyToAdultQuest).completed;
          let currentProgress = task.progress || 0;
          const isExpanded = expandedTaskIds[task.id] || false;

          // Special handling for shell integrity task progress display
          if (mode === 'egg' && task.id === 'shell_integrity_above_50') {
            currentProgress = blobbi.shellIntegrity || 100;
          }

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all",
                isCompleted
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
              )}
            >
              <div className="mt-0.5">
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 id={`tab-growth-hub-tasks-${index}`} className={cn(
                        "font-medium text-sm flex-1",
                        isCompleted ? "text-green-800 dark:text-green-200" : "text-gray-900 dark:text-gray-100"
                      )}>
                        {task.name}
                      </h4>
                      {/* Mobile description toggle - only show on mobile when not completed */}
                      {!isCompleted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="sm:hidden h-6 w-6 p-0"
                          onClick={() => setExpandedTaskIds(prev => ({...prev, [task.id]: !prev[task.id]}))}
                          aria-label={isExpanded ? "Hide description" : "Show description"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Description - always visible on desktop, toggleable on mobile */}
                    <p className={cn(
                      "text-xs mt-1",
                      isCompleted ? "text-green-700 dark:text-green-300" : "text-gray-600 dark:text-gray-400",
                      // On mobile: hidden by default, show when expanded
                      // On desktop (sm+): always visible
                      !isExpanded && "hidden sm:block"
                    )}>
                      {task.description}
                    </p>
                  </div>

                  {isCompleted && (
                    <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 flex-shrink-0">
                      Complete
                    </Badge>
                  )}
                </div>

                  {/* Progress bar for tasks with targets */}
                  {task.target && (mode === 'baby' || task.id !== 'shell_integrity_above_50') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{currentProgress}/{task.target}</span>
                      </div>
                      <Progress
                        value={(currentProgress / task.target) * 100}
                        className="h-1.5"
                      />
                    </div>
                  )}

                  {/* Shell integrity display for eggs */}
                  {mode === 'egg' && task.id === 'shell_integrity_above_50' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Shell Integrity</span>
                        <span className={cn(
                          "font-medium",
                          currentProgress >= 50 ? "text-green-600" : "text-red-600"
                        )}>
                          {currentProgress}%
                        </span>
                      </div>
                      <Progress
                        value={currentProgress}
                        className={cn(
                          "h-1.5",
                          currentProgress < 50 && "bg-red-100 dark:bg-red-900/20"
                        )}
                      />
                      {currentProgress < 50 && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Keep your egg healthy!</span>
                        </div>
                      )}
                    </div>
                  )}

                  {isCompleted && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {mode === 'egg' && task.id === 'shell_integrity_above_50'
                        ? 'Shell integrity requirement met'
                        : mode === 'egg'
                          ? 'Task confirmed on Nostr'
                          : 'Quest confirmed on Nostr'
                      }
                    </p>
                  )}
              </div>

              {/* Action buttons for specific tasks */}
              {mode === 'egg' && !isCompleted && (
                <>
                  {task.id === 'first_post' && (
                    <>
                      {/* Mobile: Icon-only button */}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreatePost(true);
                        }}
                        className="sm:hidden h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                        aria-label="Create Post"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      {/* Desktop: Button with text */}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreatePost(true);
                        }}
                        className="hidden sm:flex bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Create Post
                      </Button>
                    </>
                  )}
                  {task.id === 'post_blobbi_photo' && (
                    <>
                      {/* Mobile: Icon-only button */}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoTaken();
                        }}
                        className="sm:hidden h-8 w-8 p-0 bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                        aria-label="Take Photo"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </Button>
                      {/* Desktop: Button with text */}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoTaken();
                        }}
                        className="hidden sm:flex bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                      >
                        <Camera className="h-3 w-3 mr-1" />
                        Take Photo
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Soon overlay for baby mode */}
        {mode === 'baby' && blobbi.lifeStage === 'baby' && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-lg border border-purple-300 dark:border-purple-700">
            <h2 className="text-xl font-bold text-purple-700 dark:text-purple-300">
              Evolution Coming Soon
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              This feature is temporarily unavailable.
            </p>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {getDescription()}
        </p>

        {/* Start/Stop Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {getStartStopButtons()}
        </div>

        <div className={cn(mode === 'baby' && blobbi.lifeStage === 'baby' && "pointer-events-none opacity-40")}>
          {/* Progress Overview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{getProgressLabel()}</span>
              <span className="font-medium">{getProgressCount()}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            {getReadyButton()}
          </div>

          {/* Task/Quest List */}
          {renderTasks()}

          {/* Tracking info */}
          {hasStartTime && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              {mode === 'egg'
                ? `Incubation started: ${new Date(incubationStartTime!).toLocaleDateString()}`
                : `Evolution started: ${formatDistanceToNow(questStartTime!, { addSuffix: true })}`
              }
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal - only for egg mode */}
      {mode === 'egg' && (
        <CreatePostModal
          open={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          onPostPublished={handlePostPublished}
        />
      )}
    </>
  );
}
