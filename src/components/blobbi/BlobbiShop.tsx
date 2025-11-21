import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Coins, Palette, Sparkles, Heart, Utensils, Gamepad2, ShoppingBag } from 'lucide-react';
import { BlobbiItem } from '@/types/blobbi';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbonautProfileWithFakeInventory } from '@/hooks/useBlobbonautProfileWithFakeInventory';
import { useToast } from '@/hooks/useToast';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { SHOP_ITEMS, getShopItemsByType } from '@/lib/shop-items';
import { NotEnoughCoinsModal } from './NotEnoughCoinsModal';

interface BlobbiShopProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function BlobbiShop({ isOpen, onClose, defaultTab = 'food' }: BlobbiShopProps) {
  const { blobbi, isOwner } = useBlobbiWithFakeStatus();
  const { data: blobbonautProfile, purchaseItem } = useBlobbonautProfileWithFakeInventory();
  const { data: coinBalance } = useCoinBalance();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<BlobbiItem | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showNotEnoughCoinsModal, setShowNotEnoughCoinsModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{ item: BlobbiItem; quantity: number } | null>(null);

  if (!blobbi || !isOwner || !blobbonautProfile) return null;

  const handlePurchase = (item: BlobbiItem) => {
    if (blobbonautProfile.coins < item.price) {
      // Show the new insufficient coins modal instead of toast
      setPendingPurchase({ item, quantity: 1 });
      setShowNotEnoughCoinsModal(true);
      return;
    }

    setSelectedItem(item);
    setSelectedQuantity(1); // Reset quantity when selecting new item
    setShowPurchaseDialog(true);
  };

  // Calculate maximum affordable quantity
  const getMaxQuantity = (item: BlobbiItem): number => {
    if (!item) return 1;
    const availableCoins = coinBalance?.balance || blobbonautProfile?.coins || 0;
    const maxAffordable = Math.floor(availableCoins / item.price);
    return Math.min(maxAffordable, 999);
  };

  // Calculate total cost
  const getTotalCost = (): number => {
    if (!selectedItem) return 0;
    return selectedItem.price * selectedQuantity;
  };

  // Check if current selection is affordable
  const isCurrentSelectionAffordable = (): boolean => {
    const availableCoins = coinBalance?.balance || blobbonautProfile?.coins || 0;
    return getTotalCost() <= availableCoins;
  };

