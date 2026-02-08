import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Apple, Palette, Heart, Droplets, Gamepad2 } from 'lucide-react';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { SHOP_ITEMS } from '@/lib/shop-items';
import { useToast } from '@/hooks/useToast';
import { BlobbiItem } from '@/types/blobbi';
import { BlobbiItemCard } from './BlobbiItemCard';

interface BlobbiStorageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlobbiStorage({ isOpen, onClose }: BlobbiStorageProps) {
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get items by category from Blobbonaut Profile storage
  const getItemsByCategory = (category: string) => {
    if (!blobbonautProfile || !blobbonautProfile.storage) return [];

    const storageItems = blobbonautProfile.storage.map(storageItem => {
      const shopItem = SHOP_ITEMS.find(item => item.id === storageItem.itemId);
      return shopItem ? { ...shopItem, quantity: storageItem.quantity } : null;
    }).filter((item): item is BlobbiItem & { quantity: number } => item !== null);

    if (category === 'all') {
      return storageItems;
    }

    return storageItems.filter(item => item.type === category);
  };

  const categories = [
    { id: 'all', label: 'All Items', icon: Package },
    { id: 'food', label: 'Food', icon: Apple },
    { id: 'toy', label: 'Toys', icon: Gamepad2 },
    { id: 'medicine', label: 'Medicine', icon: Heart },
    { id: 'hygiene', label: 'Hygiene', icon: Droplets },
    { id: 'accessory', label: 'Accessories', icon: Palette },
  ];

  const items = getItemsByCategory(selectedCategory);

  const handleEquipAccessory = (item: BlobbiItem) => {
    // TODO: Implement equipping accessories
    toast({
      title: "Coming Soon!",
      description: "Equipping accessories will be available in a future update.",
    });
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPaddingRight = window.getComputedStyle(document.body).paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex flex-col w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] sm:max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 p-4 sm:p-6 gap-0 overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            Inventory
          </DialogTitle>
        </DialogHeader>

        {!blobbonautProfile ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <>
            {/* Fixed Tabs Section */}
            <div className="flex-shrink-0 mb-4 overflow-x-auto">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                <TabsList className="inline-flex lg:grid lg:w-full lg:grid-cols-6 h-auto bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1 rounded-xl border border-purple-200/50 dark:border-purple-600/50 gap-1 min-w-full">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const itemCount = getItemsByCategory(category.id).length;
                    return (
                      <TabsTrigger
                        key={category.id}
                        value={category.id}
                        className="flex items-center justify-center gap-1 text-xs min-w-[60px] lg:min-w-0 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 whitespace-nowrap px-3 py-2"
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden lg:inline truncate">{category.label}</span>
                        {itemCount > 0 && (
                          <span className="ml-1 h-5 px-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex-shrink-0 rounded-md flex items-center justify-center font-medium">
                            {itemCount}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                <TabsContent value={selectedCategory} className="mt-0">
                  {items.length === 0 ? (
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center mb-4">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-center font-medium mb-2">
                          No items in this category yet
                        </p>
                        <p className="text-sm text-muted-foreground text-center">
                          Visit the shop to purchase items!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                      {items.map((item) => (
                        <BlobbiItemCard
                          key={item.id}
                          item={item}
                          mode="inventory"
                          onAction={handleEquipAccessory}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Fixed Footer */}
            <div className="flex justify-between items-center pt-4 mt-4 border-t border-purple-200/50 dark:border-purple-600/50 flex-shrink-0">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total items: <span className="font-medium text-gray-900 dark:text-gray-100">
                  {blobbonautProfile?.storage?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={onClose}
                className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}