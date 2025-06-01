import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Sparkles, Apple, Palette, Home, Heart, Droplets } from 'lucide-react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { SHOP_ITEMS } from '@/lib/shop-items';
import { useToast } from '@/hooks/useToast';
import { BlobbiItem } from '@/types/blobbi';

interface BlobbiStorageProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlobbiStorage({ isOpen, onClose }: BlobbiStorageProps) {
  const { blobbi } = useBlobbi();
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
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Storage
          </DialogTitle>
        </DialogHeader>

        {!blobbonautProfile ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const itemCount = getItemsByCategory(category.id).length;
                  return (
                    <TabsTrigger 
                      key={category.id} 
                      value={category.id}
                      className="flex items-center gap-1 text-xs"
                    >
                      <Icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{category.label}</span>
                      {itemCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                          {itemCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <ScrollArea className="h-[400px] mt-4">
                <TabsContent value={selectedCategory} className="mt-0">
                  {items.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">
                          No items in this category yet.
                          <br />
                          Visit the shop to purchase items!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {items.map((item) => (
                        <Card key={item.id} className="relative">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-sm flex items-center gap-1">
                                  {item.icon && <span className="text-lg">{item.icon}</span>}
                                  {item.name}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                </CardDescription>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                x{item.quantity}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {item.effect && (
                              <div className="text-xs text-muted-foreground">
                                {Object.entries(item.effect).map(([stat, value]) => (
                                  <div key={stat}>
                                    {stat}: {(value as number) > 0 ? '+' : ''}{String(value)}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {item.type === 'accessory' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => handleEquipAccessory(item.id)}
                              >
                                Equip
                              </Button>
                            )}
                            
                            {(item.type === 'food' || item.type === 'medicine' || item.type === 'toy' || item.type === 'hygiene') && (
                              <p className="text-xs text-muted-foreground text-center">
                                Use from main interface
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Total items: {blobbonautProfile.storage?.reduce((sum, item) => sum + item.quantity, 0) || 0}
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}