import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlobbiAction, Blobbi, BlobbiInteractionType } from '@/types/blobbi';
import { Utensils, Gamepad2, Bath, Moon, Sun, Pill, Trophy, Thermometer, Eye, Music, MessageCircle, RefreshCw, Heart } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BlobbiInventoryModal } from './BlobbiInventoryModal';
import { useBlobbiCooldowns } from '@/hooks/useBlobbiCooldowns';
import { useBlobbiCareInteraction } from '@/hooks/useBlobbiInteractionWithStateUpdate';
import { useBlobbonautProfile, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { isActionAvailableForStage } from '@/lib/cooldown-storage';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';

interface BlobbiActionsProps {
  blobbi: Blobbi;
  onAction: (action: BlobbiAction) => void;
  isPerformingAction: boolean;
  className?: string;
  onGamesClick?: () => void;
  onOpenShop?: () => void;
  lifecycleStatus?: {
    isEligibleForEvolution: boolean;
    evolutionStatus?: {
      isReady: boolean;
      message: string;
    };
  };
  onEvolution?: () => void;
}

export function BlobbiActions({ 
  blobbi, 
  onAction, 
  isPerformingAction, 
  className, 
  onGamesClick,
  onOpenShop,
  lifecycleStatus,
  onEvolution 
}: BlobbiActionsProps) {
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<BlobbiAction | null>(null);
  
  // Check if user has a profile, create one if needed
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { mutateAsync: createInitialProfile } = useCreateInitialProfile();
  const { toast } = useToast();
  
  // Use the new cooldown system
  const {
    cooldowns,
    isLoading: cooldownsLoading,
    error: cooldownError,
    recordInteraction,
    refreshCooldowns,
    formatRemainingTime,
    isActionOnCooldown,
    isActionAvailable,
  } = useBlobbiCooldowns(blobbi);
  
  // Use the enhanced interaction system that automatically handles both 14919 and 31124 events
  const { mutateAsync: performCareInteraction } = useBlobbiCareInteraction();
  
  // Use the sleep system
  const { 
    isSleeping, 
    canSleep, 
    canWakeUp, 
    putToSleep, 
    wakeUp 
  } = useBlobbiSleepSystem({ 
    blobbi, 
    isOwner: true // Assuming this component is only shown to owners
  });
  
  const handleAction = async (action: BlobbiAction) => {
    // Check if action is available for this stage
    const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
    if (!isAvailableForStage) {
      // Import and log blocked action
      const { logInteractionBlockedUnavailable } = await import('@/lib/interaction-logger');
      logInteractionBlockedUnavailable(action, blobbi.id, blobbi.lifeStage);
      toast({
        title: "Action Unavailable",
        description: `${action} is not available for ${blobbi.lifeStage} stage Blobbis.`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if action is on cooldown using the new local-first system
    const isOnCooldown = isActionOnCooldown(action);
    if (isOnCooldown) {
      // Import and log blocked action
      const { logInteractionBlockedByCooldown } = await import('@/lib/interaction-logger');
      const remainingMs = cooldowns[action]?.remainingTime || 0;
      logInteractionBlockedByCooldown(action, blobbi.id, blobbi.lifeStage, remainingMs);
      
      const remainingTime = formatRemainingTime(action);
      const sessionInfo = cooldowns[action]?.sessionInfo;
      const isGlobalCooldown = sessionInfo?.isInGlobalCooldown;
      
      toast({
        title: isGlobalCooldown ? "Global Cooldown Active" : "Action on Cooldown",
        description: isGlobalCooldown 
          ? `You've reached the action limit. Wait ${remainingTime} before using again.`
          : `Wait ${remainingTime} before using ${action} again.`,
        variant: "destructive",
      });
      return;
    }
    
    // Final check if action is available (not on cooldown and valid for stage)
    if (!isActionAvailable(action)) {
      console.warn(`Action ${action} failed final availability check for ${blobbi.id}`);
      return;
    }

    // For actions that require items, open the inventory modal
    if (['feed', 'play', 'clean', 'medicine'].includes(action)) {
      // Ensure user has a profile before opening inventory
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
      
      setSelectedAction(action);
      setInventoryModalOpen(true);
    } else if (action === 'rest') {
      // Handle sleep/wake actions using the sleep system
      try {
        if (isSleeping) {
          await wakeUp();
        } else {
          await putToSleep();
        }
        // Record the interaction for cooldown tracking
        await recordInteraction(action);
        
        // Log successful interaction
        const { logInteractionSuccess } = await import('@/lib/interaction-logger');
        logInteractionSuccess(action, blobbi.id, blobbi.lifeStage, 'sleep_system');
      } catch (error) {
        console.error('Failed to perform sleep action:', error);
        toast({
          title: "Sleep Action Failed",
          description: "Unable to change sleep state. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // For other actions, perform directly using the enhanced interaction system
      // This will automatically send both 14919 and 31124 events
      try {
        await performCareInteraction({
          blobbiId: blobbi.id,
          action: action as 'warm' | 'check' | 'sing' | 'talk',
        });
        // Record the interaction for cooldown tracking
        await recordInteraction(action);
        
        // Log successful interaction
        const { logInteractionSuccess } = await import('@/lib/interaction-logger');
        logInteractionSuccess(action, blobbi.id, blobbi.lifeStage, 'direct');
      } catch (error) {
        console.error('Failed to perform action:', error);
        // Fallback to old system if new system fails
        try {
          await onAction(action);
          await recordInteraction(action);
        } catch (fallbackError) {
          console.error('Fallback action also failed:', fallbackError);
        }
      }
    }
  };
  
  const handleInventoryClose = async (actionPerformed?: boolean, action?: BlobbiAction) => {
    setInventoryModalOpen(false);
    setSelectedAction(null);
    
    // If an action was performed through the inventory modal, record it
    if (actionPerformed && action) {
      try {
        await recordInteraction(action);
      } catch (error) {
        console.error('Failed to record interaction:', error);
      }
    }
  };
  
  const getActionsForStage = () => {
    if (blobbi.lifeStage === 'egg') {
      return [
        {
          action: 'warm' as BlobbiAction,
          icon: Thermometer,
          label: 'Warm',
          color: 'hover:bg-orange-100',
          disabled: false,
          tooltip: 'Keep the egg warm',
        },
        {
          action: 'check' as BlobbiAction,
          icon: Eye,
          label: 'Check',
          color: 'hover:bg-blue-100',
          disabled: false,
          tooltip: 'Check on the egg',
        },
        {
          action: 'sing' as BlobbiAction,
          icon: Music,
          label: 'Sing',
          color: 'hover:bg-purple-100',
          disabled: false,
          tooltip: 'Sing to the egg',
        },
        {
          action: 'talk' as BlobbiAction,
          icon: MessageCircle,
          label: 'Talk',
          color: 'hover:bg-green-100',
          disabled: false,
          tooltip: 'Talk to the egg',
        },
        {
          action: 'medicine' as BlobbiAction,
          icon: Pill,
          label: 'Medicine',
          color: 'hover:bg-red-100',
          disabled: false, // Always allow medicine for eggs
          tooltip: 'Apply medicine to strengthen the egg (requires medicine items)',
        },
        {
          action: 'clean' as BlobbiAction,
          icon: Bath,
          label: 'Clean',
          color: 'hover:bg-cyan-100',
          disabled: false, // Always allow cleaning for eggs
          tooltip: 'Clean the egg shell (requires hygiene items)',
        },

      ];
    }
    
    // Baby and Adult actions
    const baseActions = [
      {
        action: 'feed' as BlobbiAction,
        icon: Utensils,
        label: 'Feed',
        color: 'hover:bg-orange-100',
        disabled: blobbi.stats.hunger > 90 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.hunger > 90 ? 'Already full!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Feed your Blobbi (requires food items)',
      },
      {
        action: 'play' as BlobbiAction,
        icon: Gamepad2,
        label: 'Play',
        color: 'hover:bg-yellow-100',
        disabled: blobbi.stats.energy < 20 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.energy < 20 ? 'Too tired to play' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Play with your Blobbi (requires toy items)',
      },
      {
        action: 'clean' as BlobbiAction,
        icon: Bath,
        label: 'Clean',
        color: 'hover:bg-purple-100',
        disabled: blobbi.state === 'sleeping', // Only disable when sleeping
        tooltip: blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Clean your Blobbi (requires hygiene items)',
      },
      {
        action: 'rest' as BlobbiAction,
        icon: isSleeping ? Sun : Moon,
        label: isSleeping ? 'Wake' : 'Sleep',
        color: 'hover:bg-blue-100',
        disabled: isSleeping ? !canWakeUp : !canSleep || blobbi.stats.energy > 70,
        tooltip: isSleeping ? (canWakeUp ? 'Wake up your Blobbi' : 'Cannot wake up') : (blobbi.stats.energy > 70 ? 'Not tired yet' : 'Put your Blobbi to sleep'),
      },
      {
        action: 'medicine' as BlobbiAction,
        icon: Pill,
        label: 'Medicine',
        color: 'hover:bg-red-100',
        disabled: false, // Always allow medicine
        tooltip: 'Give medicine to your Blobbi (requires medicine items)',
      },
    ];

    // Add breed action for adult Blobbis
    if (blobbi.lifeStage === 'adult') {
      baseActions.push({
        action: 'cruzar' as BlobbiAction,
        icon: Heart,
        label: 'Breed',
        color: 'hover:bg-pink-100',
        disabled: true, // Temporarily disabled
        tooltip: 'Breeding feature coming soon',
      });
    }

    return baseActions;
  };
  
  const actions = getActionsForStage();
  
  return (
    <>
      <Card className={cn("bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5" />
              Actions
            </CardTitle>
            {cooldownError && (
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshCooldowns}
                className="h-6 w-6 p-0"
                title="Refresh cooldowns"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
          {cooldownError && (
            <p className="text-xs text-muted-foreground text-red-500">
              Failed to sync cooldowns. Using local cache.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-2",
            blobbi.lifeStage === 'egg' ? "grid-cols-3" : "grid-cols-2"
          )}>
            {actions.map(({ action, icon: Icon, label, color, disabled, tooltip }) => {
              // Check if action is available for this stage
              const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
              const isOnCooldown = isActionOnCooldown(action);
              const remainingTime = formatRemainingTime(action);
              
              // Only show loading for the initial cooldown system setup, not for ongoing updates
              const isInitialLoading = cooldownsLoading && !cooldowns[action];
              const isDisabled = !isAvailableForStage || disabled || isOnCooldown || isPerformingAction || isInitialLoading;
              
              // Get session information
              const sessionInfo = cooldowns[action]?.sessionInfo;
              
              // Build tooltip
              let actionTooltip = tooltip;
              if (!isAvailableForStage) {
                actionTooltip = `Not available in ${blobbi.lifeStage} stage`;
              } else if (isOnCooldown && remainingTime) {
                if (sessionInfo?.isInGlobalCooldown) {
                  actionTooltip = `Global cooldown: ${remainingTime}`;
                } else {
                  actionTooltip = `Cooldown: ${remainingTime}`;
                }
              }
              
              return (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(action)}
                  disabled={isDisabled}
                  className={cn(
                    'flex flex-col gap-1 h-auto py-3 relative',
                    !isDisabled && isAvailableForStage && color,
                    !isAvailableForStage && 'opacity-50'
                  )}
                  title={actionTooltip}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                  
                  {/* Cooldown timer - only show when on cooldown */}
                  {isOnCooldown && remainingTime && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-background px-1 rounded border">
                      {remainingTime}
                    </span>
                  )}
                  {/* Only show loading spinner during initial setup */}
                  {isInitialLoading && (
                    <div className="absolute inset-0 bg-background/50 rounded flex items-center justify-center">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    </div>
                  )}
                </Button>
              );
            })}
            
            {/* Games Button - only for baby and adult */}
            {blobbi.lifeStage !== 'egg' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGamesClick}
                disabled={isPerformingAction}
                className={cn(
                  'flex flex-col gap-1 h-auto py-3 relative',
                  !isPerformingAction && 'hover:bg-purple-100'
                )}
              >
                <Trophy className="w-5 h-5" />
                <span className="text-xs">Games</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {selectedAction && (
        <BlobbiInventoryModal
          isOpen={inventoryModalOpen}
          onClose={handleInventoryClose}
          actionType={selectedAction}
          onOpenShop={onOpenShop}
        />
      )}
    </>
  );
}