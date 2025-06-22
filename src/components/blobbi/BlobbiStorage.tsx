import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Sparkles, Apple, Palette, Home, Heart, Droplets } from 'lucide-react';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { SHOP_ITEMS } from '@/lib/shop-items';
import { useToast } from '@/hooks/useToast';
import { BlobbiItem } from '@/types/blobbi';

interface BlobbiStorageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlobbiStorage({ isOpen, onClose }: BlobbiStorageProps) {
  const { blobbi } = useBlobbiWithFakeStatus();
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get items by category from Blobbanaut Profile storage
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
    { id: 'toy', label: 'Toys', icon: Sparkles },
    { id: 'medicine', label: 'Medicine', icon: Heart },
    { id: 'hygiene', label: 'Hygiene', icon: Droplets },
    { id: 'accessory', label: 'Accessories', icon: Palette },
  ];

  const items = getItemsByCategory(selectedCategory);

  const handleEquipAccessory = (itemId: string) => {
    // TODO: Implement equipping accessories
    toast({
      title: "Coming Soon!",
      description: "Equipping accessories will be available in a future update.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            Storage
          </DialogTitle>
        </DialogHeader>

        {!blobbonautProfile ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
              <div className="mb-6">
                <TabsList className="grid h-auto grid-cols-3 lg:grid-cols-6 w-full bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const itemCount = getItemsByCategory(category.id).length;
                    return (
                      <TabsTrigger 
                        key={category.id} 
                        value={category.id}
                        className="flex items-center gap-1 text-xs rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <Icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{category.label}</span>
                        {itemCount > 0 && (
                          <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {itemCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <ScrollArea className="h-[400px] mt-4">
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {items.map((item) => (
                        <Card key={item.id} className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl hover:shadow-lg transition-all duration-200">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                  {item.icon && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                                      <span className="text-lg">{item.icon}</span>
                                    </div>
                                  )}
                                  {item.name}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                </CardDescription>
                              </div>
                              <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                                x{item.quantity}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {item.effect && (
                              <div className="text-xs space-y-1">
                                {Object.entries(item.effect).map(([stat, value]) => (
                                  <div key={stat} className="flex justify-between text-gray-600 dark:text-gray-400">
                                    <span className="capitalize">{stat}:</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                      {(value as number) > 0 ? '+' : ''}{String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {item.type === 'accessory' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                onClick={() => handleEquipAccessory(item.id)}
                              >
                                Equip
                              </Button>
                            )}
                            
                            {(item.type === 'food' || item.type === 'medicine' || item.type === 'toy' || item.type === 'hygiene') && (
                              <div className="text-center p-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Use from main interface
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="flex justify-between items-center mt-6 pt-6 border-t border-purple-200/50 dark:border-purple-600/50">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total items: <span className="font-medium text-gray-900 dark:text-gray-100">
                  {blobbonautProfile.storage?.reduce((sum, item) => sum + item.quantity, 0) || 0}
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