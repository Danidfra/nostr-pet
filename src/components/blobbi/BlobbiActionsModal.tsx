import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BlobbiAction, Blobbi } from '@/types/blobbi';
import { Utensils, Gamepad2, Bath, Moon, Sun, Pill, Trophy, Thermometer, Eye, Music, MessageCircle, Heart, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BlobbiInventoryModal } from './BlobbiInventoryModal';
import { useBlobbonautProfile, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { isActionAvailableForStage } from '@/lib/cooldown-storage';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { useBlobbiCareInteractionWithFakeStatus } from '@/hooks/useBlobbiInteractionWithFakeStatus';

interface BlobbiActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobbi: Blobbi;
  onAction: (action: BlobbiAction) => void;
  isPerformingAction: boolean;
  onGamesClick?: () => void;
  onOpenShop?: () => void;
}

export function BlobbiActionsModal({
  isOpen,
  onClose,
  blobbi,
  onAction,
  isPerformingAction,
  onGamesClick,
  onOpenShop,
}: BlobbiActionsModalProps) {
  const { updateFakeStatus } = useBlobbiFakeStatus();
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<BlobbiAction | null>(null);
  const [actionInProgress, setActionInProgress] = useState<BlobbiAction | null>(null);

  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { mutateAsync: createInitialProfile } = useCreateInitialProfile();
  const { toast } = useToast();
  const { mutateAsync: performCareInteraction } = useBlobbiCareInteractionWithFakeStatus();

  const {
    isSleeping,
    canSleep,
    canWakeUp,
    putToSleep,
    wakeUp
  } = useBlobbiSleepSystem({
    blobbi,
    isOwner: true,
    onOptimisticUpdate: (updatedBlobbi) => {
      updateFakeStatus(blobbi.id, updatedBlobbi);
    },
  });

  const handleAction = async (action: BlobbiAction) => {
    if (actionInProgress) return;

    const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
    if (!isAvailableForStage) {
      const { logInteractionBlockedUnavailable } = await import('@/lib/interaction-logger');
      logInteractionBlockedUnavailable(action, blobbi.id, blobbi.lifeStage);
      toast({
        title: "Action Unavailable",
        description: `${action} is not available for ${blobbi.lifeStage} stage Blobbis.`,
        variant: "destructive",
      });
      return;
    }

    if (['feed', 'play', 'clean', 'medicine'].includes(action)) {
      if (!blobbonautProfile) {
        try {
          await createInitialProfile({});
        } catch (error) {
          console.error('Failed to create initial profile:', error);
          toast({
            title: "Profile Creation Failed",
            description: "Unable to create your profile. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      setActionInProgress(action);
      setSelectedAction(action);
      setInventoryModalOpen(true);
      onClose(); // Close actions modal when opening inventory
    } else if (action === 'rest') {
      setActionInProgress(action);
      try {
        if (isSleeping) {
          await wakeUp();
        } else {
          await putToSleep();
        }

        const { logInteractionSuccess } = await import('@/lib/interaction-logger');
        logInteractionSuccess(action, blobbi.id, blobbi.lifeStage, 'sleep_system');
        onClose();
      } catch (error) {
        console.error('Failed to perform sleep action:', error);
        toast({
          title: "Sleep Action Failed",
          description: "Unable to change sleep state. Please try again.",
          variant: "destructive",
        });
      } finally {
        setActionInProgress(null);
      }
    } else {
      setActionInProgress(action);
      try {
        await performCareInteraction({
          blobbiId: blobbi.id,
          action: action as 'warm' | 'check' | 'sing' | 'talk',
          currentBlobbi: blobbi,
        });

        const { logInteractionSuccess } = await import('@/lib/interaction-logger');
        logInteractionSuccess(action, blobbi.id, blobbi.lifeStage, 'direct');
        onClose();
      } catch (error) {
        console.error('Failed to perform action:', error);
        try {
          await onAction(action);
          onClose();
        } catch (fallbackError) {
          console.error('Fallback action also failed:', fallbackError);
        }
      } finally {
        setActionInProgress(null);
      }
    }
  };

  const handleInventoryClose = async () => {
    setInventoryModalOpen(false);
    setSelectedAction(null);
    setActionInProgress(null);
  };

  const getActionsForStage = () => {
    if (blobbi.lifeStage === 'egg') {
      return [
        {
          action: 'warm' as BlobbiAction,
          icon: Thermometer,
          label: 'Warm',
          description: 'Keep the egg warm',
          color: 'hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-200',
          disabled: false,
        },
        {
          action: 'check' as BlobbiAction,
          icon: Eye,
          label: 'Check',
          description: 'Check on the egg',
          color: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200',
          disabled: false,
        },
        {
          action: 'sing' as BlobbiAction,
          icon: Music,
          label: 'Sing',
          description: 'Sing to the egg',
          color: 'hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200',
          disabled: false,
        },
        {
          action: 'talk' as BlobbiAction,
          icon: MessageCircle,
          label: 'Talk',
          description: 'Talk to the egg',
          color: 'hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200',
          disabled: false,
        },
      ];
    }

    const baseActions = [
      {
        action: 'feed' as BlobbiAction,
        icon: Utensils,
        label: 'Feed',
        description: blobbi.stats.hunger > 90 ? 'Already full!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Feed your Blobbi',
        color: 'hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-200',
        disabled: blobbi.stats.hunger > 90 || blobbi.state === 'sleeping',
      },
      {
        action: 'play' as BlobbiAction,
        icon: Gamepad2,
        label: 'Play',
        description: blobbi.stats.energy < 20 ? 'Too tired to play' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Play with your Blobbi',
        color: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-200',
        disabled: blobbi.stats.energy < 20 || blobbi.state === 'sleeping',
      },
      {
        action: 'clean' as BlobbiAction,
        icon: Bath,
        label: 'Clean',
        description: blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Clean your Blobbi',
        color: 'hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200',
        disabled: blobbi.state === 'sleeping',
      },
      {
        action: 'rest' as BlobbiAction,
        icon: isSleeping ? Sun : Moon,
        label: isSleeping ? 'Wake Up' : 'Sleep',
        description: isSleeping ? (canWakeUp ? 'Wake up your Blobbi' : 'Cannot wake up yet') : (blobbi.stats.energy > 70 ? 'Not tired yet' : 'Put your Blobbi to sleep'),
        color: 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200',
        disabled: isSleeping ? !canWakeUp : !canSleep || blobbi.stats.energy > 70,
      },
      {
        action: 'medicine' as BlobbiAction,
        icon: Pill,
        label: 'Medicine',
        description: 'Give medicine to your Blobbi',
        color: 'hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200',
        disabled: false,
      },
    ];

    if (blobbi.lifeStage === 'adult') {
      baseActions.push({
        action: 'cruzar' as BlobbiAction,
        icon: Heart,
        label: 'Breed',
        description: 'Breeding feature coming soon',
        color: 'hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:border-pink-200',
        disabled: true,
      });
    }

    return baseActions;
  };

  const actions = getActionsForStage();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <span>Actions</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pb-2">
            {actions.map(({ action, icon: Icon, label, description, color, disabled }) => {
              const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
              const isThisActionInProgress = actionInProgress === action;
              const isDisabled = !isAvailableForStage || disabled || isPerformingAction || !!actionInProgress;

              return (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={isDisabled}
                  className={cn(
                    "group relative overflow-hidden rounded-xl p-4",
                    "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40",
                    "border border-purple-200/50 dark:border-purple-600/50",
                    !isDisabled && "hover:border-purple-300 dark:hover:border-purple-500",
                    !isDisabled && "hover:scale-105 hover:shadow-lg hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20",
                    "transition-all duration-200",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                  title={description}
                >
                  <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      "bg-gradient-to-br transition-all duration-200",
                      !isDisabled && color.includes('orange') && "from-orange-500 to-amber-500 group-hover:from-orange-600 group-hover:to-amber-600",
                      !isDisabled && color.includes('yellow') && "from-yellow-500 to-amber-500 group-hover:from-yellow-600 group-hover:to-amber-600",
                      !isDisabled && color.includes('purple') && "from-purple-500 to-pink-500 group-hover:from-purple-600 group-hover:to-pink-600",
                      !isDisabled && color.includes('blue') && "from-blue-500 to-cyan-500 group-hover:from-blue-600 group-hover:to-cyan-600",
                      !isDisabled && color.includes('red') && "from-red-500 to-rose-500 group-hover:from-red-600 group-hover:to-rose-600",
                      !isDisabled && color.includes('green') && "from-green-500 to-emerald-500 group-hover:from-green-600 group-hover:to-emerald-600",
                      !isDisabled && color.includes('pink') && "from-pink-500 to-rose-500 group-hover:from-pink-600 group-hover:to-rose-600",
                      isDisabled && "from-gray-400 to-gray-500"
                    )}>
                      {isThisActionInProgress ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Icon className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {label}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Games button for non-egg stages */}
            {blobbi.lifeStage !== 'egg' && onGamesClick && (
              <button
                onClick={() => {
                  onGamesClick();
                  onClose();
                }}
                disabled={isPerformingAction}
                className={cn(
                  "group relative overflow-hidden rounded-xl p-4",
                  "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40",
                  "border border-purple-200/50 dark:border-purple-600/50",
                  "hover:border-purple-300 dark:hover:border-purple-500",
                  "hover:scale-105 hover:shadow-lg hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20",
                  "transition-all duration-200"
                )}
              >
                <div className="flex flex-col items-center gap-2 relative z-10">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-200">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Games
                  </span>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedAction && (
        <BlobbiInventoryModal
          isOpen={inventoryModalOpen}
          onClose={handleInventoryClose}
          actionType={selectedAction}
          onOpenShop={onOpenShop}
          blobbi={blobbi}
        />
      )}
    </>
  );
}
