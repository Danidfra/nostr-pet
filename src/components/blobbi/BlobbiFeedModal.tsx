import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl" style={{ zIndex: 10000 }}>
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="truncate">Feed Your Blobbi</span>
          </DialogTitle>
        </DialogHeader>

        {isProfileLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your food items...</p>
          </div>
        ) : foodItems.length === 0 ? (
          <div className="text-center py-16 space-y-8">
            <div className="relative">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-xl">
                <Utensils className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-red-400 to-pink-400 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                No food items available
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                Visit the shop to purchase delicious food items and keep your Blobbi well-fed and happy.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  onClose(); // Close feed modal first
                  // Use a small delay to ensure modal closes before opening shop
                  setTimeout(() => {
                    if (onOpenShop) {
                      onOpenShop(); // Then open shop modal with food tab active
                    } else {
                      // Fallback: dispatch a global event to open shop
                      window.dispatchEvent(new CustomEvent('open-shop', {
                        detail: { defaultTab: 'food' }
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
                onClick={onClose}
                className="h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 flex flex-col h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-2">
              {foodItems.map((food) => (
                <Card
                  key={food.id}
                  className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                    selectedFood?.id === food.id
                      ? 'ring-2 ring-green-500 shadow-lg scale-[1.02] bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30'
                      : 'hover:bg-gradient-to-br hover:from-gray-50 hover:to-green-50 dark:hover:from-gray-800 dark:hover:to-green-900/20'
                  } bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-green-200/50 dark:border-green-600/50 rounded-2xl overflow-hidden`}
                  onClick={() => setSelectedFood(food)}
                >
                  <CardContent className="p-0">
                    {/* Header with icon and quantity */}
                    <div className="relative p-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                          <span className="text-2xl filter drop-shadow-sm">{food.icon}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 rounded-full border border-green-200/50 dark:border-green-600/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          <span className="text-xs font-semibold text-green-700 dark:text-green-300">×{food.quantity}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-4 pb-4">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2 truncate">{food.name}</h4>

                      {/* Effects */}
                      {food.effect && Object.entries(food.effect).filter(([stat]) => stat !== 'shell_integrity').length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {Object.entries(food.effect)
                            .filter(([stat]) => stat !== 'shell_integrity')
                            .map(([stat, value]: [string, number]) => (
                            <div key={stat} className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 rounded-lg border border-orange-200/50 dark:border-orange-700/50">
                              <div className="w-1 h-1 rounded-full bg-orange-500"></div>
                              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                {stat.charAt(0).toUpperCase() + stat.slice(1)} {value >= 0 ? '+' : ''}{value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Selection indicator */}
                      <div className={`h-1 rounded-full transition-all duration-300 ${
                        selectedFood?.id === food.id
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-200 dark:bg-gray-700 group-hover:bg-gradient-to-r group-hover:from-green-300 group-hover:to-emerald-300'
                      }`}></div>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUseFood}
                disabled={!selectedFood || isUsingFood}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isUsingFood ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Selecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-lg">🍽️</span>
                    Select Food
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