import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Coins, Palette, Sparkles, Heart, Utensils, Gamepad2 } from 'lucide-react';
import { BlobbiItem } from '@/types/blobbi';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useToast } from '@/hooks/useToast';

// Mock shop items - in a real implementation, these would come from Nostr events
const SHOP_ITEMS: BlobbiItem[] = [
  // Food items
  { id: 'food_apple', name: 'Apple', type: 'food', price: 10, effect: { hunger: 15 }, icon: '🍎' },
  { id: 'food_burger', name: 'Burger', type: 'food', price: 25, effect: { hunger: 40, happiness: 10 }, icon: '🍔' },
  { id: 'food_cake', name: 'Cake', type: 'food', price: 50, effect: { hunger: 20, happiness: 30 }, icon: '🎂' },
  
  // Toys
  { id: 'toy_ball', name: 'Ball', type: 'toy', price: 30, effect: { happiness: 25 }, icon: '⚽' },
  { id: 'toy_teddy', name: 'Teddy Bear', type: 'toy', price: 60, effect: { happiness: 40 }, icon: '🧸' },
  
  // Medicine
  { id: 'med_vitamins', name: 'Vitamins', type: 'medicine', price: 40, effect: { health: 20 }, icon: '💊' },
  { id: 'med_super', name: 'Super Medicine', type: 'medicine', price: 100, effect: { health: 50, energy: 20 }, icon: '💉' },
  
  // Accessories (for future customization)
  { id: 'acc_hat', name: 'Party Hat', type: 'accessory', price: 75, icon: '🎩' },
  { id: 'acc_glasses', name: 'Cool Glasses', type: 'accessory', price: 60, icon: '🕶️' },
  { id: 'acc_bow', name: 'Bow Tie', type: 'accessory', price: 50, icon: '🎀' },
];

interface BlobbiShopProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlobbiShop({ isOpen, onClose }: BlobbiShopProps) {
  const { blobbi, isOwner } = useBlobbi();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<BlobbiItem | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  
  if (!blobbi || !isOwner) return null;
  
  const handlePurchase = (item: BlobbiItem) => {
    if (blobbi.coins < item.price) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${item.price - blobbi.coins} more coins to buy ${item.name}.`,
        variant: "destructive",
      });
      return;
    }
    
    setSelectedItem(item);
    setShowPurchaseDialog(true);
  };
  
  const confirmPurchase = () => {
    if (!selectedItem) return;
    
    // In a real implementation, this would update the Blobbi's inventory via Nostr
    toast({
      title: "Purchase Successful!",
      description: `You bought ${selectedItem.name} for ${selectedItem.price} coins.`,
    });
    
    setShowPurchaseDialog(false);
    setSelectedItem(null);
  };
  
  const getItemsByType = (type: BlobbiItem['type']) => 
    SHOP_ITEMS.filter(item => item.type === type);
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Blobbi Shop</span>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-600" />
                <span className="font-semibold">{blobbi.coins}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="food" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="food">Food</TabsTrigger>
              <TabsTrigger value="toys">Toys</TabsTrigger>
              <TabsTrigger value="medicine">Medicine</TabsTrigger>
              <TabsTrigger value="accessories">Accessories</TabsTrigger>
            </TabsList>
            
            <TabsContent value="food" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {getItemsByType('food').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbi.coins >= item.price}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="toys" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {getItemsByType('toy').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbi.coins >= item.price}
                    onPurchase={handlePurchase}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="medicine" className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {getItemsByType('medicine').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbi.coins >= item.price}
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
                {getItemsByType('accessory').map(item => (
                  <ShopItemCard 
                    key={item.id} 
                    item={item} 
                    canAfford={blobbi.coins >= item.price}
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