  const confirmPurchase = async () => {
    if (!selectedItem || !isCurrentSelectionAffordable()) return;

    try {
      // Purchase all items in a single transaction
      await purchaseItem({
        itemId: selectedItem.id,
        price: selectedItem.price,
        quantity: selectedQuantity
      });

      const totalCost = getTotalCost();
      const quantityText = selectedQuantity === 1 ? '' : ` (×${selectedQuantity})`;

      toast({
        title: "Purchase Successful!",
        description: `You bought ${selectedItem.name}${quantityText} for ${totalCost} coins.`,
      });

      setShowPurchaseDialog(false);
      setSelectedItem(null);
      setSelectedQuantity(1);
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: "Failed to complete the purchase. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRetryPurchase = () => {
    if (!pendingPurchase) return;

    const { item, quantity } = pendingPurchase;
    const totalCost = item.price * quantity;
    const availableCoins = coinBalance?.balance || blobbonautProfile?.coins || 0;

    // Check if we have enough coins now
    if (availableCoins >= totalCost) {
      setSelectedItem(item);
      setSelectedQuantity(quantity);
      setShowPurchaseDialog(true);
      setPendingPurchase(null);
    } else {
      // Still not enough coins, show modal again
      setShowNotEnoughCoinsModal(true);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center justify-between text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="truncate">Blobbi Shop</span>
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="font-semibold text-sm sm:text-base text-yellow-700 dark:text-yellow-300">{blobbonautProfile.coins}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue={defaultTab} className="w-full">
            <div className="mb-6">
              <TabsList className="h-auto flex flex-wrap justify-center gap-1 sm:grid sm:w-full sm:grid-cols-5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
                <TabsTrigger
                  value="food"
                  className="flex-1 min-w-0 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Food
                </TabsTrigger>
                <TabsTrigger
                  value="toys"
                  className="flex-1 min-w-0 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Toys
                </TabsTrigger>
                <TabsTrigger
                  value="medicine"
                  className="flex-1 min-w-0 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Medicine
                </TabsTrigger>
                <TabsTrigger
                  value="hygiene"
                  className="flex-1 min-w-0 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Hygiene
                </TabsTrigger>
                <TabsTrigger
                  value="accessories"
                  className="flex-1 min-w-0 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                >
                  Accessories
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[500px] mt-4">
              <TabsContent value="food" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              <TabsContent value="toys" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              <TabsContent value="medicine" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              <TabsContent value="hygiene" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              <TabsContent value="accessories" className="mt-0">
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl">
                        <Palette className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white text-xs font-bold">✨</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Accessories Coming Soon!
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                        Get ready to customize your Blobbi's appearance with amazing accessories and cosmetic items.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={(open) => {
        setShowPurchaseDialog(open);
        if (!open) {
          setSelectedQuantity(1); // Reset quantity when dialog closes
        }
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Confirm Purchase</DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Select quantity and confirm your purchase
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {/* Item Preview */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-600/50">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">{selectedItem.icon}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{selectedItem.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-bold text-yellow-700 dark:text-yellow-300">{selectedItem.price} coins each</span>
                  </div>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-600/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    Quantity:
                  </label>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Max: {getMaxQuantity(selectedItem)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Decrease Button */}
                  <button
                    onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                    disabled={selectedQuantity <= 1}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    −
                  </button>

                  {/* Quantity Input */}
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="1"
                      max={getMaxQuantity(selectedItem)}
                      value={selectedQuantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        const maxQty = getMaxQuantity(selectedItem);
                        setSelectedQuantity(Math.min(Math.max(1, value), maxQty));
                      }}
                      className="w-full h-10 px-3 text-center font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>

                  {/* Increase Button */}
                  <button
                    onClick={() => setSelectedQuantity(Math.min(getMaxQuantity(selectedItem), selectedQuantity + 1))}
                    disabled={selectedQuantity >= getMaxQuantity(selectedItem)}
                    className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total Cost */}
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-2xl border border-yellow-200/50 dark:border-yellow-600/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <span className="text-lg">💰</span>
                    Total Cost:
                  </span>
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                      {getTotalCost()}
                    </span>
                  </div>
                </div>

                {!isCurrentSelectionAffordable() && (
                  <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
                    <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
                      <span>⚠️</span>
                      Insufficient coins! You need {getTotalCost() - (coinBalance?.balance || blobbonautProfile?.coins || 0)} more coins.
                    </p>
                  </div>
                )}
              </div>

              {/* Effects */}
              {selectedItem.effect && Object.entries(selectedItem.effect).length > 0 && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-700/50">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Item Effects (per item):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedItem.effect).map(([stat, value]: [string, number]) => (
                      <div key={stat} className="flex items-center gap-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">{stat}</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-auto">+{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="pt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPurchaseDialog(false);
                setSelectedQuantity(1);
              }}
              className="flex-1 h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPurchase}
              disabled={!isCurrentSelectionAffordable()}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">💳</span>
                {isCurrentSelectionAffordable()
                  ? `Purchase ${selectedQuantity > 1 ? `(×${selectedQuantity})` : ''}`
                  : 'Insufficient Coins'
                }
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not Enough Coins Modal */}
      {showNotEnoughCoinsModal && blobbonautProfile && pendingPurchase && (
        <NotEnoughCoinsModal
          isOpen={showNotEnoughCoinsModal}
          onClose={() => {
            setShowNotEnoughCoinsModal(false);
            setPendingPurchase(null);
          }}
          onRetryPurchase={handleRetryPurchase}
          requiredCoins={pendingPurchase.item.price * pendingPurchase.quantity}
          currentCoins={blobbonautProfile.coins}
        />
      )}
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
    <Card className={`group transition-all duration-300 hover:shadow-xl ${
      !canAfford || disabled
        ? 'opacity-60 cursor-not-allowed'
        : 'hover:scale-[1.02] cursor-pointer'
    } bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden`}>
      <CardContent className="p-0">
        {/* Header with icon and price */}
        <div className="relative p-4 pb-3 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="flex items-start justify-between">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
              <span className="text-2xl filter drop-shadow-sm">{item.icon}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 rounded-full border border-yellow-200/50 dark:border-yellow-700/50 shadow-sm">
              <Coins className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">{item.price}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="font-semibold text-base mb-3 text-gray-900 dark:text-gray-100 line-clamp-1">{item.name}</h4>

          {/* Effects */}
          {item.effect && Object.entries(item.effect).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(item.effect).map(([stat, value]: [string, number]) => (
                <div key={stat} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg border border-emerald-200/50 dark:border-emerald-700/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {stat} +{value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Purchase Button */}
          <Button
            size="sm"
            className={`w-full h-10 rounded-xl font-semibold transition-all duration-300 ${
              disabled
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : !canAfford
                  ? 'bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 hover:from-red-200 hover:to-pink-200 dark:hover:from-red-900/40 dark:hover:to-pink-900/40'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl'
            }`}
            disabled={!canAfford || disabled}
            onClick={() => onPurchase(item)}
          >
            {disabled ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center">
                  <span className="text-xs">⏳</span>
                </div>
                Coming Soon
              </span>
            ) : !canAfford ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center">
                  <span className="text-xs text-white">!</span>
                </div>
                Not Enough Coins
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs">🛒</span>
                </div>
                Purchase
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
