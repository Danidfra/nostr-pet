import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiItem, BlobbiAction } from '@/types/blobbi';
import { useBlobbonautProfileWithFakeInventory } from '@/hooks/useBlobbonautProfileWithFakeInventory';
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
  const { data: blobbonautProfile, isLoading: isProfileLoading, removeFromStorage } = useBlobbonautProfileWithFakeInventory();
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
      <DialogContent className="max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl" style={{ zIndex: 10000 }}>
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-white" />
            </div>
            Feed Your Blobbi
          </DialogTitle>
        </DialogHeader>
        
        {isProfileLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your food items...</p>
          </div>
        ) : foodItems.length === 0 ? (
          <div className="text-center py-12 space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center">
              <Utensils className="w-8 h-8 text-orange-500" />
            </div>
            <div className="space-y-2">
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                No food items available
              </p>
              <p className="text-sm text-muted-foreground">
                Purchase food items from the shop to feed your companion.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  if (onOpenShop) {
                    onClose(); // Close feed modal first
                    onOpenShop(); // Then open shop modal with food tab active
                  } else {
                    onClose(); // Fallback: just close the modal
                  }
                }}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
              >
                Go to Shop
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 max-h-[300px] overflow-y-auto">
              {foodItems.map((food) => (
                <Card 
                  key={food.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedFood?.id === food.id 
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  } bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl`}
                  onClick={() => setSelectedFood(food)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                          <span className="text-xl">{food.icon}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{food.name}</h4>
                          <div className="flex gap-2 mt-1">
                            {food.effect && Object.entries(food.effect)
                              .filter(([stat]) => stat !== 'shell_integrity') // Hide shell_integrity from UI
                              .map(([stat, value]: [string, number]) => (
                              <Badge key={stat} variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
                                {stat.charAt(0).toUpperCase() + stat.slice(1)} {value >= 0 ? '+' : ''}{value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">x{food.quantity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUseFood} 
                disabled={!selectedFood || isUsingFood}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 disabled:opacity-50"
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