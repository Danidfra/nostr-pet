import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Camera, Send, Sparkles, AlertTriangle, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Blobbi } from '@/types/blobbi';
import { CreatePostModal } from './CreatePostModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';

// Unified interface for both egg and baby modes
interface BlobbiGrowthHubCardProps {
  blobbi: Blobbi;
  mode: 'egg' | 'baby';

  // Egg mode props
  eggTasks?: any[];
  isReadyToHatch?: boolean;
  incubationStartTime?: number;
  taskSubscriptionActive?: boolean;
  onStartIncubation?: () => void;
  onStopIncubation?: () => void;
  onHatchBlobbi?: (id: string) => void;
  onMarkPhotoTaskCompleted?: (id: string) => void;
  onMarkFirstPostTaskCompleted?: (id: string) => void;
  isTaskCompleted?: (task: any, blobbiId: string) => boolean;

  // Baby mode props
  babyQuests?: any[];
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
  const [showCreatePost, setShowCreatePost] = useState(false);
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

  // Calculate progress based on mode
  const completedTasks = mode === 'egg'
    ? eggTasks.filter(task => isTaskCompleted?.(task, blobbi.id))
    : babyQuests.filter(quest => quest.completed);
  const totalTasks = mode === 'egg' ? eggTasks.length : babyQuests.length;
  const progressPercentage = mode === 'egg'
    ? (completedTasks.length / totalTasks) * 100
    : questProgress.percentage;

  // Determine if tracking is active
  const isTrackingActive = mode === 'egg' ? taskSubscriptionActive : questSubscriptionActive;
  const hasStartTime = mode === 'egg' ? !!incubationStartTime : !!questStartTime;

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
  const getTitle = () => {
    return mode === 'egg' ? 'Hatching Progress' : 'Evolution Quests';
  };

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
      if (!incubationStartTime && !taskSubscriptionActive) {
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
      // Baby mode
      if (!questSubscriptionActive && !questStartTime) {
        return (
          <Button
            onClick={onStartQuestTracking}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={true}
          >
            <Sparkles className="w-4 h-4 mr-2" />
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
    const tasks = mode === 'egg' ? eggTasks : babyQuests;

    return (
      <div className="space-y-3">
        {tasks.map((task, index) => {
          const isCompleted = mode === 'egg'
            ? isTaskCompleted?.(task, blobbi.id)
            : task.completed;
          let currentProgress = task.progress || 0;

          // Special handling for shell integrity task progress display
          if (mode === 'egg' && task.id === 'shell_integrity_above_50') {
            currentProgress = blobbi.shellIntegrity || 100;
          }

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
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

              <div className="flex w-full space-y-1">
                <div className='flex-1 space-x-1'>
                  <div className="flex items-center justify-between">
                    <h4 id={`tab-growth-hub-tasks-${index}`} className={cn(
                      "font-medium text-sm",
                      isCompleted ? "text-green-800 dark:text-green-200" : "text-gray-900 dark:text-gray-100"
                    )}>
                      {task.name}
                    </h4>
                    {isCompleted && (
                      <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Complete
                      </Badge>
                    )}
                  </div>

                  <p className={cn(
                    "text-xs",
                    isCompleted ? "text-green-700 dark:text-green-300" : "text-gray-600 dark:text-gray-400"
                  )}>
                    {task.description}
                  </p>

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
                <div className="flex items-center justify-between">
                  <div className="flex-1"></div>
                  {mode === 'egg' && !isCompleted && task.id === 'first_post' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreatePost(true);
                      }}
                      className="ml-4 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Create Post
                    </Button>
                  )}
                  {mode === 'egg' && !isCompleted && task.id === 'post_blobbi_photo' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhotoTaken();
                      }}
                      className="ml-4 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      Take Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={(e) => {
        setIsOpen(e)
        sessionStorage.setItem('isGrowthHubCardOpen', String(e))
      }
      }>
        <Card className={cn("relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600", className)}>
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
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    {getTitle()}
                  </CardTitle>
                  <CardDescription>
                    {getDescription()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2" id="tab-growth-hub-start-incubation">
                  {getStartStopButtons()}
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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