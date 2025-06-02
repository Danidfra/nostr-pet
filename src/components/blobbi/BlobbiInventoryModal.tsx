import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiItem, BlobbiAction } from '@/types/blobbi';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbiCareInteraction } from '@/hooks/useBlobbiInteractionWithStateUpdate';
import { useBlobbonautProfile, useRemoveFromStorage } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { Utensils, Gamepad2, Pill, Bath, Sparkles } from 'lucide-react';
import { SHOP_ITEMS } from '@/lib/shop-items';

interface BlobbiInventoryModalProps {
  isOpen: boolean;
  onClose: (actionPerformed?: boolean, action?: BlobbiAction) => void;
  actionType: BlobbiAction;
  onOpenShop?: () => void;
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

export function BlobbiInventoryModal({ isOpen, onClose, actionType, onOpenShop }: BlobbiInventoryModalProps) {
  const { blobbi } = useBlobbi();
  const { data: blobbonautProfile, isLoading: isProfileLoading } = useBlobbonautProfile();
  const { mutateAsync: performCareInteraction } = useBlobbiCareInteraction();
  const { mutateAsync: removeFromStorage } = useRemoveFromStorage();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<BlobbiItem | null>(null);
  const [isUsingItem, setIsUsingItem] = useState(false);
  
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
      });
      
      toast({
        title: "Item Used!",
        description: `${blobbi.name} used ${selectedItem.name}!`,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ActionIcon && <ActionIcon className="w-5 h-5" />}
            {getActionTitle()}
          </DialogTitle>
        </DialogHeader>
        
        {isProfileLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your inventory...</p>
          </div>
        ) : inventoryItems.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground mb-4">
              You need {itemType} items to perform this action.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Purchase {itemType} items from the shop to use this action.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => {
                  if (onOpenShop) {
                    onClose(false); // Close inventory modal first
                    onOpenShop(); // Then open shop modal
                  } else {
                    onClose(false); // Fallback: just close the modal
                  }
                }}>
                Go to Shop
              </Button>
              <Button variant="secondary" onClick={() => onClose(false)}>
                Cancel
              </Button>

            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {inventoryItems.map((item) => (
                <Card 
                  key={item.id}
                  className={`cursor-pointer transition-colors ${
                    selectedItem?.id === item.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <h4 className="font-medium text-sm">{item.name}</h4>
                          <div className="flex gap-2 mt-1">
                            {item.effect && Object.entries(item.effect).map(([stat, value]) => (
                              <Badge key={stat} variant="secondary" className="text-xs">
                                {formatStatName(stat)} {value >= 0 ? '+' : ''}{value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">x{item.quantity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onClose(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleUseItem} 
                disabled={!selectedItem || isUsingItem}
                className="flex-1"
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