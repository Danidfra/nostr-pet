import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BlobbiItem, BlobbiAction, Blobbi } from '@/types/blobbi';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbiCareInteractionWithFakeStatus } from '@/hooks/useBlobbiInteractionWithFakeStatus';
import { useBlobbonautProfileWithFakeInventory } from '@/hooks/useBlobbonautProfileWithFakeInventory';
import { useToast } from '@/hooks/useToast';
import { useAudio } from '@/contexts/AudioContext';
import { Utensils, Gamepad2, Pill, Bath, Sparkles } from 'lucide-react';
import { SHOP_ITEMS, getMedicineSoundForItem } from '@/lib/shop-items';

interface BlobbiInventoryModalProps {
  isOpen: boolean;
  onClose: (actionPerformed?: boolean, action?: BlobbiAction) => void;
  actionType: BlobbiAction;
  onOpenShop?: () => void;
  blobbi?: Blobbi; // Optional blobbi prop for companion usage
  isCompanionContext?: boolean; // Flag to indicate if this is being used from companion context
}

const ACTION_TYPE_MAP: Record<BlobbiAction, string> = {
  feed: 'food',
  play: 'toy',
  medicine: 'medicine',
  clean: 'hygiene',
  rest: '',
  warm: '',
  check: '',
  sing: '',
  talk: '',
  cruzar: '',
};

const ACTION_ICONS: Record<BlobbiAction, React.ComponentType<{ className?: string }> | null> = {
  feed: Utensils,
  play: Gamepad2,
  medicine: Pill,
  clean: Bath,
  rest: null,
  warm: null,
  check: null,
  sing: null,
  talk: null,
  cruzar: null,
};

