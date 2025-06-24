import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export function BlobbiInventoryModal({ isOpen, onClose, actionType, onOpenShop, blobbi: propBlobbi }: BlobbiInventoryModalProps) {
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
        // For toys, place them in the companion and trigger physics
        await placeToyInCompanion(selectedItem);
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
    console.log('🎾 Placing toy in companion:', toy);
    
    // First, remove the toy from storage
    await removeFromStorage({
      itemId: toy.id,
      quantity: 1,
    });
    
    // Create toy element with enhanced drag prevention
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
      <DialogContent className="max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            {ActionIcon && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <ActionIcon className="w-4 h-4 text-white" />
              </div>
            )}
            {getActionTitle()}
          </DialogTitle>
        </DialogHeader>
        
        {isProfileLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your inventory...</p>
          </div>
        ) : inventoryItems.length === 0 ? (
          <div className="text-center py-12 space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
              {ActionIcon && <ActionIcon className="w-8 h-8 text-blue-500" />}
            </div>
            <div className="space-y-2">
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                No {itemType} items available
              </p>
              <p className="text-sm text-muted-foreground">
                Purchase {itemType} items from the shop to use this action.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  if (onOpenShop) {
                    onClose(false); // Close inventory modal first
                    onOpenShop(); // Then open shop modal
                  } else {
                    onClose(false); // Fallback: just close the modal
                  }
                }}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
              >
                Go to Shop
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onClose(false)}
                className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 max-h-[300px] overflow-y-auto">
              {inventoryItems.map((item) => (
                <Card 
                  key={item.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedItem?.id === item.id 
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  } bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl`}
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                          <span className="text-xl">{item.icon}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.name}</h4>
                          <div className="flex gap-2 mt-1">
                            {item.effect && Object.entries(item.effect)
                              .filter(([stat]) => stat !== 'shell_integrity') // Hide shell_integrity from UI, show only health
                              .map(([stat, value]: [string, number]) => (
                              <Badge key={stat} variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                {formatStatName(stat)} {value >= 0 ? '+' : ''}{value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">x{item.quantity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => onClose(false)} 
                className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUseItem} 
                disabled={!selectedItem || isUsingItem}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 disabled:opacity-50"
              >
                {isUsingItem ? 'Using...' : 'Use Item'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}