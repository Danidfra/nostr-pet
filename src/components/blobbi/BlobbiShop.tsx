import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Coins, Palette, Sparkles, Heart, Utensils, Gamepad2, ShoppingBag } from 'lucide-react';
import { BlobbiItem } from '@/types/blobbi';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { SHOP_ITEMS, getShopItemsByType } from '@/lib/shop-items';

interface BlobbiShopProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function BlobbiShop({ isOpen, onClose, defaultTab = 'food' }: BlobbiShopProps) {
  const { blobbi, isOwner, purchaseItem } = useBlobbi();
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<BlobbiItem | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  
  if (!blobbi || !isOwner || !blobbonautProfile) return null;
  
  const handlePurchase = (item: BlobbiItem) => {
    if (blobbonautProfile.coins < item.price) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${item.price - blobbonautProfile.coins} more coins to buy ${item.name}.`,
        variant: "destructive",
      });
      return;
    }
    
    setSelectedItem(item);
    setShowPurchaseDialog(true);
  };
  
  const confirmPurchase = async () => {
    if (!selectedItem) return;
    
    try {
      // Purchase the item (this will update coins and inventory)
      await purchaseItem(selectedItem);
      
      toast({
        title: "Purchase Successful!",
        description: `You bought ${selectedItem.name} for ${selectedItem.price} coins.`,
      });
      
      setShowPurchaseDialog(false);
      setSelectedItem(null);
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: "Failed to complete the purchase. Please try again.",
        variant: "destructive",
      });
    }
  };
  

  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-between text-xl font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
                Blobbi Shop
              </span>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="font-semibold text-yellow-700 dark:text-yellow-300">{blobbonautProfile.coins}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue={defaultTab} className="w-full">
            <div className="mb-6">
              <TabsList className="grid w-full grid-cols-5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
                <TabsTrigger 
                  value="food"
                  className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Food
                </TabsTrigger>
                <TabsTrigger 
                  value="toys"
                  className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Toys
                </TabsTrigger>
                <TabsTrigger 
                  value="medicine"
                  className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Medicine
                </TabsTrigger>
                <TabsTrigger 
                  value="hygiene"
                  className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Hygiene
                </TabsTrigger>
                <TabsTrigger 
                  value="accessories"
                  className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Accessories
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="food" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {getShopItemsByType('food').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbonautProfile.coins >= item.price}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="toys" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {getShopItemsByType('toy').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbonautProfile.coins >= item.price}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="medicine" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {getShopItemsByType('medicine').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbonautProfile.coins >= item.price}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="hygiene" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {getShopItemsByType('hygiene').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbonautProfile.coins >= item.price}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="accessories" className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                  <Palette className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Accessories coming soon! Customize your Blobbi's appearance.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {getShopItemsByType('accessory').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbonautProfile.coins >= item.price}
                    onPurchase={handlePurchase}
                    disabled
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* Purchase Confirmation Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Confirm Purchase</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Are you sure you want to buy {selectedItem?.name} for {selectedItem?.price} coins?
            </DialogDescription>
          </DialogHeader>
          {selectedItem?.effect && (
            <div className="space-y-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Effects:</p>
              <div className="space-y-2">
                {Object.entries(selectedItem.effect).map(([stat, value]) => (
                  <div key={stat} className="flex items-center gap-2 text-sm">
                    <span className="capitalize text-gray-700 dark:text-gray-300">{stat}:</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">+{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowPurchaseDialog(false)}
              className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmPurchase}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
            >
              Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ShopItemCardProps {
  item: BlobbiItem;
  canAfford: boolean;
  onPurchase: (item: BlobbiItem) => void;
  disabled?: boolean;
}

function ShopItemCard({ item, canAfford, onPurchase, disabled }: ShopItemCardProps) {
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg ${!canAfford || disabled ? 'opacity-60' : 'hover:scale-105'} bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
            <span className="text-xl">{item.icon}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
            <Coins className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{item.price}</span>
          </div>
        </div>
        <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">{item.name}</h4>
        {item.effect && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(item.effect).map(([stat, value]) => (
              <Badge key={stat} variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
                {stat} +{value}
              </Badge>
            ))}
          </div>
        )}
        <Button 
          size="sm" 
          className={`w-full rounded-lg transition-all duration-200 ${
            disabled 
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400' 
              : !canAfford 
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0'
          }`}
          disabled={!canAfford || disabled}
          onClick={() => onPurchase(item)}
        >
          {disabled ? 'Coming Soon' : !canAfford ? 'Not Enough Coins' : 'Buy'}
        </Button>
      </CardContent>
    </Card>
  );
}