export function BlobbiInventoryModal({ isOpen, onClose, actionType, onOpenShop, blobbi: propBlobbi, isCompanionContext = false }: BlobbiInventoryModalProps) {
  const { blobbi: contextBlobbi } = useBlobbiWithFakeStatus();
  const { data: blobbonautProfile, isLoading: isProfileLoading, removeFromStorage } = useBlobbonautProfileWithFakeInventory();
  const { mutateAsync: performCareInteraction } = useBlobbiCareInteractionWithFakeStatus();
  const { toast } = useToast();
  const { playSound } = useAudio();
  const [selectedItem, setSelectedItem] = useState<BlobbiItem | null>(null);
  const [isUsingItem, setIsUsingItem] = useState(false);

  // Use prop blobbi if provided (for companion), otherwise use context blobbi
  const blobbi = propBlobbi || contextBlobbi;

  if (!blobbi) return null;

  const itemType = ACTION_TYPE_MAP[actionType];
  if (!itemType) return null;

  // Get items from BlobbonautProfile storage instead of individual Blobbi inventory
  const getStorageItemsByType = (type: string): (BlobbiItem & { quantity: number })[] => {
    if (!blobbonautProfile || !blobbonautProfile.storage) return [];

    return blobbonautProfile.storage
      .map(storageItem => {
        const shopItem = SHOP_ITEMS.find(item => item.id === storageItem.itemId);
        return shopItem && shopItem.type === type
          ? { ...shopItem, quantity: storageItem.quantity }
          : null;
      })
      .filter((item): item is (BlobbiItem & { quantity: number }) => item !== null);
  };

  const inventoryItems = getStorageItemsByType(itemType);
  const ActionIcon = ACTION_ICONS[actionType];

  const handleUseItem = async () => {
    if (!selectedItem || !blobbi || isUsingItem) return;

    setIsUsingItem(true);

    try {
      // ✅ NEW: Handle toy placement differently from other items
      if (actionType === 'play' && selectedItem.type === 'toy') {
        // Only place toys in the companion if this is being used from companion context
        if (isCompanionContext) {
          // For toys, place them in the companion and trigger physics
          await placeToyInCompanion(selectedItem);
        } else {
          // For detailed blobbi page, just apply the toy effects without visual placement
          // First, remove the item from storage
          await removeFromStorage({
            itemId: selectedItem.id,
            quantity: 1,
          });

          // Then use the enhanced care interaction system with item effects
          await performCareInteraction({
            blobbiId: blobbi.id,
            action: actionType,
            itemEffects: selectedItem.effect,
            itemUsed: selectedItem.name,
            currentBlobbi: blobbi,
          });
        }
      } else {
        // Handle other items normally (food, medicine, hygiene)

        // Play sound first based on action type and item
        if (actionType === 'feed') {
          playSound('eating');
        } else if (actionType === 'medicine') {
          const medicineSound = getMedicineSoundForItem(selectedItem.id);
          if (medicineSound) {
            playSound(medicineSound);
          }
        } else if (actionType === 'clean') {
          playSound('cleaning');
        }

        // First, remove the item from storage
        await removeFromStorage({
          itemId: selectedItem.id,
          quantity: 1,
        });

        // Then use the enhanced care interaction system with item effects
        await performCareInteraction({
          blobbiId: blobbi.id,
          action: actionType,
          itemEffects: selectedItem.effect,
          itemUsed: selectedItem.name,
          currentBlobbi: blobbi,
        });
      }

      toast({
        title: "Item Used!",
        description: `${blobbi.name || 'Your Blobbi'} ${actionType === 'play' ? 'is playing with' : 'used'} ${selectedItem.name}!`,
      });

      // Close with action performed flag
      onClose(true, actionType);
    } catch (error) {
      console.error('Failed to use item:', error);
      toast({
        title: "Failed to use item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUsingItem(false);
    }
  };

  const placeToyInCompanion = async (toy: BlobbiItem) => {

    // First, remove the toy from storage
    await removeFromStorage({
      itemId: toy.id,
      quantity: 1,
    });

    // ✅ NEW: Handle Build Blocks differently - don't create a toy element
    if (toy.id === 'toy_blocks') {

      // Dispatch toy-placed event with null element to trigger block selection menu
      window.dispatchEvent(new CustomEvent('toy-placed', {
        detail: {
          element: null, // No element for blocks - menu will be opened instead
          toy: toy,
          x: window.innerWidth / 2,
          y: window.innerHeight / 3
        }
      }));

      // Apply toy effects to Blobbi stats
      await performCareInteraction({
        blobbiId: blobbi.id,
        action: actionType,
        itemEffects: toy.effect,
        itemUsed: toy.name,
        currentBlobbi: blobbi,
      });

      return; // Exit early for blocks
    }

    // Create toy element with enhanced drag prevention for other toys
    const toyElement = document.createElement('div');
    toyElement.className = `companion-toy ${toy.id.replace('toy_', '')}`;

    // ✅ ENHANCED: Comprehensive drag prevention and smooth interaction setup
    toyElement.style.cssText = `
      position: fixed;
      left: ${window.innerWidth / 2 - 30}px;
      top: ${window.innerHeight / 3}px;
      font-size: ${toy.id === 'toy_teddy' ? '60px' : '40px'};
      z-index: 9997;
      pointer-events: auto;
      user-select: none;
      -webkit-user-select: none;
      -webkit-user-drag: none;
      -webkit-touch-callout: none;
      animation: toyDrop 0.5s ease-out;
      transition: transform 0.15s ease-out, filter 0.15s ease-out;
    `;

    // ✅ ENHANCED: Prevent default drag behavior at element level
    toyElement.draggable = false;
    toyElement.setAttribute('draggable', 'false');

    // ✅ UPDATED: Set toy icon based on type with correct sizes and drag prevention
    if (toy.id === 'toy_ball') {
      const img = document.createElement('img');
      img.src = '/companion/assets/toys/ball.png';
      img.alt = 'Ball';
      img.style.cssText = `
        width: 40px;
        height: 40px;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
        -webkit-touch-callout: none;
      `;
      img.draggable = false;
      img.setAttribute('draggable', 'false');

      // Prevent image-specific drag events
      img.addEventListener('dragstart', (e) => {
        e.preventDefault();
        return false;
      });

      toyElement.appendChild(img);
    } else if (toy.id === 'toy_teddy') {
      const img = document.createElement('img');
      img.src = '/companion/assets/toys/bear.png';
      img.alt = 'Teddy Bear';
      img.style.cssText = `
        width: 120px;
        height: 120px;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
        -webkit-touch-callout: none;
      `;
      img.draggable = false;
      img.setAttribute('draggable', 'false');

      // Prevent image-specific drag events
      img.addEventListener('dragstart', (e) => {
        e.preventDefault();
        return false;
      });

      toyElement.appendChild(img);
    } else {
      toyElement.textContent = toy.icon || '🎾';
    }

    // ✅ NEW: Add comprehensive event prevention for the toy element
    toyElement.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });

    toyElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // ✅ NEW: Add drop animation keyframes if not already present
    if (!document.querySelector('#toy-drop-animation')) {
      const style = document.createElement('style');
      style.id = 'toy-drop-animation';
      style.textContent = `
        @keyframes toyDrop {
          from {
            transform: translateY(-20px) scale(0.8);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toyElement);

    // Dispatch toy-placed event to companion
    window.dispatchEvent(new CustomEvent('toy-placed', {
      detail: {
        element: toyElement,
        toy: toy,
        x: window.innerWidth / 2,
        y: window.innerHeight / 3
      }
    }));

    // Apply toy effects to Blobbi stats
    await performCareInteraction({
      blobbiId: blobbi.id,
      action: actionType,
      itemEffects: toy.effect,
      itemUsed: toy.name,
      currentBlobbi: blobbi,
    });
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'feed':
        return 'Feed Your Blobbi';
      case 'play':
        return 'Play with Your Blobbi';
      case 'medicine':
        return blobbi.lifeStage === 'egg' ? 'Strengthen Your Egg' : 'Heal Your Blobbi';
      case 'clean':
        return blobbi.lifeStage === 'egg' ? 'Clean Your Egg Shell' : 'Clean Your Blobbi';
      default:
        return 'Use Item';
    }
  };

  const formatStatName = (stat: string): string => {
    switch (stat) {
      case 'shell_integrity':
        return 'Shell';
      case 'egg_temperature':
        return 'Temp';
      default:
        return stat.charAt(0).toUpperCase() + stat.slice(1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {ActionIcon && (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <ActionIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
            )}
            <span className="truncate">{getActionTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        {isProfileLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your inventory...</p>
          </div>
        ) : inventoryItems.length === 0 ? (
          <div className="text-center py-16 space-y-8">
            <div className="relative">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl">
                {ActionIcon && <ActionIcon className="w-10 h-10 text-white" />}
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-red-400 to-pink-400 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                No {itemType} items available
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                Visit the shop to purchase {itemType} items and unlock this action for your Blobbi.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  onClose(false); // Close inventory modal first
                  // Use a small delay to ensure modal closes before opening shop
                  setTimeout(() => {
                    if (onOpenShop) {
                      onOpenShop(); // Then open shop modal
                    } else {
                      // Fallback: dispatch a global event to open shop
                      window.dispatchEvent(new CustomEvent('open-shop', {
                        detail: { defaultTab: itemType }
                      }));
                    }
                  }, 100);
                }}
                className="h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">🛒</span>
                  Visit Shop
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onClose(false)}
                className="h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 flex flex-col h-full">
            <ScrollArea className="flex-1 max-h-[450px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-2">
              {inventoryItems.map((item) => (
                <Card
                  key={item.id}
                  className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                    selectedItem?.id === item.id
                      ? 'ring-2 ring-purple-500 shadow-lg scale-[1.02] bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30'
                      : 'hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-blue-900/20'
                  } bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden`}
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="p-0">
                    {/* Header with icon and quantity */}
                    <div className="relative p-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                          <span className="text-2xl filter drop-shadow-sm">{item.icon}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 rounded-full border border-purple-200/50 dark:border-purple-600/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">×{item.quantity}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 pb-4">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2 truncate">{item.name}</h4>

                      {/* Effects */}
                      {item.effect && Object.entries(item.effect).filter(([stat]) => stat !== 'shell_integrity').length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {Object.entries(item.effect)
                            .filter(([stat]) => stat !== 'shell_integrity')
                            .map(([stat, value]: [string, number]) => (
                            <div key={stat} className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg border border-emerald-200/50 dark:border-emerald-700/50">
                              <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                {formatStatName(stat)} {value >= 0 ? '+' : ''}{value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Selection indicator */}
                      <div className={`h-1 rounded-full transition-all duration-300 ${
                        selectedItem?.id === item.id
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                          : 'bg-gray-200 dark:bg-gray-700 group-hover:bg-gradient-to-r group-hover:from-purple-300 group-hover:to-pink-300'
                      }`}></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            </ScrollArea>

            <div className="flex gap-3 pt-2">
              {onOpenShop && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose(false);
                    setTimeout(() => {
                      onOpenShop();
                    }, 100);
                  }}
                  className="flex-1 h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">🛒</span>
                    Go to Shop
                  </span>
                </Button>
              )}
              <Button
                onClick={handleUseItem}
                disabled={!selectedItem || isUsingItem}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isUsingItem ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Using...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    Use Item
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}