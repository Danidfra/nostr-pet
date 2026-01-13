import { Button } from '@/components/ui/button';
import { BlobbiAction, Blobbi } from '@/types/blobbi';
import { Gamepad2, Package, Sparkles, ShoppingBag, Target } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BlobbiInventoryModal } from './BlobbiInventoryModal';
import { BlobbiActionsModal } from './BlobbiActionsModal';
import { useBlobbiCareInteractionWithFakeStatus } from '@/hooks/useBlobbiInteractionWithFakeStatus';
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
  onSwitchBlobbi?: () => void;
  onOpenInventory?: () => void;
  onOpenMissions?: () => void;
}

/**
 * Reusable Blobbi actions footer component
 * Used in both the detail page and dashboard
 *
 * Dashboard mode: 5-button layout
 * - Left: Shop
 * - Left-center: Inventory
 * - Center: Actions (opens modal)
 * - Right-center: Blobbies (Switch)
 * - Right: Missions
 *
 * Detail page mode: 1-button layout
 * - Center: Actions (opens modal)
 */
export function BlobbiActionsFooter({
  blobbi,
  onAction,
  isPerformingAction,
  className,
  onOpenShop,
  onSwitchBlobbi,
  onOpenInventory,
  onOpenMissions,
}: BlobbiActionsFooterProps) {
  const { updateFakeStatus } = useBlobbiFakeStatus();
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
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

  // Determine if we're in dashboard mode (all 3 buttons) or detail page mode (actions modal only)
  const isDashboardMode = onSwitchBlobbi && onOpenInventory;

  return (
    <>
      <div className={cn("bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t-2 border-purple-300 dark:border-purple-600 shadow-lg", className)}>
        <div className="container mx-auto px-4 py-3">
          {isDashboardMode ? (
            // Dashboard mode: 5-button layout
            <div className="flex items-center justify-between sm:justify-center sm:gap-4 lg:gap-8 max-w-6xl mx-auto">
              {/* Left: Shop */}
              {onSwitchBlobbi && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchBlobbi}
                  disabled={isPerformingAction}
                  className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/20"
                  title="Switch to another Blobbi"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Blobbies</span>
                </Button>
              )}

              {/* Right: Missions */}
              {onOpenMissions && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenMissions}
                  disabled={isPerformingAction}
                  className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/20"
                  title="Open missions"
                >
                  <Target className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Missions</span>
                </Button>
              )}

              {/* Center: Actions */}
              <Button
                variant="default"
                size="sm"
                onClick={() => setActionsModalOpen(true)}
                disabled={isPerformingAction}
                className="flex items-center gap-2 px-6 py-2.5 h-auto rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                title="Open actions menu"
              >
                <Gamepad2 className="w-5 h-5" />
                <span className="text-sm font-medium">Actions</span>
              </Button>

              {/* Right-center: Blobbies (Switch) */}
              {onOpenShop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenShop}
                  disabled={isPerformingAction}
                  className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full hover:bg-green-100 dark:hover:bg-green-900/20"
                  title="Open shop"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Shop</span>
                </Button>
              )}

              {/* Left-center: Inventory */}
              {onOpenInventory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenInventory}
                  disabled={isPerformingAction}
                  className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20"
                  title="Open inventory"
                >
                  <Package className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Inventory</span>
                </Button>
              )}
            </div>
          ) : (
            // Detail page mode: Just the Actions button centered
            <div className="flex items-center justify-center max-w-4xl mx-auto">
              <Button
                variant="default"
                size="sm"
                onClick={() => setActionsModalOpen(true)}
                disabled={isPerformingAction}
                className="flex items-center gap-2 px-6 py-2.5 h-auto rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                title="Open actions menu"
              >
                <Gamepad2 className="w-5 h-5" />
                <span className="text-sm font-medium">Actions</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Actions Modal */}
      <BlobbiActionsModal
        isOpen={actionsModalOpen}
        onClose={() => setActionsModalOpen(false)}
        blobbi={blobbi}
        onAction={handleAction}
        actionInProgress={actionInProgress}
        isSleeping={isSleeping}
        canSleep={canSleep ?? false}
        canWakeUp={canWakeUp ?? false}
      />

      {/* Inventory Modal */}
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
