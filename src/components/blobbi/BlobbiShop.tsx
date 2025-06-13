import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Coins, Palette, Sparkles, Heart, Utensils, Gamepad2 } from 'lucide-react';
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Blobbi Shop</span>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold">{blobbonautProfile.coins}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue={defaultTab} className="w-full">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-2">
                <TabsList className="grid w-full grid-cols-5 bg-purple-50/50 dark:bg-purple-900/20">
                  <TabsTrigger 
                    value="food"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Food
                  </TabsTrigger>
                  <TabsTrigger 
                    value="toys"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Toys
                  </TabsTrigger>
                  <TabsTrigger 
                    value="medicine"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Medicine
                  </TabsTrigger>
                  <TabsTrigger 
                    value="hygiene"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Hygiene
                  </TabsTrigger>
                  <TabsTrigger 
                    value="accessories"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Accessories
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>
            
            <TabsContent value="food" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
            
            <TabsContent value="toys" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
            
            <TabsContent value="medicine" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
            
            <TabsContent value="hygiene" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
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
            
            <TabsContent value="accessories" className="space-y-2">
              <p className="text-sm text-muted-foreground text-center py-4">
                Accessories coming soon! Customize your Blobbi's appearance.
              </p>
              <div className="grid grid-cols-2 gap-2">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              Are you sure you want to buy {selectedItem?.name} for {selectedItem?.price} coins?
            </DialogDescription>
          </DialogHeader>
          {selectedItem?.effect && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Effects:</p>
              <div className="space-y-1">
                {Object.entries(selectedItem.effect).map(([stat, value]) => (
                  <div key={stat} className="flex items-center gap-2 text-sm">
                    <span className="capitalize">{stat}:</span>
                    <span className="text-green-600">+{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPurchase}>
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
    <Card className={!canAfford || disabled ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">{item.icon}</span>
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-yellow-600" />
            <span className="text-sm font-semibold">{item.price}</span>
          </div>
        </div>
        <h4 className="font-medium text-sm mb-1">{item.name}</h4>
        {item.effect && (
          <div className="flex gap-2 mb-2">
            {Object.entries(item.effect).map(([stat, value]) => (
              <Badge key={stat} variant="secondary" className="text-xs">
                {stat} +{value}
              </Badge>
            ))}
          </div>
        )}
        <Button 
          size="sm" 
          className="w-full"
          disabled={!canAfford || disabled}
          onClick={() => onPurchase(item)}
        >
          {disabled ? 'Coming Soon' : !canAfford ? 'Not Enough Coins' : 'Buy'}
        </Button>
      </CardContent>
    </Card>
  );
}