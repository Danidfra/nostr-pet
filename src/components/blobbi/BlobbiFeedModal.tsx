import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiItem } from '@/types/blobbi';
import { useBlobbonautProfile, useRemoveFromStorage } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { Utensils } from 'lucide-react';
import { SHOP_ITEMS } from '@/lib/shop-items';

interface BlobbiFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShop?: () => void;
  onFoodSelected?: (food: BlobbiItem) => void;
  isCompanionMode?: boolean; // New prop to distinguish companion vs page usage
}

export function BlobbiFeedModal({ isOpen, onClose, onOpenShop, onFoodSelected, isCompanionMode = false }: BlobbiFeedModalProps) {
  const { data: blobbonautProfile, isLoading: isProfileLoading } = useBlobbonautProfile();
  const { mutateAsync: removeFromStorage } = useRemoveFromStorage();
  const { toast } = useToast();
  const [selectedFood, setSelectedFood] = useState<BlobbiItem | null>(null);
  const [isUsingFood, setIsUsingFood] = useState(false);
  
  // Get food items from BlobbonautProfile storage
  const getFoodItemsFromStorage = (): (BlobbiItem & { quantity: number })[] => {
    if (!blobbonautProfile || !blobbonautProfile.storage) return [];
    
    return blobbonautProfile.storage
      .map(storageItem => {
        const shopItem = SHOP_ITEMS.find(item => item.id === storageItem.itemId);
        return shopItem && shopItem.type === 'food'
          ? { ...shopItem, quantity: storageItem.quantity }
          : null;
      })
      .filter((item): item is (BlobbiItem & { quantity: number }) => item !== null);
  };
  
  const foodItems = getFoodItemsFromStorage();
  
  const handleUseFood = async () => {
    if (!selectedFood || isUsingFood) return;
    
    setIsUsingFood(true);
    
    try {
      if (isCompanionMode) {
        // For companion mode: Don't remove from inventory yet, just select the food
        toast({
          title: "Food Selected!",
          description: `${selectedFood.name} selected for feeding. Click on the screen to place it!`,
        });
        
        // Notify parent component about food selection (without removing from inventory)
        if (onFoodSelected) {
          onFoodSelected(selectedFood);
        }
        
        // Close the modal
        onClose();
      } else {
        // For regular Blobbi page: Remove from inventory immediately (existing behavior)
        await removeFromStorage({
          itemId: selectedFood.id,
          quantity: 1,
        });
        
        toast({
          title: "Food Selected!",
          description: `${selectedFood.name} selected for feeding. Click on the screen to place it!`,
        });
        
        // Notify parent component about food selection
        if (onFoodSelected) {
          onFoodSelected(selectedFood);
        }
        
        // Close the modal
        onClose();
      }
    } catch (error) {
      console.error('Failed to use food:', error);
      toast({
        title: "Failed to select food",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUsingFood(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" style={{ zIndex: 10000 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            Feed Your Blobbi
          </DialogTitle>
        </DialogHeader>
        
        {isProfileLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your food items...</p>
          </div>
        ) : foodItems.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground mb-4">
              You need food items to feed your Blobbi.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Purchase food items from the shop to feed your companion.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => {
                  if (onOpenShop) {
                    onClose(); // Close feed modal first
                    onOpenShop(); // Then open shop modal with food tab active
                  } else {
                    onClose(); // Fallback: just close the modal
                  }
                }}>
                Go to Shop
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {foodItems.map((food) => (
                <Card 
                  key={food.id}
                  className={`cursor-pointer transition-colors ${
                    selectedFood?.id === food.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedFood(food)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{food.icon}</span>
                        <div>
                          <h4 className="font-medium text-sm">{food.name}</h4>
                          <div className="flex gap-2 mt-1">
                            {food.effect && Object.entries(food.effect)
                              .filter(([stat]) => stat !== 'shell_integrity') // Hide shell_integrity from UI
                              .map(([stat, value]) => (
                              <Badge key={stat} variant="secondary" className="text-xs">
                                {stat.charAt(0).toUpperCase() + stat.slice(1)} {value >= 0 ? '+' : ''}{value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">x{food.quantity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleUseFood} 
                disabled={!selectedFood || isUsingFood}
                className="flex-1"
              >
                {isUsingFood ? 'Selecting...' : 'Select Food'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}