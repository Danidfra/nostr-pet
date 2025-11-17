import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Camera, Edit, Sparkles, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Blobbi } from '@/types/blobbi';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { CreatePostModal } from './CreatePostModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BlobbiGrowthHubProps {
  blobbi: Blobbi;
  onTakePhoto?: () => void;
  className?: string;
}

export function BlobbiGrowthHub({ blobbi, onTakePhoto, className }: BlobbiGrowthHubProps) {
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Default to expanded/open

  const {
    eggTasks,
    selectedEggId,
    incubationStartTime,
    isReadyToHatch,
    isBlobbiReadyToHatch,
    hatchBlobbi,
    markPhotoTaskCompleted,
    isTaskCompleted
  } = useBlobbiIncubationSystem();

  // Only show for eggs
  if (blobbi.lifeStage !== 'egg') {
    return null;
  }

  // Only show if this egg is selected for incubation
  if (selectedEggId !== blobbi.id) {
    return null;
  }

  // Calculate progress including dynamic shell integrity task
  const completedTasks = eggTasks.filter(task => isTaskCompleted(task, blobbi.id));
  const totalTasks = eggTasks.length;
  const progressPercentage = (completedTasks.length / totalTasks) * 100;

  const handlePostPublished = () => {
    setShowCreatePost(false);
    // The incubation system will automatically detect the published post
    // and mark the first_post task as completed
  };

  const handlePhotoTaken = () => {
    if (onTakePhoto) {
      onTakePhoto();
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className={cn("bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600", className)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Hatching Progress
                  </CardTitle>
                  <CardDescription>
                    Complete these tasks to help your egg hatch
                  </CardDescription>
                </div>
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
          {/* Progress Overview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Hatching Progress</span>
              <span className="font-medium">{completedTasks.length}/{totalTasks}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            {isBlobbiReadyToHatch(blobbi) ? (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  hatchBlobbi(blobbi.id);
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Hatch {blobbi.name}
              </Button>
            ) : (
              <Badge variant="outline" className="w-full justify-center mt-1">
                Incubating...
              </Badge>
            )}
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {eggTasks.map((task, index) => {
              // Use the centralized completion status function
              const isCompleted = isTaskCompleted(task, blobbi.id);
              let currentProgress = task.progress || 0;

              // Special handling for shell integrity task progress display
              if (task.id === 'shell_integrity_above_50') {
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

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className={cn(
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
                    {task.target && task.id !== 'shell_integrity_above_50' && (
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

                    {/* Shell integrity display */}
                    {task.id === 'shell_integrity_above_50' && (
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

                    {/* Action buttons for specific tasks */}
                    {!isCompleted && (
                      <div className="pt-2">
                        {task.id === 'first_post' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCreatePost(true)}
                            className="text-xs h-7"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Create Post
                          </Button>
                        )}

                        {task.id === 'post_blobbi_photo' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePhotoTaken}
                            className="text-xs h-7"
                          >
                            <Camera className="w-3 h-3 mr-1" />
                            Take Photo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Incubation info */}
          {incubationStartTime && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Incubation started: {new Date(incubationStartTime).toLocaleDateString()}
            </div>
          )}
          </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPostPublished={handlePostPublished}
      />
    </>
  );
}