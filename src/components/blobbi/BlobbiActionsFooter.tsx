import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BlobbiAction, Blobbi } from '@/types/blobbi';
import { Utensils, Gamepad2, Bath, Moon, Sun, Pill, Trophy, Thermometer, Eye, Music, MessageCircle, Heart, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { BlobbiInventoryModal } from './BlobbiInventoryModal';
import { useBlobbiCareInteractionWithFakeStatus } from '@/hooks/useBlobbiInteractionWithFakeStatus';
import { BlobbiFakeStatusIndicator } from './BlobbiFakeStatusIndicator';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { useBlobbonautProfile, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { isActionAvailableForStage } from '@/lib/cooldown-storage';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';

interface BlobbiActionsFooterProps {
  blobbi: Blobbi;
  onAction: (action: BlobbiAction) => void;
  isPerformingAction: boolean;
  className?: string;
  onGamesClick?: () => void;
  onOpenShop?: () => void;
}

/**
 * Reusable Blobbi actions footer component
 * Used in both the detail page and dashboard
 */
export function BlobbiActionsFooter({
  blobbi,
  onAction,
  isPerformingAction,
  className,
  onGamesClick,
  onOpenShop,
}: BlobbiActionsFooterProps) {
  const { hasFakeStatus, getPendingInteractionCount, updateFakeStatus } = useBlobbiFakeStatus();
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
      } catch (error) {
        console.error('Failed to perform action:', error);
        try {
          await onAction(action);
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
          color: 'hover:bg-orange-100 dark:hover:bg-orange-900/20',
          disabled: false,
          tooltip: 'Keep the egg warm',
        },
        {
          action: 'check' as BlobbiAction,
          icon: Eye,
          label: 'Check',
          color: 'hover:bg-blue-100 dark:hover:bg-blue-900/20',
          disabled: false,
          tooltip: 'Check on the egg',
        },
        {
          action: 'sing' as BlobbiAction,
          icon: Music,
          label: 'Sing',
          color: 'hover:bg-purple-100 dark:hover:bg-purple-900/20',
          disabled: false,
          tooltip: 'Sing to the egg',
        },
        {
          action: 'talk' as BlobbiAction,
          icon: MessageCircle,
          label: 'Talk',
          color: 'hover:bg-green-100 dark:hover:bg-green-900/20',
          disabled: false,
          tooltip: 'Talk to the egg',
        },
      ];
    }

    const baseActions = [
      {
        action: 'feed' as BlobbiAction,
        icon: Utensils,
        label: 'Feed',
        color: 'hover:bg-orange-100 dark:hover:bg-orange-900/20',
        disabled: blobbi.stats.hunger > 90 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.hunger > 90 ? 'Already full!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Feed your Blobbi',
      },
      {
        action: 'play' as BlobbiAction,
        icon: Gamepad2,
        label: 'Play',
        color: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/20',
        disabled: blobbi.stats.energy < 20 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.energy < 20 ? 'Too tired to play' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Play with your Blobbi',
      },
      {
        action: 'clean' as BlobbiAction,
        icon: Bath,
        label: 'Clean',
        color: 'hover:bg-purple-100 dark:hover:bg-purple-900/20',
        disabled: blobbi.state === 'sleeping',
        tooltip: blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Clean your Blobbi',
      },
      {
        action: 'rest' as BlobbiAction,
        icon: isSleeping ? Sun : Moon,
        label: isSleeping ? 'Wake' : 'Sleep',
        color: 'hover:bg-blue-100 dark:hover:bg-blue-900/20',
        disabled: isSleeping ? !canWakeUp : !canSleep || blobbi.stats.energy > 70,
        tooltip: isSleeping ? (canWakeUp ? 'Wake up your Blobbi' : 'Cannot wake up') : (blobbi.stats.energy > 70 ? 'Not tired yet' : 'Put your Blobbi to sleep'),
      },
      {
        action: 'medicine' as BlobbiAction,
        icon: Pill,
        label: 'Medicine',
        color: 'hover:bg-red-100 dark:hover:bg-red-900/20',
        disabled: false,
        tooltip: 'Give medicine to your Blobbi',
      },
    ];

    if (blobbi.lifeStage === 'adult') {
      baseActions.push({
        action: 'cruzar' as BlobbiAction,
        icon: Heart,
        label: 'Breed',
        color: 'hover:bg-pink-100 dark:hover:bg-pink-900/20',
        disabled: true,
        tooltip: 'Breeding feature coming soon',
      });
    }

    return baseActions;
  };

  const actions = getActionsForStage();

  return (
    <>
      <div className={cn("bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t-2 border-purple-300 dark:border-purple-600 shadow-lg", className)}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-2 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap w-full">
              {actions.map(({ action, icon: Icon, label, color, disabled, tooltip }) => {
                const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
                const isThisActionInProgress = actionInProgress === action;
                const isDisabled = !isAvailableForStage || disabled || isPerformingAction || !!actionInProgress;

                let actionTooltip = tooltip;
                if (!isAvailableForStage) {
                  actionTooltip = `Not available in ${blobbi.lifeStage} stage`;
                }

                return (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(action)}
                    disabled={isDisabled}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2.5 h-auto rounded-full',
                      !isDisabled && isAvailableForStage && color,
                      !isAvailableForStage && 'opacity-50'
                    )}
                    title={actionTooltip}
                  >
                    {isThisActionInProgress ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium hidden sm:inline">{label}</span>
                  </Button>
                );
              })}

              {blobbi.lifeStage !== 'egg' && onGamesClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGamesClick}
                  disabled={isPerformingAction}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 h-auto rounded-full',
                    !isPerformingAction && 'hover:bg-purple-100 dark:hover:bg-purple-900/20'
                  )}
                >
                  <Trophy className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Games</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

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
